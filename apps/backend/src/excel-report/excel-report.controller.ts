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
  QueryToExcelDto,
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

  /** POST /excel-report/run — stream xlsx directly from ClickHouse → browser (no full-buffer step) */
  @Post("run")
  async runReport(@Body() dto: RunReportDto, @Res() res: Response) {
    // Validation + query building — throws before touching the response if invalid
    const { query, fileName, sheetName } =
      await this.service.prepareRunReport(dto);
    // ClickHouse connection verified (status 200) before headers are sent
    const encodedName = encodeURIComponent(fileName);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"; filename*=UTF-8''${encodedName}`,
      // No Content-Length — chunked transfer; ExcelJS flushes zip entries as it goes
    });
    await this.service.writeExcelToStream(query, sheetName, res);
  }

  /** POST /excel-report/run-async — start job, return jobId immediately */
  @Post("run-async")
  async runReportAsync(@Body() dto: RunReportDto) {
    const jobId = await this.service.runReportAsync(dto);
    return { jobId };
  }

  /** GET /excel-report/jobs/:jobId — poll job status */
  @Get("jobs/:jobId")
  getJobStatus(@Param("jobId") jobId: string) {
    return this.service.getJobStatus(jobId);
  }

  /** GET /excel-report/jobs/:jobId/download — download finished file */
  @Get("jobs/:jobId/download")
  downloadJob(@Param("jobId") jobId: string, @Res() res: Response) {
    const { buffer, fileName } = this.service.getJobFile(jobId);
    // RFC 5987: encode non-ASCII filename (e.g. Mongolian/Cyrillic chars)
    const encodedName = encodeURIComponent(fileName);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"; filename*=UTF-8''${encodedName}`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  /** POST /excel-report/preview — run SQL-mode report, return first 100 rows as JSON */
  @Post("preview")
  previewReport(@Body() dto: RunReportDto) {
    return this.service.previewReport(dto);
  }

  /** POST /excel-report/query-to-excel — run custom SELECT → download xlsx */
  @Post("query-to-excel")
  async queryToExcel(@Body() dto: QueryToExcelDto, @Res() res: Response) {
    const buffer = await this.service.queryToExcel(dto);
    const baseName = (dto.fileName ?? "query_result").replace(
      /[^a-z0-9_\-\u0400-\u04FF]/gi,
      "_",
    );
    const date = new Date().toISOString().slice(0, 10);
    const encodedName = encodeURIComponent(`${baseName}_${date}.xlsx`);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="query_result.xlsx"; filename*=UTF-8''${encodedName}`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }
}
