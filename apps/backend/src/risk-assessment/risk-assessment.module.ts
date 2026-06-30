import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { RiskAssessmentController } from "./risk-assessment.controller";
import { RiskAssessmentService } from "./risk-assessment.service";

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [RiskAssessmentController],
  providers: [RiskAssessmentService],
  exports: [RiskAssessmentService],
})
export class RiskAssessmentModule {}
