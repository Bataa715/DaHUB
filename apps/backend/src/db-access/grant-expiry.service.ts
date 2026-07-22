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
import { AuditLogService } from "../audit/audit-log.service";

@Injectable()
export class GrantExpiryService {
  private readonly logger = new Logger(GrantExpiryService.name);

  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly chAccess: ClickHouseAccessService,
    private readonly auditLogService: AuditLogService,
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
        // [H-12] Revoke the LIVE ClickHouse SQL access FIRST. Only once that
        // has actually succeeded do we mark the grant inactive in the audit
        // trail — otherwise a revoke failure would leave the DB saying
        // "revoked" while the user still has live access, with nothing to
        // retry it. If revokeAccess throws, we skip the audit-trail write so
        // this same grant is picked up and retried on the next run (a minute
        // later) instead of silently going stale.
        const result = await this.chAccess.revokeAccess({
          requestId: grant.requestId,
          requesterUserId: grant.userUserId,
          tableName: grant.tableName,
        });

        // Mark inactive in audit trail now that access is actually revoked
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

        this.logger.log(
          `[expiry] ✓ grant=${grant.id} user=${grant.userUserId} ` +
            `table=${grant.tableName} userDropped=${result.userDropped}`,
        );
      } catch (err: any) {
        this.logger.error(
          `[expiry] Failed to revoke expired grant=${grant.id} user=${grant.userUserId} ` +
            `table=${grant.tableName} — will retry next run: ${err?.message}`,
        );
        // Surface in the audit log too so a stuck revoke (repeated failures)
        // is discoverable outside of application logs.
        await this.auditLogService
          .log({
            userId: "system",
            action: "grant_expiry_revoke_failed",
            resource: "access_grants",
            method: "expireGrants",
            status: "failure",
            errorMessage: err?.message ?? String(err),
            metadata: {
              grantId: grant.id,
              userUserId: grant.userUserId,
              tableName: grant.tableName,
            },
          })
          .catch(() => {
            // Never let audit-log failure mask the original error
          });
      }
    }
  }
}
