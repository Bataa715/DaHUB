import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { randomUUID } from "crypto";
import {
  CreateAccessRequestDto,
  ReviewRequestDto,
  RevokeGrantDto,
} from "./dto/db-access.dto";

// Databases exposed to auditors
const ALLOWED_DATABASES = ["FINACLE", "ERP", "CARDZONE", "EBANK"];

// Tables always excluded from the list
const EXCLUDED_TABLES = [
  "access_requests",
  "access_grants",
  "access_sessions",
  "users",
];

@Injectable()
export class DbAccessService {
  private readonly logger = new Logger(DbAccessService.name);

  constructor(private clickhouse: ClickHouseService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  private canGrantAccess(user: any): boolean {
    if (user.isAdmin || user.isSuperAdmin) return true;
    const tools: string[] = user.allowedTools || [];
    return tools.includes("db_access_granter");
  }

  // ─── Tables & Columns ───────────────────────────────────────────────────────

  /** List all ClickHouse tables across allowed databases */
  async getAvailableTables(): Promise<
    { database: string; table: string; full: string }[]
  > {
    const dbList = ALLOWED_DATABASES.map((d) => `'${d}'`).join(", ");
    const exList = EXCLUDED_TABLES.map((t) => `'${t}'`).join(", ");

    const rows = await this.clickhouse.query<any>(
      `SELECT database, name
       FROM system.tables
       WHERE database IN (${dbList})
         AND name NOT IN (${exList})
       ORDER BY database, name`,
    );

    return rows.map((r) => ({
      database: r.database,
      table: r.name,
      full: `${r.database}.${r.name}`,
    }));
  }

  /** List columns for a specific database.table */
  async getTableColumns(
    fullTableName: string,
  ): Promise<{ name: string; type: string }[]> {
    const [db, table] = fullTableName.includes(".")
      ? fullTableName.split(".")
      : ["FINACLE", fullTableName];

    if (!ALLOWED_DATABASES.includes(db)) {
      throw new ForbiddenException("Database not allowed");
    }

    const rows = await this.clickhouse.query<any>(
      `SELECT name, type
       FROM system.columns
       WHERE database = {db:String} AND table = {table:String}
       ORDER BY position`,
      { db, table },
    );

    return rows.map((r) => ({ name: r.name, type: r.type }));
  }

  // ─── Access Requests ────────────────────────────────────────────────────────

  /** Submit a new access request */
  async createRequest(
    user: any,
    dto: CreateAccessRequestDto,
  ): Promise<{ id: string }> {
    const validUntil = new Date(dto.validUntil);
    if (validUntil <= new Date()) {
      throw new BadRequestException("Дуусах хугацаа өнгөрсөн байна");
    }

    const now = this.formatDateTime(new Date());
    const id = randomUUID();

    await this.clickhouse.insert("access_requests", [
      {
        id,
        requesterId: user.id,
        requesterName: user.name,
        requesterUserId: user.userId,
        tables: dto.tables,
        columns: dto.columns ?? [],
        accessTypes: dto.accessTypes,
        validUntil: this.formatDateTime(validUntil),
        reason: dto.reason ?? "",
        status: "pending",
        reviewedBy: "",
        reviewedByName: "",
        reviewNote: "",
        requestTime: now,
        reviewedAt: "1970-01-01 00:00:00",
        updatedAt: now,
      },
    ]);

    this.logger.log(
      `Access request ${id} created by ${user.userId} for tables: ${dto.tables.join(", ")}`,
    );

    return { id };
  }

  /** Get requests submitted by the current user */
  async getMyRequests(userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT *
       FROM access_requests FINAL
       WHERE requesterId = {userId:String}
       ORDER BY requestTime DESC`,
      { userId },
    );
    return rows.map(this.formatRequest);
  }

  /** Get all pending requests (grantors & admins only) */
  async getPendingRequests(user: any) {
    if (!this.canGrantAccess(user)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }

    const rows = await this.clickhouse.query<any>(
      `SELECT *
       FROM access_requests FINAL
       WHERE status = 'pending'
       ORDER BY requestTime ASC`,
    );
    return rows.map(this.formatRequest);
  }

  /** Get ALL requests (admin view) */
  async getAllRequests(user: any) {
    if (!this.canGrantAccess(user)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT *
       FROM access_requests FINAL
       ORDER BY requestTime DESC`,
    );
    return rows.map(this.formatRequest);
  }

