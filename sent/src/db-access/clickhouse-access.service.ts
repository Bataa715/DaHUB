/**
 * ClickHouseAccessService
 *
 * Manages ClickHouse SQL Access-Control (local-directory, NOT users.xml).
 * Lifecycle per request:
 *   approve → CREATE USER (if absent) + CREATE ROLE + GRANT SELECT + SET DEFAULT ROLE
 *   revoke  → REVOKE ROLE + DROP ROLE + DROP USER (when no roles remain)
 *
 * Security guarantees:
 *  - All identifiers (username, role, table) are whitelist-validated and
 *    backtick-escaped before interpolation – no user input reaches raw SQL.
 *  - Only tables in ALLOWED_DATABASES (FINACLE, ERP, CARDZONE, EBANK) may ever receive a GRANT.
 *  - Passwords are never logged.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { randomBytes } from "crypto";

// ─── Whitelist ───────────────────────────────────────────────────────────────

/**
 * Databases whose tables may ever receive a GRANT.
 * Must match the ALLOWED_DATABASES list in db-access.service.ts.
 */
const ALLOWED_DATABASES = new Set<string>([
  "FINACLE",
  "ERP",
  "CARDZONE",
  "EBANK",
]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApproveAccessOptions {
  /** UUID of the access_requests row – becomes part of the role name */
  requestId: string;
  /** The requester's login userId stored in audit_db.users (e.g. "B.Batmunkh") */
  requesterUserId: string;
  /** Fully-qualified table to grant (e.g. "FINACLE.HTD") */
  tableName: string;
  /**
   * Optional pre-generated password to reuse.
   * Supply this when approving multiple tables in one request so all grants
   * share a single password and the user's CH password is not overwritten
   * on every iteration.
   */
  password?: string;
}

export interface RevokeAccessOptions {
  /** Same UUID used during approval */
  requestId: string;
  /** The requester's login userId */
  requesterUserId: string;
  /**
   * If provided, only revoke SELECT on this specific table from the shared role.
   * If omitted, the entire role is dropped (full revocation).
   */
  tableName?: string;
}

export interface GrantVerification {
  username: string;
  role: string;
  grants: string[];
  hasSelectOnTable: boolean;
  /** Newly generated (or reset) ClickHouse password. Always present after approval. */
  generatedPassword: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ClickHouseAccessService {
  private readonly logger = new Logger(ClickHouseAccessService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * STEP 1 of fast multi-table approval (call ONCE per request):
   *  - CREATE USER or ALTER USER (always syncs password — fixes auth mismatch)
   *  - CREATE ROLE IF NOT EXISTS
   *  - GRANT role TO user
   *  - ALTER USER DEFAULT ROLE ALL
   *
   * After this, call grantTableToRole() in parallel for every table.
   */
  async setupUserAndRole(opts: {
    requestId: string;
    requesterUserId: string;
    password: string;
  }): Promise<void> {
    const { requestId, requesterUserId, password } = opts;
    const username = this.sanitizeIdentifier(requesterUserId);
    const role = this.buildRoleName(requestId);

    this.logger.log(`[setup] user=${username} role=${role}`);

    // Always set the password — guarantees stored password ≡ CH password
    const userExists = await this.clickhouseUserExists(username);
    if (!userExists) {
      await this.execSafe(
        `CREATE USER ${this.q(username)} IDENTIFIED WITH sha256_password BY ${this.literal(password)}`,
        `create user ${username}`,
      );
    } else {
      await this.execSafe(
        `ALTER USER ${this.q(username)} IDENTIFIED WITH sha256_password BY ${this.literal(password)}`,
        `update password for ${username}`,
      );
    }

    await this.execSafe(
      `CREATE ROLE IF NOT EXISTS ${this.q(role)}`,
      `create role ${role}`,
    );
    await this.execSafe(
      `GRANT ${this.q(role)} TO ${this.q(username)}`,
      `grant role to user`,
    );
    await this.execSafe(
      `ALTER USER ${this.q(username)} DEFAULT ROLE ALL`,
      `default role all for ${username}`,
    );

    this.logger.log(`[setup] ✓ user=${username} role=${role} ready`);
  }

  /**
   * STEP 2 of fast multi-table approval (call in parallel for each table):
   *  - GRANT SELECT ON <db>.<table> TO <role>
   *
   * Prerequisite: setupUserAndRole() must have been called first.
   */
  async grantTableToRole(requestId: string, tableName: string): Promise<void> {
    this.assertValidTable(tableName);
    const role = this.buildRoleName(requestId);
    const [db, table] = tableName.split(".");
    await this.execSafe(
      `GRANT SELECT ON ${this.q(db)}.${this.q(table)} TO ${this.q(role)}`,
      `grant select on ${tableName} to ${role}`,
    );
    this.logger.log(`[grant] ✓ ${tableName} → ${role}`);
  }

  /**
   * Legacy single-table approval (kept for backwards compat / single-table requests).
   * For multi-table requests use setupUserAndRole + grantTableToRole instead.
   */
  async approveAccess(opts: ApproveAccessOptions): Promise<GrantVerification> {
    const { requestId, requesterUserId, tableName, password } = opts;

    this.assertValidTable(tableName);
    const username = this.sanitizeIdentifier(requesterUserId);
    const role = this.buildRoleName(requestId);
    const [db, table] = tableName.split(".");

    this.logger.log(
      `[approve] requestId=${requestId} user=${username} table=${tableName} role=${role}`,
    );

    // Always set the password so the stored value always matches CH
    const generatedPassword: string =
      password ?? randomBytes(12).toString("hex");
    const userExists = await this.clickhouseUserExists(username);
    if (!userExists) {
      await this.execSafe(
        `CREATE USER ${this.q(username)} IDENTIFIED WITH sha256_password BY ${this.literal(generatedPassword)}`,
        `create user ${username}`,
      );
    } else {
      await this.execSafe(
        `ALTER USER ${this.q(username)} IDENTIFIED WITH sha256_password BY ${this.literal(generatedPassword)}`,
        `update password for ${username}`,
      );
    }

    await this.execSafe(
      `CREATE ROLE IF NOT EXISTS ${this.q(role)}`,
      `create role ${role}`,
    );
    await this.execSafe(
      `GRANT SELECT ON ${this.q(db)}.${this.q(table)} TO ${this.q(role)}`,
      `grant select on ${tableName}`,
    );
    await this.execSafe(
      `GRANT ${this.q(role)} TO ${this.q(username)}`,
      `grant role to user`,
    );
    await this.execSafe(
      `ALTER USER ${this.q(username)} DEFAULT ROLE ALL`,
      `default role all`,
    );

    const verification = await this.verifyGrants(username, role, tableName);
    this.logger.log(
      `[approve] ✓ user=${username} hasSelect=${verification.hasSelectOnTable}`,
    );
    return { ...verification, generatedPassword };
  }

  /**
   * Revoke access for a specific table (selective) or the entire request (full).
   *
   * - If `tableName` provided: REVOKE SELECT ON table FROM role.
   *   If no privileges remain on the role → DROP ROLE → possibly DROP USER.
   * - If `tableName` omitted: DROP ROLE directly → possibly DROP USER.
   */
  async revokeAccess(
    opts: RevokeAccessOptions,
  ): Promise<{ userDropped: boolean }> {
    const { requestId, requesterUserId, tableName } = opts;

    const username = this.sanitizeIdentifier(requesterUserId);
    const role = this.buildRoleName(requestId);

    this.logger.log(
      `[revoke] requestId=${requestId} user=${username} role=${role}${
        tableName ? ` table=${tableName}` : " (full)"
      }`,
    );

    if (tableName) {
      // ── Selective: remove only this table's SELECT privilege from the role ──
      const [db, tbl] = tableName.split(".");
      try {
        await this.clickhouse.execAcl(
          `REVOKE SELECT ON ${this.q(db)}.${this.q(tbl)} FROM ${this.q(role)}`,
        );
        this.logger.debug(
          `[exec] ✓ revoke select on ${tableName} from role ${role}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `[revoke] Could not revoke select on ${tableName} from ${role}: ${err?.message}`,
        );
      }

      // Check if this role still has any SELECT privileges left
      const remainingPrivileges = await this.getRolePrivilegeCount(role);
      if (remainingPrivileges > 0) {
        this.logger.log(
          `[revoke] ✓ removed ${tableName} from role ${role}; ${remainingPrivileges} privilege(s) remain`,
        );
        return { userDropped: false };
      }
      // No privileges remain → fall through to drop the role
      this.logger.log(
        `[revoke] Role ${role} has no remaining privileges — dropping`,
      );
    }

    // ── Drop the role entirely ───────────────────────────────────────────────
    // First revoke it from the user (ClickHouse requires explicit REVOKE before DROP)
    try {
      await this.clickhouse.execAcl(
        `REVOKE ${this.q(role)} FROM ${this.q(username)}`,
      );
      this.logger.debug(`[exec] ✓ revoke role ${role} from ${username}`);
    } catch (err: any) {
      this.logger.warn(
        `[revoke] Could not revoke role ${role} from ${username}: ${err?.message}`,
      );
    }

    await this.execSafe(
      `DROP ROLE IF EXISTS ${this.q(role)}`,
      `drop role ${role}`,
    );

    // ── Drop user if no other roles remain ──────────────────────────────────
    const remainingRoles = await this.getActiveRolesForUser(username);
    let userDropped = false;

    if (remainingRoles.length === 0) {
      await this.execSafe(
        `DROP USER IF EXISTS ${this.q(username)}`,
        `drop user ${username}`,
      );
      userDropped = true;
      this.logger.log(
        `[revoke] ✓ user ${username} dropped (no remaining roles)`,
      );
    } else {
      this.logger.log(
        `[revoke] ✓ role dropped; user ${username} retains ${remainingRoles.length} role(s)`,
      );
    }

    return { userDropped };
  }

  /**
   * Return SHOW GRANTS output for an existing ClickHouse user (for debugging / UI).
   */
  async showGrantsForUser(requesterUserId: string): Promise<string[]> {
    const username = this.sanitizeIdentifier(requesterUserId);
    return this.fetchGrants(username);
  }

  /**
   * Force-clean all ClickHouse access state for a user:
   *   - Drop every role whose name matches `role_req_*` that is assigned to the user
   *   - Drop the ClickHouse user itself
   *
   * Use this when a user is stuck (orphaned roles, broken DEFAULT ROLE state, etc.)
   * so that the next approval can start from a clean slate.
   */
  async cleanupUserChAccess(
    requesterUserId: string,
  ): Promise<{ rolesDropped: string[]; userDropped: boolean }> {
    const username = this.sanitizeIdentifier(requesterUserId);
    const rolesDropped: string[] = [];

    // 1. Collect all role_req_* roles currently assigned to this user
    const assignedRoles = await this.getActiveRolesForUser(username);
    const reqRoles = assignedRoles.filter((r) => r.startsWith("role_req_"));

    // 2. Also catch orphaned role_req_* roles that still have grants TO this user
    //    in system.grants (user_name column). Scoped strictly to this user —
    //    never touches other users' roles.
    try {
      const orphanedRoles = await this.clickhouse.queryAcl<{
        role_name: string;
      }>(
        `SELECT DISTINCT role_name
         FROM system.grants
         WHERE user_name = {username:String}
           AND role_name LIKE 'role_req_%'`,
        { username },
      );
      for (const { role_name } of orphanedRoles) {
        if (!reqRoles.includes(role_name)) {
          reqRoles.push(role_name);
        }
      }
    } catch {
      // system.grants unavailable — proceed with what we have
    }

    // 3. Drop each role (revoke from user first, then drop)
    for (const role of reqRoles) {
      try {
        await this.clickhouse.execAcl(
          `REVOKE IF EXISTS ${this.q(role)} FROM ${this.q(username)}`,
        );
      } catch {
        /* ignore */
      }
      try {
        await this.clickhouse.execAcl(`DROP ROLE IF EXISTS ${this.q(role)}`);
        rolesDropped.push(role);
        this.logger.log(
          `[cleanup] Dropped orphaned role ${role} for user ${username}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `[cleanup] Could not drop role ${role}: ${err?.message}`,
        );
      }
    }

    // 4. Drop the ClickHouse user
    let userDropped = false;
    const userExists = await this.clickhouseUserExists(username);
    if (userExists) {
      try {
        await this.clickhouse.execAcl(
          `DROP USER IF EXISTS ${this.q(username)}`,
        );
        userDropped = true;
        this.logger.log(`[cleanup] Dropped CH user ${username}`);
      } catch (err: any) {
        this.logger.warn(
          `[cleanup] Could not drop CH user ${username}: ${err?.message}`,
        );
      }
    }

    return { rolesDropped, userDropped };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Security ────────────────────────────────────────────────────────────────

  /**
   * Enforce the ALLOWED_DATABASES whitelist.
   * tableName must be in "DATABASE.table" format and the database prefix
   * must be one of the permitted databases.
   */
  private assertValidTable(tableName: string): void {
    const dot = tableName.indexOf(".");
    const db = dot !== -1 ? tableName.slice(0, dot).toUpperCase() : "";
    if (!db || !ALLOWED_DATABASES.has(db)) {
      this.logger.warn(
        `[security] Blocked table from disallowed database: "${tableName}"`,
      );
      throw new BadRequestException(
        `Table "${tableName}" is not in an allowed database`,
      );
    }
  }

  /**
   * Sanitize any string that will be used as a ClickHouse identifier.
   * Allows: alphanumeric, underscore, hyphen, dot.
   * Throws BadRequestException on illegal characters.
   */
  private sanitizeIdentifier(value: string): string {
    if (!/^[A-Za-z0-9._\-]+$/.test(value)) {
      throw new BadRequestException(
        `Identifier "${value}" contains illegal characters`,
      );
    }
    return value;
  }

  /**
   * Backtick-quote a single identifier segment (no dots).
   * Escapes any internal backticks.
   */
  private q(identifier: string): string {
    return "`" + identifier.replace(/`/g, "``") + "`";
  }

  /**
   * Produce a ClickHouse single-quoted string literal, escaping ' and \.
   * Used ONLY for the password value – never for identifiers.
   */
  private literal(value: string): string {
    const escaped = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /** Build a deterministic role name from a UUID requestId (ONE role per request). */
  private buildRoleName(requestId: string): string {
    const safeId = requestId.replace(/[^A-Za-z0-9\-]/g, "");
    return `role_req_${safeId}`;
  }

  // ── ClickHouse queries ──────────────────────────────────────────────────────

  /**
   * Check whether a ClickHouse user already exists in system.users.
   */
  private async clickhouseUserExists(username: string): Promise<boolean> {
    try {
      const rows = await this.clickhouse.queryAcl<{ name: string }>(
        `SELECT name FROM system.users WHERE name = {name:String} LIMIT 1`,
        { name: username },
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Fetch the raw grant lines for a ClickHouse user via SHOW GRANTS.
   * Falls back to [] if the user does not exist.
   */
  private async fetchGrants(username: string): Promise<string[]> {
    try {
      const rows = await this.clickhouse.queryAcl<{ grants: string }>(
        // SHOW GRANTS returns one row per grant line; column name is "GRANTS FOR …"
        // Use the generic system.grants table instead for reliable parsing
        `SHOW GRANTS FOR ${this.q(username)}`,
      );
      // The result column may be named differently across CH versions
      return rows.map((r) => Object.values(r)[0] as string);
    } catch {
      // User may not exist yet – not an error
      return [];
    }
  }

  /**
   * Count the number of SELECT privileges still granted to a role.
   * Used after a selective table revoke to decide whether to drop the role.
   */
  private async getRolePrivilegeCount(role: string): Promise<number> {
    try {
      const rows = await this.clickhouse.queryAcl<{ cnt: string }>(
        `SELECT count() AS cnt
         FROM system.grants
         WHERE role_name = {role:String}`,
        { role },
      );
      return parseInt(rows[0]?.cnt ?? "0", 10);
    } catch {
      // system.grants unavailable — assume privileges remain (safe default)
      return 1;
    }
  }

  /**
   * Return the names of roles currently assigned to the ClickHouse user.
   * Queries system.role_grants which is always available on ClickHouse ≥ 21.6.
   */
  private async getActiveRolesForUser(username: string): Promise<string[]> {
    try {
      const rows = await this.clickhouse.queryAcl<{
        granted_role_name: string;
      }>(
        `SELECT granted_role_name
         FROM system.role_grants
         WHERE user_name = {username:String}`,
        { username },
      );
      return rows.map((r) => r.granted_role_name);
    } catch {
      // If system table unavailable, fall back to SHOW GRANTS parsing
      const grants = await this.fetchGrants(username);
      return grants
        .filter((g) => /^GRANT\s+`?role_req_/.test(g))
        .map((g) => {
          const m = g.match(/GRANT\s+`?([^`\s]+)`?\s+TO/);
          return m ? m[1] : "";
        })
        .filter(Boolean);
    }
  }

  /**
   * Verify that the expected SELECT grant exists after approval.
   */
  private async verifyGrants(
    username: string,
    role: string,
    tableName: string,
  ): Promise<Omit<GrantVerification, "generatedPassword">> {
    const grants = await this.fetchGrants(username);

    // Check for the SELECT grant on the target table
    const [db, table] = tableName.split(".");
    const hasSelectOnTable = grants.some(
      (g) =>
        g.toUpperCase().includes("SELECT") &&
        g.includes(db) &&
        g.includes(table),
    );

    return { username, role, grants, hasSelectOnTable };
  }

  /**
   * Wrapper around clickhouse.exec that catches errors and re-throws with context.
   * Never exposes the raw SQL (which may contain a password) in production logs.
   */
  private async execSafe(sql: string, description: string): Promise<void> {
    try {
      await this.clickhouse.execAcl(sql);
      this.logger.debug(`[exec] ✓ ${description}`);
    } catch (error: any) {
      this.logger.error(
        `[exec] ✗ ${description} — ${error?.message ?? "unknown error"}`,
      );
      throw new InternalServerErrorException(
        `ClickHouse access control error during "${description}": ${error?.message}`,
      );
    }
  }
}
