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
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(
    @Query("page") page = 1,
    @Query("limit") limit = 200,
  ) {
    const take = Math.min(Number(limit), 500);
    const skip = (Number(page) - 1) * take;
    return this.usersService.findAll(take, skip);
  }

  @Get("admins")
  getAdmins() {
    return this.usersService.getAdmins();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.usersService.updateStatus(id, body.isActive);
  }

  @Patch(":id/tools")
  updateTools(
    @Param("id") id: string,
    @Body() body: { allowedTools: string[] },
  ) {
    return this.usersService.updateTools(id, body.allowedTools);
  }

  @Patch(":id/admin-role")
  setAdminRole(
    @Param("id") id: string,
    @Body() body: { isAdmin: boolean; isSuperAdmin: boolean },
  ) {
    return this.usersService.setAdminRole(id, body.isAdmin, body.isSuperAdmin);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }

  @Get(":id/avatar")
  async getAvatar(@Param("id") id: string, @Res() res: Response) {
    const result = await this.usersService.getAvatar(id);
    if (!result) throw new NotFoundException("Avatar not found");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(result.buffer);
  }
}
