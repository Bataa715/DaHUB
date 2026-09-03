import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import { Request as ExpressRequest, Response, CookieOptions } from "express";
import { AuthService } from "./auth.service";
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
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { AuditLogService } from "../audit/audit-log.service";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private auditLogService: AuditLogService,
  ) {}

  // [N-2] Set access + refresh tokens as HttpOnly cookies
  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    isAdmin = false,
  ): void {
    /**
     * HTTP deploy үед COOKIE_SECURE=false байх ёстой.
     * HTTPS deploy хийсэн үед COOKIE_SECURE=true болгоно.
     */
    const cookieSecure = process.env.COOKIE_SECURE === "true";

    const tokenName = isAdmin ? "adminToken" : "token";
    const refreshName = isAdmin ? "adminRefreshToken" : "refreshToken";

    // [SEC/CSRF] sameSite="lax" бүх горимд — frontend/backend нэг сайт дээр
    // (reverse proxy ард) ажилладаг тул "none" шаардлагагүй бөгөөд "none" нь
    // гадны сайтын form POST-д cookie хавсаргаж CSRF гарц нээдэг байсан.
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: "lax",
      path: "/",
    };

    res.cookie(tokenName, accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie(refreshName, refreshToken, {
      ...cookieOptions,
      maxAge: 3 * 60 * 60 * 1000, // 3 hours
    });
  }

  // Prevent proxies/browsers from caching token-bearing auth responses
  private setNoStore(res: Response): void {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.set("Pragma", "no-cache");
  }

  // [N-2] Clear both token cookies on logout / session expiry
  private clearAuthCookies(res: Response, isAdmin = false): void {
    const cookieSecure = process.env.COOKIE_SECURE === "true";

    const opts: CookieOptions = {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: "lax",
      path: "/",
    };

    res.clearCookie(isAdmin ? "adminToken" : "token", opts);
    res.clearCookie(isAdmin ? "adminRefreshToken" : "refreshToken", opts);
  }

  // [H-4/SEC-FIX] Extract caller IP for brute-force lockout key.
  //
  // ⚠️ Do NOT read `x-forwarded-for` directly — that header is fully
  // attacker-controlled on any request that reaches this server directly
  // (or through an untrusted hop), letting an attacker rotate the value on
  // every request to reset/bypass the login lockout entirely.
  //
  // `req.ip` is populated by Express and correctly honours the app-level
  // `trust proxy` setting (see main.ts) — it only trusts X-Forwarded-For
  // when the connection actually originates from a configured trusted proxy
  // hop, and falls back to the raw socket address otherwise.
  private clientIp(req: ExpressRequest): string {
    return req.ip || req.socket?.remoteAddress || "unknown";
  }

  // Check if user exists
  // [AUDIT] 10/мин — default 120/мин нь ажилтдын лавлахыг скриптээр
  // enumerate хийхэд хангалттай байсан.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("check-user")
  async checkUser(@Body() checkUserDto: CheckUserDto) {
    return this.authService.checkUser(checkUserDto);
  }

  // Register new user — public self-registration
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post("register")
  async registerUser(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.registerUser(registerUserDto);
  }

  // [ACCESS] Registrations are superadmin-only (a plain admin is limited to
  // tool-permission granting + own password).
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Get("registration-requests")
  async getRegistrationRequests(@Query("status") status?: string) {
    return this.authService.getRegistrationRequests(status);
  }

  // Approve or reject a pending registration request — superadmin-only.
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch("registration-requests/:id")
  async reviewRegistration(
    @Param("id") id: string,
    @Body() dto: ReviewRegistrationDto,
    @Request() req: ExpressRequest & { user: Record<string, unknown> },
  ) {
    try {
      const result = await this.authService.reviewRegistration(
        id,
        { id: req.user.id as string, name: req.user.name as string },
        dto,
      );
      await this.auditLogService.log({
        userId: req.user.id as string,
        action: "registration_review",
        resource: "registration_requests",
        method: "update",
        status: "success",
        metadata: { targetId: id, decision: dto.action },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user.id as string,
        action: "registration_review",
        resource: "registration_requests",
        method: "update",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id, decision: dto?.action },
      });
      throw error;
    }
  }

  // Set password for first-time user
  @UseGuards(ThrottlerGuard)
  @Post("set-password")
  async setPassword(
    @Body() setPasswordDto: SetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.setPassword(setPasswordDto);

    this.setNoStore(res);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      success: true,
    };
  }

  @UseGuards(ThrottlerGuard)
  @Post("login")
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, this.clientIp(req));

    this.setNoStore(res);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      success: true,
    };
  }

  @UseGuards(ThrottlerGuard)
  @Post("login-by-id")
  async loginById(
    @Body() loginByIdDto: LoginByIdDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginById(
      loginByIdDto,
      this.clientIp(req),
    );

    this.setNoStore(res);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      success: true,
    };
  }

  @UseGuards(ThrottlerGuard)
  @Post("admin-login")
  async adminLogin(
    @Body() adminLoginDto: AdminLoginDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.adminLogin(
      adminLoginDto,
      this.clientIp(req),
    );

    this.setNoStore(res);
    this.setAuthCookies(res, result.accessToken, result.refreshToken, true);

    return {
      user: result.user,
      success: true,
    };
  }

  // [SEC] Public (pre-auth) login-autocomplete search. Cannot require
  // JwtAuthGuard here — the user hasn't logged in yet. This is inherently
  // an unauthenticated employee-directory/userId-enumeration surface, so
  // keep it as tight as the UX allows: short min-query length + small
  // LIMIT are enforced in the service, `position` is stripped from the
  // public response (see searchUsersByUserId), and the per-IP throttle is
  // tighter than a typical read endpoint to slow down bulk enumeration.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get("search")
  async searchUsers(@Query("q") query: string) {
    return this.authService.searchUsersByUserId(query, false);
  }

  // [SEC] Public (pre-auth) department→employee list for the login page.
  // Same enumeration posture as `search`: no admins, active/claimable only.
  // `position` is returned so the client can rank Захирал → Ахлах → Аудитор.
  //
  // [PERF/429] This endpoint is reached via the Next.js proxy route
  // (/api/auth/by-department → server-side fetch), so the backend sees EVERY
  // user's request as coming from ONE IP (the Next server). A tight per-IP
  // throttle therefore acts as a single GLOBAL limit shared by all users on the
  // login page — with many staff behind the same corporate NAT it tripped 429
  // almost immediately. The real fix is client-side caching (each user fetches
  // each department at most once) + a browser Cache-Control on the proxy route;
  // the limit here is just a generous abuse ceiling for a cheap, public read.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  @Get("by-department")
  async listUsersByDepartment(@Query("department") department: string) {
    return this.authService.listUsersByDepartment(department);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(
    @Request() req: ExpressRequest & { user: Record<string, unknown> },
  ) {
    return req.user;
  }

  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Post("change-password")
  async changePassword(
    @Request() req: ExpressRequest & { user: Record<string, unknown> },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.id as string,
      changePasswordDto,
    );
  }

  // 30 requests/min — enough for silent auto-refresh but limits token-grinding attacks
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("refresh")
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: ExpressRequest & { cookies: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Access cookie-той таарах refresh-ийг сонгоно.
    // adminToken (хугацаа дууссан ч) байвал adminRefreshToken;
    // эсрэгээрээ энгийн refreshToken.
    const token =
      (req.cookies?.adminToken && req.cookies?.adminRefreshToken
        ? req.cookies.adminRefreshToken
        : null) ||
      req.cookies?.refreshToken ||
      req.cookies?.adminRefreshToken ||
      refreshTokenDto.refreshToken;

    if (!token) {
      throw new UnauthorizedException("Refresh token not found");
    }

    const result = await this.authService.refreshAccessToken({
      refreshToken: token,
    });

    const isAdmin = !!result.user?.isAdmin;

    this.setNoStore(res);
    this.setAuthCookies(res, result.accessToken, result.refreshToken, isAdmin);

    return {
      user: result.user,
      success: true,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(
    @Request() req: ExpressRequest & { user: Record<string, unknown> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const isAdmin = !!req.user?.isAdmin;

    this.clearAuthCookies(res, isAdmin);
    // Also clear the other side in case both were set
    this.clearAuthCookies(res, !isAdmin);

    return this.authService.revokeRefreshTokens(req.user.id as string);
  }
}
