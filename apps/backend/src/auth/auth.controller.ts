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
import { AdminGuard } from "./guards/admin.guard";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

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

    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSecure ? "none" : "lax",
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
      sameSite: cookieSecure ? "none" : "lax",
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
  @UseGuards(ThrottlerGuard)
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

  // Admin: list registration requests (?status=pending|approved|rejected)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("registration-requests")
  async getRegistrationRequests(@Query("status") status?: string) {
    return this.authService.getRegistrationRequests(status);
  }

  // Admin: approve or reject a pending registration request
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("registration-requests/:id")
  async reviewRegistration(
    @Param("id") id: string,
    @Body() dto: ReviewRegistrationDto,
    @Request() req: ExpressRequest & { user: Record<string, unknown> },
  ) {
    return this.authService.reviewRegistration(
      id,
      { id: req.user.id as string, name: req.user.name as string },
      dto,
    );
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
    // Cookie takes priority; fall back to body for API tools
    const token =
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
