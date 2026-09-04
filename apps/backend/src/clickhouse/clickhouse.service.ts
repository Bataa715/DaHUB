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

function isRetriableChError(error: unknown): boolean {
  const e = error as { message?: string; code?: string; type?: string };
  const msg = `${e?.message || ""} ${e?.code || ""} ${e?.type || ""}`;
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("socket hang up") ||
    msg.includes("EPIPE") ||
    msg.includes("ECONNREFUSED") ||
    e?.code === "ECONNRESET"
  );
}

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private client: ClickHouseClient;
  private aclClient: ClickHouseClient;
  private runtimeOpts: {
    url: string;
    username: string;
    password: string;
    database: string;
  } | null = null;
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
      const clientOpts = {
        url: host,
        username: adminUser,
        password: adminPass,
        request_timeout: 60_000,
        compression: { request: true, response: true },
        keep_alive: { enabled: true, idle_socket_ttl: 2_500 },
      } as const;

      // Connect without a database first — a fresh server has no audit_db yet.
      this.client = createClient(clientOpts);

      const result = await this.client.query({
        query: "SELECT version() as version",
      });
      const data = (await result.json()) as { data: { version: string }[] };
      this.logger.log(`ClickHouse version: ${data.data[0].version}`);

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) {
        throw new Error(`Invalid CLICKHOUSE_DATABASE: ${database}`);
      }
      await this.exec(`CREATE DATABASE IF NOT EXISTS ${database}`);
      await this.client.close();
      this.client = createClient({ ...clientOpts, database });

      // Initialize schema AND provision audit_app / audit_acl (needs admin rights)
      await this.initializeSchema();

      // ── 2. Switch to limited runtime client ────────────────────────────────
      // If CLICKHOUSE_USER is unset or is the admin "default", automatically
      // fall back to "audit_app" which was just provisioned above.
      const envUser = process.env.CLICKHOUSE_USER;
      const runtimeUser =
        !envUser || envUser === "default" ? "audit_app" : envUser;
      if (!envUser || envUser === "default") {
        this.logger.warn(
          `CLICKHOUSE_USER is "${envUser ?? "(unset)"}" — automatically using "audit_app" service account.`,
        );
      }
      const runtimePass = process.env.CLICKHOUSE_PASSWORD || "";
      this.runtimeOpts = {
        url: host,
        username: runtimeUser,
        password: runtimePass,
        database,
      };
      await this.client.close();
      this.client = this.createRuntimeClient();
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

  private createRuntimeClient(): ClickHouseClient {
    if (!this.runtimeOpts) {
      throw new Error("ClickHouse runtime client is not configured");
    }
    return createClient({
      ...this.runtimeOpts,
      request_timeout: 60_000,
      compression: { request: true, response: true },
      keep_alive: { enabled: true, idle_socket_ttl: 2_500 },
    });
  }

  private async recreateRuntimeClient(): Promise<void> {
    if (!this.runtimeOpts) return;
    try {
      await this.client.close();
    } catch {
      // stale socket — ignore
    }
    this.client = this.createRuntimeClient();
    this.aclClient = this.client;
    this.logger.warn("ClickHouse client recreated after dropped connection");
  }

  /**
   * Execute a SELECT query and return rows
   */
  async query<T = Record<string, unknown>>(
    query: string,
    params?: Record<string, unknown>,
    retries = 1,
  ): Promise<T[]> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.client.query({
          query,
          query_params: params,
        });
        const data = (await result.json()) as { data: T[] };
        return data.data;
      } catch (error: unknown) {
        const msg = (error as Error)?.message || String(error);
        if (isRetriableChError(error) && attempt < retries) {
          this.logger.warn(`ClickHouse query retrying after: ${msg}`);
          await this.recreateRuntimeClient();
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        this.logger.error(`ClickHouse query error: ${msg}`);
        throw error;
      }
    }
    return [];
  }

  /**
   * Insert data
   */
  async insert(table: string, data: Record<string, unknown>[], retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await this.client.insert({
          table,
          values: data,
          format: "JSONEachRow",
        });
        return;
      } catch (error: unknown) {
        const msg = (error as Error)?.message || String(error);
        if (isRetriableChError(error) && attempt < retries) {
          this.logger.warn(
            `ClickHouse insert retrying (${table}) after: ${msg}`,
          );
          await this.recreateRuntimeClient();
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        this.logger.error(`ClickHouse insert error (${table}): ${msg}`);
        throw error;
      }
    }
  }

  /**
   * Row replace without ALTER UPDATE (many CH users lack UPDATE privilege).
   * DELETE matching rows (sync), then INSERT new versions.
   * `table` must be a simple identifier — callers pass hardcoded names only.
   */
  async replaceRows(
    table: string,
    deleteWhere: string,
    params: Record<string, unknown>,
    rows: Record<string, unknown>[],
  ) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      throw new Error(`Invalid ClickHouse table name: ${table}`);
    }
    await this.exec(
      `ALTER TABLE ${table} DELETE WHERE ${deleteWhere} SETTINGS mutations_sync = 1`,
      params,
    );
    if (rows.length > 0) {
      await this.insert(table, rows);
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
        if (isRetriableChError(error) && attempt < retries) {
          this.logger.warn(`ClickHouse command retrying after: ${msg}`);
          await this.recreateRuntimeClient();
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
          code String DEFAULT '',
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
          grantableTools String DEFAULT '[]',
          isLocked UInt8 DEFAULT 0,
          failedLoginCount UInt16 DEFAULT 0,
          lastLoginAt Nullable(DateTime),
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY id
      `);

      // Migration: rename legacy news_* tables to medleg_* (one-time).
      // Хуучин өгөгдлийг хадгалж шинэ нэр рүү шилжүүлнэ. Зөвхөн хуучин нэр
      // байгаа бөгөөд шинэ нэр байхгүй үед л RENAME хийнэ.
      const tableExists = async (name: string): Promise<boolean> => {
        const rows = await this.query<{ c: string }>(
          `SELECT count() AS c FROM system.tables
           WHERE database = currentDatabase() AND name = {name:String}`,
          { name },
        );
        return Number(rows?.[0]?.c ?? 0) > 0;
      };
      const medlegRenames: [string, string][] = [
        ["news", "medleg"],
        ["news_reactions", "medleg_reactions"],
        ["news_comments", "medleg_comments"],
        ["news_views", "medleg_views"],
      ];
      for (const [oldName, newName] of medlegRenames) {
        if ((await tableExists(oldName)) && !(await tableExists(newName))) {
          await this.exec(`RENAME TABLE ${oldName} TO ${newName}`);
          this.logger.log(`Migrated table ${oldName} → ${newName}`);
        }
      }

      // Create medleg table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS medleg (
          id String,
          title String,
          content String,
          category String DEFAULT 'Ерөнхий',
          imageUrl String,
          imageMime String DEFAULT '',
          imagesJson String DEFAULT '[]',
          authorId String,
          isPublished UInt8 DEFAULT 1,
          views UInt32 DEFAULT 0,
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY createdAt
      `);

      // Create medleg_reactions table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS medleg_reactions (
          newsId String,
          userId String,
          emoji String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(createdAt)
        ORDER BY (newsId, userId)
      `);

      // Create medleg_comments table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS medleg_comments (
          id String,
          newsId String,
          authorId String,
          authorName String,
          content String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (newsId, createdAt)
      `);

      // Create medleg_views table (per-user view dedup)
      await this.exec(`
        CREATE TABLE IF NOT EXISTS medleg_views (
          newsId String,
          userId String,
          viewedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(viewedAt)
        ORDER BY (newsId, userId)
      `);

      // Create medleg_quizzes table — Мэдлэг мэдээлэл хуудасны QUIZ хэсэг:
      // quiz-ийн ерөнхий мэдээлэл (гарчиг/сэдэв). Асуулт бүр тус тусдаа
      // medleg_quiz_questions хүснэгтэд хадгалагдана (нэг quiz-д олон асуулт
      // байж болно). [MIGRATION] Хуучин "options"/"correctIndex" багана
      // deployed DB-д үлдэж болзошгүй ч кодоор ашиглагдахгүй.
      await this.exec(`
        CREATE TABLE IF NOT EXISTS medleg_quizzes (
          id String,
          title String,
          authorId String,
          isActive UInt8 DEFAULT 1,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY createdAt
      `);

      // Create medleg_quiz_questions table — нэг quiz дотор дараалалтай
      // (seq) олон асуулт байж болно. options нь JSON массив string.
      await this.exec(`
        CREATE TABLE IF NOT EXISTS medleg_quiz_questions (
          id String,
          quizId String,
          seq UInt16,
          question String,
          options String,
          correctIndex UInt8,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (quizId, seq)
      `);

      // Create medleg_quiz_answers table — хэрэглэгч тус бүр quiz-д (бүх
      // асуултаараа) нэг л удаа бүхэлд нь хариулна (app-level шалгалт).
      // correctCount/totalQuestions = тухайн оролдлогын нийт оноо,
      // answersJson = асуулт тус бүрийн сонголт (дэлгэрэнгүй харах/шалгахад).
      // timeTakenMs = quiz эхлүүлснээс дуусгах хүртэлх хугацаа (клиент тал
      // хэмждэг, сая секундийн нарийвчлал шаардлагагүй тул хангалттай).
      await this.exec(`
        CREATE TABLE IF NOT EXISTS medleg_quiz_answers (
          id String,
          quizId String,
          userId String,
          userName String,
          correctCount UInt16,
          totalQuestions UInt16,
          timeTakenMs UInt32,
          answersJson String DEFAULT '[]',
          answeredAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (quizId, userId)
      `);

      // Create registration_requests table — public self-registration now only
      // files a request; an admin must approve it before the real `users` row
      // (and claim token) is created. See AuthService.registerUser/reviewRegistration.
      await this.exec(`
        CREATE TABLE IF NOT EXISTS registration_requests (
          id String,
          userId String,
          name String,
          department String,
          departmentId String,
          position String,
          status String DEFAULT 'pending',
          claimToken String DEFAULT '',
          reviewedBy String DEFAULT '',
          reviewedByName String DEFAULT '',
          reviewNote String DEFAULT '',
          requestedAt DateTime DEFAULT now(),
          reviewedAt DateTime DEFAULT '1970-01-01 00:00:00',
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY id
      `);

      // Create refresh_tokens table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          userId String,
          token String,
          expiresAt DateTime,
          isRevoked UInt8 DEFAULT 0,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (userId, createdAt)
        TTL expiresAt + INTERVAL 1 DAY
      `);

      // Create audit_logs table
      await this.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id String,
          userId String,
          action String,
          resource String,
          resourceId String,
          method String,
          status String,
          errorMessage String,
          metadata String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (createdAt, userId)
        TTL createdAt + INTERVAL 2 YEAR
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
          lockKey String,
          attemptedAt DateTime DEFAULT now(),
          success UInt8 DEFAULT 0
        ) ENGINE = MergeTree()
        ORDER BY (lockKey, attemptedAt)
        TTL attemptedAt + INTERVAL 1 DAY
      `);

      // Create avlaga_verifications table — Зардлын хяналт: аудиторын тайлбар,
      // төрөл (expense_verification_types-ээс), гэрээний нийт дүн, статус —
      // avlaga.book_number-ээр (1 гүйлгээ = 1 мөр). Мөр байгаа эсэх өөрөө
      // "баталгаажсан" төлөвийг илэрхийлнэ (тусгай boolean багана хэрэггүй).
      await this.exec(`
        CREATE TABLE IF NOT EXISTS avlaga_verifications (
          bookNumber String,
          comment String DEFAULT '',
          verificationType String DEFAULT '',
          contractTotalAmount Float64 DEFAULT 0,
          status String DEFAULT '',
          updatedBy String DEFAULT '',
          updatedByName String DEFAULT '',
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY bookNumber
      `);

      // Зардлын хяналтын эх хүснэгтүүд — өөр компьютер дээр эхний асаалтад
      // байхгүй бол хоосон үүсгэнэ. Прод дээр өгөгдөлтэй хүснэгт байвал
      // IF NOT EXISTS юу ч өөрчлөхгүй.
      await this.exec(`
        CREATE TABLE IF NOT EXISTS avlaga (
          load_date DateTime DEFAULT now(),
          book_date Date,
          customer_code String,
          customer_name String DEFAULT '',
          account_name String DEFAULT '',
          account_code String DEFAULT '',
          currency_code String DEFAULT '',
          debit_amount Float64 DEFAULT 0,
          description String DEFAULT '',
          book_number String DEFAULT '',
          department_code String DEFAULT '',
          department_name String DEFAULT '',
          CO_A_GROUP_CODE String DEFAULT '',
          CO_A_GROUP_NAME String DEFAULT '',
          RECIEVABLE_TYPE_CODE String DEFAULT '',
          RECIEVABLE_TYPE_NAME String DEFAULT ''
        ) ENGINE = MergeTree()
        ORDER BY (book_date, customer_code, book_number)
      `);

      await this.exec(`
        CREATE TABLE IF NOT EXISTS tulbur (
          load_date DateTime DEFAULT now(),
          invoice_id String,
          description String DEFAULT '',
          request_date Date DEFAULT toDate(0),
          employee_name String DEFAULT '',
          sol_id String DEFAULT '',
          employee_code String DEFAULT '',
          department_name String DEFAULT '',
          book_number String DEFAULT '',
          request_amount Float64 DEFAULT 0,
          book_date Date,
          account_number String DEFAULT '',
          bank_name String DEFAULT '',
          customer_code String DEFAULT '',
          customer_name String DEFAULT '',
          currency_code String DEFAULT '',
          gl_number String DEFAULT '',
          tender_method_name String DEFAULT '',
          info_name String DEFAULT '',
          purpose String DEFAULT ''
        ) ENGINE = MergeTree()
        ORDER BY (book_date, customer_code, invoice_id)
      `);

      await this.exec(`
        CREATE TABLE IF NOT EXISTS budget (
          load_date DateTime DEFAULT now(),
          book_date Date,
          book_number String DEFAULT '',
          employee_name String DEFAULT '',
          sol_id String DEFAULT '',
          employee_code String DEFAULT '',
          department_name String DEFAULT '',
          request_amount Float64 DEFAULT 0,
          description String DEFAULT '',
          total_amount Float64 DEFAULT 0,
          to_activity_name String DEFAULT '',
          from_activity_name String DEFAULT '',
          from_activity_dtl_name String DEFAULT '',
          to_activity_dtl_name String DEFAULT '',
          amount Float64 DEFAULT 0,
          related_book_number String,
          from_employee_name String DEFAULT '',
          purpose String DEFAULT ''
        ) ENGINE = MergeTree()
        ORDER BY (related_book_number, book_date)
      `);

      await this.exec(`
        CREATE TABLE IF NOT EXISTS havsralt (
          invoice_id String,
          book_number String DEFAULT '',
          customer_code String DEFAULT '',
          customer_name String DEFAULT '',
          content_id String DEFAULT '',
          file_name String DEFAULT '',
          file_extension String DEFAULT '',
          physical_path String DEFAULT '',
          full_url String DEFAULT ''
        ) ENGINE = MergeTree()
        ORDER BY (invoice_id, file_name)
      `);

      // Create expense_verification_types table — Зардлын хяналтын
      // Баталгаажуулалт дэлгэц дэх "Төрөл" сонголтын жагсаалт, зөвхөн admin
      // тохируулна (see MonitoringService.listVerificationTypes etc.).
      await this.exec(`
        CREATE TABLE IF NOT EXISTS expense_verification_types (
          id String,
          name String,
          isActive UInt8 DEFAULT 1,
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY id
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

      // Homepage ethics carousel (Аудиторын ёс зүйн код)
      await this.exec(`
        CREATE TABLE IF NOT EXISTS homepage_ethics_slides (
          id          String,
          title       String,
          body        String,
          sort_order  UInt32,
          is_active   UInt8,
          updated_by  String,
          seq         UInt64,
          updated_at  DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(seq)
        ORDER BY id
        SETTINGS index_granularity = 8192
      `);

      // Migration: add `code` column to departments (хэрэглэгчийн ID-н prefix).
      // ALTER ... ADD COLUMN IF NOT EXISTS нь хуучин table-д шинэ багана нэмнэ.
      await this.exec(
        `ALTER TABLE departments ADD COLUMN IF NOT EXISTS code String DEFAULT ''`,
      );

      // ── 2026-07 cleanup/optimization migrations (idempotent) ────────────────
      // 1) users.grantableTools — кодонд ашиглагддаг ч хуучин schema-д байгаагүй
      await this.exec(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS grantableTools String DEFAULT '[]'`,
      ).catch(() => {});

      // 1c) users.isLocked / failedLoginCount — persistent brute-force lockout
      // (5 wrong passwords → locked until an admin unlocks; separate from the
      // existing 15-min auto-expiring IP-scoped lockout in auth.service.ts).
      await this.exec(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS isLocked UInt8 DEFAULT 0`,
      ).catch(() => {});
      await this.exec(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS failedLoginCount UInt16 DEFAULT 0`,
      ).catch(() => {});
      // 1d) users.lockedAt — [AUDIT] түгжээ хугацаатай болсон (30 мин дараа
      // автоматаар тайлагдана); хэзээ түгжигдсэнийг хадгална.
      await this.exec(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS lockedAt DateTime DEFAULT toDateTime(0)`,
      ).catch(() => {});

      // 1b) tailan_reports.sectionsDataJson — template-driven generic section
      // storage (Tailan dynamic template refactor). Old per-field JSON columns
      // above are kept read-only for backward compat with pre-refactor rows.
      await this.exec(
        `ALTER TABLE tailan_reports ADD COLUMN IF NOT EXISTS sectionsDataJson String DEFAULT ''`,
      ).catch(() => {});

      // 1e) medleg_quiz_answers — quiz-ийг нэг асуулттай → олон асуулттай
      // болгож өөрчилсний дараа шинээр хэрэгтэй багана (хуучин
      // selectedIndex/isCorrect багана deployed DB-д үлдэж болзошгүй ч
      // кодоор ашиглагдахгүй).
      await this.exec(
        `ALTER TABLE medleg_quiz_answers ADD COLUMN IF NOT EXISTS correctCount UInt16 DEFAULT 0`,
      ).catch(() => {});
      await this.exec(
        `ALTER TABLE medleg_quiz_answers ADD COLUMN IF NOT EXISTS totalQuestions UInt16 DEFAULT 0`,
      ).catch(() => {});
      await this.exec(
        `ALTER TABLE medleg_quiz_answers ADD COLUMN IF NOT EXISTS answersJson String DEFAULT '[]'`,
      ).catch(() => {});
      await this.exec(
        `ALTER TABLE medleg ADD COLUMN IF NOT EXISTS imagesJson String DEFAULT '[]'`,
      ).catch(() => {});

      // [SAFETY] DROP TABLE/DROP COLUMN migration-уудыг эндээс хассан — app boot
      // (onModuleInit) local/prod ижил DB руу холбогдоход эргэлт буцалтгүй
      // өгөгдөл устгах эрсдэлтэй байсан тул.

      // 3) TTL — лог хүснэгтүүд автоматаар цэвэрлэгдэнэ
      await this.exec(
        `ALTER TABLE audit_logs MODIFY TTL createdAt + INTERVAL 2 YEAR`,
        undefined,
        1,
        true,
      ).catch(() => {});
      await this.exec(
        `ALTER TABLE refresh_tokens MODIFY TTL expiresAt + INTERVAL 1 DAY`,
        undefined,
        1,
        true,
      ).catch(() => {});
      await this.exec(
        `ALTER TABLE python_api_run_logs MODIFY TTL ranAt + INTERVAL 2 YEAR`,
        undefined,
        1,
        true,
      ).catch(() => {});

      // 4) Том blob баганууд — ZSTD codec (шинэ бичигдэх part-ууд шахагдана)
      const codecColumns: [string, string, string][] = [
        ["users", "profileImage", "String"],
        ["medleg", "imageUrl", "String"],
        ["medleg", "imagesJson", "String DEFAULT '[]'"],
        ["medleg", "content", "String"],
        ["tailan_images", "imageData", "String DEFAULT ''"],
        ["tailan_reports", "plannedTasksJson", "String DEFAULT '[]'"],
        ["tailan_reports", "dynamicSectionsJson", "String DEFAULT '[]'"],
        ["tailan_reports", "extraDataJson", "String DEFAULT '{}'"],
        ["risk_assessment_history", "rowsJson", "String DEFAULT '[]'"],
      ];
      for (const [table, column, type] of codecColumns) {
        await this.exec(
          `ALTER TABLE ${table} MODIFY COLUMN ${column} ${type} CODEC(ZSTD(3))`,
          undefined,
          1,
          true,
        ).catch(() => {});
      }

      // 5) [PERF] Point-lookup query-д зориулсан нэмэлт PROJECTION-ууд (үндсэн
      // ORDER BY хэвээрээ). [SAFETY] ReplacingMergeTree+FINAL table-д (access_
      // requests/grants, tailan_reports) зориудаар алгассан — PROJECTION+FINAL
      // хослол зарим ClickHouse хувилбарт эрсдэлтэй. Бүгд idempotent, алдаа
      // гарвал (хуучин хувилбар projection дэмжихгүй гэх мэт) чимээгүй өнгөрнө.
      const projections: [string, string, string][] = [
        ["medleg", "proj_by_id", "SELECT * ORDER BY id"],
        ["medleg_quizzes", "proj_by_id", "SELECT * ORDER BY id"],
        ["audit_logs", "proj_by_user", "SELECT * ORDER BY userId, createdAt"],
      ];
      for (const [table, name, selectClause] of projections) {
        await this.exec(
          `ALTER TABLE ${table} ADD PROJECTION IF NOT EXISTS ${name} (${selectClause})`,
          undefined,
          1,
          true,
        ).catch(() => {});
        // No mutations_sync — runs async so it can't block startup on a large table.
        await this.exec(
          `ALTER TABLE ${table} MATERIALIZE PROJECTION ${name}`,
          undefined,
          1,
          true,
        ).catch(() => {});
      }

      // Хуучин мэдэгдэж буй хэлтсүүдийн кодыг нэг удаа seed хийнэ (code хоосон бол).
      // ALTER UPDATE биш — DELETE + INSERT (audit_app UPDATE эрхгүй байж болно).
      const DEFAULT_DEPT_CODES: Record<string, string> = {
        Удирдлага: "DAG",
        "Дата анализын алба": "DAA",
        "Бизнесийн аудитын хэлтэс": "BAH",
        "Эрсдэл, комплаенс, санхүүгийн аудитын хэлтэс": "EKSAH",
        "Мэдээллийн технологийн аудитын хэлтэс": "MTAH",
        "Чанарын баталгаажуулалтын алба": "CHBA",
      };
      for (const [deptName, deptCode] of Object.entries(DEFAULT_DEPT_CODES)) {
        const rows = await this.query<Record<string, unknown>>(
          `SELECT * FROM departments WHERE name = {name:String} AND code = '' LIMIT 1`,
          { name: deptName },
        );
        if (rows.length === 0) continue;
        const row = rows[0];
        await this.replaceRows(
          "departments",
          "id = {id:String}",
          { id: row.id },
          [{ ...row, code: deptCode }],
        ).catch((e) =>
          this.logger.warn(
            `Dept code seed skipped for ${deptName}: ${e instanceof Error ? e.message : e}`,
          ),
        );
      }

      // Админ хэрэглэгчийг хэлтэсээс салгана — веб дээр (ажилтнууд г.м.) харагдахгүй
      const adminWithDept = await this.query<Record<string, unknown>>(
        `SELECT * FROM users
         WHERE (isAdmin = 1 OR isSuperAdmin = 1) AND departmentId != ''`,
      );
      for (const u of adminWithDept) {
        await this.replaceRows(
          "users",
          "id = {id:String}",
          { id: u.id },
          [{ ...u, departmentId: "", updatedAt: nowCH() }],
        ).catch((e) =>
          this.logger.warn(
            `Admin dept clear skipped: ${e instanceof Error ? e.message : e}`,
          ),
        );
      }

      // Нууц үг тохируулсан боловч isActive=0 хэвээр үлдсэн хуучин бүртгэлүүдийг идэвхжүүлнэ.
      const inactiveReady = await this.query<Record<string, unknown>>(
        `SELECT * FROM users
         WHERE isActive = 0
           AND isAdmin = 0
           AND isSuperAdmin = 0
           AND password != ''
           AND password NOT LIKE 'PENDING:%'`,
      );
      for (const u of inactiveReady) {
        await this.replaceRows(
          "users",
          "id = {id:String}",
          { id: u.id },
          [{ ...u, isActive: 1, updatedAt: nowCH() }],
        ).catch((e) =>
          this.logger.warn(
            `Activate user skipped: ${e instanceof Error ? e.message : e}`,
          ),
        );
      }

      // Service user provisioning зөвхөн bootstrap/admin эрхтэй үед.
      // CLICKHOUSE_USER=audit_app үед CREATE USER оролдвол ACCESS_STORAGE_READONLY
      // ERROR (@clickhouse/client) шууд console-д асгарна — алгасна.
      const bootstrapUser =
        process.env.CLICKHOUSE_BOOTSTRAP_USER ||
        process.env.CLICKHOUSE_USER ||
        "default";
      const canProvisionUsers =
        Boolean(process.env.CLICKHOUSE_BOOTSTRAP_USER) ||
        bootstrapUser === "default";

      if (canProvisionUsers) {
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
      }

      this.logger.log(
        "Schema tables initialized (departments, users, medleg, medleg_reactions, medleg_comments, refresh_tokens, audit_logs, access_requests, access_grants, tailan_reports, dept_bsc_reports, login_attempts, avlaga, tulbur, budget, havsralt, avlaga_verifications, expense_verification_types)",
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
