import { Module } from "@nestjs/common";
import { RiskAssessmentController } from "./risk-assessment.controller";
import { RiskAssessmentService } from "./risk-assessment.service";

@Module({
  controllers: [RiskAssessmentController],
  providers: [RiskAssessmentService],
  exports: [RiskAssessmentService],
})
export class RiskAssessmentModule {}
