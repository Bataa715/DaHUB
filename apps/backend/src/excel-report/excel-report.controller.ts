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

  /** POST /excel-report/run — execute python and download xlsx */
  @Post("run")
  async runReport(@Body() dto: RunReportDto, @Res() res: Response) {
    const buffer = await this.service.runReport(dto);
    const safeName = dto.templateId.replace(/[^a-z0-9]/gi, "_");
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report_${safeName}_${date}.xlsx"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }
}
