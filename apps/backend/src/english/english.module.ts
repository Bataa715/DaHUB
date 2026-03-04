import { Module } from "@nestjs/common";
import { EnglishController } from "./english.controller";
import { EnglishService } from "./english.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";

@Module({
  imports: [ClickHouseModule],
  controllers: [EnglishController],
  providers: [EnglishService],
})
export class EnglishModule {}
