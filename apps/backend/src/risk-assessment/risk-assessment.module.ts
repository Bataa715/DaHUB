import { Module } from "@nestjs/common";
import { RiskAssessmentController } from "./risk-assessment.controller";
import { RiskAssessmentService } from "./risk-assessment.service";
import { OracleModule } from "../oracle/oracle.module";

@Module({
  imports: [OracleModule],
  controllers: [RiskAssessmentController],
  providers: [RiskAssessmentService],
  exports: [RiskAssessmentService],
})
export class RiskAssessmentModule {}
