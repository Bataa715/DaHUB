import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { createClient, ClickHouseClient } from "@clickhouse/client";

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private client: ClickHouseClient;
  private readonly logger = new Logger(ClickHouseService.name);

  async onModuleInit() {
    if (!process.env.CLICKHOUSE_HOST) {
      throw new Error("CLICKHOUSE_HOST environment variable is required");
    }
    const host = process.env.CLICKHOUSE_HOST;
    const username = process.env.CLICKHOUSE_USER || "default";
    const password = process.env.CLICKHOUSE_PASSWORD || "";
    const database = process.env.CLICKHOUSE_DATABASE || "audit_db";

    this.logger.log(`Connecting to ClickHouse at ${host}...`);

    try {
      this.client = createClient({
        url: host,
        username: username,
        password: password,
        database: database,
        request_timeout: 30000,
        compression: {
          request: true,
          response: true,
        },
      });

      // Test connection
      const result = await this.client.query({
        query: "SELECT version() as version",
      });
      const data: any = await result.json();
      this.logger.log(
        `Connected to ClickHouse version: ${data.data[0].version}`,
      );

      // Initialize database schema
      await this.initializeSchema();
    } catch (error) {
      this.logger.error("Failed to connect to ClickHouse:", error.message);
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
   * Get ClickHouse client instance
   */
  getClient(): ClickHouseClient {
    return this.client;
  }

  /**
   * Execute a SELECT query and return rows
   */
  async query<T = any>(
    query: string,
    params?: Record<string, any>,
  ): Promise<T[]> {
    try {
      const result = await this.client.query({
        query,
        query_params: params,
      });
      const data: any = await result.json();
      return data.data as T[];
    } catch (error: any) {
      this.logger.error(`ClickHouse query error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Insert data
   */
  async insert(table: string, data: any[]) {
    try {
      await this.client.insert({
        table,
        values: data,
        format: "JSONEachRow",
      });
    } catch (error: any) {
      this.logger.error(`ClickHouse insert error (${table}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a DDL / mutating statement (ALTER TABLE, CREATE TABLE, etc.)
   * Supports optional query_params for parameterized mutations.
   */
  async exec(sql: string, params?: Record<string, any>) {
    try {
      await this.client.exec({ query: sql, query_params: params });
    } catch (error: any) {
      this.logger.error(`ClickHouse exec error: ${error.message}`);
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
          email String,
          password String,
          name String,
          position String,
          profileImage String,
          departmentId String,
          isAdmin UInt8 DEFAULT 0,
          isActive UInt8 DEFAULT 1,
          allowedTools String,
          lastLoginAt Nullable(DateTime),
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY id
      `);

      // Create exercises table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS exercises (
          id String,
          name String,
          category String,
          description String,
          userId String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (userId, id)
      `);

      // Create workout_logs table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS workout_logs (
          id String,
          exerciseId String,
          userId String,
          sets UInt16,
          repetitions UInt16,
          weight Float32,
          notes String,
          date DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (userId, date)
      `);

      // Create body_stats table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS body_stats (
          id String,
          userId String,
          weight Float32,
          height Float32,
          date DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (userId, date)
      `);

      // Create news table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS news (
          id String,
          title String,
          content String,
          category String DEFAULT 'Ерөнхий',
          imageUrl String,
          authorId String,
          isPublished UInt8 DEFAULT 1,
          views UInt32 DEFAULT 0,
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY createdAt
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
          revokeReason String DEFAULT ''
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
          submittedAt DateTime DEFAULT '1970-01-01 00:00:00',
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (userId, year, quarter)
      `);

      // Create chess_invitations table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS chess_invitations (
          id String,
          fromUserId String,
          fromUserName String,
          toUserId String,
          toUserName String,
          status String DEFAULT 'pending',
          seq UInt64,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);

      // Create chess_games table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS chess_games (
          id String,
          whiteUserId String,
          whiteUserName String,
          blackUserId String,
          blackUserName String,
          moves String DEFAULT '[]',
          status String DEFAULT 'active',
          resultReason String DEFAULT '',
          whiteTimeMs UInt32 DEFAULT 600000,
          blackTimeMs UInt32 DEFAULT 600000,
          lastMoveAt String DEFAULT '',
          seq UInt64,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
      // Migrate existing chess_games tables (add timer columns if missing)
      await this.exec(`ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS whiteTimeMs UInt32 DEFAULT 600000`).catch(() => {});
      await this.exec(`ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS blackTimeMs UInt32 DEFAULT 600000`).catch(() => {});
      await this.exec(`ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS lastMoveAt String DEFAULT ''`).catch(() => {});

      // Create department_photos table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS department_photos (
          id String,
          departmentId String,
          departmentName String,
          uploadedBy String,
          uploadedByName String,
          imageData String,
          caption String DEFAULT '',
          uploadedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (departmentId, uploadedAt)
      `);

      this.logger.log(
        "Schema tables initialized (departments, users, exercises, workout_logs, body_stats, news, refresh_tokens, audit_logs, access_requests, access_grants, tailan_reports, chess_invitations, chess_games, department_photos)",
      );
    } catch (error: any) {
      this.logger.error(`Schema initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Generate UUID (ClickHouse compatible)
   */
  uuid(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
