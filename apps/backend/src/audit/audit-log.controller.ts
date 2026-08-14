import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { AuditLogService } from "./audit-log.service";

/**
 * Нэгдсэн Log таб-ын backend — зөвхөн super admin. Бүх төрлийн логийг нэг
 * дороос харах: audit (мутаци), нэвтрэх оролдлого. (Python run-log нь
 * python-api/admin/run-logs endpoint-оос ирнэ.)
 */
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  /** Мутацийн audit лог (шүүлтүүртэй). */
  @Get()
  async list(
    @Query("limit") limit?: string,
    @Query("action") action?: string,
    @Query("status") status?: string,
    @Query("resource") resource?: string,
    @Query("userId") userId?: string,
  ) {
    return this.auditLog.getLogs({
      limit: limit ? Number(limit) : 200,
      action: action || undefined,
      status: status || undefined,
      resource: resource || undefined,
      userId: userId || undefined,
    });
  }

  /** Нэвтрэх оролдлогын лог. */
  @Get("login-attempts")
  async loginAttempts(@Query("limit") limit?: string) {
    return this.auditLog.getLoginAttempts(limit ? Number(limit) : 200);
  }
}
