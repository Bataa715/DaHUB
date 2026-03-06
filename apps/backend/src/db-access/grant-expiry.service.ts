/**
 * GrantExpiryService
 *
 * Runs every minute to check for expired access grants and automatically:
 *  1. Marks them inactive in access_grants (audit trail)
 *  2. Revokes the ClickHouse role and drops the user if no roles remain
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { ClickHouseAccessService } from "./clickhouse-access.service";

@Injectable()
export class GrantExpiryService {
  private readonly logger = new Logger(GrantExpiryService.name);

  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly chAccess: ClickHouseAccessService,
  ) {}

  /** Run every minute — expire grants whose validUntil has passed */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireGrants(): Promise<void> {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 19).replace("T", " ");

    // Find all active grants that have expired
    const expired = await this.clickhouse.query<any>(
      `SELECT *
       FROM access_grants FINAL
       WHERE isActive = 1
         AND validUntil <= {now:String}`,
      { now: nowStr },
    );

    if (expired.length === 0) return;

    this.logger.log(
      `[expiry] Found ${expired.length} expired grant(s) to revoke`,
    );

    for (const grant of expired) {
      try {
        // 1. Mark inactive in audit trail
        await this.clickhouse.insert("access_grants", [
          {
            ...grant,
            columns: Array.isArray(grant.columns)
              ? grant.columns
              : JSON.parse(grant.columns ?? "[]"),
            accessTypes: Array.isArray(grant.accessTypes)
              ? grant.accessTypes
              : JSON.parse(grant.accessTypes ?? "[]"),
            isActive: 0,
            revokedAt: nowStr,
            revokeReason: "Хүчинтэй хугацаа дууслаа (автомат)",
            grantedAt: nowStr,
          },
        ]);

        // 2. Revoke ClickHouse SQL access (selective per table)
        const result = await this.chAccess.revokeAccess({
          requestId: grant.requestId,
          requesterUserId: grant.userUserId,
          tableName: grant.tableName,
        });

        this.logger.log(
          `[expiry] ✓ grant=${grant.id} user=${grant.userUserId} ` +
            `table=${grant.tableName} userDropped=${result.userDropped}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `[expiry] Failed to expire grant=${grant.id}: ${err?.message}`,
        );
      }
    }
  }
}
