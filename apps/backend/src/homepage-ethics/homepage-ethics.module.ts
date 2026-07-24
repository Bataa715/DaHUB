import { Module } from "@nestjs/common";
import { HomepageEthicsController } from "./homepage-ethics.controller";
import { HomepageEthicsService } from "./homepage-ethics.service";

@Module({
  controllers: [HomepageEthicsController],
  providers: [HomepageEthicsService],
  exports: [HomepageEthicsService],
})
export class HomepageEthicsModule {}
