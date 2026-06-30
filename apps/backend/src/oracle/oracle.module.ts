import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OracleService } from "./oracle.service";
import { OracleConfigService } from "./oracle-config.service";
import { OracleSearchController } from "./oracle-search.controller";

@Module({
  imports: [AuthModule],
  controllers: [OracleSearchController],
  providers: [OracleService, OracleConfigService],
  exports: [OracleService, OracleConfigService],
})
export class OracleModule {}
