import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { TailanTemplateController } from "./tailan-template.controller";
import { TailanTemplateService } from "./tailan-template.service";

@Module({
  imports: [ClickHouseModule],
  controllers: [TailanTemplateController],
  providers: [TailanTemplateService],
  exports: [TailanTemplateService],
})
export class TailanTemplateModule {}
