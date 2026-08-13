import { Module } from "@nestjs/common";
import { DepartmentsService } from "./departments.service";
import { DepartmentsController } from "./departments.controller";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
