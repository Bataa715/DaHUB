import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { SaveWeeklyReportDto } from "./dto/weekly-report.dto";

export type WeeklyRole = "audit" | "daa" | "director" | "none";

interface UserPayload {
  id: string;
  name?: string;
  departmentId?: string;
  department?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  allowedTools?: string[];
}

/** 4 audit/data-analyst role-ийн нэр. Director нь зөвхөн харах эрхтэй. */
const TOOL = {
  AUDIT: "weekly_report_audit",
  DAA: "weekly_report_daa",
  DIRECTOR: "weekly_report_director",
};

@Injectable()
export class WeeklyReportService implements OnModuleInit {
  private readonly logger = new Logger(WeeklyReportService.name);
  constructor(private clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS weekly_reports (
        id              String,
        userId          String,
        userName        String DEFAULT '',
        departmentId    String DEFAULT '',
        departmentName  String DEFAULT '',
        role            String DEFAULT '',
        year            UInt16,
        weekNumber      UInt8,
        weekStart       Date,
        weekEnd         Date,
        status          String DEFAULT 'draft',
        sectionsJson    String DEFAULT '{}',
        submittedAt     DateTime DEFAULT '1970-01-01 00:00:00',
        createdAt       DateTime DEFAULT now(),
        updatedAt       DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updatedAt)
      ORDER BY (userId, year, weekNumber)
    `);
  }

  // ── Role detection ────────────────────────────────────────────────────────
  resolveRole(user: UserPayload): WeeklyRole {
    const tools = user.allowedTools ?? [];
    if (user.isAdmin || user.isSuperAdmin || tools.includes(TOOL.DIRECTOR))
      return "director";
    if (tools.includes(TOOL.DAA)) return "daa";
    if (tools.includes(TOOL.AUDIT)) return "audit";
    return "none";
  }

  getRole(user: UserPayload) {
    const role = this.resolveRole(user);
    return {
      role,
      departmentId: user.departmentId ?? "",
      departmentName: user.department ?? "",
      canWrite: role === "audit" || role === "daa",
      canViewAll: role === "director",
    };
  }

  // ── Save / submit ─────────────────────────────────────────────────────────
  async save(user: UserPayload, dto: SaveWeeklyReportDto) {
    const role = this.resolveRole(user);
    if (role !== "audit" && role !== "daa") {
      throw new ForbiddenException("Долоо хоногийн тайлан бичих эрх байхгүй");
    }
    if (dto.role !== role) {
      // FE/BE role зөрчилдвөл backend role-г үнэн гэж үзнэ
      this.logger.warn(
        `role mismatch user=${user.id} fe=${dto.role} be=${role} — using ${role}`,
      );
    }

    // Existing row хайж id-ийг дахин ашиглана (ReplacingMergeTree dedup).
    const existing = await this.clickhouse.query<{ id: string; status: string }>(
      `SELECT id, status FROM weekly_reports FINAL
       WHERE userId = {uid:String} AND year = {y:UInt16} AND weekNumber = {w:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { uid: user.id, y: dto.year, w: dto.weekNumber },
    );

    const id = existing[0]?.id || randomUUID();
    const now = nowCH();
    const status = dto.status === "submitted" ? "submitted" : "draft";
    const submittedAt =
      status === "submitted" ? now : "1970-01-01 00:00:00";

    await this.clickhouse.insert("weekly_reports", [
      {
        id,
        userId: user.id,
        userName: user.name ?? "",
        departmentId: user.departmentId ?? "",
        departmentName: user.department ?? "",
        role,
        year: dto.year,
        weekNumber: dto.weekNumber,
        weekStart: dto.weekStart,
        weekEnd: dto.weekEnd,
        status,
        sectionsJson: JSON.stringify(dto.sections ?? {}),
        submittedAt,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    return { id, status, savedAt: now };
  }

  async submit(user: UserPayload, year: number, weekNumber: number) {
    await this.clickhouse.exec(
      `ALTER TABLE weekly_reports
       UPDATE status = 'submitted', submittedAt = {now:String}, updatedAt = {now:String}
       WHERE userId = {uid:String} AND year = {y:UInt16} AND weekNumber = {w:UInt8}`,
      { now: nowCH(), uid: user.id, y: year, w: weekNumber },
    );
    return { success: true };
  }

  // ── Read own ──────────────────────────────────────────────────────────────
  async getMine(user: UserPayload, year: number, weekNumber: number) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM weekly_reports FINAL
       WHERE userId = {uid:String} AND year = {y:UInt16} AND weekNumber = {w:UInt8}
       LIMIT 1`,
      { uid: user.id, y: year, w: weekNumber },
    );
    if (!rows[0]) return null;
    return this.format(rows[0]);
  }

  async listMine(user: UserPayload, limit = 30) {
    const rows = await this.clickhouse.query<any>(
      `SELECT id, year, weekNumber, weekStart, weekEnd, status, submittedAt, updatedAt
       FROM weekly_reports FINAL
       WHERE userId = {uid:String}
       ORDER BY year DESC, weekNumber DESC
       LIMIT {lim:UInt32}`,
      { uid: user.id, lim: limit },
    );
    return rows;
  }

  // ── Director consolidated view ────────────────────────────────────────────
  async getConsolidated(
    user: UserPayload,
    year: number,
    weekNumber: number,
  ) {
    const role = this.resolveRole(user);
    if (role !== "director") {
      throw new ForbiddenException("Зөвхөн газрын захирал харах эрхтэй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM weekly_reports FINAL
       WHERE year = {y:UInt16} AND weekNumber = {w:UInt8} AND status = 'submitted'
       ORDER BY departmentName ASC, userName ASC`,
      { y: year, w: weekNumber },
    );
    return rows.map((r) => this.format(r));
  }

  /** Бүх ирүүлсэн долоо хоногуудын жагсаалт (захирлын dropdown-д). */
  async listSubmittedWeeks(user: UserPayload, limit = 52) {
    const role = this.resolveRole(user);
    if (role !== "director") {
      throw new ForbiddenException("Зөвхөн газрын захирал харах эрхтэй");
    }
    const rows = await this.clickhouse.query<{
      year: number;
      weekNumber: number;
      weekStart: string;
      weekEnd: string;
      cnt: number;
    }>(
      `SELECT year, weekNumber, min(weekStart) AS weekStart, max(weekEnd) AS weekEnd, count() AS cnt
       FROM weekly_reports FINAL
       WHERE status = 'submitted'
       GROUP BY year, weekNumber
       ORDER BY year DESC, weekNumber DESC
       LIMIT {lim:UInt32}`,
      { lim: limit },
    );
    return rows;
  }

  /** Захирал ирүүлсэн тайлангийн агуулгыг засна. */
  async directorEdit(
    user: UserPayload,
    reportId: string,
    sections: Record<string, unknown>,
  ) {
    const role = this.resolveRole(user);
    if (role !== "director") {
      throw new ForbiddenException("Зөвхөн газрын захирал засах эрхтэй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM weekly_reports FINAL WHERE id = {id:String} LIMIT 1`,
      { id: reportId },
    );
    const r = rows[0];
    if (!r) throw new NotFoundException("Тайлан олдсонгүй");
    const now = nowCH();
    await this.clickhouse.insert("weekly_reports", [
      {
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        role: r.role,
        year: Number(r.year),
        weekNumber: Number(r.weekNumber),
        weekStart: r.weekStart,
        weekEnd: r.weekEnd,
        status: r.status || "submitted",
        sectionsJson: JSON.stringify(sections ?? {}),
        submittedAt: r.submittedAt,
        createdAt: r.createdAt,
        updatedAt: now,
      },
    ]);
    return { id: r.id, savedAt: now };
  }

  /** Захирал нэг ажилтны ирүүлсэн тайланг тодорхойлж харна. */
  async getMemberReport(
    user: UserPayload,
    targetUserId: string,
    year: number,
    weekNumber: number,
  ) {
    const role = this.resolveRole(user);
    if (role !== "director") {
      throw new ForbiddenException("Зөвхөн газрын захирал харах эрхтэй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM weekly_reports FINAL
       WHERE userId = {uid:String} AND year = {y:UInt16} AND weekNumber = {w:UInt8}
       LIMIT 1`,
      { uid: targetUserId, y: year, w: weekNumber },
    );
    if (!rows[0]) throw new NotFoundException("Тайлан олдсонгүй");
    return this.format(rows[0]);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private format(r: any) {
    let sections: unknown = {};
    try {
      sections = r.sectionsJson ? JSON.parse(r.sectionsJson) : {};
    } catch {
      sections = {};
    }
    return {
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      role: r.role,
      year: Number(r.year),
      weekNumber: Number(r.weekNumber),
      weekStart: r.weekStart,
      weekEnd: r.weekEnd,
      status: r.status,
      sections,
      submittedAt: r.submittedAt,
      updatedAt: r.updatedAt,
    };
  }
}
