import { Module } from "@nestjs/common";
import { HomepageEthicsController } from "./homepage-ethics.controller";
import { HomepageEthicsService } from "./homepage-ethics.service";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [HomepageEthicsController],
  providers: [HomepageEthicsService],
  exports: [HomepageEthicsService],
})
export class HomepageEthicsModule {}
