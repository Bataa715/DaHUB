import { Controller, Post, Body, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { ReportService } from "./report.service";
import { GenerateReportDto } from "./dto/report.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("report")
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post("generate")
  async generate(@Body() dto: GenerateReportDto, @Res() res: Response) {
    const buffer = await this.reportService.generate(dto);

    const filename = encodeURIComponent(
      `Аудитын-тайлан-${dto.department}-${dto.reportDate}.docx`,
    );

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Content-Length": buffer.length,
      "Cache-Control": "no-store, no-cache",
      Pragma: "no-cache",
    });

    res.end(buffer);
  }
}
