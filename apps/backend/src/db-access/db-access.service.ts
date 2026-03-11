import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { ClickHouseAccessService } from "./clickhouse-access.service";
import { randomUUID, randomBytes } from "crypto";
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

  constructor(
    private clickhouse: ClickHouseService,
    private chAccess: ClickHouseAccessService,
  ) {}

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

    // ── Pre-revoke only grants whose tables overlap with the new request ──────
    // This way unrelated active grants are NOT touched; only duplicate-table
    // grants are revoked so approval won't create a conflicting ClickHouse role.
    const newTables = new Set(dto.tables);

    const activeGrants = await this.clickhouse.query<any>(
      `SELECT * FROM access_grants FINAL
       WHERE userId = {uid:String} AND isActive = 1 AND validUntil > now()`,
      { uid: user.id },
    );

    // Filter to only grants that share at least one table with the new request.
    // access_grants rows have a single `tableName` field (one row per table).
    const overlappingGrants = activeGrants.filter((g: any) =>
      newTables.has(g.tableName),
    );

    if (overlappingGrants.length > 0) {
      // Group by requestId: one ClickHouse role per request → one full revoke per role
      const byRequest = new Map<
        string,
        { grants: any[]; requesterUserId: string }
      >();
      for (const g of overlappingGrants) {
        if (!byRequest.has(g.requestId)) {
          byRequest.set(g.requestId, {
            grants: [],
            requesterUserId: g.requesterUserId ?? g.userUserId,
          });
        }
        byRequest.get(g.requestId)!.grants.push(g);
      }

      for (const [requestId, { grants, requesterUserId }] of byRequest) {
        // Full revoke: drop the ClickHouse role for this requestId
        try {
          await this.chAccess.revokeAccess({ requestId, requesterUserId });
          this.logger.log(
            `[CH ACL] Pre-revoked overlapping grants for requestId=${requestId} user=${requesterUserId}`,
          );
        } catch (err: any) {
          this.logger.warn(
            `[CH ACL] Pre-revoke failed for requestId=${requestId}: ${err?.message}`,
          );
        }

        // Mark every overlapping grant row inactive in the DB
        for (const grant of grants) {
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
              revokeReason: "Давхардсан хүсэлтийн улмаас автоматаар цуцлагдсан",
              grantedAt: now,
            },
          ]);
        }
      }

      this.logger.log(
        `[createRequest] Pre-revoked ${overlappingGrants.length} overlapping grant(s) for user ${user.userId}`,
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

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

  /** Hard-delete a single pending request (granter / admin only) */
  async deleteRequest(id: string, user: any) {
    if (!this.canGrantAccess(user)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT id, status FROM access_requests WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (rows.length === 0) throw new NotFoundException("Хүсэлт олдсонгүй");
    if (rows[0].status === "approved") {
      throw new BadRequestException("Батлагдаж хүсэлтийг устгах боломжтой");
    }
    await this.clickhouse.exec(
      `ALTER TABLE access_requests DELETE WHERE id = {id:String}`,
      { id },
    );
    this.logger.log(`[DBAccess] Request ${id} (${rows[0].status}) deleted by ${user.userId}`);
    return { success: true };
  }

  /** Delete all approved/rejected request history (keeps pending rows) */
  async deleteRequestHistory(user: any) {
    if (!this.canGrantAccess(user)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    await this.clickhouse.exec(
      `ALTER TABLE access_requests DELETE WHERE status IN ('approved', 'rejected')`,
    );
    this.logger.log(
      `[DBAccess] Request history deleted by ${user.userId}`,
    );
    return { success: true, message: "Түүх устгагдлаа" };
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

  /**
   * Force-clean a user's ClickHouse access state (drop all orphaned roles + CH user).
   * Use this when a user is stuck after a failed revoke/approve cycle.
   * After cleanup, the next approval will recreate everything cleanly.
   */
  async cleanupUserChAccess(requesterUserId: string, admin: any) {
    if (!this.canGrantAccess(admin)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    const result = await this.chAccess.cleanupUserChAccess(requesterUserId);
    this.logger.log(
      `[DBAccess] CH cleanup for userId=${requesterUserId} by ${admin.userId}: ` +
        `rolesDropped=${result.rolesDropped.length} userDropped=${result.userDropped}`,
    );
    return {
      success: true,
      rolesDropped: result.rolesDropped,
      userDropped: result.userDropped,
      message: `ClickHouse хандалт цэвэрлэгдлээ (${result.rolesDropped.length} role, user: ${result.userDropped ? "устгагдсан" : "байгаагүй"})`,
    };
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
    // L-8: Prevent approving expired requests
    if (dto.action === "approve" && new Date(req.validUntil) <= new Date()) {
      throw new BadRequestException(
        "Хүсэлтийн хүчинтэй хугацаа дуусчихсан байна — дахин хүсэлт илгээнэ үү",
      );
    }

    const now = this.formatDateTime(new Date());
    let chSetupFailed = false;

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
      const tables: string[] = Array.isArray(req.tables)
        ? req.tables
        : JSON.parse(req.tables ?? "[]");
      const columns: string[] = Array.isArray(req.columns)
        ? req.columns
        : JSON.parse(req.columns ?? "[]");
      const accessTypes: string[] = Array.isArray(req.accessTypes)
        ? req.accessTypes
        : JSON.parse(req.accessTypes ?? "[]");

      // ── Apply ClickHouse SQL access control (fast parallel flow) ─────────────
      //
      // 1. Generate ONE shared password for this entire request.
      // 2. Setup the CH user + role ONCE (always syncs password → fixes auth).
      // 3. Grant every table in PARALLEL → avoids N sequential round-trips.
      const sharedPassword = randomBytes(12).toString("hex");

      // Step 1: user + role setup (sequential, must finish before parallel grants)
      try {
        await this.chAccess.setupUserAndRole({
          requestId,
          requesterUserId: req.requesterUserId,
          password: sharedPassword,
        });
      } catch (err: any) {
        chSetupFailed = true;
        this.logger.error(
          `[CH ACL] setupUserAndRole FAILED for user=${req.requesterUserId}: ${err?.message}. ` +
            `Grant DB rows will be written but CH access may be broken. ` +
            `Admin should use the CH cleanup endpoint to reset.`,
        );
      }

      // Step 2: grant all tables in parallel (even if setup failed — role may have been partially created)
      await Promise.all(
        tables.map((table) =>
          this.chAccess.grantTableToRole(requestId, table).catch((err: any) => {
            chSetupFailed = true;
            this.logger.warn(
              `[CH ACL] Failed to grant ${table}: ${err?.message}`,
            );
          }),
        ),
      );

      this.logger.log(
        `[CH ACL] Approved ${tables.length} table(s) for user=${req.requesterUserId}${chSetupFailed ? " (⚠ CH setup had errors)" : ""}`,
      );

      // ── Insert audit grant rows (all share the same chPassword) ───────────────
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
        chPassword: sharedPassword, // same for every table in this request
      }));

      await this.clickhouse.insert("access_grants", grants);
    }

    this.logger.log(
      `Request ${requestId} ${dto.action}d by ${reviewer.userId}`,
    );

    return {
      success: true,
      action: dto.action,
      chSetupFailed: dto.action === "approve" ? (chSetupFailed ?? false) : false,
    };
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

    // ── Revoke ClickHouse SQL access control ──────────────────────────────
    try {
      const result = await this.chAccess.revokeAccess({
        requestId: grant.requestId,
        requesterUserId: grant.userUserId,
        tableName: grant.tableName, // selective: only revoke this table's SELECT
      });
      this.logger.log(
        `[CH ACL] Revoked: user=${grant.userUserId} requestId=${grant.requestId} ` +
          `table=${grant.tableName} userDropped=${result.userDropped}`,
      );
    } catch (err: any) {
      this.logger.warn(
        `[CH ACL] Skipping CH SQL revoke for grant=${grantId}: ${err?.message}`,
      );
      // Non-fatal: audit trail is already written.
    }

    this.logger.log(`Grant ${grantId} revoked by ${revoker.userId}`);
    return { success: true };
  }

  /** User self-cancels their own active grant before expiry */
  async selfRevokeGrant(grantId: string, requester: any) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM access_grants FINAL WHERE id = {id:String} LIMIT 1`,
      { id: grantId },
    );
    const grant = rows[0];
    if (!grant) throw new NotFoundException("Зөвшөөрөл олдсонгүй");
    if (grant.userId !== requester.id && !this.canGrantAccess(requester))
      throw new ForbiddenException("Зөвхөн өөрийн эрхийг хаах боломжтой");
    if (!grant.isActive)
      throw new BadRequestException("Эрх аль хэдийн хаагдсан байна");

    const now = this.formatDateTime(new Date());
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
        revokeReason: "Хэрэглэгч өөрөө хаасан",
        grantedAt: now,
      },
    ]);

    try {
      const result = await this.chAccess.revokeAccess({
        requestId: grant.requestId,
        requesterUserId: grant.userUserId,
        tableName: grant.tableName, // selective: only revoke this table's SELECT
      });
      this.logger.log(
        `[CH ACL] Self-revoked: user=${grant.userUserId} requestId=${grant.requestId} ` +
          `table=${grant.tableName} userDropped=${result.userDropped}`,
      );
    } catch (err: any) {
      this.logger.warn(
        `[CH ACL] CH SQL self-revoke failed for grant=${grantId}: ${err?.message}`,
      );
    }

    this.logger.log(
      `Grant ${grantId} self-cancelled by user ${requester.userId}`,
    );
    return { success: true };
  }

  /** Get ClickHouse credentials for a specific grant (owner or admin only) */
  async getGrantCredentials(grantId: string, requester: any) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM access_grants FINAL WHERE id = {id:String} LIMIT 1`,
      { id: grantId },
    );
    const grant = rows[0];
    if (!grant) throw new NotFoundException("Grant олдсонгүй");

    // Only the grant owner or an admin/granter can view credentials
    const isOwner = grant.userId === requester.id;
    if (!isOwner && !this.canGrantAccess(requester)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }

    return {
      username: grant.userUserId,
      chPassword: grant.chPassword ?? "",
      tableName: grant.tableName,
      host: process.env.CLICKHOUSE_EXTERNAL_HOST ?? "localhost",
      port: parseInt(process.env.CLICKHOUSE_EXTERNAL_PORT ?? "8123", 10),
      playUrl: process.env.CLICKHOUSE_PLAY_URL ?? "http://localhost:8123/play",
    };
  }

  /** List users who can grant access */
  async getGrantors() {
    const rows = await this.clickhouse.query<any>(
      `SELECT id, userId, name, position, allowedTools
       FROM users
       WHERE (isAdmin = 1 OR allowedTools LIKE '%db_access_granter%')
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
      chPassword: g.chPassword ?? "",
    };
  }
}
