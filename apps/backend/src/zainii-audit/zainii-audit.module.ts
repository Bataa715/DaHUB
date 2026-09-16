import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit/audit-log.module";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { ZainiiAuditController } from "./zainii-audit.controller";
import { ZainiiAuditService } from "./zainii-audit.service";
import { ZainiiAuditSettingsService } from "./zainii-audit-settings.service";
import { ZainiiAuditVerificationService } from "./zainii-audit-verification.service";
import { ZainiiAuditDocxService } from "./zainii-audit-docx.service";

@Module({
  imports: [ClickHouseModule, AuditLogModule],
  controllers: [ZainiiAuditController],
  providers: [
    ZainiiAuditService,
    ZainiiAuditSettingsService,
    ZainiiAuditVerificationService,
    ZainiiAuditDocxService,
  ],
})
export class ZainiiAuditModule {}
