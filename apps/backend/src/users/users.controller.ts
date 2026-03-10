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
} from "@nestjs/common";
import { Response } from "express";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { AuditLogService } from "../audit/audit-log.service";

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

  /** Any authenticated user: view a profile */
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  /** Admin: update basic user fields (name, position, department, image) */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id")
  update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
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
    return this.usersService.updateTools(id, body.allowedTools);
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

  /** Any authenticated user: get avatar image */
  @UseGuards(JwtAuthGuard)
  @Get(":id/avatar")
  async getAvatar(@Param("id") id: string, @Res() res: Response) {
    const result = await this.usersService.getAvatar(id);
    if (!result) throw new NotFoundException("Avatar not found");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(result.buffer);
  }
}
