import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuditLogService } from "../audit/audit-log.service";
import { TailanTemplateService } from "./tailan-template.service";
import { UpsertTailanTemplateDto } from "./dto/tailan-template.dto";
import { TailanTemplateScope } from "./tailan-template.types";

@Controller("tailan-templates")
@UseGuards(JwtAuthGuard)
export class TailanTemplateController {
  constructor(
    private readonly svc: TailanTemplateService,
    private auditLogService: AuditLogService,
  ) {}

  /** Admin: list all templates (optionally filtered by scope) for the builder UI. */
  @UseGuards(AdminGuard)
  @Get()
  list(@Query("scope") scope?: TailanTemplateScope) {
    return this.svc.list(scope);
  }

  /** Any authenticated user: the active template for their own department. */
  @Get("active")
  getActive(
    @Query("departmentId") departmentId: string | undefined,
    @Query("scope") scope: TailanTemplateScope = "employee",
  ) {
    return this.svc.getActive(departmentId, scope);
  }

  @UseGuards(AdminGuard)
  @Post()
  async upsert(
    @Body() dto: UpsertTailanTemplateDto,
    @CurrentUser() user: { id: string },
  ) {
    try {
      const result = await this.svc.upsert(dto, user.id);
      await this.auditLogService.log({
        userId: user.id,
        action: "tailan_template_upsert",
        resource: "tailan_templates",
        method: "upsert",
        status: "success",
        metadata: { targetId: (dto as any)?.id, scope: (dto as any)?.scope },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "tailan_template_upsert",
        resource: "tailan_templates",
        method: "upsert",
        status: "failure",
        errorMessage: error?.message ?? String(error),
      });
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      const result = await this.svc.delete(id);
      await this.auditLogService.log({
        userId: user.id,
        action: "tailan_template_delete",
        resource: "tailan_templates",
        method: "delete",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: user.id,
        action: "tailan_template_delete",
        resource: "tailan_templates",
        method: "delete",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }
}
