import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Header,
} from "@nestjs/common";
import { Response } from "express";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuditLogService } from "../audit/audit-log.service";
import { PythonApiService } from "./python-api.service";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import {
  CreatePythonToolDto,
  UpdatePythonToolDto,
  RunToolDto,
  ToggleToolDto,
  ReorderToolsDto,
  ValidateCodeDto,
  PreviewCodeDto,
  GrantPermissionDto,
  RevokePermissionDto,
} from "./dto/python-api.dto";

@Controller("python-api")
@UseGuards(JwtAuthGuard)
export class PythonApiController {
  constructor(
    private readonly service: PythonApiService,
    private auditLogService: AuditLogService,
  ) {}

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  @Get("admin/tools")
  @UseGuards(AdminGuard)
  getAllTools() {
    return this.service.getAllTools();
  }

  @Post("admin/tools")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTool(
    @Body() dto: CreatePythonToolDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.service.createTool(dto);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_create",
        resource: "python_api_tools",
        method: "create",
        status: "success",
        metadata: { name: (dto as any)?.name },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_create",
        resource: "python_api_tools",
        method: "create",
        status: "failure",
        errorMessage: error?.message ?? String(error),
      });
      throw error;
    }
  }

  @Patch("admin/tools/:id")
  @UseGuards(AdminGuard)
  async updateTool(
    @Param("id") id: string,
    @Body() dto: UpdatePythonToolDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.service.updateTool(id, dto);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_update",
        resource: "python_api_tools",
        method: "update",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_update",
        resource: "python_api_tools",
        method: "update",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  @Patch("admin/tools/:id/toggle")
  @UseGuards(AdminGuard)
  async toggleTool(
    @Param("id") id: string,
    @Body() body: ToggleToolDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.service.toggleActive(id, body.isActive);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_toggle",
        resource: "python_api_tools",
        method: "toggle",
        status: "success",
        metadata: { targetId: id, isActive: body.isActive },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_toggle",
        resource: "python_api_tools",
        method: "toggle",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  @Delete("admin/tools/:id")
  @UseGuards(AdminGuard)
  async deleteTool(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.service.deleteTool(id);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_delete",
        resource: "python_api_tools",
        method: "delete",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_delete",
        resource: "python_api_tools",
        method: "delete",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  // [SORT] Persist user-side display order — body: { ids: string[] }
  @Post("admin/tools/reorder")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderTools(
    @Body() body: ReorderToolsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      await this.service.reorderTools(body.ids);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_reorder",
        resource: "python_api_tools",
        method: "reorder",
        status: "success",
      });
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_reorder",
        resource: "python_api_tools",
        method: "reorder",
        status: "failure",
        errorMessage: error?.message ?? String(error),
      });
      throw error;
    }
  }

  /** Editor: кодыг ажиллуулахгүйгээр шалгах */
  @Post("admin/validate-code")
  @UseGuards(AdminGuard)
  validateCode(@Body() body: ValidateCodeDto) {
    return this.service.validateCode(body.code);
  }

  /** Editor: хадгалаагүй кодыг шууд тест ажиллуулах (эхний 50 мөр) */
  @Post("admin/preview-code")
  @UseGuards(AdminGuard)
  @SkipThrottle()
  previewCode(@Body() body: PreviewCodeDto) {
    return this.service.previewCode(body);
  }

  @Get("admin/run-logs")
  @UseGuards(AdminGuard)
  getRunLogs(@Query("limit") limit?: string) {
    return this.service.getRunLogs(limit ? Math.min(Number(limit), 1000) : 200);
  }

  @Get("admin/permissions")
  @UseGuards(AdminGuard)
  getAllPermissions() {
    return this.service.getAllPermissions();
  }

  @Post("admin/permissions")
  @UseGuards(AdminGuard)
  async grantPermission(@Body() body: GrantPermissionDto, @Request() req: AuthenticatedRequest) {
    try {
      await this.service.grantPermission(
        body.userId,
        body.templateId,
        req.user?.id ?? "",
      );
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_permission_grant",
        resource: "python_api_permissions",
        method: "grant",
        status: "success",
        metadata: { targetUserId: body.userId, templateId: body.templateId },
      });
      return { ok: true };
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_permission_grant",
        resource: "python_api_permissions",
        method: "grant",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetUserId: body.userId, templateId: body.templateId },
      });
      throw error;
    }
  }

  @Delete("admin/permissions")
  @UseGuards(AdminGuard)
  async revokePermission(
    @Body() body: RevokePermissionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      await this.service.revokePermission(body.userId, body.templateId);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_permission_revoke",
        resource: "python_api_permissions",
        method: "revoke",
        status: "success",
        metadata: { targetUserId: body.userId, templateId: body.templateId },
      });
      return { ok: true };
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "python_tool_permission_revoke",
        resource: "python_api_permissions",
        method: "revoke",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetUserId: body.userId, templateId: body.templateId },
      });
      throw error;
    }
  }

  // ── User routes ────────────────────────────────────────────────────────────

  // [PERF] tool catalog changes rarely — short private cache.
  @Get("tools")
  @Header("Cache-Control", "private, max-age=60")
  getActiveTools(@Request() req: AuthenticatedRequest) {
    return this.service.getActiveToolsForUser(
      req.user?.id,
      !!req.user?.isAdmin,
    );
  }

  /** POST /python-api/run — файл татах (Excel / CSV)
   * [SEC] Was fully @SkipThrottle()-ed — an authenticated user (or admin)
   * could fire unlimited heavy pandas/ClickHouse/Oracle executions. Kept
   * generous (long-running exports are legitimate) but finite so it can't
   * be looped indefinitely from one account. */
  @Post("run")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async runTool(
    @Body() dto: RunToolDto,
    @Res() res: Response,
    @Request() req: AuthenticatedRequest,
  ) {
    // ── Permission check ──────────────────────────────────────────────────
    if (!req.user?.isAdmin && dto.toolId) {
      const allowed = await this.service.hasPermission(
        req.user?.id,
        dto.toolId,
      );
      if (!allowed)
        throw new ForbiddenException("Энэ тайлан ашиглах эрхгүй байна");
    }
    const caller = req.user
      ? {
          userId: req.user.id as string,
          userName: (req.user.name ?? req.user.userId ?? "") as string,
          isAdmin: !!req.user.isAdmin,
        }
      : undefined;

    // Client disconnect (browser cancel) → upstream Python socket-ийг таслана
    const abort = new AbortController();
    const onClose = () => abort.abort();
    req.on("close", onClose);

    let buffer: Buffer, fileName: string, contentType: string;
    try {
      ({ buffer, fileName, contentType } = await this.service.runTool(
        dto,
        caller,
        abort.signal,
      ));
    } finally {
      req.off("close", onClose);
    }

    if (abort.signal.aborted) return;
    const encodedName = encodeURIComponent(fileName);
    const isAttachment = !contentType.startsWith("application/json");
    // RFC 5987 charset separator built via concat so source has no adjacent quotes
    const rfc5987 = "UTF-8" + "'" + "'" + encodedName;
    res.set({
      "Content-Type": contentType,
      ...(isAttachment
        ? {
            "Content-Disposition": `attachment; filename="file"; filename*=${rfc5987}`,
          }
        : {}),
      "Content-Length": String(buffer.length),
    });
    res.end(buffer);
  }

  /** POST /python-api/preview — эхний 50 мөрийг JSON-оор буцаана */
  @Post("preview")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async previewTool(@Body() dto: RunToolDto, @Request() req: AuthenticatedRequest) {
    if (!dto.toolId) throw new BadRequestException("toolId шаардлагатай");
    // ── Permission check ──────────────────────────────────────────────────
    if (!req.user?.isAdmin) {
      const allowed = await this.service.hasPermission(
        req.user?.id,
        dto.toolId,
      );
      if (!allowed)
        throw new ForbiddenException("Энэ тайлан ашиглах эрхгүй байна");
    }
    return this.service.previewTool(dto);
  }
}
