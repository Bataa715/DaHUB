import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  RunReportDto,
} from "./dto/excel-report.dto";
import { randomUUID } from "crypto";
import * as http from "http";

export interface FilterDef {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  pythonCode: string;
  dateMode: "none" | "single" | "range";
  color: string;
  filters: string; // JSON string of FilterDef[]
  stagingTable: string;
  stagingInsertSql: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ExcelReportService implements OnModuleInit {
  private readonly logger = new Logger(ExcelReportService.name);

  private static parseCHHostPort(): { host: string; port: string } {
    const raw = process.env.CLICKHOUSE_HOST ?? "localhost";
    try {
      const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
      return {
        host: url.hostname,
        port: url.port || process.env.CLICKHOUSE_PORT || "8123",
      };
    } catch {
      // Not a valid URL — use as bare hostname
      return {
        host: raw.replace(/^https?:\/\//i, "").split(":")[0],
        port: process.env.CLICKHOUSE_PORT ?? "8123",
      };
    }
  }

  constructor(private clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTableExists();
    await this.ensurePermissionTables();
  }

  // ── Permission & Log tables ───────────────────────────────────────────────

  private async ensurePermissionTables() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS excel_report_permissions (
          userId      String,
          templateId  String,
          grantedBy   String DEFAULT '',
          grantedAt   DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(grantedAt)
          ORDER BY (userId, templateId)
      `);
    } catch (e) {
      this.logger.error("Failed to ensure excel_report_permissions table:", e);
    }
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS excel_report_download_logs (
          id           String,
          userId       String,
          userName     String DEFAULT '',
          templateId   String,
          templateName String DEFAULT '',
          downloadedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
          ORDER BY (downloadedAt, userId)
      `);
    } catch (e) {
      this.logger.error("Failed to ensure excel_report_download_logs table:", e);
    }
  }

  // ── Permission CRUD ───────────────────────────────────────────────────────

  async grantPermission(userId: string, templateId: string, grantedBy: string) {
    await this.clickhouse.insert("excel_report_permissions", [
      { userId, templateId, grantedBy, grantedAt: nowCH() },
    ]);
  }

  async revokePermission(userId: string, templateId: string) {
    await this.clickhouse.exec(
      `ALTER TABLE excel_report_permissions DELETE WHERE userId = {uid:String} AND templateId = {tid:String}`,
      { uid: userId, tid: templateId },
    );
  }

  /** All (userId, templateId) pairs that currently have permission */
  async getAllPermissions(): Promise<{ userId: string; templateId: string; grantedBy: string; grantedAt: string }[]> {
    // LIMIT 1 BY deduplicates per (userId, templateId) — no GROUP BY, no FINAL, no nested aggregates
    return this.clickhouse.query(
      `SELECT userId, templateId, grantedBy, grantedAt
       FROM excel_report_permissions
       ORDER BY grantedAt DESC
       LIMIT 1 BY userId, templateId`,
    );
  }

  /** Template IDs that a specific user has access to */
  async getUserPermittedTemplateIds(userId: string): Promise<string[]> {
    const rows = await this.clickhouse.query<{ templateId: string }>(
      `SELECT DISTINCT templateId
       FROM excel_report_permissions
       WHERE userId = {uid:String}
       ORDER BY grantedAt DESC
       LIMIT 1 BY templateId`,
      { uid: userId },
    );
    return rows.map((r) => r.templateId);
  }

  async hasPermission(userId: string, templateId: string): Promise<boolean> {
    // Single query: count distinct users with permissions for this template,
    // and whether this specific user is among them.
    const rows = await this.clickhouse.query<{ total: number; hasUser: number }>(
      `SELECT
         countDistinct(userId) AS total,
         countDistinctIf(userId, userId = {uid:String}) AS hasUser
       FROM (
         SELECT userId FROM excel_report_permissions
         WHERE templateId = {tid:String}
         ORDER BY grantedAt DESC
         LIMIT 1 BY userId
       )`,
      { uid: userId, tid: templateId },
    );
    const hasUser = Number(rows[0]?.hasUser ?? 0);
    return hasUser > 0;
  }

