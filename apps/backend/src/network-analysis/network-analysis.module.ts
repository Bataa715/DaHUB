import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { NetworkAnalysisController } from "./network-analysis.controller";
import { NetworkAnalysisService } from "./network-analysis.service";

@Module({
  imports: [ClickHouseModule, AuditLogModule],
  controllers: [NetworkAnalysisController],
  providers: [NetworkAnalysisService],
})
export class NetworkAnalysisModule {}
