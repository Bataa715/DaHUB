import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
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

  // ── User routes ────────────────────────────────────────────────────────────

  /** GET /excel-report/templates — active templates (no pythonCode) */
  @Get("templates")
  getActiveTemplates() {
    return this.service.getActiveTemplates();
  }

  /** POST /excel-report/run-csv — stream CSV directly from ClickHouse to the browser */
  @Post("run-csv")
  async runReportCsv(@Body() dto: RunReportDto, @Res() res: Response) {
    const { stream, fileName, estimatedBytes, onDone } =
      await this.service.runReportCsv(dto);
    const encodedName = encodeURIComponent(fileName);
    const headers: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report.csv"; filename*=UTF-8''${encodedName}`,
      // Expose Content-Length so the browser can compute download progress
      "Access-Control-Expose-Headers": "Content-Length",
    };
    if (estimatedBytes > 0) headers["Content-Length"] = String(estimatedBytes);
    res.set(headers);
    // Prepend UTF-8 BOM so Excel renders Cyrillic correctly
    res.write(Buffer.from([0xef, 0xbb, 0xbf]));
    stream.pipe(res);
    // Staging mode: TRUNCATE staging table after the client has received everything
    if (onDone) res.on("finish", onDone);
  }

  /** POST /excel-report/preview — run SQL-mode report, return first 100 rows as JSON */
  @Post("preview")
  previewReport(@Body() dto: RunReportDto) {
    return this.service.previewReport(dto);
  }

}
