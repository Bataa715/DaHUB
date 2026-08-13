import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OracleService } from "./oracle.service";
import { OracleConfigService } from "./oracle-config.service";
import { OracleSearchController } from "./oracle-search.controller";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [OracleSearchController],
  providers: [OracleService, OracleConfigService],
  exports: [OracleService, OracleConfigService],
})
export class OracleModule {}
