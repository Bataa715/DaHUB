import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { AuditLogService } from "../audit/audit-log.service";
import { SaveTailanDto } from "./dto/tailan.dto";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isTailanDeptHead } from "./utils/tailan-permissions.util";
import { parseReport } from "./utils/tailan-report-parser.util";

/**
 * Report CRUD (save/get/submit) for the Tailan quarterly-report tool.
 * Image handling lives in TailanImagesService; .docx generation lives in
 * TailanDocxService — see those files for the other two thirds of what used
 * to be one 1500-line TailanService.
 */
@Injectable()
export class TailanReportsService {
  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly auditLog: AuditLogService,
  ) {}

  private auditMutation(
    userId: string,
    action: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    void this.auditLog.log({
      userId,
      action,
      resource: "tailan",
      resourceId: resourceId ?? "",
      method: action,
      status: "success",
      metadata,
    });
  }

  isDeptHead(user: AuthenticatedUser): boolean {
    return isTailanDeptHead(user);
  }

  // ─── Save / upsert draft ───────────────────────────────────────────────────
  async saveDraft(user: AuthenticatedUser, dto: SaveTailanDto) {
    const existing = await this.clickhouse.query<{ id: string }>(
      `SELECT id FROM tailan_reports FINAL
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId: user.id, year: dto.year, quarter: dto.quarter },
    );

    const id = existing.length > 0 ? existing[0].id : randomUUID();
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    await this.clickhouse.insert("tailan_reports", [
      {
        id,
        userId: user.id,
        userName: user.name,
        departmentId: user.departmentId ?? "",
        year: dto.year,
        quarter: dto.quarter,
        status: dto.status ?? "draft",
        // Legacy per-field column left at default for new saves — all
        // section data now lives in sectionsDataJson (template-driven).
        // (otherWork / teamActivitiesJson columns were dropped — never read
        // anywhere, not even by the legacy fallback parser.)
        plannedTasksJson: "[]",
        dynamicSectionsJson: JSON.stringify(dto.dynamicSections ?? []),
        extraDataJson: JSON.stringify({
          hiddenSections: dto.hiddenSections ?? [],
        }),
        sectionsDataJson: JSON.stringify(dto.sections ?? {}),
        submittedAt: dto.status === "submitted" ? now : "1970-01-01 00:00:00",
        updatedAt: now,
        createdAt:
          existing.length > 0 ? (existing[0]["createdAt"] ?? now) : now,
      },
    ]);

    if (dto.status === "submitted") {
      this.auditMutation(user.id, "tailan_submit", id, {
        year: dto.year,
        quarter: dto.quarter,
      });
    }

    return { id, message: "Амжилттай хадгаллаа" };
  }

  // ─── Get my report ─────────────────────────────────────────────────────────
  async getMyReport(userId: string, year: number, quarter: number) {
    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId, year, quarter },
    );

    if (rows.length === 0) return null;
    return parseReport(rows[0]);
  }

  // ─── Department BSC (ТҮЗ) report save ─────────────────────────────────────
  async saveDeptBsc(
    user: AuthenticatedUser,
    year: number,
    quarter: number,
    sections: Record<string, unknown>,
  ) {
    const deptId = user.departmentId || user.id;
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await this.clickhouse.insert("dept_bsc_reports", [
      {
        departmentId: deptId,
        year,
        quarter,
        sectionsJson: JSON.stringify(sections),
        savedByName: user.name,
        updatedAt: now,
      },
    ]);
    return { ok: true, message: "Амжилттай хадгаллаа" };
  }

  // ─── Department BSC (ТҮЗ) report load ─────────────────────────────────────
  async getDeptBsc(user: AuthenticatedUser, year: number, quarter: number) {
    const deptId = user.departmentId || user.id;
    const rows = await this.clickhouse.query<{
      sectionsJson: string;
      savedByName: string;
      updatedAt: string;
    }>(
      `SELECT sectionsJson, savedByName, updatedAt FROM dept_bsc_reports FINAL
       WHERE departmentId = {deptId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { deptId, year, quarter },
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      sections: JSON.parse(row.sectionsJson || "{}"),
      savedByName: row.savedByName,
      updatedAt: row.updatedAt,
    };
  }

  // ─── Submit report ──────────────────────────────────────────────────────────
  async submitReport(userId: string, year: number, quarter: number) {
    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId, year, quarter },
    );
    if (rows.length === 0) throw new NotFoundException("Тайлан олдсонгүй");

    const report = rows[0];
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    await this.clickhouse.insert("tailan_reports", [
      { ...report, status: "submitted", submittedAt: now, updatedAt: now },
    ]);

    this.auditMutation(userId, "tailan_submit", String(report.id), {
      year,
      quarter,
    });

    return { message: "Тайлан илгээгдлээ" };
  }

  // ─── Get dept submitted reports ─────────────────────────────────────────────
  async getDeptReports(user: AuthenticatedUser, year: number, quarter: number) {
    if (!isTailanDeptHead(user)) throw new ForbiddenException("Эрх хүрэхгүй");

    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE departmentId = {deptId:String}
         AND year = {year:UInt16}
         AND quarter = {quarter:UInt8}
         AND status = 'submitted'
       ORDER BY userName ASC`,
      { deptId: user.departmentId ?? "", year, quarter },
    );

    return rows.map((r) => parseReport(r));
  }

  // ─── Get all dept reports for dept head's own ─────────────────────────────
  async getAllDeptReports(
    user: AuthenticatedUser,
    year: number,
    quarter: number,
  ) {
    if (!isTailanDeptHead(user)) throw new ForbiddenException("Эрх хүрэхгүй");

    const rows = await this.clickhouse.query(
      `SELECT id, userId, userName, status, updatedAt, submittedAt
       FROM tailan_reports FINAL
       WHERE departmentId = {deptId:String}
         AND year = {year:UInt16}
         AND quarter = {quarter:UInt8}
       ORDER BY userName ASC`,
      { deptId: user.departmentId ?? "", year, quarter },
    );

    return rows;
  }
}
