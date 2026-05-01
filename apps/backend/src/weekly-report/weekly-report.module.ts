import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { WeeklyReportController } from "./weekly-report.controller";
import { WeeklyReportService } from "./weekly-report.service";

@Module({
  imports: [ClickHouseModule],
  controllers: [WeeklyReportController],
  providers: [WeeklyReportService],
  exports: [WeeklyReportService],
})
export class WeeklyReportModule {}
