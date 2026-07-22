import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";

@Module({
  imports: [ClickHouseModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
})
export class MonitoringModule {}
