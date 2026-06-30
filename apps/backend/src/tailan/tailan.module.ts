import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { TailanController } from "./tailan.controller";
import { TailanService } from "./tailan.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";

@Module({
  imports: [ClickHouseModule, AuthModule, AuditLogModule],
  controllers: [TailanController],
  providers: [TailanService],
  exports: [TailanService],
})
export class TailanModule {}
