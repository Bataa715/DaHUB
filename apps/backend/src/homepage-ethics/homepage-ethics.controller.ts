import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuditLogService } from "../audit/audit-log.service";
import { HomepageEthicsService } from "./homepage-ethics.service";
import {
  CreateEthicsSlideDto,
  UpdateEthicsSlideDto,
} from "./dto/homepage-ethics.dto";

@Controller("homepage-ethics")
export class HomepageEthicsController {
  constructor(
    private readonly svc: HomepageEthicsService,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Нүүр carousel — нэвтэрсэн/нэвтрээгүй аль алинд уншиж болно.
   * (Текст нийтийн агуулга; JWT алдааны улмаас хоосон харагдахыг болиулна.)
   */
  // [PERF] public, rarely-changing content — safe to cache publicly.
  @Get()
  @Header("Cache-Control", "public, max-age=120")
  list() {
    return this.svc.list(true);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Body() dto: CreateEthicsSlideDto,
    @CurrentUser() user: { id: string },
  ) {
    try {
      const result = await this.svc.create(dto, user.id);
      await this.auditLogService.log({
        userId: user.id,
        action: "homepage_ethics_create",
        resource: "homepage_ethics",
        method: "create",
        status: "success",
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "homepage_ethics_create",
        resource: "homepage_ethics",
        method: "create",
        status: "failure",
        errorMessage: error?.message ?? String(error),
      });
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateEthicsSlideDto,
    @CurrentUser() user: { id: string },
  ) {
    try {
      const result = await this.svc.update(id, dto, user.id);
      await this.auditLogService.log({
        userId: user.id,
        action: "homepage_ethics_update",
        resource: "homepage_ethics",
        method: "update",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "homepage_ethics_update",
        resource: "homepage_ethics",
        method: "update",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      await this.svc.remove(id, user.id);
      await this.auditLogService.log({
        userId: user.id,
        action: "homepage_ethics_delete",
        resource: "homepage_ethics",
        method: "delete",
        status: "success",
        metadata: { targetId: id },
      });
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "homepage_ethics_delete",
        resource: "homepage_ethics",
        method: "delete",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }
}
