import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";

@Controller("audit")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get("logs")
  async getLogs(
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("resource") resource?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    return this.auditLogService.getLogs({
      userId,
      action,
      resource,
      status,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  @Get("stats")
  async getStats() {
    return this.auditLogService.getStats({});
  }
}
