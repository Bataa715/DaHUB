import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
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

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  // Keep signup for admin to create users (protected)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @Post("signup")
  @ApiOperation({
    summary: "Create new user (Admin only)",
    description: "Admin endpoint to create a new user account",
  })
  @ApiResponse({ status: 201, description: "User created successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 409, description: "User already exists" })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  // Check if user exists (public)
  @Post("check-user")
  @ApiOperation({
    summary: "Check if user exists",
    description:
      "Check if a user with given userId exists and has a password set",
  })
  @ApiResponse({ status: 200, description: "User check result returned" })
  async checkUser(@Body() checkUserDto: CheckUserDto) {
    return this.authService.checkUser(checkUserDto);
  }

  // Register new user without password (public)
  @Post("register")
  @ApiOperation({
    summary: "Register new user",
    description: "Register a new user without password (self-registration)",
  })
  @ApiResponse({ status: 201, description: "User registered successfully" })
  @ApiResponse({ status: 409, description: "User already exists" })
  async registerUser(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.registerUser(registerUserDto);
  }

  // Set password for first-time user (public)
  @Post("set-password")
  @ApiOperation({
    summary: "Set password for new user",
    description: "Set password for a newly registered user",
  })
  @ApiResponse({ status: 200, description: "Password set successfully" })
  @ApiResponse({ status: 400, description: "Password already set" })
  @ApiResponse({ status: 404, description: "User not found" })
  async setPassword(@Body() setPasswordDto: SetPasswordDto) {
    return this.authService.setPassword(setPasswordDto);
  }

  // Get userId prefix for department (public)
  @Get("user-id-prefix/:department")
  @ApiOperation({
    summary: "Get user ID prefix",
    description: "Get the user ID prefix for a given department",
  })
  @ApiParam({
    name: "department",
    description: "Department name",
    example: "Удирдлага",
  })
  @ApiResponse({ status: 200, description: "Returns user ID prefix" })
  async getUserIdPrefix(@Param("department") department: string) {
    return { prefix: this.authService.getUserIdPrefix(department) };
  }

  @UseGuards(ThrottlerGuard)
  @Post("login")
  @ApiOperation({
    summary: "Login with department and username",
    description: "Login using department name, username and password",
  })
  @ApiResponse({
    status: 200,
    description: "Login successful, returns user and JWT token",
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(ThrottlerGuard)
  @Post("login-by-id")
  @ApiOperation({
    summary: "Login with user ID",
    description: "Login using user ID and password",
  })
  @ApiResponse({
    status: 200,
    description: "Login successful, returns user and JWT token",
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  async loginById(@Body() loginByIdDto: LoginByIdDto) {
    return this.authService.loginById(loginByIdDto);
  }

  @UseGuards(ThrottlerGuard)
  @Post("admin-login")
  @ApiOperation({
    summary: "Admin login",
    description: "Login endpoint for administrators",
  })
  @ApiResponse({
    status: 200,
    description: "Admin login successful, returns user and JWT token",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials or not an admin",
  })
  @ApiResponse({ status: 429, description: "Too many requests" })
  async adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return this.authService.adminLogin(adminLoginDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @Get("departments/:department/users")
  @ApiOperation({
    summary: "Get users by department",
    description: "Get all active users in a specific department",
  })
  @ApiParam({
    name: "department",
    description: "Department name",
    example: "Удирдлага",
  })
  @ApiResponse({ status: 200, description: "Returns list of users" })
  async getUsersByDepartment(@Param("department") department: string) {
    return this.authService.getUsersByDepartment(department);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @Get("search")
  @ApiOperation({
    summary: "Search users",
    description: "Search users by user ID or name",
  })
  @ApiQuery({ name: "q", description: "Search query", example: "Bold" })
  @ApiQuery({
    name: "adminOnly",
    required: false,
    description: "Filter admin users only",
    example: "true",
  })
  @ApiResponse({ status: 200, description: "Returns search results" })
  async searchUsers(
    @Query("q") query: string,
    @Query("adminOnly") adminOnly?: string,
  ) {
    return this.authService.searchUsersByUserId(query, adminOnly === "true");
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @Get("me")
  @ApiOperation({
    summary: "Get current user profile",
    description: "Get the profile of the currently authenticated user",
  })
  @ApiResponse({ status: 200, description: "Returns current user profile" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @Post("change-password")
  @ApiOperation({
    summary: "Change password",
    description: "Change password for the currently authenticated user",
  })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized or invalid current password",
  })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Post("refresh")
  @ApiOperation({
    summary: "Refresh access token",
    description: "Get a new access token using a refresh token",
  })
  @ApiResponse({ status: 200, description: "New tokens issued successfully" })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @Post("logout")
  @ApiOperation({
    summary: "Logout",
    description: "Revoke all refresh tokens for the current user",
  })
  @ApiResponse({ status: 200, description: "Logged out successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(@Request() req) {
    return this.authService.revokeRefreshTokens(req.user.id);
  }
}
