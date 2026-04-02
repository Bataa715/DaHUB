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
import { ConfigService } from "@nestjs/config";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { AuditLogService } from "../audit/audit-log.service";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { DEPARTMENT_CODES } from "../common/constants/departments"; // [LOW-1] shared constant
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  SignupDto,
  LoginDto,
  AdminLoginDto,
  LoginByIdDto,
  CheckUserDto,
  RegisterUserDto,
  SetPasswordDto,
  ChangePasswordDto,
  RefreshTokenDto,
} from "./dto/auth.dto";

// [LOW-1] DEPARTMENT_CODES is now imported from src/common/constants/departments.ts

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ─── [CRIT-2] ClickHouse-backed brute-force protection ──────────────────────
  // Replaces the previous in-memory Map which was lost on every server restart.
  // login_attempts table schema → scripts/create-login-attempts.sql
  private readonly MAX_ATTEMPTS = 5;
  private readonly ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 min window
  private readonly LOCKOUT_MS = 15 * 60 * 1000;        // 15 min lockout

  /** Throws if the key is currently locked out. */
  private async guardLogin(key: string): Promise<void> {
    const windowStart = new Date(Date.now() - this.ATTEMPT_WINDOW_MS)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const rows = await this.clickhouse.query<any>(
      `SELECT
         countIf(success = 0) AS failures,
         maxIf(attemptedAt, success = 0) AS lastFailure
       FROM login_attempts
       WHERE lockKey = {key:String} AND attemptedAt >= {windowStart:String}`,
      { key, windowStart },
    );

    const failures = Number(rows[0]?.failures ?? 0);
    const lastFailureStr: string = rows[0]?.lastFailure ?? "";

    if (failures >= this.MAX_ATTEMPTS && lastFailureStr) {
      const lastFailureMs = new Date(lastFailureStr).getTime();
      const lockedUntilMs = lastFailureMs + this.LOCKOUT_MS;
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
          id: randomUUID(),
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
          id: randomUUID(),
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
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) { }

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
      allowedTools: user.allowedTools ? JSON.parse(user.allowedTools) : [],
      grantableTools: user.grantableTools
        ? JSON.parse(user.grantableTools)
        : [],
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
      sub: user.id,          // standard JWT subject claim
      id: user.id,           // kept for backwards compatibility
      userId: user.userId,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      allowedTools: user.allowedTools ? JSON.parse(user.allowedTools) : [],
    });
  }

  /** Generate a refresh token and store it in the database */
  private async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // [MED-1] Refresh token valid for 7 days (was 30)

    const now = nowCH();
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");

    await this.clickhouse.insert("refresh_tokens", [
      {
        id: randomUUID(),
        userId,
        token: refreshToken,
        expiresAt: expiresAtStr,
        isRevoked: 0,
        createdAt: now,
      },
    ]);

    return refreshToken;
  }

  /** Validate and use a refresh token to generate a new access token */
  async refreshAccessToken(refreshTokenDto: RefreshTokenDto): Promise<any> {
    const { refreshToken } = refreshTokenDto;

    // Find the refresh token
    const tokens = (await this.clickhouse.query(
      `SELECT * FROM refresh_tokens 
       WHERE token = {token:String} 
       AND isRevoked = 0 
       AND expiresAt > now() 
       LIMIT 1`,
      { token: refreshToken },
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

    // Generate new tokens
    const accessToken = this.generateTokenForUser(user);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    // Revoke the old refresh token (single-use)
    await this.clickhouse.exec(
      "ALTER TABLE refresh_tokens UPDATE isRevoked = 1 WHERE token = {token:String}",
      { token: refreshToken },
    );

    return {
      user: this.formatUserResponse(user),
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /** Revoke all refresh tokens for a user (on logout) */
  async revokeRefreshTokens(userId: string): Promise<any> {
    await this.clickhouse.exec(
      "ALTER TABLE refresh_tokens UPDATE isRevoked = 1 WHERE userId = {userId:String}",
      { userId },
    );
    return { success: true, message: "All refresh tokens revoked" };
  }

  /** Stamp the user's lastLoginAt */
  private async updateLastLogin(userId: string): Promise<void> {
    await this.clickhouse.exec(
      "ALTER TABLE users UPDATE lastLoginAt = {lastLoginAt:String} WHERE id = {id:String}",
      {
        lastLoginAt: nowCH(),
        id: userId,
      },
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
          employeeCount: 1,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      dept = { id: deptId, name: department };
    } else {
      await this.clickhouse.exec(
        "ALTER TABLE departments UPDATE employeeCount = employeeCount + 1 WHERE id = {id:String}",
        { id: dept.id },
      );
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

  private async generateUserId(
    department: string,
    name: string,
  ): Promise<string> {
    const deptCode = DEPARTMENT_CODES[department] || "USR";
    const namePart = name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("-")
      .replace(/\s+/g, "");

    if (department === "Удирдлага") return `.${namePart}-${deptCode}`;
    if (department === "Дата анализын алба") return `${deptCode}-${namePart}`;
    return `DAG-${deptCode}-${namePart}`;
  }

  // ─── Public Methods ─────────────────────────────────────────────────────────

  async signup(signupDto: SignupDto) {
    const { password, name, department, position } = signupDto;
    const userId = await this.generateUserId(department, name);

    // Only conflict if an active user exists — handles the case where a deleted
    // user's row is still physically present due to async ClickHouse mutation.
    const existing = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE userId = {userId:String} AND isActive = 1 LIMIT 1",
      { userId },
    );
    if (existing[0]) {
      throw new ConflictException(
        `Энэ хэрэглэгчийн ID (${userId}) аль хэдийн бүртгэлтэй байна`,
      );
    }

    return this.createUser(password, name, department, position, userId);
  }

  private async createUser(
    password: string,
    name: string,
    department: string,
    position: string,
    usrId: string,
  ) {
    const hashedPassword = await bcrypt.hash(password, 12); // [LOW-3] cost 12
    const dept = await this.ensureDepartment(department);
    const id = randomUUID();
    const now = nowCH();

    await this.clickhouse.insert("users", [
      {
        id,
        userId: usrId,
        password: hashedPassword,
        name,
        position,
        departmentId: dept.id,
        isAdmin: 0,
        isActive: 1,
        allowedTools: JSON.stringify(["todo"]),
        profileImage: "",
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const fakeUser = {
      id,
      userId: usrId,
      departmentName: department,
      departmentId: dept.id,
      isAdmin: 0,
      allowedTools: JSON.stringify(["todo"]),
      name,
      position,
    };
    // Do NOT return tokens: admin-created accounts must authenticate themselves.
    // Returning a JWT here would give the calling admin a live token for another user.
    return {
      user: this.formatUserResponse(fakeUser),
      message: "Хэрэглэгч амжилттай үүслээ",
    };
  }

  async login(loginDto: LoginDto) {
    const { department, username, password } = loginDto;
    const lockKey = `login:${department}:${username}`;

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

      if (user.isAdmin) {
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

  async loginById(loginByIdDto: LoginByIdDto) {
    const { userId, password } = loginByIdDto;
    const lockKey = `login:${userId}`;

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

      if (user.isAdmin) {
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
    } catch (error) {
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

  async adminLogin(adminLoginDto: AdminLoginDto) {
    const { username, password } = adminLoginDto;
    const lockKey = `admin-login:${username}`;
    this.logger.debug(`Admin login attempt for userId: ${username}`);

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
      this.logger.log(`Admin login successful: ${username}`);
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
    } catch (error) {
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

  async getUsersByDepartment(departmentName: string) {
    const users = await this.clickhouse.query<any>(
      `SELECT u.id, u.name, u.position
       FROM users u JOIN departments d ON u.departmentId = d.id
       WHERE d.name = {departmentName:String} AND u.isActive = 1`,
      { departmentName },
    );
    return { users: users || [] };
  }

  async searchUsersByUserId(query: string, adminOnly: boolean = false) {
    if (!query || query.length < 2) return { users: [] };
    const pattern = `%${query}%`;
    // If adminOnly is true, show only admins. Otherwise, hide admins from search.
    const adminFilter = adminOnly ? "AND u.isAdmin = 1" : "AND u.isAdmin = 0";
    const users = await this.clickhouse.query<any>(
      `SELECT u.id, u.name, u.userId, u.position, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.isActive = 1 ${adminFilter} AND (u.userId LIKE {pattern:String} OR u.name LIKE {pattern:String})
       LIMIT 10`,
      { pattern },
    );
    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        userId: u.userId || "",
        department: u.departmentName || "",
        position: u.position,
      })),
    };
  }

  async checkUser(checkUserDto: CheckUserDto) {
    const { userId } = checkUserDto;
    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.userId = {userId:String} LIMIT 1`,
      { userId },
    );
    const user = users[0];
    if (!user)
      return {
        exists: false,
        hasPassword: false,
        userId: null,
        name: null,
        department: null,
      };

    const hasPassword =
      user.password &&
      user.password.length > 0 &&
      !user.password.startsWith("PENDING_");
    return {
      exists: true,
      hasPassword,
      userId: user.userId,
      name: user.name,
      department: user.departmentName || null,
    };
  }

  async registerUser(registerUserDto: RegisterUserDto) {
    const { department, position, name } = registerUserDto;

    const userId = await this.generateUserId(department, name);

    const existing = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE userId = {userId:String} LIMIT 1",
      { userId },
    );
    if (existing.length > 0) {
      throw new ConflictException(
        `Энэ хэрэглэгчийн ID (${userId}) аль хэдийн бүртгэлтэй байна`,
      );
    }

    const dept = await this.ensureDepartment(department);
    const id = randomUUID();
    const now = nowCH();

    await this.clickhouse.insert("users", [
      {
        id,
        userId,
        password: "PENDING_PASSWORD",
        name,
        position,
        departmentId: dept.id,
        isAdmin: 0,
        isActive: 1,
        allowedTools: JSON.stringify(["todo"]),
        profileImage: "",
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    return {
      success: true,
      userId,
      name,
      department,
      position,
      message: "Бүртгэл амжилттай. Нууц үгээ үүсгэнэ үү.",
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
    const { userId, password } = setPasswordDto;

    // [MED-2] Validate complexity before querying DB
    this.validatePasswordComplexity(password);

    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.userId = {userId:String} LIMIT 1`,
      { userId },
    );
    const user = users[0];
    if (!user) throw new NotFoundException("Хэрэглэгч олдсонгүй");
    if (user.password && !user.password.startsWith("PENDING_")) {
      throw new BadRequestException("Нууц үг аль хэдийн тохируулагдсан байна");
    }

    const hashedPassword = await bcrypt.hash(password, 12); // [LOW-3] cost 12
    await this.clickhouse.exec(
      "ALTER TABLE users UPDATE password = {password:String} WHERE id = {id:String}",
      {
        password: hashedPassword,
        id: user.id,
      },
    );

    const accessToken = this.generateTokenForUser(user);
    const refreshToken = await this.generateRefreshToken(user.id);
    return {
      success: true,
      user: this.formatUserResponse(user),
      accessToken,
      refreshToken,
      token: accessToken, // for frontend compatibility
    };
  }

  getUserIdPrefix(department: string): string {
    const deptCode = DEPARTMENT_CODES[department] || "USR";
    if (department === "Удирдлага") return `.`;
    return `DAG-${deptCode}-`;
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

    const hashedPassword = await bcrypt.hash(newPassword, 12); // [LOW-3] cost 12
    await this.clickhouse.exec(
      "ALTER TABLE users UPDATE password = {password:String}, updatedAt = {updatedAt:String} WHERE id = {id:String}",
      {
        password: hashedPassword,
        updatedAt: nowCH(),
        id: userId,
      },
    );

    return { success: true, message: "Нууц үг амжилттай солигдлоо" };
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