  // ── Download log ──────────────────────────────────────────────────────────

  async logDownload(userId: string, userName: string, templateId: string, templateName: string) {
    try {
      await this.clickhouse.insert("excel_report_download_logs", [
        { id: randomUUID(), userId, userName, templateId, templateName, downloadedAt: nowCH() },
      ]);
    } catch (e) {
      this.logger.warn("Failed to log download:", e);
    }
  }

  async getDownloadLogs(limit = 200): Promise<{
    id: string; userId: string; userName: string;
    templateId: string; templateName: string; downloadedAt: string;
  }[]> {
    return this.clickhouse.query(
      `SELECT id, userId, userName, templateId, templateName, downloadedAt
       FROM excel_report_download_logs
       ORDER BY downloadedAt DESC
       LIMIT {limit:UInt32}`,
      { limit },
    );
  }

  private async ensureTableExists() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS excel_report_templates (
          id        String,
          name      String,
          description String DEFAULT '',
          pythonCode  String,
          dateMode    String DEFAULT 'range',
          color       String DEFAULT 'from-blue-500 to-cyan-500',
          filters     String DEFAULT '[]',
          isActive    UInt8  DEFAULT 1,
          seq         UInt64,
          createdAt   DateTime DEFAULT now(),
          updatedAt   String DEFAULT ''
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
    } catch (e) {
      this.logger.error("Failed to ensure excel_report_templates table:", e);
    }
    // Column migrations — each ALTER is idempotent
    const migrations = [
      `ALTER TABLE excel_report_templates ADD COLUMN IF NOT EXISTS filters         String DEFAULT '[]'`,
      `ALTER TABLE excel_report_templates ADD COLUMN IF NOT EXISTS stagingTable    String DEFAULT ''`,
      `ALTER TABLE excel_report_templates ADD COLUMN IF NOT EXISTS stagingInsertSql String DEFAULT ''`,
    ];
    for (const sql of migrations) {
      try {
        await this.clickhouse.exec(sql);
      } catch {
        /* already exists */
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getLatestTemplates(
    activeOnly = false,
  ): Promise<ReportTemplate[]> {
    const where = activeOnly ? "WHERE isActive = 1" : "";
    const rows = await this.clickhouse.query<ReportTemplate>(
      `SELECT *
       FROM (
         SELECT
           id,
           argMax(name, seq)             AS name,
           argMax(description, seq)      AS description,
           argMax(pythonCode, seq)       AS pythonCode,
           argMax(dateMode, seq)         AS dateMode,
           argMax(color, seq)            AS color,
           argMax(filters, seq)          AS filters,
           argMax(isActive, seq)         AS isActive,
           argMax(stagingTable, seq)     AS stagingTable,
           argMax(stagingInsertSql, seq) AS stagingInsertSql,
           argMax(updatedAt, seq)        AS updatedAt,
           min(createdAt)               AS createdAt
         FROM excel_report_templates
         GROUP BY id
       )
       ${where}
       ORDER BY createdAt ASC`,
    );
    return rows || [];
  }

  private async getTemplateById(id: string): Promise<ReportTemplate> {
    const rows = await this.clickhouse.query<ReportTemplate>(
      `SELECT
         id,
         argMax(name, seq)             AS name,
         argMax(description, seq)      AS description,
         argMax(pythonCode, seq)       AS pythonCode,
         argMax(dateMode, seq)         AS dateMode,
         argMax(color, seq)            AS color,
         argMax(filters, seq)          AS filters,
         argMax(isActive, seq)         AS isActive,
         argMax(stagingTable, seq)     AS stagingTable,
         argMax(stagingInsertSql, seq) AS stagingInsertSql,
         argMax(updatedAt, seq)        AS updatedAt,
         min(createdAt)               AS createdAt
       FROM excel_report_templates
       WHERE id = {id:String}
       GROUP BY id`,
      { id },
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException("Загвар олдсонгүй");
    }
    return rows[0];
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async getAllTemplates(): Promise<ReportTemplate[]> {
    return this.getLatestTemplates(false);
  }

  async createTemplate(dto: CreateReportTemplateDto): Promise<ReportTemplate> {
    const id = randomUUID();
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("excel_report_templates", [
      {
        id,
        name: dto.name,
        description: dto.description ?? "",
        pythonCode: dto.pythonCode,
        dateMode: dto.dateMode,
        color: dto.color ?? "from-blue-500 to-cyan-500",
        filters: dto.filters ?? "[]",
        stagingTable: dto.stagingTable ?? "",
        stagingInsertSql: dto.stagingInsertSql ?? "",
        isActive: 1,
        seq,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    return this.getTemplateById(id);
  }

  async updateTemplate(
    id: string,
    dto: UpdateReportTemplateDto,
  ): Promise<ReportTemplate> {
    const existing = await this.getTemplateById(id);
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("excel_report_templates", [
      {
        id,
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        pythonCode: dto.pythonCode ?? existing.pythonCode,
        dateMode: dto.dateMode ?? existing.dateMode,
        color: dto.color ?? existing.color,
        filters: dto.filters ?? existing.filters,
        stagingTable: dto.stagingTable ?? existing.stagingTable ?? "",
        stagingInsertSql:
          dto.stagingInsertSql ?? existing.stagingInsertSql ?? "",
        isActive: existing.isActive,
        seq,
        createdAt: existing.createdAt,
        updatedAt: now,
      },
    ]);
    return this.getTemplateById(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<ReportTemplate> {
    const existing = await this.getTemplateById(id);
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("excel_report_templates", [
      {
        id,
        name: existing.name,
        description: existing.description,
        pythonCode: existing.pythonCode,
        dateMode: existing.dateMode,
        color: existing.color,
        filters: existing.filters,
        stagingTable: existing.stagingTable ?? "",
        stagingInsertSql: existing.stagingInsertSql ?? "",
        isActive: isActive ? 1 : 0,
        seq,
        createdAt: existing.createdAt,
        updatedAt: now,
      },
    ]);
    return this.getTemplateById(id);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.getTemplateById(id);
    await this.clickhouse.exec(
      `ALTER TABLE excel_report_templates DELETE WHERE id = {id:String}`,
      { id },
    );
  }

  // ── User: list active templates ────────────────────────────────────────────

  async getActiveTemplates(userId?: string, isAdmin = false): Promise<
    (Omit<ReportTemplate, "pythonCode" | "isActive"> & {
      isSqlMode: boolean;
      isStaging: boolean;
      sqlCode?: string;
    })[]
  > {
    const all = await this.getLatestTemplates(true);
    let filtered = all;
    // Non-admin: filter by permission only for templates that have *any* permission row.
    // Templates with no permission rows are treated as public (default allow).
    // If permissions table query fails, fall back to showing all templates (don't block user).
    if (!isAdmin && userId) {
      try {
        const allPerms = await this.getAllPermissions();
        const userIds = new Set(
          allPerms.filter((p) => p.userId === userId).map((p) => p.templateId),
        );
        // No explicit permission row → no access (not public)
        filtered = all.filter((t) => userIds.has(t.id));
      } catch (e) {
        this.logger.warn(`Permission filter failed, showing all templates: ${(e as any)?.message ?? e}`);
      }
    }
    return filtered.map(({ pythonCode, isActive: _a, ...rest }) => ({
      ...rest,
      isSqlMode: pythonCode.startsWith("# __SQL_MODE__") || !!rest.stagingTable,
      isStaging: !!rest.stagingTable,
      sqlCode: rest.stagingTable
        ? rest.stagingInsertSql
        : (ExcelReportService.extractSqlFromPythonCode(pythonCode) ??
          undefined),
    }));
  }

  // ── Background INSERT (staging mode) — called separately from CSV download ─

  async runInsertBackground(dto: RunReportDto): Promise<void> {
    const template = await this.getTemplateById(dto.templateId);
    if (!template.isActive || !template.stagingTable || !template.stagingInsertSql) return;

    const filterVals = dto.filters ?? {};
    let insertSql = template.stagingInsertSql.replace(
      /\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g,
      (_, k, c) => (filterVals[k] ? c : ""),
    );
    insertSql = insertSql
      .replace(/\{start_date\}/g, dto.startDate ?? "")
      .replace(/\{end_date\}/g, dto.endDate ?? dto.startDate ?? "");
    for (const [k, v] of Object.entries(filterVals))
      insertSql = insertSql.replace(new RegExp(`\\{${k}\\}`, "g"), v);

    // Fire and forget — intentionally NOT awaited by the controller
    this.httpQueryText(insertSql.trim()).catch((err: Error) => {
      this.logger.error(`Staging INSERT алдаа [${template.stagingTable}]: ${err?.message ?? err}`);
    });
  }

  // ── Preview: run SQL-mode report against ClickHouse directly, return JSON ─

  async previewReport(
    dto: RunReportDto,
  ): Promise<{ columns: string[]; rows: any[][]; totalCount: number }> {
    const template = await this.getTemplateById(dto.templateId);

    // ── STAGING MODE PREVIEW ──────────────────────────────────────────────────
    // Run only the SELECT part of INSERT...SELECT — no INSERT privilege needed
    if (template.stagingTable && template.stagingInsertSql) {
      const filterVals: Record<string, string> = dto.filters ?? {};
      let insertSql = template.stagingInsertSql.replace(
        /\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g,
        (_, k, c) => (filterVals[k] ? c : ""),
      );
      insertSql = insertSql
        .replace(/\{start_date\}/g, dto.startDate ?? "")
        .replace(/\{end_date\}/g, dto.endDate ?? dto.startDate ?? "");
      for (const [k, v] of Object.entries(filterVals))
        insertSql = insertSql.replace(new RegExp(`\\{${k}\\}`, "g"), v);

      // Extract just the SELECT portion from INSERT INTO ... SELECT ...
      const selectMatch = insertSql.match(/\bSELECT\b[\s\S]*/i);
      if (!selectMatch) {
        throw new BadRequestException(
          "Staging SQL-д SELECT олдсонгүй. INSERT INTO ... SELECT ... хэлбэртэй байх шаардлагатай.",
        );
      }

      // Extract just the SELECT portion; strip any trailing FORMAT clause
      const selectSql = selectMatch[0].trim().replace(/\s+FORMAT\s+\w+\s*$/i, "");
      const [tsv, countText] = await Promise.all([
        this.httpQueryText(
          `SELECT * FROM (\n${selectSql}\n) LIMIT 50 FORMAT TSVWithNames`,
        ),
        this.httpQueryText(
          `SELECT count() FROM (\n${selectSql}\n) FORMAT TSV`,
        ).catch(() => "0"),
      ]);
      const totalCount = parseInt(countText.trim(), 10) || 0;

      const lines = tsv.split("\n");
      const columns = lines[0] ? lines[0].split("\t") : [];
      const rows: any[][] = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i]) rows.push(lines[i].split("\t"));
      }
      return { columns, rows, totalCount };
    }

    // ── NORMAL SQL MODE ──────────────────────────────────────────────────────
    const sql = ExcelReportService.extractSqlFromPythonCode(
      template.pythonCode,
    );
    if (!sql) {
      throw new BadRequestException(
        "Энэ тайлан preview дэмжихгүй (SQL горим биш). Зөвхөн SQL горимын тайлан урьдчилан харагдана.",
      );
    }

    // Substitute date placeholders and filter values
    const start = dto.startDate ?? "";
    const end = dto.endDate ?? dto.startDate ?? "";
    const filterVals: Record<string, string> = dto.filters ?? {};
    let resolved = sql.replace(
      /\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g,
      (_, name, content) => (filterVals[name] ? content : ""),
    );
    resolved = resolved
      .replace(/\{start_date\}/g, start)
      .replace(/\{end_date\}/g, end);
    for (const [k, v] of Object.entries(filterVals)) {
      resolved = resolved.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }

    const previewSql = `SELECT * FROM (\n${resolved}\n) LIMIT 50 FORMAT TSVWithNames`;
    const countSql = `SELECT count() FROM (\n${resolved}\n) FORMAT TSV`;

    const [tsv, countText] = await Promise.all([
      this.httpQueryText(previewSql),
      this.httpQueryText(countSql).catch(() => "0"),
    ]);
    const totalCount = parseInt(countText.trim(), 10) || 0;

    // Parse TSVWithNames: first line = headers, remaining = data rows
    const lines = tsv.split("\n");
    const columns = lines[0] ? lines[0].split("\t") : [];
    const rows: any[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      rows.push(line.split("\t"));
    }

    return { columns, rows, totalCount };
  }

  /** Extract SQL string from SQL-mode pythonCode, or null if not SQL mode. */
  private static extractSqlFromPythonCode(pythonCode: string): string | null {
    if (!pythonCode.startsWith("# __SQL_MODE__")) return null;
    const m = pythonCode.match(/^SQL = r'''\n([\s\S]*?)\n'''\.strip\(\)/m);
    if (m) return m[1].replace(/''\\'''/g, "'''");
    return null;
  }

  // ── SQL-mode → CSV streaming directly from ClickHouse ───────────────────

  /** Buffered HTTP query — for small metadata lookups (COUNT, LIMIT 1 sample). */
  private async httpQueryText(query: string): Promise<string> {
    const { host, port } = ExcelReportService.parseCHHostPort();
    const urlPath =
      `/?user=${encodeURIComponent(process.env.CLICKHOUSE_USER ?? "default")}` +
      `&password=${encodeURIComponent(process.env.CLICKHOUSE_PASSWORD ?? "")}` +
      `&database=${encodeURIComponent(process.env.CLICKHOUSE_DATABASE ?? "audit_db")}` +
      `&format_tsv_null_representation=NULL&format_csv_null_representation=NULL`;
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: host,
          port: Number(port) || 8123,
          path: urlPath,
          method: "POST",
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf-8");
            if ((res.statusCode ?? 0) !== 200)
              reject(new Error(text.slice(0, 200)));
            else resolve(text);
          });
        },
      );
      req.on("error", reject);
      req.write(Buffer.from(query, "utf-8"));
      req.end();
    });
  }