  /** Approve or reject ALL pending requests at once */
  async bulkReviewPending(reviewer: any, action: "approve" | "reject") {
    if (!this.canGrantAccess(reviewer)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }

    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM access_requests WHERE status = 'pending' ORDER BY requestTime ASC`,
    );

    if (rows.length === 0) return { affected: 0 };

    let affected = 0;
    for (const req of rows) {
      try {
        await this.reviewRequest(req.id, reviewer, {
          action,
          reviewNote:
            action === "approve" ? "Бүгдийг зөвшөөрлөө" : "Бүгдийг татгалзлаа",
        });
        affected++;
      } catch {
        // skip individual failures
      }
    }

    return { affected };
  }

  /** Get grants filtered by userId */
  async getGrantsByUser(targetUserId: string, requester: any) {
    if (!this.canGrantAccess(requester)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT *
       FROM access_grants FINAL
       WHERE userId = {userId:String}
         AND isActive = 1
       ORDER BY grantedAt DESC`,
      { userId: targetUserId },
    );
    return rows.map(this.formatGrant);
  }

  /** Approve or reject a request */
  async reviewRequest(requestId: string, reviewer: any, dto: ReviewRequestDto) {
    if (!this.canGrantAccess(reviewer)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }

    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM access_requests FINAL WHERE id = {id:String} LIMIT 1`,
      { id: requestId },
    );

    const req = rows[0];
    if (!req) throw new NotFoundException("Хүсэлт олдсонгүй");
    if (req.status !== "pending")
      throw new BadRequestException("Хүсэлт аль хэдийн шийдвэрлэгдсэн байна");

    const now = this.formatDateTime(new Date());

    // Upsert via re-insert (ReplacingMergeTree deduplicates by updatedAt version)
    await this.clickhouse.insert("access_requests", [
      {
        ...req,
        tables: Array.isArray(req.tables)
          ? req.tables
          : JSON.parse(req.tables ?? "[]"),
        columns: Array.isArray(req.columns)
          ? req.columns
          : JSON.parse(req.columns ?? "[]"),
        accessTypes: Array.isArray(req.accessTypes)
          ? req.accessTypes
          : JSON.parse(req.accessTypes ?? "[]"),
        status: dto.action === "approve" ? "approved" : "rejected",
        reviewedBy: reviewer.id,
        reviewedByName: reviewer.name,
        reviewNote: dto.reviewNote ?? "",
        reviewedAt: now,
        updatedAt: now,
      },
    ]);

    // If approved, create grants for each table
    if (dto.action === "approve") {
      const tables: string[] = req.tables;
      const columns: string[] = req.columns;
      const accessTypes: string[] = req.accessTypes;

      const grants = tables.map((table) => ({
        id: randomUUID(),
        userId: req.requesterId,
        userName: req.requesterName,
        userUserId: req.requesterUserId,
        requestId: requestId,
        tableName: table,
        columns: columns,
        accessTypes: accessTypes,
        validUntil: req.validUntil,
        grantedBy: reviewer.id,
        grantedByName: reviewer.name,
        grantedAt: now,
        isActive: 1,
        revokedAt: "1970-01-01 00:00:00",
        revokeReason: "",
      }));

      await this.clickhouse.insert("access_grants", grants);
    }

    this.logger.log(
      `Request ${requestId} ${dto.action}d by ${reviewer.userId}`,
    );

    return { success: true, action: dto.action };
  }

  // ─── Access Grants ───────────────────────────────────────────────────────────

  /** Get active grants for the current user */
  async getMyGrants(userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT *
       FROM access_grants FINAL
       WHERE userId = {userId:String}
         AND isActive = 1
         AND validUntil > now()
       ORDER BY grantedAt DESC`,
      { userId },
    );
    return rows.map(this.formatGrant);
  }

  /** Get all active grants (admin view) */
  async getAllGrants(user: any) {
    if (!this.canGrantAccess(user)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT *
       FROM access_grants FINAL
       WHERE isActive = 1
         AND validUntil > now()
       ORDER BY grantedAt DESC`,
    );
    return rows.map(this.formatGrant);
  }

  /** Revoke a grant */
  async revokeGrant(grantId: string, revoker: any, dto: RevokeGrantDto) {
    if (!this.canGrantAccess(revoker)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }

    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM access_grants FINAL WHERE id = {id:String} LIMIT 1`,
      { id: grantId },
    );

    if (!rows[0]) throw new NotFoundException("Зөвшөөрөл олдсонгүй");
    if (!rows[0].isActive)
      throw new BadRequestException("Зөвшөөрөл аль хэдийн цуцлагдсан байна");

    const now = this.formatDateTime(new Date());
    const grant = rows[0];

    // Upsert via re-insert (ReplacingMergeTree deduplicates by grantedAt version)
    await this.clickhouse.insert("access_grants", [
      {
        ...grant,
        columns: Array.isArray(grant.columns)
          ? grant.columns
          : JSON.parse(grant.columns ?? "[]"),
        accessTypes: Array.isArray(grant.accessTypes)
          ? grant.accessTypes
          : JSON.parse(grant.accessTypes ?? "[]"),
        isActive: 0,
        revokedAt: now,
        revokeReason: dto.reason ?? "",
        grantedAt: now,
      },
    ]);

    this.logger.log(`Grant ${grantId} revoked by ${revoker.userId}`);
    return { success: true };
  }

  /** List users who can grant access */
  async getGrantors() {
    const rows = await this.clickhouse.query<any>(
      `SELECT id, userId, name, position, allowedTools
       FROM users
       WHERE isAdmin = 1 OR allowedTools LIKE '%db_access_granter%'
         AND isActive = 1`,
    );
    return rows.map((u) => ({
      id: u.id,
      userId: u.userId,
      name: u.name,
      position: u.position,
    }));
  }

  // ─── Formatters ─────────────────────────────────────────────────────────────

  private formatRequest(r: any) {
    const toArr = (v: any): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v ? v.split(",") : [];
        }
      }
      return [];
    };
    return {
      id: r.id,
      requesterId: r.requesterId,
      requesterName: r.requesterName,
      requesterUserId: r.requesterUserId,
      tables: toArr(r.tables),
      columns: toArr(r.columns),
      accessTypes: toArr(r.accessTypes),
      validUntil: r.validUntil,
      reason: r.reason,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedByName: r.reviewedByName,
      reviewNote: r.reviewNote,
      requestTime: r.requestTime,
      reviewedAt: r.reviewedAt === "1970-01-01 00:00:00" ? null : r.reviewedAt,
    };
  }

  private formatGrant(g: any) {
    const toArr = (v: any): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v ? v.split(",") : [];
        }
      }
      return [];
    };
    return {
      id: g.id,
      userId: g.userId,
      userName: g.userName,
      userUserId: g.userUserId,
      requestId: g.requestId,
      tableName: g.tableName,
      columns: toArr(g.columns),
      accessTypes: toArr(g.accessTypes),
      validUntil: g.validUntil,
      grantedBy: g.grantedBy,
      grantedByName: g.grantedByName,
      grantedAt: g.grantedAt,
      isActive: !!g.isActive,
    };
  }
}
