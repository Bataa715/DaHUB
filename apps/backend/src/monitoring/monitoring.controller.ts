import { Body, Controller, Post, UseGuards } from "@nestjs/common";
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
}
