import { Module } from "@nestjs/common";
import { MedlegController } from "./medleg.controller";
import { MedlegService } from "./medleg.service";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [MedlegController],
  providers: [MedlegService],
  exports: [MedlegService],
})
export class MedlegModule {}
