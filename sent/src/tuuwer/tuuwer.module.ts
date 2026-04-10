import { Module } from "@nestjs/common";
import { TuuwerController } from "./tuuwer.controller";
import { TuuwerService } from "./tuuwer.service";

/**
 * TuuwerModule — unified backend for sampling tools
 *
 * Covers:
 *  • Санамсаргүй Түүвэр  (random sampler: SRSWR, SRSWOR, stratified)
 *  • Зээлзэс Түүвэр       (pivot / loan sampler: prefix-grouped pivot + sample export)
 */
@Module({
  controllers: [TuuwerController],
  providers: [TuuwerService],
  exports: [TuuwerService],
})
export class TuuwerModule {}
