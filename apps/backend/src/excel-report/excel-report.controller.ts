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
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { ExcelReportService } from "./excel-report.service";
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  RunReportDto,
} from "./dto/excel-report.dto";

@Controller("excel-report")
@UseGuards(JwtAuthGuard)
export class ExcelReportController {
  constructor(private readonly service: ExcelReportService) {}

  // ── Admin routes ───────────────────────────────────────────────────────────

  /** GET /excel-report/admin/templates — all templates (incl. inactive) */
  @Get("admin/templates")
  @UseGuards(AdminGuard)
  getAllTemplates() {
    return this.service.getAllTemplates();
  }

  /** POST /excel-report/admin/templates — create a new template */
  @Post("admin/templates")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  createTemplate(@Body() dto: CreateReportTemplateDto) {
    return this.service.createTemplate(dto);
  }

  /** PATCH /excel-report/admin/templates/:id — update template */
  @Patch("admin/templates/:id")
  @UseGuards(AdminGuard)
  updateTemplate(
    @Param("id") id: string,
    @Body() dto: UpdateReportTemplateDto,
  ) {
    return this.service.updateTemplate(id, dto);
  }

  /** PATCH /excel-report/admin/templates/:id/toggle — activate / deactivate */
  @Patch("admin/templates/:id/toggle")
  @UseGuards(AdminGuard)
  toggleTemplate(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.service.toggleActive(id, body.isActive);
  }

  /** DELETE /excel-report/admin/templates/:id — delete template */
  @Delete("admin/templates/:id")
  @UseGuards(AdminGuard)
  deleteTemplate(@Param("id") id: string) {
    return this.service.deleteTemplate(id);
  }

  // ── Admin: permission management ───────────────────────────────────────────

  /** GET /excel-report/admin/permissions — all granted permissions */
  @Get("admin/permissions")
  @UseGuards(AdminGuard)
  getAllPermissions() {
    return this.service.getAllPermissions();
  }

  /** POST /excel-report/admin/permissions — grant a user access to a template */
  @Post("admin/permissions")
  @UseGuards(AdminGuard)
  async grantPermission(
    @Body() body: { userId: string; templateId: string },
    @Request() req: any,
  ) {
    if (!body.userId || !body.templateId)
      throw new BadRequestException("userId болон templateId шаардлагатай");
    await this.service.grantPermission(body.userId, body.templateId, req.user?.id ?? "");
    return { ok: true };
  }

  /** DELETE /excel-report/admin/permissions — revoke a user's access to a template */
  @Delete("admin/permissions")
  @UseGuards(AdminGuard)
  async revokePermission(@Body() body: { userId: string; templateId: string }) {
    if (!body.userId || !body.templateId)
      throw new BadRequestException("userId болон templateId шаардлагатай");
    await this.service.revokePermission(body.userId, body.templateId);
    return { ok: true };
  }

  /** GET /excel-report/admin/download-logs — download history */
  @Get("admin/download-logs")
  @UseGuards(AdminGuard)
  getDownloadLogs(@Query("limit") limit?: string) {
    return this.service.getDownloadLogs(limit ? Math.min(Number(limit), 1000) : 200);
  }

  // ── User routes ────────────────────────────────────────────────────────────

  /** GET /excel-report/templates — active templates filtered by permission */
  @Get("templates")
  getActiveTemplates(@Request() req: any) {
    return this.service.getActiveTemplates(req.user?.id, req.user?.isAdmin);
  }

  /** POST /excel-report/run-insert — fire staging INSERT in background, return immediately */
  @Post("run-insert")
  @HttpCode(HttpStatus.ACCEPTED)
  async runInsert(@Body() dto: RunReportDto) {
    // Do NOT await — fire and forget. Returns 202 immediately.
    this.service.runInsertBackground(dto).catch(() => {});
    return { ok: true };
  }

  /** POST /excel-report/run-csv — stream CSV directly from ClickHouse to the browser */
  @Post("run-csv")
  async runReportCsv(@Body() dto: RunReportDto, @Res() res: Response, @Request() req: any) {
    const caller = req.user
      ? { userId: req.user.id, userName: req.user.name ?? req.user.userId ?? "", isAdmin: !!req.user.isAdmin }
      : undefined;
    const { stream, fileName, estimatedBytes, onDone } =
      await this.service.runReportCsv(dto, caller);
    const encodedName = encodeURIComponent(fileName);
    const headers: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report.csv"; filename*=UTF-8''${encodedName}`,
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    };
    if (estimatedBytes > 0) {
      headers["Content-Length"] = String(estimatedBytes);
      delete headers["Transfer-Encoding"];
    }
    res.set(headers);
    res.write(Buffer.from([0xef, 0xbb, 0xbf]));
    stream.on("error", (err) => {
      if (!res.headersSent) res.status(500).end("Stream error");
      else res.end();
    });
    stream.pipe(res);
    if (onDone) res.on("finish", onDone);
  }

  /** POST /excel-report/preview — run SQL-mode report, return first 100 rows as JSON */
  @Post("preview")
  previewReport(@Body() dto: RunReportDto) {
    return this.service.previewReport(dto);
  }
}

