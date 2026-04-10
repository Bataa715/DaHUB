import { Module } from "@nestjs/common";
import { DbAccessController } from "./db-access.controller";
import { DbAccessService } from "./db-access.service";
import { ClickHouseAccessService } from "./clickhouse-access.service";
import { GrantExpiryService } from "./grant-expiry.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";

@Module({
  imports: [ClickHouseModule],
  controllers: [DbAccessController],
  providers: [DbAccessService, ClickHouseAccessService, GrantExpiryService],
  exports: [DbAccessService, ClickHouseAccessService],
})
export class DbAccessModule {}
