import { Controller, Get, Post, Delete, Patch, Body, Param, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, JwtPayload } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { LoginDto, CreateUserDto, UpdateRoleDto, ChangePasswordDto } from '../dtos/auth.dto';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(
      body.username.trim(),
      body.password,
    );
    if (result.error) {
      this.audit.log('LOGIN_FAILED', '', String(body.username).substring(0, 50), 'auth');
    } else {
      this.audit.log('LOGIN_SUCCESS', result.user!.id, result.user!.username, 'auth');
    }
    return result;
  }

  @Get('me')
  async me(@Headers('authorization') auth: string) {
    const payload = this.extractUser(auth);
    if (!payload) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    return { user: payload };
  }

  @Get('users')
  async listUsers(@Headers('authorization') auth: string) {
    const payload = this.requireAdmin(auth);
    const users = await this.authService.listUsers();
    return { users };
  }

  @Post('users')
  async createUser(
    @Headers('authorization') auth: string,
    @Body() body: CreateUserDto,
  ) {
    const payload = this.requireAdmin(auth);

    const result = await this.authService.createUser(
      body.username.trim(),
      body.password,
      body.displayName.trim(),
      body.role,
    );

    if (!result.error) {
      this.audit.log('CREATE_USER', payload.userId, payload.username, body.username, { role: body.role });
    }
    return result;
  }

  @Delete('users/:id')
  async deleteUser(
    @Headers('authorization') auth: string,
    @Param('id') userId: string,
  ) {
    const payload = this.requireAdmin(auth);
    const result = await this.authService.deleteUser(userId);
    if (!result.error) {
      this.audit.log('DELETE_USER', payload.userId, payload.username, userId);
    }
    return result;
  }

  @Patch('users/:id/role')
  async updateRole(
    @Headers('authorization') auth: string,
    @Param('id') userId: string,
    @Body() body: UpdateRoleDto,
  ) {
    const payload = this.requireAdmin(auth);
    const result = await this.authService.updateUserRole(userId, body.role);
    if (!result.error) {
      this.audit.log('UPDATE_ROLE', payload.userId, payload.username, userId, { newRole: body.role });
    }
    return result;
  }

  @Patch('users/:id/password')
  async changePassword(
    @Headers('authorization') auth: string,
    @Param('id') userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    const payload = this.extractUser(auth);
    if (!payload) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    if (payload.role !== 'admin' && payload.userId !== userId) {
      throw new HttpException('Эрх хүрэлцэхгүй', HttpStatus.FORBIDDEN);
    }
    const pw = body.newPassword || body.password;
    if (!pw) {
      throw new HttpException('Шинэ нууц үгээ оруулна уу', HttpStatus.BAD_REQUEST);
    }

    const result = await this.authService.changePassword(userId, pw);
    if (!result.error) {
      this.audit.log('CHANGE_PASSWORD', payload.userId, payload.username, userId);
    }
    return result;
  }

  private extractUser(auth: string): JwtPayload | null {
    if (!auth) return null;
    const token = auth.replace(/^Bearer\s+/i, '');
    return this.authService.verifyToken(token);
  }

  private requireAdmin(auth: string): JwtPayload {
    const payload = this.extractUser(auth);
    if (!payload) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    if (payload.role !== 'admin') throw new HttpException('Зөвхөн админ', HttpStatus.FORBIDDEN);
    return payload;
  }
}
