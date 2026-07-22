import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DbAccessController } from "./db-access.controller";
import { DbAccessService } from "./db-access.service";
import { ClickHouseAccessService } from "./clickhouse-access.service";
import { GrantExpiryService } from "./grant-expiry.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [ClickHouseModule, AuthModule, AuditLogModule],
  // NOTE: AuditLogModule is also used inside DbAccessService now (grant
  // lifecycle audit trail) in addition to GrantExpiryService.
  controllers: [DbAccessController],
  providers: [DbAccessService, ClickHouseAccessService, GrantExpiryService],
  exports: [DbAccessService, ClickHouseAccessService],
})
export class DbAccessModule {}
