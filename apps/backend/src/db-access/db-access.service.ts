import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { ClickHouseAccessService } from "./clickhouse-access.service";
import { AuditLogService } from "../audit/audit-log.service";
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "crypto";
import {
  CreateAccessRequestDto,
  ReviewRequestDto,
  RevokeGrantDto,
} from "./dto/db-access.dto";
import { AuthenticatedUser } from "../common/types/authenticated-request";

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

  // [SEC-5] AES-256-GCM encryption-at-rest for ClickHouse user passwords
  // stored in access_grants.chPassword. Format: enc:v1:<base64(iv|tag|ciphertext)>.
  // Old plaintext rows are still readable (auto-detected by missing prefix).
  //
  // [AUDIT] Multi-key: python-api.service-тэй ижил загвараар тусгай
  // CONFIG_ENC_KEY/CREDENTIAL_ENCRYPTION_KEY-г нэн тэргүүнд ашиглаж,
  // JWT_SECRET-ээс гарсан түлхүүрийг унших fallback болгож үлдээнэ —
  // ингэснээр JWT_SECRET солиход хуучин мөрүүд уншигдсаар байна.
  private static deriveKey(secret: string): Buffer {
    return createHash("sha256")
      .update("db-access:ch-pwd:" + secret)
      .digest();
  }
  private readonly encKeys: Buffer[] = (() => {
    const keys: Buffer[] = [];
    const dedicated =
      process.env.CONFIG_ENC_KEY || process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (dedicated && dedicated.length >= 16) {
      keys.push(DbAccessService.deriveKey(dedicated));
    }
    const jwt = process.env.JWT_SECRET;
    if (jwt && jwt.length >= 16 && jwt !== dedicated) {
      keys.push(DbAccessService.deriveKey(jwt));
    }
    if (keys.length === 0) {
      throw new Error(
        "CONFIG_ENC_KEY or JWT_SECRET (>=16 chars) is required for chPassword encryption-at-rest",
      );
    }
    return keys;
  })();

  private encryptPwd(plain: string): string {
    if (!plain) return "";
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encKeys[0], iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return "enc:v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
  }

  private decryptPwd(stored: string | null | undefined): string {
    if (!stored) return "";
    if (!stored.startsWith("enc:v1:")) return stored; // legacy plaintext
    const buf = Buffer.from(stored.slice("enc:v1:".length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    for (const key of this.encKeys) {
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
        return pt.toString("utf8");
      } catch {
        // GCM tag таараагүй — дараагийн түлхүүрээр оролдоно
      }
    }
    this.logger.error("chPassword decrypt failed (no key matched)");
    return "";
  }

  constructor(
    private clickhouse: ClickHouseService,
    private chAccess: ClickHouseAccessService,
    private auditLogService: AuditLogService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  private canGrantAccess(user: AuthenticatedUser): boolean {
    if (user.isAdmin || user.isSuperAdmin) return true;
    // formatUserResponse array өгдөг ч edge case-д string ирж болно
    const tools = Array.isArray(user.allowedTools)
      ? user.allowedTools
      : typeof user.allowedTools === "string"
        ? (() => {
            try {
              const p = JSON.parse(user.allowedTools);
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })()
        : [];
    return tools.includes("db_access_granter");
  }

  // ─── Tables & Columns ───────────────────────────────────────────────────────

  /** List all ClickHouse tables across allowed databases.
   * [HIGH-3] DB and table lists are hard-coded constants — not user input.
   * The string interpolation here is safe (no injection risk) but is intentional:
   * ClickHouse's IN clause with String literals requires this pattern; parameterized
   * {value:String} only supports scalar values, not arrays.
   */
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

  // ─── Access Requests ────────────────────────────────────────────────────────

  /** Submit a new access request */
  async createRequest(
    user: AuthenticatedUser,
    dto: CreateAccessRequestDto,
  ): Promise<{ id: string }> {
    const validUntil = new Date(dto.validUntil);
    if (validUntil <= new Date()) {
      throw new BadRequestException("Дуусах хугацаа өнгөрсөн байна");
    }
    // C-6: Cap access duration at 90 days to prevent indefinite grants
    const MAX_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
    if (validUntil.getTime() - Date.now() > MAX_DURATION_MS) {
      throw new BadRequestException(
        "Хүсэлтийн хүчинтэй хугацаа 90 хоноос хэтерхгүй",
      );
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

  /** Get all pending requests (grantors & admins only) */
  async getPendingRequests(user: AuthenticatedUser) {
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
  async getAllRequests(user: AuthenticatedUser) {
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

  /** Hard-delete a single pending request (granter / admin only) */
  async deleteRequest(id: string, user: AuthenticatedUser) {
    if (!this.canGrantAccess(user)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    const rows = await this.clickhouse.query<any>(
      `SELECT id, status FROM access_requests FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (rows.length === 0) throw new NotFoundException("Хүсэлт олдсонгүй");
    await this.clickhouse.exec(
      `ALTER TABLE access_requests DELETE WHERE id = {id:String}`,
      { id },
    );
    this.logger.log(
      `[DBAccess] Request ${id} (${rows[0].status}) deleted by ${user.userId}`,
    );
    await this.auditLogService.log({
      userId: user.id,
      action: "db_access_request_delete",
      resource: "access_requests",
      resourceId: id,
      method: "deleteRequest",
      status: "success",
      metadata: { priorStatus: rows[0].status },
    });
    return { success: true };
  }

  /**
   * Force-clean a user's ClickHouse access state (drop all orphaned roles + CH user).
   * Use this when a user is stuck after a failed revoke/approve cycle.
   * After cleanup, the next approval will recreate everything cleanly.
   */
  async cleanupUserChAccess(requesterUserId: string, admin: AuthenticatedUser) {
    if (!this.canGrantAccess(admin)) {
      throw new ForbiddenException("Энэ үйлдлийг гүйцэтгэх эрх байхгүй");
    }
    const result = await this.chAccess.cleanupUserChAccess(requesterUserId);
    this.logger.log(
      `[DBAccess] CH cleanup for userId=${requesterUserId} by ${admin.userId}: ` +
        `rolesDropped=${result.rolesDropped.length} userDropped=${result.userDropped}`,
    );
    await this.auditLogService.log({
      userId: admin.id,
      action: "db_access_ch_cleanup",
      resource: "access_grants",
      method: "cleanupUserChAccess",
      status: "success",
      metadata: {
        targetUserUserId: requesterUserId,
        rolesDropped: result.rolesDropped,
        userDropped: result.userDropped,
      },
    });
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

      // ── Insert audit grant rows ───────────────────────────────────────────
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
        chPassword: this.encryptPwd(sharedPassword),
      }));

      await this.clickhouse.insert("access_grants", grants);
    }

    this.logger.log(
      `Request ${requestId} ${dto.action}d by ${reviewer.userId}`,
    );

    await this.auditLogService.log({
      userId: reviewer.id,
      action:
        dto.action === "approve" ? "db_access_approve" : "db_access_reject",
      resource: "access_requests",
      resourceId: requestId,
      method: "reviewRequest",
      status: "success",
      metadata: {
        requesterUserId: req.requesterUserId,
        tables: req.tables,
        reviewNote: dto.reviewNote,
        chSetupFailed,
      },
    });

    return {
      success: true,
      action: dto.action,
      chSetupFailed:
        dto.action === "approve" ? (chSetupFailed ?? false) : false,
    };
  }

  // ─── Access Grants ───────────────────────────────────────────────────────────

  /** Get active grants for the current user (includes decrypted chPassword for credentials display) */
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
    return rows.map((r) => ({
      ...this.formatGrant(r),
      chPassword: this.decryptPwd(r.chPassword),
    }));
  }

  /** Get all active grants (admin view) */
  async getAllGrants(user: AuthenticatedUser) {
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

    // [M-3/H-12-style fix] Revoke the LIVE ClickHouse SQL access FIRST.
    // Only mark the grant inactive in the audit trail once that has actually
    // happened — otherwise a CH failure would leave the DB saying "revoked"
    // while the user still has live access, with no record that the revoke
    // itself failed.
    let chRevokeError: string | undefined;
    let userDropped = false;
    try {
      const result = await this.chAccess.revokeAccess({
        requestId: grant.requestId,
        requesterUserId: grant.userUserId,
        tableName: grant.tableName, // selective: only revoke this table's SELECT
      });
      userDropped = result.userDropped;
      this.logger.log(
        `[CH ACL] Revoked: user=${grant.userUserId} requestId=${grant.requestId} ` +
          `table=${grant.tableName} userDropped=${result.userDropped}`,
      );
    } catch (err: any) {
      chRevokeError = err?.message ?? String(err);
      this.logger.error(
        `[CH ACL] CH SQL revoke FAILED for grant=${grantId}: ${chRevokeError}. ` +
          `Grant is NOT being marked inactive — retry or use the CH cleanup endpoint.`,
      );
    }

    if (chRevokeError) {
      await this.auditLogService.log({
        userId: revoker.id,
        action: "db_access_revoke",
        resource: "access_grants",
        resourceId: grantId,
        method: "revokeGrant",
        status: "failure",
        errorMessage: chRevokeError,
        metadata: { userUserId: grant.userUserId, tableName: grant.tableName },
      });
      throw new BadRequestException(
        "ClickHouse дээрх хандалтыг цуцлахад алдаа гарлаа. Дахин оролдох эсвэл 'CH cleanup' ашиглана уу.",
      );
    }

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
    await this.auditLogService.log({
      userId: revoker.id,
      action: "db_access_revoke",
      resource: "access_grants",
      resourceId: grantId,
      method: "revokeGrant",
      status: "success",
      metadata: {
        userUserId: grant.userUserId,
        tableName: grant.tableName,
        reason: dto.reason,
        userDropped,
      },
    });
    return { success: true };
  }

  /** User self-cancels their own active grant before expiry */
  async selfRevokeGrant(grantId: string, requester: AuthenticatedUser) {
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

    // [M-3/H-12-style fix] Same ordering fix as revokeGrant(): revoke the
    // live CH access first, only then mark inactive in the audit trail.
    let chRevokeError: string | undefined;
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
      chRevokeError = err?.message ?? String(err);
      this.logger.error(
        `[CH ACL] CH SQL self-revoke FAILED for grant=${grantId}: ${chRevokeError}. ` +
          `Grant is NOT being marked inactive — retry or use the CH cleanup endpoint.`,
      );
    }

    if (chRevokeError) {
      await this.auditLogService.log({
        userId: requester.id,
        action: "db_access_self_revoke",
        resource: "access_grants",
        resourceId: grantId,
        method: "selfRevokeGrant",
        status: "failure",
        errorMessage: chRevokeError,
        metadata: { userUserId: grant.userUserId, tableName: grant.tableName },
      });
      throw new BadRequestException(
        "ClickHouse дээрх хандалтыг цуцлахад алдаа гарлаа. Дахин оролдоно уу.",
      );
    }

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

    this.logger.log(
      `Grant ${grantId} self-cancelled by user ${requester.userId}`,
    );
    await this.auditLogService.log({
      userId: requester.id,
      action: "db_access_self_revoke",
      resource: "access_grants",
      resourceId: grantId,
      method: "selfRevokeGrant",
      status: "success",
      metadata: { userUserId: grant.userUserId, tableName: grant.tableName },
    });
    return { success: true };
  }

  /** List users who can grant access.
   * [HIGH-4] Uses has(JSONExtractArrayRaw()) for exact element matching instead
   * of LIKE '%db_access_granter%' which could false-match partial tool names.
   */
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

  private formatGrant = (g: any) => {
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
  };
}
