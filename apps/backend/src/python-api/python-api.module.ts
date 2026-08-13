import { Module } from "@nestjs/common";
import { PythonApiController } from "./python-api.controller";
import { PythonApiService } from "./python-api.service";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [PythonApiController],
  providers: [PythonApiService],
})
export class PythonApiModule {}
