import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { TailanController } from "./tailan.controller";
import { TailanReportsService } from "./tailan-reports.service";
import { TailanImagesService } from "./tailan-images.service";
import { TailanDocxService } from "./tailan-docx.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { TailanTemplateModule } from "../tailan-template/tailan-template.module";

@Module({
  imports: [ClickHouseModule, AuthModule, AuditLogModule, TailanTemplateModule],
  controllers: [TailanController],
  providers: [TailanReportsService, TailanImagesService, TailanDocxService],
  exports: [TailanReportsService, TailanImagesService, TailanDocxService],
})
export class TailanModule {}
