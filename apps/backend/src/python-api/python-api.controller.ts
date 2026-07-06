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
} from "@nestjs/common";
import { Response } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { PythonApiService } from "./python-api.service";
import {
  CreatePythonToolDto,
  UpdatePythonToolDto,
  RunToolDto,
} from "./dto/python-api.dto";

@Controller("python-api")
@UseGuards(JwtAuthGuard)
export class PythonApiController {
  constructor(private readonly service: PythonApiService) {}

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  @Get("admin/tools")
  @UseGuards(AdminGuard)
  getAllTools() {
    return this.service.getAllTools();
  }

  @Post("admin/tools")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  createTool(@Body() dto: CreatePythonToolDto) {
    return this.service.createTool(dto);
  }

  @Patch("admin/tools/:id")
  @UseGuards(AdminGuard)
  updateTool(@Param("id") id: string, @Body() dto: UpdatePythonToolDto) {
    return this.service.updateTool(id, dto);
  }

  @Patch("admin/tools/:id/toggle")
  @UseGuards(AdminGuard)
  toggleTool(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.service.toggleActive(id, body.isActive);
  }

  @Delete("admin/tools/:id")
  @UseGuards(AdminGuard)
  deleteTool(@Param("id") id: string) {
    return this.service.deleteTool(id);
  }

  // [SORT] Persist user-side display order — body: { ids: string[] }
  @Post("admin/tools/reorder")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderTools(@Body() body: { ids: string[] }) {
    if (!body || !Array.isArray(body.ids))
      throw new BadRequestException("ids массив шаардлагатай");
    await this.service.reorderTools(body.ids);
  }

  /** Editor: кодыг ажиллуулахгүйгээр шалгах */
  @Post("admin/validate-code")
  @UseGuards(AdminGuard)
  validateCode(@Body() body: { code: string }) {
    if (typeof body?.code !== "string")
      throw new BadRequestException("code шаардлагатай");
    return this.service.validateCode(body.code);
  }

  /** Editor: хадгалаагүй кодыг шууд тест ажиллуулах (эхний 50 мөр) */
  @Post("admin/preview-code")
  @UseGuards(AdminGuard)
  @SkipThrottle()
  previewCode(
    @Body()
    body: {
      code: string;
      connectionType?: string;
      connectionConfig?: string;
      startDate?: string;
      endDate?: string;
      filters?: Record<string, string>;
    },
  ) {
    if (typeof body?.code !== "string" || !body.code.trim())
      throw new BadRequestException("code шаардлагатай");
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
  async grantPermission(
    @Body() body: { userId: string; templateId: string },
    @Request() req: any,
  ) {
    if (!body.userId || !body.templateId)
      throw new BadRequestException("userId болон templateId шаардлагатай");
    await this.service.grantPermission(
      body.userId,
      body.templateId,
      req.user?.id ?? "",
    );
    return { ok: true };
  }

  @Delete("admin/permissions")
  @UseGuards(AdminGuard)
  async revokePermission(@Body() body: { userId: string; templateId: string }) {
    if (!body.userId || !body.templateId)
      throw new BadRequestException("userId болон templateId шаардлагатай");
    await this.service.revokePermission(body.userId, body.templateId);
    return { ok: true };
  }

  // ── User routes ────────────────────────────────────────────────────────────

  @Get("tools")
  getActiveTools(@Request() req: any) {
    return this.service.getActiveToolsForUser(
      req.user?.id,
      !!req.user?.isAdmin,
    );
  }

  /** POST /python-api/run — файл татах (Excel / CSV) */
  @Post("run")
  @SkipThrottle()
  async runTool(
    @Body() dto: RunToolDto,
    @Res() res: Response,
    @Request() req: any,
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
  @SkipThrottle()
  async previewTool(@Body() dto: RunToolDto, @Request() req: any) {
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
