import { Module } from "@nestjs/common";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