  /**
   * Open a streaming HTTP connection to ClickHouse and resolve with the
   * IncomingMessage (readable stream) on 200, or reject with a descriptive
   * error on any other status code.  The caller is responsible for piping
   * or consuming the returned stream.
   */
  private streamFromClickHouse(
    query: string,
  ): Promise<import("http").IncomingMessage> {
    const { host, port } = ExcelReportService.parseCHHostPort();
    const urlPath =
      `/?user=${encodeURIComponent(process.env.CLICKHOUSE_USER ?? "default")}` +
      `&password=${encodeURIComponent(process.env.CLICKHOUSE_PASSWORD ?? "")}` +
      `&database=${encodeURIComponent(process.env.CLICKHOUSE_DATABASE ?? "audit_db")}` +
      `&format_tsv_null_representation=NULL&format_csv_null_representation=NULL`;

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: host,
          port: Number(port) || 8123,
          path: urlPath,
          method: "POST",
        },
        (chRes) => {
          if ((chRes.statusCode ?? 0) !== 200) {
            // Drain the error body before rejecting
            const errChunks: Buffer[] = [];
            chRes.on("data", (c: Buffer) => errChunks.push(c));
            chRes.on("end", () =>
              reject(
                new InternalServerErrorException(
                  "ClickHouse алдаа: " +
                    Buffer.concat(errChunks).toString("utf-8").slice(0, 300),
                ),
              ),
            );
          } else {
            resolve(chRes); // caller owns the stream
          }
        },
      );
      req.on("error", (e: Error) =>
        reject(
          new InternalServerErrorException(
            "ClickHouse холболт алдаа: " + e.message,
          ),
        ),
      );
      req.write(Buffer.from(query, "utf-8"));
      req.end();
    });
  }

  /** Validate dto, build query, return a live stream + fileName + estimated byte count for Content-Length. */
  async runReportCsv(
    dto: RunReportDto,
    caller?: { userId: string; userName: string; isAdmin: boolean },
  ): Promise<{
    stream: import("http").IncomingMessage;
    fileName: string;
    estimatedBytes: number;
    onDone?: () => void;
  }> {
    const template = await this.getTemplateById(dto.templateId);
    if (!template.isActive)
      throw new BadRequestException("Энэ тайлан идэвхгүй байна");

    // Permission check — admins bypass
    if (caller && !caller.isAdmin) {
      const allowed = await this.hasPermission(caller.userId, dto.templateId);
      if (!allowed)
        throw new BadRequestException("Энэ тайлан татах эрх байхгүй байна");
    }

    if (template.dateMode === "range" && (!dto.startDate || !dto.endDate))
      throw new BadRequestException("Эхлэх болон дуусах огноо шаардлагатай");
    if (template.dateMode === "single" && !dto.startDate)
      throw new BadRequestException("Огноо шаардлагатай");

    // Log download (fire-and-forget)
    if (caller) {
      this.logDownload(caller.userId, caller.userName, dto.templateId, template.name);
    }

    const date = new Date().toISOString().slice(0, 10);

    // ── STAGING MODE ──────────────────────────────────────────────────────────
    // INSERT is fired separately via POST /run-insert (called in parallel by frontend).
    // Here we ONLY stream the SELECT portion directly from the source tables.
    if (template.stagingTable && template.stagingInsertSql) {
      const filterVals = dto.filters ?? {};
      let insertSql = template.stagingInsertSql.replace(
        /\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g,
        (_, k, c) => (filterVals[k] ? c : ""),
      );
      insertSql = insertSql
        .replace(/\{start_date\}/g, dto.startDate ?? "")
        .replace(/\{end_date\}/g, dto.endDate ?? dto.startDate ?? "");
      for (const [k, v] of Object.entries(filterVals))
        insertSql = insertSql.replace(new RegExp(`\\{${k}\\}`, "g"), v);

      // Extract SELECT portion (reads from source tables, not the staging table)
      const selectMatch = insertSql.match(/\bSELECT\b[\s\S]*/i);
      if (!selectMatch) {
        throw new BadRequestException(
          "Staging SQL-д SELECT олдсонгүй. INSERT INTO ... SELECT ... хэлбэртэй байх шаардлагатай.",
        );
      }
      const selectSql = selectMatch[0].trim().replace(/\s+FORMAT\s+\w+\s*$/i, "");

      const stream = await this.streamFromClickHouse(
        `${selectSql} FORMAT CSVWithNames`,
      );

      return {
        stream,
        fileName: `${template.name}_${date}.csv`,
        estimatedBytes: 0,
      };
    }

    // ── NORMAL SQL MODE ───────────────────────────────────────────────────────
    const sql = ExcelReportService.extractSqlFromPythonCode(
      template.pythonCode,
    );
    if (!sql)
      throw new BadRequestException("Зөвхөн SQL горимын тайлан дэмжигдэнэ.");

    // Resolve placeholders once for both the CSV query and the size estimate
    const filterVals = dto.filters ?? {};
    let resolved = sql.replace(/\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g, (_, k, c) =>
      filterVals[k] ? c : "",
    );
    resolved = resolved
      .replace(/\{start_date\}/g, dto.startDate ?? "")
      .replace(/\{end_date\}/g, dto.endDate ?? dto.startDate ?? "");
    for (const [k, v] of Object.entries(filterVals))
      resolved = resolved.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    resolved = resolved.trim();

    const csvQuery = resolved + " FORMAT CSVWithNames";

    const stream = await this.streamFromClickHouse(csvQuery);
    return { stream, fileName: `${template.name}_${date}.csv`, estimatedBytes: 0 };
  }

}
