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
import { ThrottlerGuard, SkipThrottle, Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { AuthService } from "./auth.service";
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
    const isProd = process.env.NODE_ENV === "production";
    const tokenName = isAdmin ? "adminToken" : "token";
    const refreshName = isAdmin ? "adminRefreshToken" : "refreshToken";
    res.cookie(tokenName, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });
    res.cookie(refreshName, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      path: "/",
    });
  }

  // [N-2] Clear both token cookies on logout / session expiry
  private clearAuthCookies(res: Response, isAdmin = false): void {
    const isProd = process.env.NODE_ENV === "production";
    const opts = { httpOnly: true, secure: isProd, sameSite: "strict" as const, path: "/" };
    res.clearCookie(isAdmin ? "adminToken" : "token", opts);
    res.clearCookie(isAdmin ? "adminRefreshToken" : "refreshToken", opts);
  }

  // Create a new user — Admin only
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("signup")
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  // Check if user exists
  @UseGuards(ThrottlerGuard)
  @Post("check-user")
  async checkUser(@Body() checkUserDto: CheckUserDto) {
    return this.authService.checkUser(checkUserDto);
  }

  // Register new user — public self-registration (employee registers, then sets own password)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post("register")
  async registerUser(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.registerUser(registerUserDto);
  }

  // Set password for first-time user (throttled)
  @UseGuards(ThrottlerGuard)
  @Post("set-password")
  async setPassword(
    @Body() setPasswordDto: SetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.setPassword(setPasswordDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user, success: true };
  }

  // Get userId prefix for department (requires login)
  @UseGuards(JwtAuthGuard)
  @Get("user-id-prefix/:department")
  async getUserIdPrefix(@Param("department") department: string) {
    return { prefix: this.authService.getUserIdPrefix(department) };
  }

  @UseGuards(ThrottlerGuard)
  @Post("login")
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, this.clientIp(req));
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user, success: true };
  }

  @UseGuards(ThrottlerGuard)
  @Post("login-by-id")
  async loginById(
    @Body() loginByIdDto: LoginByIdDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginById(
      loginByIdDto,
      this.clientIp(req),
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user, success: true };
  }

  @UseGuards(ThrottlerGuard)
  @Post("admin-login")
  async adminLogin(
    @Body() adminLoginDto: AdminLoginDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.adminLogin(
      adminLoginDto,
      this.clientIp(req),
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken, true);
    return { user: result.user, success: true };
  }

  // [H-4] Extract caller IP for brute-force lockout key. Honours X-Forwarded-For
  // when behind a trusted reverse proxy (set TRUST_PROXY=1 + app.set('trust proxy')).
  private clientIp(req: any): string {
    const xff = (req.headers?.["x-forwarded-for"] || "")
      .toString()
      .split(",")[0]
      .trim();
    return xff || req.ip || req.socket?.remoteAddress || "unknown";
  }

  @UseGuards(JwtAuthGuard)
  @Get("departments/:department/users")
  async getUsersByDepartment(@Param("department") department: string) {
    return this.authService.getUsersByDepartment(department);
  }

  @UseGuards(ThrottlerGuard)
  @Get("search")
  async searchUsers(@Query("q") query: string) {
    return this.authService.searchUsersByUserId(query, false);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  // 30 requests/min — enough for silent auto-refresh but limits token-grinding attacks
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("refresh")
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    // [N-2] Cookie takes priority; fall back to body (Swagger / API tools)
    const token =
      req.cookies?.refreshToken ||
      req.cookies?.adminRefreshToken ||
      refreshTokenDto.refreshToken;
    if (!token) throw new UnauthorizedException("Refresh token not found");
    const result = await this.authService.refreshAccessToken({ refreshToken: token });
    const isAdmin = !!result.user?.isAdmin;
    this.setAuthCookies(res, result.accessToken, result.refreshToken, isAdmin);
    return { user: result.user, success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isAdmin = !!req.user?.isAdmin;
    this.clearAuthCookies(res, isAdmin);
    // Also clear the other side in case both were set
    this.clearAuthCookies(res, !isAdmin);
    return this.authService.revokeRefreshTokens(req.user.id);
  }
}
