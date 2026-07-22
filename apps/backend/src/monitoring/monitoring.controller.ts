import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ToolGuard } from "../auth/guards/tool.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { MonitoringService } from "./monitoring.service";
import { RelatedPartyTransactionsDto } from "./dto/monitoring.dto";

@UseGuards(JwtAuthGuard, ToolGuard)
@RequireTools("monitoring_box")
@Controller("monitoring")
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Post("related-party-transactions")
  findRelatedPartyTransactions(@Body() dto: RelatedPartyTransactionsDto) {
    return this.monitoring.findRelatedPartyTransactions(dto);
  }

  @Post("related-party-transactions/export")
  async exportRelatedPartyTransactions(
    @Body() dto: RelatedPartyTransactionsDto,
    @Res() res: Response,
  ) {
    const buffer =
      await this.monitoring.exportRelatedPartyTransactionsXlsx(dto);
    const filename = encodeURIComponent(
      `harilcsan-guilgee-${dto.startDate}_${dto.endDate}.xlsx`,
    );
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });
    res.end(buffer);
  }
}
