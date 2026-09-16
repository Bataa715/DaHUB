import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { DbChangesController } from "./db-changes.controller";
import { DbChangesService } from "./db-changes.service";

@Module({
  imports: [ClickHouseModule, AuditLogModule],
  controllers: [DbChangesController],
  providers: [DbChangesService],
})
export class DbChangesModule {}
