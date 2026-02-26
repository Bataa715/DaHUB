import { Injectable, Logger } from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { randomUUID } from "crypto";

export interface AuditLogEntry {
  userId: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  status: "success" | "failure";
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private clickhouse: ClickHouseService) {}

  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const now = nowCH();

      await this.clickhouse.insert("audit_logs", [
        {
          id: randomUUID(),
          userId: entry.userId,
          userEmail: entry.userEmail || "",
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId || "",
          method: entry.method,
          ipAddress: entry.ipAddress || "",
          userAgent: entry.userAgent || "",
          status: entry.status,
          errorMessage: entry.errorMessage || "",
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : "",
          createdAt: now,
        },
      ]);
    } catch (error) {
      // Don't let audit logging break the application
      this.logger.error(`Failed to write audit log: ${error}`);
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const conditions: string[] = ["1=1"];
    const params: Record<string, any> = {};

    if (filters.userId) {
      conditions.push("userId = {userId:String}");
      params.userId = filters.userId;
    }

    if (filters.action) {
      conditions.push("action = {action:String}");
      params.action = filters.action;
    }

    if (filters.resource) {
      conditions.push("resource = {resource:String}");
      params.resource = filters.resource;
    }

    if (filters.status) {
      conditions.push("status = {status:String}");
      params.status = filters.status;
    }

    if (filters.startDate) {
      conditions.push("createdAt >= {startDate:DateTime}");
      params.startDate = filters.startDate
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    }

    if (filters.endDate) {
      conditions.push("createdAt <= {endDate:DateTime}");
      params.endDate = filters.endDate
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    }

    const limit = filters.limit || 100;
    const query = `
      SELECT * FROM audit_logs 
      WHERE ${conditions.join(" AND ")} 
      ORDER BY createdAt DESC 
      LIMIT ${limit}
    `;

    const logs = await this.clickhouse.query<any>(query, params);

    return logs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : {},
    }));
  }

  /**
   * Get audit logs summary/statistics
   */
  async getStats(filters: { startDate?: Date; endDate?: Date }) {
    const conditions: string[] = ["1=1"];
    const params: Record<string, any> = {};

    if (filters.startDate) {
      conditions.push("createdAt >= {startDate:DateTime}");
      params.startDate = filters.startDate
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    }

    if (filters.endDate) {
      conditions.push("createdAt <= {endDate:DateTime}");
      params.endDate = filters.endDate
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    }

    const query = `
      SELECT 
        action,
        resource,
        status,
        count() as count
      FROM audit_logs 
      WHERE ${conditions.join(" AND ")}
      GROUP BY action, resource, status
      ORDER BY count DESC
    `;

    return await this.clickhouse.query<any>(query, params);
  }
}
