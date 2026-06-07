import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { createClient, ClickHouseClient } from "@clickhouse/client";
import { randomUUID } from "crypto";

/** Returns current UTC timestamp in ClickHouse DateTime string format (YYYY-MM-DD HH:MM:SS). */
export const nowCH = (): string =>
  new Date().toISOString().slice(0, 19).replace("T", " ");

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private client: ClickHouseClient;
  private aclClient: ClickHouseClient;
  private readonly logger = new Logger(ClickHouseService.name);

  async onModuleInit() {
    if (!process.env.CLICKHOUSE_HOST) {
      throw new Error("CLICKHOUSE_HOST environment variable is required");
    }
    const host = process.env.CLICKHOUSE_HOST;
    const database = process.env.CLICKHOUSE_DATABASE || "audit_db";

    // ── 1. Bootstrap (admin) client — schema init + user provisioning only ─────
    //   Use explicit bootstrap credentials when provided, otherwise fallback to
    //   ClickHouse's built-in "default" user.
    //   This client is closed immediately after provisionServiceUsers() completes.
    const adminUser =
      process.env.CLICKHOUSE_BOOTSTRAP_USER ||
      process.env.CLICKHOUSE_USER ||
      "default";
    const adminPass =
      process.env.CLICKHOUSE_BOOTSTRAP_PASSWORD ??
      process.env.CLICKHOUSE_PASSWORD ??
      "";

    this.logger.log(
      `Connecting to ClickHouse at ${host} (bootstrap as "${adminUser}")...`,
    );

    try {
      // Temporarily assign so exec() / query() work inside initializeSchema()
      this.client = createClient({
        url: host,
        username: adminUser,
        password: adminPass,
        database,
        request_timeout: 30000,
        compression: { request: true, response: true },
      });

      const result = await this.client.query({
        query: "SELECT version() as version",
      });
      const data = (await result.json()) as { data: { version: string }[] };
      this.logger.log(`ClickHouse version: ${data.data[0].version}`);

      // Initialize schema AND provision audit_app / audit_acl (needs admin rights)
      await this.initializeSchema();

      // ── 2. Switch to limited runtime client ────────────────────────────────
      // If CLICKHOUSE_USER is unset or is the admin "default", automatically
      // fall back to "audit_app" which was just provisioned above.
      const envUser = process.env.CLICKHOUSE_USER;
      const runtimeUser =
        !envUser || envUser === adminUser ? "audit_app" : envUser;
      if (!envUser || envUser === adminUser) {
        this.logger.warn(
          `CLICKHOUSE_USER is "${envUser ?? "(unset)"}" — automatically using "audit_app" service account.`,
        );
      }
      const runtimePass = process.env.CLICKHOUSE_PASSWORD || "";
      await this.client.close();
      this.client = createClient({
        url: host,
        username: runtimeUser,
        password: runtimePass,
        database,
        request_timeout: 30000,
        compression: { request: true, response: true },
      });
      this.logger.log(
        `Runtime client switched to "${runtimeUser}" (limited privileges)`,
      );

      // ── 3. ACL client = runtime client (audit_app handles everything) ───────────
      this.aclClient = this.client;
    } catch (error: unknown) {
      this.logger.error(
        "Failed to connect to ClickHouse:",
        (error as Error).message,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.logger.log("ClickHouse connection closed");
    }
  }

  /**
   * Execute a SELECT query and return rows
   */
  async query<T = Record<string, unknown>>(
    query: string,
    params?: Record<string, unknown>,
  ): Promise<T[]> {
    try {
      const result = await this.client.query({
        query,
        query_params: params,
      });
      const data = (await result.json()) as { data: T[] };
      return data.data;
    } catch (error: unknown) {
      const msg = (error as Error)?.message || String(error);
      this.logger.error(`ClickHouse query error: ${msg}`);
      throw error;
    }
  }

  /**
   * Insert data
   */
  async insert(table: string, data: Record<string, unknown>[]) {
    try {
      await this.client.insert({
        table,
        values: data,
        format: "JSONEachRow",
      });
    } catch (error: unknown) {
      const msg = (error as Error)?.message || String(error);
      this.logger.error(`ClickHouse insert error (${table}): ${msg}`);
      throw error;
    }
  }

  /**
   * Execute DDL / mutation SQL (ALTER TABLE, CREATE, DROP, etc.)
   * Uses client.command() which automatically drains the response stream.
   * @param silent — when true, suppresses error logging before re-throwing (for expected/handled failures)
   */
  async exec(
    sql: string,
    params?: Record<string, unknown>,
    retries = 1,
    silent = false,
  ) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await this.client.command({ query: sql, query_params: params });
        return;
      } catch (error: unknown) {
        const e = error as {
          message?: string;
          type?: string;
          code?: string;
          stack?: string;
        };
        const msg = e?.message || e?.type || String(error);
        const isRetriable =
          msg.includes("ECONNRESET") ||
          msg.includes("socket hang up") ||
          e?.code === "ECONNRESET";
        if (isRetriable && attempt < retries) {
          this.logger.warn(`ClickHouse command retrying after: ${msg}`);
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        if (!silent) {
          this.logger.error(`ClickHouse command error: ${msg}`, e?.stack);
        }
        throw error;
      }
    }
  }

  /**
   * Execute ACL DDL (CREATE USER, GRANT, DROP USER, etc.) using the dedicated ACL client.
   */
  async execAcl(sql: string, params?: Record<string, any>): Promise<void> {
    const client = this.aclClient ?? this.client;
    try {
      await client.command({ query: sql, query_params: params });
    } catch (error: any) {
      const msg = error?.message || error?.type || String(error);
      this.logger.error(`ClickHouse ACL command error: ${msg}`);
      throw error;
    }
  }

  /**
   * Query system tables using the dedicated ACL client.
   */
  async queryAcl<T = Record<string, unknown>>(
    query: string,
    params?: Record<string, unknown>,
  ): Promise<T[]> {
    const client = this.aclClient ?? this.client;
    try {
      const result = await client.query({ query, query_params: params });
      const data = (await result.json()) as { data: T[] };
      return data.data;
    } catch (error: unknown) {
      const msg = (error as Error)?.message || String(error);
      this.logger.error(`ClickHouse ACL query error: ${msg}`);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  private async initializeSchema() {
    this.logger.log("Initializing ClickHouse schema...");

    try {
      // Create database if not exists
      await this.exec(`CREATE DATABASE IF NOT EXISTS audit_db`);

      // Create departments table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS departments (
          id String,
          name String,
          description String,
          manager String,
          employeeCount UInt32 DEFAULT 0,
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY id
      `);

      // Create users table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id String,
          userId String,
          password String,
          name String,
          position String,
          profileImage String,
          departmentId String,
          isAdmin UInt8 DEFAULT 0,
          isSuperAdmin UInt8 DEFAULT 0,
          isActive UInt8 DEFAULT 1,
          allowedTools String,
          lastLoginAt Nullable(DateTime),
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY id
      `);

      // Create news table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS news (
          id String,
          title String,
          content String,
          category String DEFAULT 'Аудит',
          imageUrl String,
          imageMime String DEFAULT '',
          authorId String,
          isPublished UInt8 DEFAULT 1,
          views UInt32 DEFAULT 0,
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY createdAt
      `);

      // Create news_reactions table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS news_reactions (
          newsId String,
          userId String,
          emoji String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(createdAt)
        ORDER BY (newsId, userId)
      `);

      // Create news_comments table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS news_comments (
          id String,
          newsId String,
          authorId String,
          authorName String,
          content String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (newsId, createdAt)
      `);

      // Create refresh_tokens table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id String,
          userId String,
          token String,
          expiresAt DateTime,
          isRevoked UInt8 DEFAULT 0,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (userId, createdAt)
      `);

      // Create audit_logs table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id String,
          userId String,
          userEmail String,
          action String,
          resource String,
          resourceId String,
          method String,
          ipAddress String,
          userAgent String,
          status String,
          errorMessage String,
          metadata String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (createdAt, userId)
      `);

      // Create access_requests table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS access_requests (
          id String,
          requesterId String,
          requesterName String,
          requesterUserId String,
          tables Array(String),
          columns Array(String),
          accessTypes Array(String),
          validUntil DateTime,
          reason String DEFAULT '',
          status String DEFAULT 'pending',
          reviewedBy String DEFAULT '',
          reviewedByName String DEFAULT '',
          reviewNote String DEFAULT '',
          requestTime DateTime DEFAULT now(),
          reviewedAt DateTime DEFAULT '1970-01-01 00:00:00',
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY id
      `);

      // Create access_grants table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS access_grants (
          id String,
          userId String,
          userName String,
          userUserId String,
          requestId String,
          tableName String,
          columns Array(String),
          accessTypes Array(String),
          validUntil DateTime,
          grantedBy String,
          grantedByName String,
          grantedAt DateTime DEFAULT now(),
          isActive UInt8 DEFAULT 1,
          revokedAt DateTime DEFAULT '1970-01-01 00:00:00',
          revokeReason String DEFAULT '',
          chPassword String DEFAULT ''
        ) ENGINE = ReplacingMergeTree(grantedAt)
        ORDER BY id
      `);

      // Create tailan_reports table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS tailan_reports (
          id String,
          userId String,
          userName String,
          departmentId String DEFAULT '',
          year UInt16,
          quarter UInt8,
          status String DEFAULT 'draft',
          plannedTasksJson String DEFAULT '[]',
          dynamicSectionsJson String DEFAULT '[]',
          otherWork String DEFAULT '',
          teamActivitiesJson String DEFAULT '[]',
          extraDataJson String DEFAULT '{}',
          submittedAt DateTime DEFAULT '1970-01-01 00:00:00',
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (userId, year, quarter)
      `);

      // Create login_attempts table for brute-force protection
      await this.exec(`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id String,
          lockKey String,
          attemptedAt DateTime DEFAULT now(),
          success UInt8 DEFAULT 0
        ) ENGINE = MergeTree()
        ORDER BY (lockKey, attemptedAt)
        TTL attemptedAt + INTERVAL 1 DAY
      `);

      // Create dept_bsc_reports table (department BSC/ТҮЗ quarterly reports)
      await this.exec(`
        CREATE TABLE IF NOT EXISTS dept_bsc_reports (
          departmentId String,
          year UInt16,
          quarter UInt8,
          sectionsJson String DEFAULT '{}',
          savedByName String DEFAULT '',
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (departmentId, year, quarter)
      `);

      try {
        await this.provisionServiceUsers();
      } catch (provisionErr: any) {
        const msg = provisionErr?.message || String(provisionErr);
        if (
          msg.includes("ACCESS_STORAGE_READONLY") ||
          msg.includes("users_xml") ||
          msg.includes("ACCESS_DENIED") ||
          msg.includes("Not enough privileges") ||
          msg.includes("WITH GRANT OPTION")
        ) {
          this.logger.warn(
            "Skipping user provisioning because current ClickHouse account cannot manage users/grants in this environment.",
          );
        } else {
          throw provisionErr;
        }
      }
      this.logger.log(
        "Schema tables initialized (departments, users, news, news_reactions, news_comments, refresh_tokens, audit_logs, access_requests, access_grants, tailan_reports, dept_bsc_reports, login_attempts)",
      );
    } catch (error: any) {
      this.logger.error(`Schema initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-provision the two service users used by the backend.
   *   audit_app — full read/write on audit_db (future: replace "default" as CLICKHOUSE_USER)
   *   audit_acl — access management + system table reads (used by aclClient)
   *
   * Idempotent: CREATE USER IF NOT EXISTS + ALTER USER IF EXISTS keeps passwords in sync.
   * Skips silently when the corresponding env var is not set.
   */
  private async provisionServiceUsers(): Promise<void> {
    const appPw = process.env.CLICKHOUSE_PASSWORD || "";

    // [C-2] Defence-in-depth: reject passwords containing characters that would
    // break SQL string escaping (control chars, NUL). The escape() below is correct
    // ClickHouse C-style escaping, but a strict format also prevents accidental
    // mis-configuration. Empty password skips provisioning entirely.
    if (!appPw) {
      this.logger.warn(
        "CLICKHOUSE_PASSWORD empty — skipping audit_app/audit_acl provisioning",
      );
      return;
    }
    if (!/^[\x21-\x7E]{8,128}$/.test(appPw)) {
      throw new Error(
        "CLICKHOUSE_PASSWORD must be 8–128 printable ASCII chars (no spaces / control chars)",
      );
    }

    const esc = (pw: string): string =>
      pw.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const p = esc(appPw);

    // Create/sync audit_app user
    await this.exec(
      `CREATE USER IF NOT EXISTS audit_app IDENTIFIED WITH sha256_password BY '${p}'`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `ALTER USER IF EXISTS audit_app IDENTIFIED WITH sha256_password BY '${p}'`,
      undefined,
      1,
      true,
    );

    // audit_db: full read/write + schema rights
    await this.exec(
      `GRANT SELECT, INSERT ON audit_db.* TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT CREATE DATABASE ON *.* TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT CREATE TABLE, DROP TABLE, ALTER ON audit_db.* TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT SELECT ON system.tables TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT SELECT ON system.columns TO audit_app`,
      undefined,
      1,
      true,
    );

    // External DBs: SELECT only — cannot modify data, only read
    for (const db of ["FINACLE", "ERP", "CARDZONE", "EBANK"]) {
      await this.exec(
        `GRANT SELECT ON \`${db}\`.* TO audit_app`,
        undefined,
        1,
        true,
      ).catch(() => {
        // DB may not exist yet on this CH instance — skip silently
      });
    }

    // ACL management: create/revoke user grants (for db-access feature)
    await this.exec(
      `GRANT ACCESS MANAGEMENT ON *.* TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT SELECT ON system.users TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT SELECT ON system.roles TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT SELECT ON system.grants TO audit_app`,
      undefined,
      1,
      true,
    );
    await this.exec(
      `GRANT SELECT ON system.role_grants TO audit_app`,
      undefined,
      1,
      true,
    );

    this.logger.log(
      "Service user audit_app provisioned (audit_db rw + external DBs ro + ACL mgmt)",
    );
  }

  /**
   * Helper: Generate UUID (crypto.randomUUID — collision-safe)
   */
  uuid(): string {
    return randomUUID();
  }
}
