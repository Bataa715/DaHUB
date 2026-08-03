import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { AuditLogService } from "../audit/audit-log.service";
import * as bcrypt from "bcryptjs";
import { randomUUID, createHash } from "crypto";
import {
  buildUserId,
  safeParseTools,
  webVisibleUserSql,
  isPrivilegedUser,
} from "../common/utils/user-utils";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  LoginDto,
  AdminLoginDto,
  LoginByIdDto,
  CheckUserDto,
  RegisterUserDto,
  SetPasswordDto,
  ChangePasswordDto,
  RefreshTokenDto,
  ReviewRegistrationDto,
} from "./dto/auth.dto";

// [LOW-1] buildUserId and safeParseTools imported from src/common/utils/user-utils.ts

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ─── [CRIT-2] ClickHouse-backed brute-force protection ──────────────────────
  // Replaces the previous in-memory Map which was lost on every server restart.
  // login_attempts table schema → scripts/create-login-attempts.sql
  private readonly MAX_ATTEMPTS = 5;
  private readonly ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 min window
  private readonly LOCKOUT_MS = 15 * 60 * 1000; // 15 min lockout

  /** Throws if the key is currently locked out. */
  private async guardLogin(key: string): Promise<void> {
    // Use Unix epoch integers so comparisons are timezone-independent.
    // ClickHouse toUnixTimestamp() returns UTC-based seconds regardless of server tz.
    const windowStartEpoch = Math.floor(
      (Date.now() - this.ATTEMPT_WINDOW_MS) / 1000,
    );

    const rows = await this.clickhouse.query<any>(
      `SELECT
         countIf(success = 0) AS failures,
         toUnixTimestamp(maxIf(attemptedAt, success = 0)) AS lastFailureEpoch
       FROM login_attempts
       WHERE lockKey = {key:String}
         AND toUnixTimestamp(attemptedAt) >= {windowStartEpoch:UInt32}`,
      { key, windowStartEpoch },
    );

    const failures = Number(rows[0]?.failures ?? 0);
    const lastFailureEpoch = Number(rows[0]?.lastFailureEpoch ?? 0);

    if (failures >= this.MAX_ATTEMPTS && lastFailureEpoch > 0) {
      const lockedUntilMs = lastFailureEpoch * 1000 + this.LOCKOUT_MS;
      if (Date.now() < lockedUntilMs) {
        const remaining = Math.ceil((lockedUntilMs - Date.now()) / 60000);
        throw new UnauthorizedException(
          `Хэт олон амжилтгүй оролдлого. ${remaining} минутын дараа дахин оролдоно уу.`,
        );
      }
    }
  }

  /** Inserts a failed login attempt row. */
  private async recordFailedLogin(key: string): Promise<void> {
    try {
      await this.clickhouse.insert("login_attempts", [
        {
          lockKey: key,
          attemptedAt: nowCH(),
          success: 0,
        },
      ]);
    } catch (err) {
      // Non-fatal: log but do not break the login flow
      this.logger.error(`Failed to record failed login attempt: ${err}`);
    }
  }

  /** Inserts a success row, effectively clearing the failure window. */
  private async clearFailedLogins(key: string): Promise<void> {
    try {
      await this.clickhouse.insert("login_attempts", [
        {
          lockKey: key,
          attemptedAt: nowCH(),
          success: 1,
        },
      ]);
    } catch (err) {
      this.logger.error(`Failed to clear login attempts: ${err}`);
    }
  }

  constructor(
    private clickhouse: ClickHouseService,
    private jwtService: JwtService,
    private auditLogService: AuditLogService,
  ) {}

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /** Format a DB user row into the standard API response shape */
  private formatUserResponse(user: any) {
    return {
      id: user.id,
      userId: user.userId,
      name: user.name,
      position: user.position,
      department: user.departmentName,
      departmentId: user.departmentId,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      allowedTools: safeParseTools(user.allowedTools),
      grantableTools: safeParseTools(user.grantableTools),
      profileImage: user.profileImage || null,
      isActive: !!user.isActive,
    };
  }

  /**
   * Sign a JWT with the user's core claims including allowedTools.
   * allowedTools is included so the Next.js edge middleware can enforce
   * tool-route guards without making a DB call on every request.
   * NestJS API routes still call validateUser() on every request via
   * JwtStrategy to get fresh DB data (deactivation, permission revocation).
   */
  private generateTokenForUser(user: any): string {
    return this.jwtService.sign({
      sub: user.id, // standard JWT subject claim
      id: user.id, // kept for backwards compatibility
      userId: user.userId,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      allowedTools: safeParseTools(user.allowedTools),
    });
  }

  // [MED-1] Refresh tokens are high-value bearer credentials (3h validity,
  // usable to mint new access tokens). Store only a SHA-256 hash in the DB —
  // identical in spirit to password hashing — so a read-only DB leak (backup,
  // dump, misconfigured access) cannot be replayed as a live session. The
  // raw token is still returned to the caller and set as the HttpOnly cookie;
  // only the DB copy is hashed. A fast hash (not bcrypt) is appropriate here
  // since the token itself is a high-entropy random UUID, not a
  // human-guessable secret — there's no brute-force risk to slow down.
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Generate a refresh token and store it (hashed) in the database */
  private async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = randomUUID();
    // Store expiresAt as Unix epoch integer — ClickHouse JSONEachRow treats numbers
    // as UTC-based Unix timestamps regardless of the server's configured timezone.
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + 3 * 3600; // 3 hours from now

    await this.clickhouse.insert("refresh_tokens", [
      {
        userId,
        token: this.hashToken(refreshToken),
        expiresAt: expiresAtEpoch,
        isRevoked: 0,
        createdAt: nowCH(),
      },
    ]);

    return refreshToken;
  }

  /** Validate and use a refresh token to generate a new access token */
  async refreshAccessToken(refreshTokenDto: RefreshTokenDto): Promise<any> {
    const { refreshToken } = refreshTokenDto;
    const tokenHash = this.hashToken(refreshToken);

    // Find the refresh token — compare with epoch integer to stay timezone-independent.
    const nowEpoch = Math.floor(Date.now() / 1000);
    const tokens = (await this.clickhouse.query(
      `SELECT * FROM refresh_tokens
       WHERE token = {token:String}
         AND isRevoked = 0
         AND toUnixTimestamp(expiresAt) > {nowEpoch:UInt32}
       LIMIT 1`,
      { token: tokenHash, nowEpoch },
    )) as any[];

    const tokenRecord = tokens[0];
    if (!tokenRecord) {
      this.logger.warn("Invalid or expired refresh token");
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Get the user
    const users = (await this.clickhouse.query(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.id = {userId:String} AND u.isActive = 1 LIMIT 1`,
      { userId: tokenRecord.userId },
    )) as any[];

    const user = users[0];
    if (!user) {
      this.logger.warn(
        `User not found or inactive for refresh token: ${tokenRecord.userId}`,
      );
      throw new UnauthorizedException("User not found or inactive");
    }

    // [H-3] Revoke the old refresh token FIRST (single-use) before issuing a new one.
    // ALTER UPDATE биш — DELETE (query нь isRevoked=0 шүүдэг тул устгахад хангалттай).
    await this.clickhouse.exec(
      "ALTER TABLE refresh_tokens DELETE WHERE token = {token:String} SETTINGS mutations_sync = 1",
      { token: tokenHash },
    );

    // Generate new tokens after old token is revoked
    const accessToken = this.generateTokenForUser(user);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      user: this.formatUserResponse(user),
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /** Revoke all refresh tokens for a user (on logout) */
  async revokeRefreshTokens(userId: string): Promise<any> {
    await this.clickhouse.exec(
      "ALTER TABLE refresh_tokens DELETE WHERE userId = {userId:String} SETTINGS mutations_sync = 1",
      { userId },
    );
    return { success: true, message: "All refresh tokens revoked" };
  }

  /** Stamp the user's lastLoginAt */
  private async updateLastLogin(userId: string): Promise<void> {
    const users = await this.clickhouse.query<any>(
      "SELECT * FROM users WHERE id = {id:String} LIMIT 1",
      { id: userId },
    );
    if (users.length === 0) return;
    const u = users[0];
    await this.clickhouse.replaceRows(
      "users",
      "id = {id:String}",
      { id: userId },
      [
        {
          id: u.id,
          userId: u.userId,
          password: u.password ?? "",
          name: u.name ?? "",
          position: u.position ?? "",
          profileImage: u.profileImage ?? "",
          departmentId: u.departmentId ?? "",
          isAdmin: Number(u.isAdmin) || 0,
          isSuperAdmin: Number(u.isSuperAdmin) || 0,
          isActive: u.isActive === undefined ? 1 : Number(u.isActive),
          allowedTools:
            typeof u.allowedTools === "string"
              ? u.allowedTools
              : JSON.stringify(u.allowedTools ?? []),
          grantableTools:
            typeof u.grantableTools === "string"
              ? u.grantableTools
              : JSON.stringify(u.grantableTools ?? []),
          lastLoginAt: nowCH(),
          createdAt: u.createdAt,
          updatedAt: nowCH(),
        },
      ],
    );
  }

  /** Ensure/create a department and return its record */
  private async ensureDepartment(department: string) {
    const deptResults = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE name = {name:String} LIMIT 1",
      { name: department },
    );
    let dept = deptResults[0];

    if (!dept) {
      const deptId = randomUUID();
      const now = nowCH();
      await this.clickhouse.insert("departments", [
        {
          id: deptId,
          name: department,
          description: "",
          manager: "",
          createdAt: now,
          updatedAt: now,
        },
      ]);
      dept = { id: deptId, name: department };
    }
    return dept;
  }

  /** Validate credentials and return the DB user (or throw) */
  private async validateCredentials(
    user: any | null,
    password: string,
    logContext: string,
  ): Promise<any> {
    if (!user) {
      this.logger.warn(`Login failed — user not found [${logContext}]`);
      throw new UnauthorizedException(
        "Хэрэглэгч олдсонгүй эсвэл нууц үг буруу байна",
      );
    }
    if (!user.isActive) {
      this.logger.warn(`Login failed — inactive user [${logContext}]`);
      // Use the same generic message as "user not found" to prevent user enumeration
      throw new UnauthorizedException(
        "Хэрэглэгч олдсонгүй эсвэл нууц үг буруу байна",
      );
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed — wrong password [${logContext}]`);
      throw new UnauthorizedException(
        "Хэрэглэгч олдсонгүй эсвэл нууц үг буруу байна",
      );
    }
    return user;
  }

  // ─── Generate User ID ───────────────────────────────────────────────────────

  private generateUserId(
    department: string,
    name: string,
    code?: string,
    position?: string,
  ): string {
    return buildUserId(department, name, code, position);
  }

  // ─── Public Methods ─────────────────────────────────────────────────────────

  async login(loginDto: LoginDto, clientIp = "unknown") {
    const { department, username, password } = loginDto;
    // [H-4] Lock by username AND IP so an attacker rotating IPs cannot keep
    // a victim's account locked, and an attacker cannot brute-force from one IP
    // by rotating usernames either.
    const lockKey = `login:${department}:${username}:${clientIp}`;

    // Guard runs OUTSIDE try-catch so a lockout error is not counted as a new failure
    await this.guardLogin(lockKey);

    try {
      const dept = (
        await this.clickhouse.query<any>(
          "SELECT * FROM departments WHERE name = {name:String} LIMIT 1",
          { name: department },
        )
      )[0];
      if (!dept) {
        await this.auditLogService.log({
          userId: "unknown",
          action: "login",
          resource: "auth",
          method: "login",
          status: "failure",
          errorMessage: "Department not found",
          metadata: { department, username },
        });
        throw new UnauthorizedException("Хэлтэс олдсонгүй");
      }

      const user = (
        await this.clickhouse.query<any>(
          `SELECT u.*, d.name as departmentName
         FROM users u LEFT JOIN departments d ON u.departmentId = d.id
         WHERE u.name = {username:String} AND u.departmentId = {deptId:String} LIMIT 1`,
          { username, deptId: dept.id },
        )
      )[0];

      await this.validateCredentials(user, password, `dept-login:${username}`);

      if (isPrivilegedUser(user)) {
        // ForbiddenException (NOT UnauthorizedException) — correct credentials but
        // wrong endpoint. This ensures the catch block does NOT count it as a failed
        // login, preventing DoS-lockout of admin accounts via their own correct password.
        throw new ForbiddenException(
          "Админ хэрэглэгч энд нэвтрэх боломжгүй. Админ хуудсаар нэвтэрнэ үү.",
        );
      }

      await this.clearFailedLogins(lockKey); // [CRIT-2] async
      await this.updateLastLogin(user.id);

      const accessToken = this.generateTokenForUser(user);
      const refreshToken = await this.generateRefreshToken(user.id);

      await this.auditLogService.log({
        userId: user.id,
        action: "login",
        resource: "auth",
        method: "login",
        status: "success",
        metadata: { department, username },
      });

      return {
        user: this.formatUserResponse(user),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.recordFailedLogin(lockKey); // [CRIT-2] async
      } else if (!(error instanceof ForbiddenException)) {
        this.logger.error(`Login error: ${error}`);
      }
      throw error;
    }
  }

  async loginById(loginByIdDto: LoginByIdDto, clientIp = "unknown") {
    const { userId, password } = loginByIdDto;
    const lockKey = `login:${userId}:${clientIp}`; // [H-4] IP-aware

    // Guard runs OUTSIDE try-catch so a lockout error is not counted as a new failure
    await this.guardLogin(lockKey); // [CRIT-2] now async

    try {
      const user = (
        await this.clickhouse.query<any>(
          `SELECT u.*, d.name as departmentName
         FROM users u LEFT JOIN departments d ON u.departmentId = d.id
         WHERE u.userId = {userId:String} AND u.isActive = 1 LIMIT 1`,
          { userId },
        )
      )[0];

      await this.validateCredentials(user, password, `id-login:${userId}`);

      if (isPrivilegedUser(user)) {
        throw new ForbiddenException(
          "Админ хэрэглэгч энд нэвтрэх боломжгүй. Админ хуудсаар нэвтэрнэ үү.",
        );
      }

      await this.clearFailedLogins(lockKey); // [CRIT-2] async

      await this.updateLastLogin(user.id);

      const accessToken = this.generateTokenForUser(user);
      const refreshToken = await this.generateRefreshToken(user.id);

      await this.auditLogService.log({
        userId: user.id,
        action: "login",
        resource: "auth",
        method: "loginById",
        status: "success",
        metadata: { userId },
      });

      return {
        user: this.formatUserResponse(user),
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        await this.recordFailedLogin(lockKey); // [CRIT-2] async
      }
      await this.auditLogService.log({
        userId: "unknown",
        action: "login",
        resource: "auth",
        method: "loginById",
        status: "failure",
        errorMessage: error.message,
        metadata: { userId },
      });
      throw error;
    }
  }

  async adminLogin(adminLoginDto: AdminLoginDto, clientIp = "unknown") {
    const { username, password } = adminLoginDto;
    const lockKey = `admin-login:${username}:${clientIp}`; // [H-4] IP-aware
    // [L-3] admin username removed from log to prevent credential exposure
    this.logger.debug("Admin login attempt received");

    // Guard runs OUTSIDE try-catch so a lockout error is not counted as a new failure
    await this.guardLogin(lockKey); // [CRIT-2] now async

    try {
      const user = (
        await this.clickhouse.query<any>(
          `SELECT u.*, d.name as departmentName
         FROM users u LEFT JOIN departments d ON u.departmentId = d.id
         WHERE u.userId = {userId:String} AND u.isAdmin = 1 LIMIT 1`,
          { userId: username },
        )
      )[0];

      await this.validateCredentials(user, password, `admin-login:${username}`);
      await this.clearFailedLogins(lockKey); // [CRIT-2] async
      // [SEC-4] admin username removed from success log to prevent credential
      // enumeration if log files are compromised. Audit log keeps full record.
      this.logger.log("Admin authentication successful");
      await this.updateLastLogin(user.id);

      const accessToken = this.generateTokenForUser(user);
      const refreshToken = await this.generateRefreshToken(user.id);

      await this.auditLogService.log({
        userId: user.id,
        action: "admin_login",
        resource: "auth",
        method: "adminLogin",
        status: "success",
        metadata: { username, isAdmin: true },
      });

      return {
        user: this.formatUserResponse(user),
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        await this.recordFailedLogin(lockKey); // [CRIT-2] async
      }
      await this.auditLogService.log({
        userId: "unknown",
        action: "admin_login",
        resource: "auth",
        method: "adminLogin",
        status: "failure",
        errorMessage: error.message,
        metadata: { username },
      });
      throw error;
    }
  }

  async validateUser(userId: string) {
    // C-1: AND isActive = 1 ensures deactivated users are rejected on every request,
    // not just at login — their existing JWT becomes invalid immediately after deactivation.
    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.id = {userId:String} AND u.isActive = 1 LIMIT 1`,
      { userId },
    );
    const user = users[0];
    if (!user) {
      this.logger.warn(
        `JWT validation failed — user not found or inactive: ${userId}`,
      );
      return null;
    }
    return this.formatUserResponse(user);
  }

  async searchUsersByUserId(query: string, adminOnly: boolean = false) {
    if (!query || query.length < 3) return { users: [] };
    const pattern = `%${query}%`;
    // If adminOnly is true, show only admins. Otherwise, hide admins from search.
    const adminFilter = adminOnly
      ? "AND u.isAdmin = 1"
      : `AND ${webVisibleUserSql("u")}`;
    const users = await this.clickhouse.query<any>(
      `SELECT u.id, u.name, u.userId, u.position, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE (u.isActive = 1 OR u.password LIKE 'PENDING:%')
         ${adminFilter}
         AND (u.userId LIKE {pattern:String} OR u.name LIKE {pattern:String})
       LIMIT 10`,
      { pattern },
    );
    return {
      users: users.map((u) => ({
        name: u.name,
        userId: u.userId || "",
        department: u.departmentName || "",
        // [SEC] `position` is only needed by the (currently unused) admin
        // search path — the public pre-auth login autocomplete doesn't
        // render it, so don't hand it to anonymous callers. Minimizes
        // PII exposed via this unauthenticated enumeration surface.
        ...(adminOnly ? { position: u.position, id: u.id } : {}),
      })),
    };
  }

  async checkUser(checkUserDto: CheckUserDto) {
    const { userId } = checkUserDto;
    const users = await this.clickhouse.query<any>(
      `SELECT userId, password, isActive, isAdmin, isSuperAdmin FROM users WHERE userId = {userId:String} LIMIT 1`,
      { userId },
    );
    const user = users[0];
    if (!user) {
      // No live account yet — surface an in-flight registration request's
      // status (pending/rejected) instead of a bare "not found" so the login
      // page can show a helpful message.
      const reqRows = await this.clickhouse.query<any>(
        `SELECT status FROM registration_requests FINAL
         WHERE userId = {userId:String} ORDER BY updatedAt DESC LIMIT 1`,
        { userId },
      );
      const registrationStatus = reqRows[0]?.status as string | undefined;
      if (registrationStatus === "pending" || registrationStatus === "rejected") {
        return { exists: false, hasPassword: false, registrationStatus };
      }
      return { exists: false, hasPassword: false };
    }

    if (isPrivilegedUser(user)) {
      throw new ForbiddenException(
        "Админ хэрэглэгч энд нэвтрэх боломжгүй. Админ хуудсаар нэвтэрнэ үү.",
      );
    }

    const isPending = String(user.password ?? "").startsWith("PENDING:");
    const hasPassword = user.password && user.password.length > 0 && !isPending;

    if (isPending) {
      return {
        exists: true,
        hasPassword: false,
        userId: user.userId,
        isActive: !!user.isActive,
        needsPasswordSetup: true,
      };
    }

    return {
      exists: true,
      hasPassword,
      userId: user.userId,
      isActive: !!user.isActive,
    };
  }

  // [SEC] Public self-registration no longer creates a live account directly —
  // it only files a request (registration_requests, status='pending'). An
  // admin must approve it (see reviewRegistration) before the actual `users`
  // row + one-time claim token are created. This closes a gap where anyone
  // who could derive a coworker's deterministic userId (dept+name) could
  // self-provision an account with zero human review.
  async registerUser(registerUserDto: RegisterUserDto) {
    const { department, position, name } = registerUserDto;

    // Хэлтсийн динамик prefix кодыг DB-аас уншина (employeeCount-г өсгөхгүйгээр)
    const deptRows = await this.clickhouse.query<any>(
      "SELECT code FROM departments WHERE name = {name:String} LIMIT 1",
      { name: department },
    );
    const deptCode = deptRows[0]?.code || "";

    const userId = this.generateUserId(department, name, deptCode, position);

    const existing = await this.clickhouse.query<any>(
      "SELECT id, password FROM users WHERE userId = {userId:String} LIMIT 1",
      { userId },
    );
    if (existing.length > 0) {
      const pending = String(existing[0].password ?? "").startsWith("PENDING:");
      if (pending) {
        throw new ConflictException(
          "Энэ ID-тай бүртгэл аль хэдийн эхэлсэн байна. Нууц үгээ тохируулаагүй бол админд хандана уу.",
        );
      }
      throw new ConflictException(
        `Энэ хэрэглэгчийн ID (${userId}) аль хэдийн бүртгэлтэй байна`,
      );
    }

    const pendingReq = await this.clickhouse.query<any>(
      `SELECT status FROM registration_requests FINAL
       WHERE userId = {userId:String} ORDER BY updatedAt DESC LIMIT 1`,
      { userId },
    );
    if (pendingReq[0]?.status === "pending") {
      throw new ConflictException(
        "Энэ ID-тай бүртгэлийн хүсэлт аль хэдийн илгээгдсэн байна. Админ баталгаажуулах хүртэл хүлээнэ үү.",
      );
    }

    const dept = await this.ensureDepartment(department);
    const id = randomUUID();
    const now = nowCH();

    await this.clickhouse.insert("registration_requests", [
      {
        id,
        userId,
        name,
        department,
        departmentId: dept.id,
        position,
        status: "pending",
        claimToken: "",
        reviewedBy: "",
        reviewedByName: "",
        reviewNote: "",
        requestedAt: now,
        reviewedAt: "1970-01-01 00:00:00",
        updatedAt: now,
      },
    ]);

    await this.auditLogService.log({
      userId: "unknown",
      action: "registration_request",
      resource: "registration_requests",
      resourceId: id,
      method: "registerUser",
      status: "success",
      metadata: { userId, department, position },
    });

    return {
      success: true,
      userId,
      name,
      department,
      position,
      message:
        "Хүсэлт амжилттай илгээгдлээ. Админ баталгаажуулсны дараа нэвтрэх боломжтой болно.",
    };
  }

  /** Admin: list registration requests (optionally filtered by status) */
  async getRegistrationRequests(status?: string) {
    const rows = status
      ? await this.clickhouse.query<any>(
          `SELECT * FROM registration_requests FINAL
           WHERE status = {status:String} ORDER BY requestedAt DESC`,
          { status },
        )
      : await this.clickhouse.query<any>(
          `SELECT * FROM registration_requests FINAL ORDER BY requestedAt DESC`,
        );

    // claimToken intentionally omitted here — it's only ever returned once,
    // synchronously, from reviewRegistration()'s approve response.
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      department: r.department,
      position: r.position,
      status: r.status,
      reviewedByName: r.reviewedByName || null,
      reviewNote: r.reviewNote || null,
      requestedAt: r.requestedAt,
      reviewedAt:
        r.reviewedAt && r.reviewedAt !== "1970-01-01 00:00:00"
          ? r.reviewedAt
          : null,
    }));
  }

  /** Admin: approve or reject a pending registration request */
  async reviewRegistration(
    requestId: string,
    reviewer: { id: string; name?: string },
    dto: ReviewRegistrationDto,
  ) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM registration_requests FINAL WHERE id = {id:String} LIMIT 1`,
      { id: requestId },
    );
    const req = rows[0];
    if (!req) throw new NotFoundException("Хүсэлт олдсонгүй");
    if (req.status !== "pending") {
      throw new BadRequestException("Хүсэлт аль хэдийн шийдвэрлэгдсэн байна");
    }

    const now = nowCH();

    if (dto.action === "reject") {
      await this.clickhouse.insert("registration_requests", [
        {
          ...req,
          status: "rejected",
          reviewedBy: reviewer.id,
          reviewedByName: reviewer.name ?? "",
          reviewNote: dto.reviewNote ?? "",
          reviewedAt: now,
          updatedAt: now,
        },
      ]);
      await this.auditLogService.log({
        userId: reviewer.id,
        action: "registration_reject",
        resource: "registration_requests",
        resourceId: requestId,
        method: "reviewRegistration",
        status: "success",
        metadata: { targetUserId: req.userId },
      });
      return { success: true, status: "rejected" as const };
    }

    // Approve — re-check for a userId collision (race: someone else may have
    // registered/been approved with the same derived ID meanwhile).
    const existing = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE userId = {userId:String} LIMIT 1",
      { userId: req.userId },
    );
    if (existing.length > 0) {
      throw new ConflictException(
        `Энэ хэрэглэгчийн ID (${req.userId}) аль хэдийн бүртгэлтэй байна`,
      );
    }

    // [N-3] One-time claim token — only ever shown to the reviewing admin,
    // who relays it to the employee out-of-band (chat/in person) so they can
    // set their own password. Nobody else can claim the account without it.
    const claimToken = randomUUID();
    const userRowId = randomUUID();

    await this.clickhouse.insert("users", [
      {
        id: userRowId,
        userId: req.userId,
        password: "PENDING:" + claimToken,
        name: req.name,
        position: req.position,
        departmentId: req.departmentId,
        isAdmin: 0,
        isActive: 1,
        allowedTools: JSON.stringify([]),
        profileImage: "",
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await this.clickhouse.insert("registration_requests", [
      {
        ...req,
        status: "approved",
        claimToken,
        reviewedBy: reviewer.id,
        reviewedByName: reviewer.name ?? "",
        reviewNote: dto.reviewNote ?? "",
        reviewedAt: now,
        updatedAt: now,
      },
    ]);

    await this.auditLogService.log({
      userId: reviewer.id,
      action: "registration_approve",
      resource: "registration_requests",
      resourceId: requestId,
      method: "reviewRegistration",
      status: "success",
      metadata: { targetUserId: req.userId },
    });

    return {
      success: true,
      status: "approved" as const,
      userId: req.userId,
      name: req.name,
      claimToken,
      message:
        "Хэрэглэгчийг баталгаажууллаа. Доорх кодыг ажилтанд өгч нууц үгээ тохируулахыг мэдэгдэнэ үү.",
    };
  }

  // [MED-2] Password complexity regex — shared by setPassword & changePassword
  private readonly PASSWORD_COMPLEXITY_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+\[\]{}|;:',.\/<>~`])[A-Za-z\d@$!%*?&#^()\-_=+\[\]{}|;:',.\/<>~`]+$/;

  private validatePasswordComplexity(password: string): void {
    if (!password || password.length < 8) {
      throw new BadRequestException(
        "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой",
      );
    }
    if (!this.PASSWORD_COMPLEXITY_REGEX.test(password)) {
      throw new BadRequestException(
        "Нууц үг нь том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой",
      );
    }
  }

  async setPassword(setPasswordDto: SetPasswordDto) {
    const { userId, password, claimToken } = setPasswordDto;

    // [MED-2] Validate complexity before querying DB
    this.validatePasswordComplexity(password);

    // [H-3] Brute-force guard — rate-limit setPassword attempts per userId
    await this.guardLogin("setpw:" + userId);

    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.userId = {userId:String} LIMIT 1`,
      { userId },
    );
    const user = users[0];
    if (!user) {
      await this.recordFailedLogin("setpw:" + userId);
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }
    if (isPrivilegedUser(user)) {
      throw new ForbiddenException(
        "Админ хэрэглэгч энд нэвтрэх боломжгүй. Админ хуудсаар нэвтэрнэ үү.",
      );
    }
    if (user.password && !user.password.startsWith("PENDING:")) {
      await this.recordFailedLogin("setpw:" + userId);
      throw new BadRequestException("Нууц үг аль хэдийн тохируулагдсан байна");
    }
    // [N-3] Validate claim token — prevents an attacker from setting another user's password
    if (user.password !== "PENDING:" + claimToken) {
      await this.recordFailedLogin("setpw:" + userId);
      throw new UnauthorizedException("Нууц үг тохируулах эрх байхгүй байна");
    }

    const hashedPassword = await bcrypt.hash(password, 13);
    const updatedAt = nowCH();
    await this.clickhouse.replaceRows(
      "users",
      "id = {id:String}",
      { id: user.id },
      [
        {
          id: user.id,
          userId: user.userId,
          password: hashedPassword,
          name: user.name ?? "",
          position: user.position ?? "",
          profileImage: user.profileImage ?? "",
          departmentId: user.departmentId ?? "",
          isAdmin: Number(user.isAdmin) || 0,
          isSuperAdmin: Number(user.isSuperAdmin) || 0,
          isActive: 1,
          allowedTools:
            typeof user.allowedTools === "string"
              ? user.allowedTools
              : JSON.stringify(user.allowedTools ?? []),
          grantableTools:
            typeof user.grantableTools === "string"
              ? user.grantableTools
              : JSON.stringify(user.grantableTools ?? []),
          lastLoginAt: user.lastLoginAt ?? null,
          createdAt: user.createdAt,
          updatedAt,
        },
      ],
    );

    await this.clearFailedLogins("setpw:" + userId);
    const activeUser = { ...user, password: hashedPassword, isActive: 1 };
    const accessToken = this.generateTokenForUser(activeUser);
    const refreshToken = await this.generateRefreshToken(user.id);
    return {
      success: true,
      user: this.formatUserResponse(activeUser),
      accessToken,
      refreshToken,
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // [MED-2] Validate new password complexity
    this.validatePasswordComplexity(newPassword);

    const userResult = await this.clickhouse.query<any>(
      "SELECT * FROM users WHERE id = {userId:String} LIMIT 1",
      { userId },
    );
    const user = userResult[0];
    if (!user) throw new NotFoundException("Хэрэглэгч олдсонгүй");

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException("Одоогийн нууц үг буруу байна");

    const hashedPassword = await bcrypt.hash(newPassword, 13);
    await this.clickhouse.replaceRows(
      "users",
      "id = {id:String}",
      { id: userId },
      [
        {
          id: user.id,
          userId: user.userId,
          password: hashedPassword,
          name: user.name ?? "",
          position: user.position ?? "",
          profileImage: user.profileImage ?? "",
          departmentId: user.departmentId ?? "",
          isAdmin: Number(user.isAdmin) || 0,
          isSuperAdmin: Number(user.isSuperAdmin) || 0,
          isActive: user.isActive === undefined ? 1 : Number(user.isActive),
          allowedTools:
            typeof user.allowedTools === "string"
              ? user.allowedTools
              : JSON.stringify(user.allowedTools ?? []),
          grantableTools:
            typeof user.grantableTools === "string"
              ? user.grantableTools
              : JSON.stringify(user.grantableTools ?? []),
          lastLoginAt: user.lastLoginAt ?? null,
          createdAt: user.createdAt,
          updatedAt: nowCH(),
        },
      ],
    );

    await this.revokeRefreshTokens(userId);

    await this.auditLogService.log({
      userId,
      action: "password_change",
      resource: "auth",
      method: "changePassword",
      status: "success",
    });

    return {
      success: true,
      message: "Нууц үг амжилттай солигдлоо. Дахин нэвтэрнэ үү.",
    };
  }

  /**
   * Nightly cleanup of expired and already-revoked refresh tokens (M-3).
   * Prevents unbounded table growth — ScheduleModule is registered in AppModule.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredRefreshTokens(): Promise<void> {
    try {
      await this.clickhouse.exec(
        "ALTER TABLE refresh_tokens DELETE WHERE expiresAt < now() OR isRevoked = 1",
      );
      this.logger.log("Expired/revoked refresh tokens cleaned up");
    } catch (err) {
      this.logger.error(`Failed to clean up refresh tokens: ${err}`);
    }
  }
}
