import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { AuditLogService } from "../audit/audit-log.service";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isTailanDeptHead } from "./utils/tailan-permissions.util";

/**
 * Image upload/list/serve/delete for the Tailan quarterly-report tool
 * (report body text and .docx rendering live in TailanReportsService /
 * TailanDocxService — see those files for the other two thirds of what used
 * to be one 1500-line TailanService).
 */
@Injectable()
export class TailanImagesService {
  // [PERF] ensureImagesTable() is called from every upload/list/read/delete
  // method (no OnModuleInit here) — this guard stops the CREATE/ALTER DDL
  // from re-running on every request; only needs to happen once per process.
  private tableEnsured = false;

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

  // ─── Images table bootstrap (call once on module init) ─────────────────────
  async ensureImagesTable() {
    if (this.tableEnsured) return;

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS tailan_images (
        id String,
        userId String,
        departmentId String DEFAULT '',
        year UInt16,
        quarter UInt8,
        filename String,
        mimeType String,
        imageData String DEFAULT '',
        uploadedAt DateTime DEFAULT now()
      ) ENGINE = MergeTree() ORDER BY (userId, year, quarter, id)
    `);
    // Only mark ensured once CREATE TABLE succeeds — a transient failure here
    // must retry on the next call, not silently skip table creation forever.
    this.tableEnsured = true;
    // migrate: add imageData column if table was created with old dataBase64 schema
    // [SAFETY] DROP COLUMN dataBase64 cleanup хассан — энэ функц image
    // upload/унших болгонд дуудагддаг тул local/prod ижил DB-д эрсдэлтэй.
    try {
      await this.clickhouse.exec(
        `ALTER TABLE tailan_images ADD COLUMN IF NOT EXISTS imageData String DEFAULT ''`,
      );
    } catch {}

    // [PERF] getImageData() looks up by `id` alone, which isn't prunable in
    // the base ORDER BY — add an id-sorted projection for that lookup.
    try {
      await this.clickhouse.exec(
        `ALTER TABLE tailan_images ADD PROJECTION IF NOT EXISTS proj_by_id (SELECT * ORDER BY id)`,
      );
      await this.clickhouse.exec(
        `ALTER TABLE tailan_images MATERIALIZE PROJECTION proj_by_id`,
      );
    } catch {}
  }

  // ─── Save image ────────────────────────────────────────────────────────────
  async saveImage(
    userId: string,
    departmentId: string,
    year: number,
    quarter: number,
    filename: string,
    mimeType: string,
    buffer: Buffer,
  ) {
    await this.ensureImagesTable();
    const id = randomUUID();
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const imageData = buffer.toString("hex");
    await this.clickhouse.insert("tailan_images", [
      {
        id,
        userId,
        departmentId,
        year,
        quarter,
        filename,
        mimeType,
        imageData,
        uploadedAt: now,
      },
    ]);
    this.auditMutation(userId, "tailan_image_upload", id, { year, quarter });
    return { id, filename, mimeType };
  }

  // ─── Get image list (metadata only) ───────────────────────────────────────
  async getImages(userId: string, year: number, quarter: number) {
    await this.ensureImagesTable();
    return this.clickhouse.query<any>(
      `SELECT id, filename, mimeType, uploadedAt FROM tailan_images
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY uploadedAt ASC`,
      { userId, year, quarter },
    );
  }

  // ─── Get image raw data ────────────────────────────────────────────────────
  async getImageData(id: string, user: AuthenticatedUser) {
    await this.ensureImagesTable();
    const rows = await this.clickhouse.query<any>(
      `SELECT userId, departmentId, mimeType, imageData FROM tailan_images WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!rows.length) throw new NotFoundException("Зураг олдсонгүй");

    const img = rows[0];
    const isOwner = String(img.userId) === user.id;
    const isDeptHeadAccess =
      isTailanDeptHead(user) &&
      String(img.departmentId ?? "") === String(user.departmentId ?? "");
    const isAdmin = user.isAdmin || user.isSuperAdmin;

    if (!isOwner && !isDeptHeadAccess && !isAdmin) {
      throw new ForbiddenException("Эрх хүрэхгүй");
    }

    return {
      mimeType: img.mimeType,
      buffer: Buffer.from(img.imageData, "hex"),
    };
  }

  // ─── Delete image ──────────────────────────────────────────────────────────
  async deleteImage(id: string, userId: string) {
    await this.ensureImagesTable();
    await this.clickhouse.exec(
      `ALTER TABLE tailan_images DELETE WHERE id = {id:String} AND userId = {userId:String}`,
      { id, userId },
    );
    this.auditMutation(userId, "tailan_image_delete", id);
    return { message: "Устгагдлаа" };
  }
}
