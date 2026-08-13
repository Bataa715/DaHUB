import { Module } from "@nestjs/common";
import { RiskIndicatorConfigController } from "./risk-indicator-config.controller";
import { RiskIndicatorConfigService } from "./risk-indicator-config.service";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [RiskIndicatorConfigController],
  providers: [RiskIndicatorConfigService],
  exports: [RiskIndicatorConfigService],
})
export class RiskIndicatorConfigModule {}
