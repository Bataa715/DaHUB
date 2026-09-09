import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { ZainiiAuditController } from "./zainii-audit.controller";
import { ZainiiAuditService } from "./zainii-audit.service";

@Module({
  imports: [ClickHouseModule],
  controllers: [ZainiiAuditController],
  providers: [ZainiiAuditService],
})
export class ZainiiAuditModule {}
