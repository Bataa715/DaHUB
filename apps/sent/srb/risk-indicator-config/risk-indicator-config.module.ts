import { Module } from "@nestjs/common";
import { RiskIndicatorConfigController } from "./risk-indicator-config.controller";
import { RiskIndicatorConfigService } from "./risk-indicator-config.service";

@Module({
  controllers: [RiskIndicatorConfigController],
  providers: [RiskIndicatorConfigService],
  exports: [RiskIndicatorConfigService],
})
export class RiskIndicatorConfigModule {}
