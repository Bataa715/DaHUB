import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AuditLogService } from "./audit-log.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@ApiTags("audit")
@Controller("audit")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get("logs")
  @ApiOperation({
    summary: "Get audit logs",
    description: "Retrieve audit logs with optional filtering (Admin only)",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "Filter by user ID",
  })
  @ApiQuery({
    name: "action",
    required: false,
    description: "Filter by action",
  })
  @ApiQuery({
    name: "resource",
    required: false,
    description: "Filter by resource",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filter by status (success/failure)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of records",
    example: 100,
  })
  @ApiResponse({ status: 200, description: "Returns audit logs" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
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
  @ApiOperation({
    summary: "Get audit statistics",
    description: "Get audit log statistics and summary (Admin only)",
  })
  @ApiResponse({ status: 200, description: "Returns audit statistics" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getStats() {
    return this.auditLogService.getStats({});
  }
}
