import { Module } from "@nestjs/common";
import { ChessController } from "./chess.controller";
import { ChessService } from "./chess.service";
import { ClickHouseModule } from "../clickhouse/clickhouse.module";

@Module({
  imports: [ClickHouseModule],
  controllers: [ChessController],
  providers: [ChessService],
})
export class ChessModule {}
