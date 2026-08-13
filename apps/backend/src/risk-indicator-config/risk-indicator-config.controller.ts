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
import {
  RiskIndicatorConfigService,
  IndicatorConfig,
} from "./risk-indicator-config.service";

@Controller("risk-indicator-config")
@UseGuards(JwtAuthGuard)
export class RiskIndicatorConfigController {
  constructor(
    private readonly svc: RiskIndicatorConfigService,
    private auditLogService: AuditLogService,
  ) {}

  /** GET /risk-indicator-config — бүх нэвтэрсэн хэрэглэгч уншиж болно */
  // [PERF] Indicator config changes rarely (admin-managed) — short private cache.
  @Get()
  @Header("Cache-Control", "private, max-age=60")
  list(): Promise<IndicatorConfig[]> {
    return this.svc.listIndicators();
  }

  @UseGuards(AdminGuard)
  @Post()
  async create(
    @Body()
    dto: Omit<
      IndicatorConfig,
      "seq" | "updated_at" | "is_active" | "updated_by"
    > & {
      hint?: string;
    },
    @CurrentUser() user: { id: string },
  ): Promise<IndicatorConfig> {
    try {
      const result = await this.svc.upsertIndicator(
        { ...dto, id: undefined },
        user.id,
      );
      await this.auditLogService.log({
        userId: user.id,
        action: "risk_indicator_config_create",
        resource: "risk_indicator_config",
        method: "create",
        status: "success",
        metadata: { name: (dto as any)?.name, group: (dto as any)?.group },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "risk_indicator_config_create",
        resource: "risk_indicator_config",
        method: "create",
        status: "failure",
        errorMessage: error?.message ?? String(error),
      });
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: Partial<IndicatorConfig>,
    @CurrentUser() user: { id: string },
  ): Promise<IndicatorConfig> {
    try {
      const result = await this.svc.upsertIndicator(
        { ...dto, id } as any,
        user.id,
      );
      await this.auditLogService.log({
        userId: user.id,
        action: "risk_indicator_config_update",
        resource: "risk_indicator_config",
        method: "update",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "risk_indicator_config_update",
        resource: "risk_indicator_config",
        method: "update",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    try {
      await this.svc.deleteIndicator(id, user.id);
      await this.auditLogService.log({
        userId: user.id,
        action: "risk_indicator_config_delete",
        resource: "risk_indicator_config",
        method: "delete",
        status: "success",
        metadata: { targetId: id },
      });
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "risk_indicator_config_delete",
        resource: "risk_indicator_config",
        method: "delete",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }
}
