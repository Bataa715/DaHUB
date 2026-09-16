import { Module } from "@nestjs/common";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { NegativeNewsController } from "./negative-news.controller";
import { NegativeNewsService } from "./negative-news.service";
import { NegativeNewsAiService } from "./negative-news-ai.service";

@Module({
  imports: [ClickHouseModule, AuditLogModule],
  controllers: [NegativeNewsController],
  providers: [NegativeNewsService, NegativeNewsAiService],
})
export class NegativeNewsModule {}
