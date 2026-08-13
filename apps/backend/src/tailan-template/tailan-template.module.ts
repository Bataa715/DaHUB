import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { TailanTemplateController } from "./tailan-template.controller";
import { TailanTemplateService } from "./tailan-template.service";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [ClickHouseModule, AuditLogModule],
  controllers: [TailanTemplateController],
  providers: [TailanTemplateService],
  exports: [TailanTemplateService],
})
export class TailanTemplateModule {}
