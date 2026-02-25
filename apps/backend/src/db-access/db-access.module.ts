import { Module } from "@nestjs/common";
import { DbAccessController } from "./db-access.controller";
import { DbAccessService } from "./db-access.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";

@Module({
  imports: [ClickHouseModule],
  controllers: [DbAccessController],
  providers: [DbAccessService],
  exports: [DbAccessService],
})
export class DbAccessModule {}
