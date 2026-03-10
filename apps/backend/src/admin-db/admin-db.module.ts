import { Module } from "@nestjs/common";
import { AdminDbController } from "./admin-db.controller";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";

@Module({
  imports: [ClickHouseModule],
  controllers: [AdminDbController],
})
export class AdminDbModule {}
