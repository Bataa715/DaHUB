import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { ClickHouseService } from "../clickhouse/clickhouse.service";

@Controller("admin-db")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminDbController {
  private readonly logger = new Logger(AdminDbController.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  /** GET /admin-db/tables — audit_db доторх хүснэгтүүдийн жагсаалт */
  @Get("tables")
  async getTables() {
    return this.clickhouse.query<any>(
      `SELECT database, name, engine, total_rows
       FROM system.tables
       WHERE database = 'audit_db'
       ORDER BY name`,
    );
  }

  /** POST /admin-db/execute — дурын SQL ажиллуулах (зөвхөн superadmin) */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @Post("execute")
  async execute(@Body() body: { sql: string }, @Request() req: any) {
    const sql = (body?.sql ?? "").trim();

    if (!sql) throw new BadRequestException("SQL байхгүй байна");
    if (sql.length > 20000)
      throw new BadRequestException(
        "SQL хэт урт байна (дээд тал 20 000 тэмдэгт)",
      );

    this.logger.warn(
      `[ADMIN-DB] superadmin '${req.user?.userId}' executed: ${sql.slice(0, 200)}`,
    );

    // Strip block comments (/* ... */) and line comments (-- ...) before
    // classifying the query to prevent comment-injection bypass like:
    //   /* SELECT */ DROP TABLE users
    const stripped = sql
      .replace(/\/\*[\s\S]*?\*\//g, " ") // remove /* ... */
      .replace(/--[^\n]*/g, " ") // remove -- to end of line
      .trimStart();

    const isReadQuery = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i.test(
      stripped,
    );

    // A-2: Reject multi-statement queries — prevents "SELECT 1; DROP TABLE users"
    // (ClickHouse usually ignores the second statement, but we fail-safe here)
    if (stripped.includes(";")) {
      throw new BadRequestException("SQL нэг нэг заавар агуулах боломжгүй (;)");
    }

    if (isReadQuery) {
      const result = await this.clickhouse.getClient().query({ query: sql });
      const json: any = await result.json();
      return {
        queryType: "SELECT" as const,
        columns: (json.meta ?? []) as { name: string; type: string }[],
        data: (json.data ?? []) as Record<string, unknown>[],
        rows: json.rows ?? json.data?.length ?? 0,
        statistics: json.statistics ?? null,
      };
    } else {
      // C-2: Block irreversible/destructive DDL even for superadmin.
      // Compromised accounts and fat-finger mistakes are both real risks.
      const BLOCKED_PATTERNS = [
        /\bDROP\s+(?:DATABASE|TABLE|USER)\b/i,
        /\bTRUNCATE\s+TABLE\b/i,
        /\bCREATE\s+USER\b/i,
        /\bGRANT\b\s+/i,
        /\bREVOKE\b\s+/i,
      ];
      const blockedBy = BLOCKED_PATTERNS.find((p) => p.test(stripped));
      if (blockedBy) {
        this.logger.error(
          `[ADMIN-DB] BLOCKED dangerous DDL from superadmin '${req.user?.userId}': ${sql.slice(0, 200)}`,
        );
        throw new BadRequestException(
          "Энэ SQL команд хориглогдсон байна (DROP, TRUNCATE, CREATE USER, GRANT, REVOKE). " +
            "Хэрэв зайлшгүй шаардлагатай бол серверийн консолоор гүйцэтгэнэ үү.",
        );
      }

      const start = Date.now();
      await this.clickhouse.exec(sql);
      return {
        queryType: "COMMAND" as const,
        message: "OK",
        statistics: { elapsed: (Date.now() - start) / 1000 },
      };
    }
  }
}
