import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Request,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { AuditLogService } from "../audit/audit-log.service";

// B-8: Whitelist of valid tool names — prevents granting fake/invented tools
const VALID_TOOLS = [
  "todo",
  "tailan",
  "tailan_dept_head",
  "english",
  "chess",
  "db_access_requester",
  "db_access_granter",
  "pivot",
  "sanamsargui-tuuwer",
  "excel_report",
  "pdf_to_text",
  "rag_chat",
  "data_doc",
] as const;

@Controller("users")
export class UsersController {
  constructor(
    private usersService: UsersService,
    private auditLogService: AuditLogService,
  ) {}

  /** Admin: full user list with details */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll(@Query("page") page = 1, @Query("limit") limit = 200) {
    const take = Math.min(Number(limit), 500);
    const skip = (Number(page) - 1) * take;
    return this.usersService.findAll(take, skip);
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
  findOne(@Param("id") id: string, @Request() req: any) {
    // M-1: IDOR fix — prevent any user from reading another user's full profile
    if (id !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException("Зөвхөн өөрийн профайлыг харах боломжтой");
    }
    return this.usersService.findOne(id);
  }

  /** Authenticated: user can update own profileImage; Admin can update any field */
  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ) {
    const isSelf = id === req.user.id;
    const isAdmin = req.user.isAdmin;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException("Зөвхөн өөрийн профайлыг засах боломжтой");
    }

    // Non-admins may only change their own profileImage
    if (!isAdmin) {
      const { profileImage } = updateUserDto;
      return this.usersService.update(id, { profileImage });
    }

    return this.usersService.update(id, updateUserDto);
  }

  /** Admin: activate / deactivate a user account */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.usersService.updateStatus(id, body.isActive);
  }

  /** Admin: update which tools a user may access */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id/tools")
  updateTools(
    @Param("id") id: string,
    @Body() body: { allowedTools: string[] },
  ) {
    const tools = body.allowedTools;
    if (!Array.isArray(tools)) {
      throw new BadRequestException("allowedTools тооц байна");
    }
    // B-8: Strip any tool IDs not in the explicit whitelist (handles legacy IDs gracefully)
    const sanitized = tools.filter((t) =>
      (VALID_TOOLS as readonly string[]).includes(t),
    );
    return this.usersService.updateTools(id, sanitized);
  }

  /** SuperAdmin only: promote or demote admin role */
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch(":id/admin-role")
  async setAdminRole(
    @Param("id") id: string,
    @Body()
    body: {
      isAdmin: boolean;
      isSuperAdmin: boolean;
      grantableTools?: string[];
    },
    @Request() req: any,
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

  /** SuperAdmin only: reset a user's password */
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch(":id/reset-password")
  resetPassword(
    @Param("id") id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.usersService.resetPassword(id, body.newPassword);
  }

  /** Admin: delete a user */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }

  /** B-1: Authenticated users can only view their own avatar; admins can view any */
  @UseGuards(JwtAuthGuard)
  @Get(":id/avatar")
  async getAvatar(
    @Param("id") id: string,
    @Res() res: Response,
    @Request() req: any,
  ) {
    if (id !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException("Зөвхөн өөрийн аватараа харах боломжтой");
    }
    const result = await this.usersService.getAvatar(id);
    if (!result) throw new NotFoundException("Avatar not found");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(result.buffer);
  }
}
