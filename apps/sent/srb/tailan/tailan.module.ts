import { Module } from "@nestjs/common";
import { TailanController } from "./tailan.controller";
import { TailanService } from "./tailan.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";

@Module({
  imports: [ClickHouseModule],
  controllers: [TailanController],
  providers: [TailanService],
  exports: [TailanService],
})
export class TailanModule {}
