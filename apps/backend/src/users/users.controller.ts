import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import { createHash } from "crypto";
import { UsersService } from "./users.service";
import { SkipThrottle } from "@nestjs/throttler";
import {
  UpdateUserDto,
  UpdateToolsDto,
  SetAdminRoleDto,
  ResetPasswordDto,
} from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { AuditLogService } from "../audit/audit-log.service";
import { VALID_TOOLS_SET } from "../common/constants/tools";
import { AuthenticatedRequest } from "../common/types/authenticated-request";

@Controller("users")
export class UsersController {
  constructor(
    private usersService: UsersService,
    private auditLogService: AuditLogService,
  ) {}

  /** Admin: full user list with details */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll(
    @Query("page") page = 1,
    @Query("limit") limit = 100,
    @Query("excludeAdmins") excludeAdmins?: string,
  ) {
    const exclude =
      excludeAdmins === "1" ||
      excludeAdmins === "true" ||
      excludeAdmins === "yes";
    const maxLimit = exclude ? 1000 : 200;
    const take = Math.min(Number(limit) || (exclude ? 1000 : 100), maxLimit);
    const skip = (Number(page) - 1) * take;
    return this.usersService.findAll(take, skip, exclude);
  }

  /** Admin: list of all admins */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admins")
  getAdmins() {
    return this.usersService.getAdmins();
  }

  /** Authenticated users can view their own profile; admins can view any profile */
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  findOne(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    // M-1: IDOR fix — prevent any user from reading another user's full profile
    if (id !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException("Зөвхөн өөрийн профайлыг харах боломжтой");
    }
    return this.usersService.findOne(id);
  }

  /** Authenticated: user can update own profileImage; Admin can update any field.
   *  departmentId солихыг зөвхөн SuperAdmin хийнэ. */
  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const isSelf = id === req.user.id;
    const isAdmin = req.user.isAdmin;
    const isSuperAdmin = !!req.user.isSuperAdmin;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException("Зөвхөн өөрийн профайлыг засах боломжтой");
    }

    // Non-admins may only change their own profileImage
    if (!isAdmin) {
      const { profileImage } = updateUserDto;
      return this.usersService.update(id, { profileImage });
    }

    // [ACCESS] Managing OTHER users is superadmin-only — a plain admin is
    // limited to tool-permission granting and their own profile/password.
    if (!isSelf && !isSuperAdmin) {
      throw new ForbiddenException(
        "Бусад хэрэглэгчийг удирдахыг зөвхөн супер админ хийх боломжтой",
      );
    }

    if (updateUserDto.departmentId !== undefined && !isSuperAdmin) {
      throw new ForbiddenException(
        "Хэрэглэгчийн хэлтэс солихыг зөвхөн супер админ хийх боломжтой",
      );
    }

    return this.usersService.update(id, updateUserDto);
  }

  /** [PERF] Хэрэглэгчийн профайл зургийг BINARY-аар үйлчилнэ (base64-ийг
   *  жагсаалт болгонд оруулахын оронд). Хөтч зургийг lazy татаж, ETag/Cache-
   *  Control-оор кэшилдэг тул employee directory зэрэг олон аватартай хуудас
   *  хурдан болно. Нэвтэрсэн дурын хэрэглэгч харна. */
  @UseGuards(JwtAuthGuard)
  @Get(":id/avatar")
  async getAvatar(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest & { headers: Record<string, string> },
    @Res() res: Response,
  ) {
    const dataUri = await this.usersService.getProfileImage(id);
    if (!dataUri) throw new NotFoundException("Зураг олдсонгүй");
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUri);
    if (!m) throw new NotFoundException("Зураг олдсонгүй");

    // ETag — агуулга өөрчлөгдөөгүй бол 304 буцаана (дата дамжуулахгүй).
    const etag = `"${createHash("sha1").update(dataUri).digest("hex")}"`;
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }
    res.set("Content-Type", m[1]);
    res.set("Cache-Control", "private, max-age=86400");
    res.set("ETag", etag);
    res.send(Buffer.from(m[2], "base64"));
  }

  /** Admin: update which tools a user may access. A plain admin is limited to
   *  the tools within their own grantableTools scope (set by a superadmin);
   *  the service enforces this — see UsersService.updateTools. */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id/tools")
  updateTools(
    @Param("id") id: string,
    @Body() body: UpdateToolsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tools = body.allowedTools;
    if (!Array.isArray(tools)) {
      throw new BadRequestException("allowedTools тооц байна");
    }
    // B-8: Strip any tool IDs not in the explicit whitelist (handles legacy IDs gracefully)
    const sanitized = tools.filter((t) => VALID_TOOLS_SET.has(t));
    return this.usersService.updateTools(id, sanitized, {
      isSuperAdmin: !!req.user.isSuperAdmin,
      grantableTools: Array.isArray(req.user.grantableTools)
        ? (req.user.grantableTools as string[])
        : [],
    });
  }

  /** SuperAdmin only: promote or demote admin role */
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch(":id/admin-role")
  async setAdminRole(
    @Param("id") id: string,
    @Body() body: SetAdminRoleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.usersService.setAdminRole(
      id,
      body.isAdmin,
      body.isSuperAdmin,
      body.grantableTools,
    );
    await this.auditLogService.log({
      userId: req.user?.id,
      action: "admin_role_change",
      resource: "users",
      method: "setAdminRole",
      status: "success",
      metadata: {
        targetUserId: id,
        isAdmin: body.isAdmin,
        isSuperAdmin: body.isSuperAdmin,
        grantableTools: body.grantableTools,
      },
    });
    return result;
  }

  /** Admin: reset a user's password (SuperAdmin required if target is an admin) */
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch(":id/reset-password")
  async resetPassword(
    @Param("id") id: string,
    @Body() body: ResetPasswordDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.usersService.resetPassword(
        id,
        body.newPassword,
        !!req.user.isSuperAdmin,
      );
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "password_reset_by_admin",
        resource: "users",
        method: "resetPassword",
        status: "success",
        metadata: { targetUserId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "password_reset_by_admin",
        resource: "users",
        method: "resetPassword",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetUserId: id },
      });
      throw error;
    }
  }

  /** Admin: clear a user's persistent brute-force lockout (5 wrong passwords) */
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch(":id/unlock")
  async unlock(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    try {
      const result = await this.usersService.unlockUser(
        id,
        !!req.user.isSuperAdmin,
      );
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "user_unlock",
        resource: "users",
        method: "unlock",
        status: "success",
        metadata: { targetUserId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "user_unlock",
        resource: "users",
        method: "unlock",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetUserId: id },
      });
      throw error;
    }
  }

  /** Authenticated: user can remove own profile image; admin can remove any user's */
  @UseGuards(JwtAuthGuard)
  @Delete(":id/profile-image")
  removeProfileImage(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const isSelf = id === req.user.id;
    const isAdmin = req.user.isAdmin;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException(
        "Зөвхөн өөрийн профайл зураг устгах боломжтой",
      );
    }

    return this.usersService.clearProfileImage(id);
  }

  /** Admin: delete a user (SuperAdmin required if target is an admin) */
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    try {
      const result = await this.usersService.remove(
        id,
        !!req.user.isSuperAdmin,
      );
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "user_delete",
        resource: "users",
        method: "remove",
        status: "success",
        metadata: { targetUserId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "user_delete",
        resource: "users",
        method: "remove",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetUserId: id },
      });
      throw error;
    }
  }
}
