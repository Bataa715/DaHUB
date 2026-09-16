import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { ZainiiAuditController } from "./zainii-audit.controller";
import { ZainiiAuditService } from "./zainii-audit.service";
import { ZainiiAuditDocxService } from "./zainii-audit-docx.service";

@Module({
  imports: [ClickHouseModule],
  controllers: [ZainiiAuditController],
  providers: [ZainiiAuditService, ZainiiAuditDocxService],
})
export class ZainiiAuditModule {}
