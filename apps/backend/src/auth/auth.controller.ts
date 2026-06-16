import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import {
  Request as ExpressRequest,
  Response,
  CookieOptions,
} from "express";
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
} from "./dto/auth.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

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
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    });
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

  // [H-4] Extract caller IP for brute-force lockout key.
  // Honours X-Forwarded-For when behind a trusted reverse proxy.
  private clientIp(req: ExpressRequest): string {
    const xff = (req.headers?.["x-forwarded-for"] || "")
      .toString()
      .split(",")[0]
      .trim();

    return xff || req.ip || req.socket?.remoteAddress || "unknown";
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

  // Set password for first-time user
  @UseGuards(ThrottlerGuard)
  @Post("set-password")
  async setPassword(
    @Body() setPasswordDto: SetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.setPassword(setPasswordDto);

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

    this.setAuthCookies(res, result.accessToken, result.refreshToken, true);

    return {
      user: result.user,
      success: true,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("departments/:department/users")
  async getUsersByDepartment(
    @Param("department") department: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.authService.getUsersByDepartment(
      department,
      Number(limit) || 100,
      Number(offset) || 0,
    );
  }

  @UseGuards(ThrottlerGuard)
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
