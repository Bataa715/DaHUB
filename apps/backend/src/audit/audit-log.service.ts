import { Injectable, Logger } from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { randomUUID } from "crypto";

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  status: "success" | "failure";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
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
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId || "",
          method: entry.method,
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

    // Clamp limit: minimum 1, maximum 1000, default 100 (prevents NaN / unbounded queries)
    const limit = Math.min(
      Math.max(
        Number.isFinite(filters.limit ?? 100) ? (filters.limit ?? 100) : 100,
        1,
      ),
      1000,
    );
    params.limit = limit;
    const query = `
      SELECT * FROM audit_logs 
      WHERE ${conditions.join(" AND ")} 
      ORDER BY createdAt DESC 
      LIMIT {limit:UInt32}
    `;

    const logs = await this.clickhouse.query<any>(query, params);

    return logs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : {},
    }));
  }

  /** Нэвтрэх оролдлогын лог (brute-force хяналт) — нэгдсэн Log таб харуулна. */
  async getLoginAttempts(limit = 200) {
    const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    const rows = await this.clickhouse.query<any>(
      `SELECT lockKey, toString(attemptedAt) AS attemptedAt, success
       FROM login_attempts
       ORDER BY attemptedAt DESC
       LIMIT {limit:UInt32}`,
      { limit: lim },
    );
    return rows.map((r) => ({
      lockKey: String(r.lockKey ?? ""),
      attemptedAt: String(r.attemptedAt ?? ""),
      success: Number(r.success) === 1,
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
