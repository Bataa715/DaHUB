import { Module } from "@nestjs/common";
import { MedlegController } from "./medleg.controller";
import { MedlegService } from "./medleg.service";

@Module({
  controllers: [MedlegController],
  providers: [MedlegService],
  exports: [MedlegService],
})
export class MedlegModule {}
