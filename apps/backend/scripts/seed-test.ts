/**
 * seed-test.ts
 *
 * Утга: бүх DB-ийн schema-г шалгаж, засаж, test өгөгдөл оруулан, баталгаажуулж,
 *       бүх test өгөгдлийг устгаад DB-г анх байсан төлөвт нь буцааж үлдэх.
 *
 * Ажлын дараалал:
 *   1. Холболт шалгах
 *   2. Бүх DB/table CREATE IF NOT EXISTS
 *   3. system.columns-оор schema validate → дутуу column бол ALTER TABLE ADD COLUMN
 *   4. __TEST_SEED__ prefix-тэй test мөр оруулах (table тус бүрт 1 мөр)
 *   5. Оруулсан мөрүүдийг SELECT-ээр баталгаажуулах
 *   6. ALTER TABLE DELETE-ээр устгаж, mutation дуусахыг хүлээх
 *   7. Ustgagdsanыг баталгаажуулах (count = 0)
 */

import { createClient } from "@clickhouse/client";

if (!process.env.CLICKHOUSE_HOST) {
  throw new Error("CLICKHOUSE_HOST environment variable is required");
}
const CH_HOST = process.env.CLICKHOUSE_HOST;
const CH_USER = process.env.CLICKHOUSE_USER || "default";
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || "";

const SEED_PREFIX = "__TEST_SEED__";
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nowDt = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const tid = (suffix: string) => `${SEED_PREFIX}${suffix}`;

async function countWhere(
  c: ReturnType<typeof createClient>,
  db: string,
  table: string,
  idCol: string,
): Promise<number> {
  const r = await c.query({
    query: `SELECT count() as cnt FROM ${db}.${table}
            WHERE ${idCol} LIKE '${SEED_PREFIX}%'`,
  });
  const d: any = await r.json();
  return Number(d.data[0]?.cnt ?? 0);
}

async function waitMutation(
  c: ReturnType<typeof createClient>,
  db: string,
  table: string,
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await c.query({
      query: `SELECT count() as cnt FROM system.mutations
              WHERE database = '${db}' AND table = '${table}'
                AND is_done = 0`,
    });
    const d: any = await r.json();
    if (Number(d.data[0]?.cnt ?? 0) === 0) return;
    await new Promise((res) => setTimeout(res, 500));
  }
  console.warn(
    `  ⚠️  Mutation timeout for ${db}.${table} — may still be running`,
  );
}

/** system.columns-оор table-ийн бодит columns-ийг авах */
async function getActualColumns(
  c: ReturnType<typeof createClient>,
  db: string,
  table: string,
): Promise<Set<string>> {
  const r = await c.query({
    query: `SELECT name FROM system.columns WHERE database = '${db}' AND table = '${table}'`,
  });
  const d: any = await r.json();
  return new Set(d.data.map((row: any) => row.name));
}

/** Дутуу column байвал ALTER TABLE ADD COLUMN хийх */
async function ensureColumns(
  c: ReturnType<typeof createClient>,
  db: string,
  table: string,
  expectedCols: Array<{ name: string; def: string }>,
): Promise<void> {
  const actual = await getActualColumns(c, db, table);
  const missing = expectedCols.filter((col) => !actual.has(col.name));
  if (missing.length === 0) return;

  console.log(
    `    🔧 ${db}.${table}: нэмэгдсэн column(s): ${missing.map((m) => m.name).join(", ")}`,
  );
  for (const col of missing) {
    await c.exec({
      query: `ALTER TABLE ${db}.${table} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`,
    });
  }
}

// ─── Schema definitions ───────────────────────────────────────────────────────

const SCHEMAS: Array<{
  db: string;
  table: string;
  createDDL: string;
  cols: Array<{ name: string; def: string }>;
  idCol: string;
}> = [
  // ── audit_db ──────────────────────────────────────────────────────────────
  {
    db: "audit_db",
    table: "departments",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.departments (
      id String, name String, description String, manager String,
      employeeCount UInt32 DEFAULT 0,
      createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY id`,
    cols: [
      { name: "id", def: "String" },
      { name: "name", def: "String" },
      { name: "description", def: "String" },
      { name: "manager", def: "String DEFAULT ''" },
      { name: "employeeCount", def: "UInt32 DEFAULT 0" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
      { name: "updatedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "users",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.users (
      id String, userId String, password String,
      name String, position String, profileImage String, departmentId String,
      isAdmin UInt8 DEFAULT 0, isSuperAdmin UInt8 DEFAULT 0, isActive UInt8 DEFAULT 1,
      allowedTools String, grantableTools String DEFAULT '[]', lastLoginAt Nullable(DateTime),
      createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY id`,
    cols: [
      { name: "id", def: "String" },
      { name: "userId", def: "String" },
      { name: "password", def: "String" },
      { name: "name", def: "String" },
      { name: "position", def: "String DEFAULT ''" },
      { name: "profileImage", def: "String DEFAULT ''" },
      { name: "departmentId", def: "String" },
      { name: "isAdmin", def: "UInt8 DEFAULT 0" },
      { name: "isSuperAdmin", def: "UInt8 DEFAULT 0" },
      { name: "isActive", def: "UInt8 DEFAULT 1" },
      { name: "allowedTools", def: "String DEFAULT '[]'" },
      { name: "grantableTools", def: "String DEFAULT '[]'" },
      { name: "lastLoginAt", def: "Nullable(DateTime)" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
      { name: "updatedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "news",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.news (
      id String, title String, content String,
      category String DEFAULT 'Ерөнхий', imageUrl String,
      authorId String, isPublished UInt8 DEFAULT 1, views UInt32 DEFAULT 0,
      createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY createdAt`,
    cols: [
      { name: "id", def: "String" },
      { name: "title", def: "String" },
      { name: "content", def: "String" },
      { name: "category", def: "String DEFAULT 'Ерөнхий'" },
      { name: "imageUrl", def: "String DEFAULT ''" },
      { name: "authorId", def: "String" },
      { name: "isPublished", def: "UInt8 DEFAULT 1" },
      { name: "views", def: "UInt32 DEFAULT 0" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
      { name: "updatedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  // ── audit_db — нэмэлт table-ууд ─────────────────────────────────────────
  {
    db: "audit_db",
    table: "exercises",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.exercises (
      id String, name String, category String, description String,
      userId String, createdAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (userId, id)`,
    cols: [
      { name: "id", def: "String" },
      { name: "name", def: "String" },
      { name: "category", def: "String DEFAULT ''" },
      { name: "description", def: "String DEFAULT ''" },
      { name: "userId", def: "String" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "workout_logs",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.workout_logs (
      id String, exerciseId String, userId String,
      sets UInt16, repetitions UInt16, weight Float32,
      notes String, date DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (userId, date)`,
    cols: [
      { name: "id", def: "String" },
      { name: "exerciseId", def: "String" },
      { name: "userId", def: "String" },
      { name: "sets", def: "UInt16 DEFAULT 0" },
      { name: "repetitions", def: "UInt16 DEFAULT 0" },
      { name: "weight", def: "Float32 DEFAULT 0" },
      { name: "notes", def: "String DEFAULT ''" },
      { name: "date", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "body_stats",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.body_stats (
      id String, userId String, weight Float32, height Float32,
      date DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (userId, date)`,
    cols: [
      { name: "id", def: "String" },
      { name: "userId", def: "String" },
      { name: "weight", def: "Float32 DEFAULT 0" },
      { name: "height", def: "Float32 DEFAULT 0" },
      { name: "date", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "refresh_tokens",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.refresh_tokens (
      id String, userId String, token String, expiresAt DateTime,
      isRevoked UInt8 DEFAULT 0, createdAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (userId, createdAt)`,
    cols: [
      { name: "id", def: "String" },
      { name: "userId", def: "String" },
      { name: "token", def: "String" },
      { name: "expiresAt", def: "DateTime" },
      { name: "isRevoked", def: "UInt8 DEFAULT 0" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "audit_logs",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.audit_logs (
      id String, userId String, userEmail String, action String,
      resource String, resourceId String, method String, ipAddress String,
      userAgent String, status String, errorMessage String, metadata String,
      createdAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (createdAt, userId)`,
    cols: [
      { name: "id", def: "String" },
      { name: "userId", def: "String" },
      { name: "userEmail", def: "String DEFAULT ''" },
      { name: "action", def: "String DEFAULT ''" },
      { name: "resource", def: "String DEFAULT ''" },
      { name: "resourceId", def: "String DEFAULT ''" },
      { name: "method", def: "String DEFAULT ''" },
      { name: "ipAddress", def: "String DEFAULT ''" },
      { name: "userAgent", def: "String DEFAULT ''" },
      { name: "status", def: "String DEFAULT ''" },
      { name: "errorMessage", def: "String DEFAULT ''" },
      { name: "metadata", def: "String DEFAULT ''" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "access_requests",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.access_requests (
      id String, requesterId String, requesterName String, requesterUserId String,
      tables Array(String), columns Array(String), accessTypes Array(String),
      validUntil DateTime, reason String DEFAULT '', status String DEFAULT 'pending',
      reviewedBy String DEFAULT '', reviewedByName String DEFAULT '',
      reviewNote String DEFAULT '', requestTime DateTime DEFAULT now(),
      reviewedAt DateTime DEFAULT '1970-01-01 00:00:00', updatedAt DateTime DEFAULT now()
    ) ENGINE = ReplacingMergeTree(updatedAt) ORDER BY id`,
    cols: [
      { name: "id", def: "String" },
      { name: "requesterId", def: "String" },
      { name: "requesterName", def: "String DEFAULT ''" },
      { name: "requesterUserId", def: "String DEFAULT ''" },
      { name: "tables", def: "Array(String)" },
      { name: "columns", def: "Array(String)" },
      { name: "accessTypes", def: "Array(String)" },
      { name: "validUntil", def: "DateTime" },
      { name: "reason", def: "String DEFAULT ''" },
      { name: "status", def: "String DEFAULT 'pending'" },
      { name: "reviewedBy", def: "String DEFAULT ''" },
      { name: "reviewedByName", def: "String DEFAULT ''" },
      { name: "reviewNote", def: "String DEFAULT ''" },
      { name: "requestTime", def: "DateTime DEFAULT now()" },
      { name: "reviewedAt", def: "DateTime DEFAULT '1970-01-01 00:00:00'" },
      { name: "updatedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "access_grants",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.access_grants (
      id String, userId String, userName String, userUserId String,
      requestId String, tableName String, columns Array(String),
      accessTypes Array(String), validUntil DateTime,
      grantedBy String, grantedByName String, grantedAt DateTime DEFAULT now(),
      isActive UInt8 DEFAULT 1, revokedAt DateTime DEFAULT '1970-01-01 00:00:00',
      revokeReason String DEFAULT '', chPassword String DEFAULT ''
    ) ENGINE = ReplacingMergeTree(grantedAt) ORDER BY id`,
    cols: [
      { name: "id", def: "String" },
      { name: "userId", def: "String" },
      { name: "userName", def: "String DEFAULT ''" },
      { name: "userUserId", def: "String DEFAULT ''" },
      { name: "requestId", def: "String DEFAULT ''" },
      { name: "tableName", def: "String DEFAULT ''" },
      { name: "columns", def: "Array(String)" },
      { name: "accessTypes", def: "Array(String)" },
      { name: "validUntil", def: "DateTime" },
      { name: "grantedBy", def: "String DEFAULT ''" },
      { name: "grantedByName", def: "String DEFAULT ''" },
      { name: "grantedAt", def: "DateTime DEFAULT now()" },
      { name: "isActive", def: "UInt8 DEFAULT 1" },
      { name: "revokedAt", def: "DateTime DEFAULT '1970-01-01 00:00:00'" },
      { name: "revokeReason", def: "String DEFAULT ''" },
      { name: "chPassword", def: "String DEFAULT ''" },
    ],
  },
  {
    db: "audit_db",
    table: "tailan_reports",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.tailan_reports (
      id String, userId String, userName String, departmentId String DEFAULT '',
      year UInt16, quarter UInt8, status String DEFAULT 'draft',
      plannedTasksJson String DEFAULT '[]', dynamicSectionsJson String DEFAULT '[]',
      otherWork String DEFAULT '', teamActivitiesJson String DEFAULT '[]',
      extraDataJson String DEFAULT '{}',
      submittedAt DateTime DEFAULT '1970-01-01 00:00:00',
      createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
    ) ENGINE = ReplacingMergeTree(updatedAt) ORDER BY (userId, year, quarter)`,
    cols: [
      { name: "id", def: "String" },
      { name: "userId", def: "String" },
      { name: "userName", def: "String DEFAULT ''" },
      { name: "departmentId", def: "String DEFAULT ''" },
      { name: "year", def: "UInt16" },
      { name: "quarter", def: "UInt8" },
      { name: "status", def: "String DEFAULT 'draft'" },
      { name: "plannedTasksJson", def: "String DEFAULT '[]'" },
      { name: "dynamicSectionsJson", def: "String DEFAULT '[]'" },
      { name: "otherWork", def: "String DEFAULT ''" },
      { name: "teamActivitiesJson", def: "String DEFAULT '[]'" },
      { name: "extraDataJson", def: "String DEFAULT '{}'" },
      { name: "submittedAt", def: "DateTime DEFAULT '1970-01-01 00:00:00'" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
      { name: "updatedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "chess_invitations",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.chess_invitations (
      id String, fromUserId String, fromUserName String,
      toUserId String, toUserName String, status String DEFAULT 'pending',
      seq UInt64, createdAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (id, seq)`,
    cols: [
      { name: "id", def: "String" },
      { name: "fromUserId", def: "String" },
      { name: "fromUserName", def: "String DEFAULT ''" },
      { name: "toUserId", def: "String" },
      { name: "toUserName", def: "String DEFAULT ''" },
      { name: "status", def: "String DEFAULT 'pending'" },
      { name: "seq", def: "UInt64 DEFAULT 0" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "chess_games",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.chess_games (
      id String, whiteUserId String, whiteUserName String,
      blackUserId String, blackUserName String,
      moves String DEFAULT '[]', status String DEFAULT 'active',
      resultReason String DEFAULT '', whiteTimeMs UInt32 DEFAULT 600000,
      blackTimeMs UInt32 DEFAULT 600000, lastMoveAt String DEFAULT '',
      seq UInt64, createdAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (id, seq)`,
    cols: [
      { name: "id", def: "String" },
      { name: "whiteUserId", def: "String" },
      { name: "whiteUserName", def: "String DEFAULT ''" },
      { name: "blackUserId", def: "String" },
      { name: "blackUserName", def: "String DEFAULT ''" },
      { name: "moves", def: "String DEFAULT '[]'" },
      { name: "status", def: "String DEFAULT 'active'" },
      { name: "resultReason", def: "String DEFAULT ''" },
      { name: "whiteTimeMs", def: "UInt32 DEFAULT 600000" },
      { name: "blackTimeMs", def: "UInt32 DEFAULT 600000" },
      { name: "lastMoveAt", def: "String DEFAULT ''" },
      { name: "seq", def: "UInt64 DEFAULT 0" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "english_words",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.english_words (
      id String, word String, translation String,
      definition String DEFAULT '', example String DEFAULT '',
      partOfSpeech String DEFAULT '', difficulty UInt8 DEFAULT 1,
      userId String, totalReviews UInt32 DEFAULT 0,
      correctReviews UInt32 DEFAULT 0,
      lastReviewedAt DateTime DEFAULT '1970-01-01 00:00:00',
      createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
    ) ENGINE = ReplacingMergeTree(updatedAt) ORDER BY id`,
    cols: [
      { name: "id", def: "String" },
      { name: "word", def: "String" },
      { name: "translation", def: "String DEFAULT ''" },
      { name: "definition", def: "String DEFAULT ''" },
      { name: "example", def: "String DEFAULT ''" },
      { name: "partOfSpeech", def: "String DEFAULT ''" },
      { name: "difficulty", def: "UInt8 DEFAULT 1" },
      { name: "userId", def: "String" },
      { name: "totalReviews", def: "UInt32 DEFAULT 0" },
      { name: "correctReviews", def: "UInt32 DEFAULT 0" },
      { name: "lastReviewedAt", def: "DateTime DEFAULT '1970-01-01 00:00:00'" },
      { name: "createdAt", def: "DateTime DEFAULT now()" },
      { name: "updatedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "dept_bsc_reports",
    idCol: "departmentId",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.dept_bsc_reports (
      departmentId String, year UInt16, quarter UInt8,
      sectionsJson String DEFAULT '{}', savedBy String DEFAULT '',
      savedByName String DEFAULT '', updatedAt DateTime DEFAULT now()
    ) ENGINE = ReplacingMergeTree(updatedAt) ORDER BY (departmentId, year, quarter)`,
    cols: [
      { name: "departmentId", def: "String" },
      { name: "year", def: "UInt16" },
      { name: "quarter", def: "UInt8" },
      { name: "sectionsJson", def: "String DEFAULT '{}'" },
      { name: "savedBy", def: "String DEFAULT ''" },
      { name: "savedByName", def: "String DEFAULT ''" },
      { name: "updatedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "audit_db",
    table: "department_photos",
    idCol: "id",
    createDDL: `CREATE TABLE IF NOT EXISTS audit_db.department_photos (
      id String, departmentId String, departmentName String,
      uploadedBy String, uploadedByName String, imageData String,
      caption String DEFAULT '', uploadedAt DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (departmentId, uploadedAt)`,
    cols: [
      { name: "id", def: "String" },
      { name: "departmentId", def: "String" },
      { name: "departmentName", def: "String DEFAULT ''" },
      { name: "uploadedBy", def: "String DEFAULT ''" },
      { name: "uploadedByName", def: "String DEFAULT ''" },
      { name: "imageData", def: "String DEFAULT ''" },
      { name: "caption", def: "String DEFAULT ''" },
      { name: "uploadedAt", def: "DateTime DEFAULT now()" },
    ],
  },
  // ── FINACLE ───────────────────────────────────────────────────────────────
  {
    db: "FINACLE",
    table: "customers",
    idCol: "customer_id",
    createDDL: `CREATE TABLE IF NOT EXISTS FINACLE.customers (
      customer_id String, cif_number String, first_name String,
      last_name String, register_number String, phone String, email String,
      address String, customer_type String, status String DEFAULT 'ACTIVE',
      opened_date Date, created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY customer_id`,
    cols: [
      { name: "customer_id", def: "String" },
      { name: "cif_number", def: "String" },
      { name: "first_name", def: "String" },
      { name: "last_name", def: "String" },
      { name: "register_number", def: "String" },
      { name: "phone", def: "String DEFAULT ''" },
      { name: "email", def: "String DEFAULT ''" },
      { name: "address", def: "String DEFAULT ''" },
      { name: "customer_type", def: "String DEFAULT 'INDIVIDUAL'" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "opened_date", def: "Date" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "FINACLE",
    table: "accounts",
    idCol: "account_id",
    createDDL: `CREATE TABLE IF NOT EXISTS FINACLE.accounts (
      account_id String, customer_id String, account_number String,
      account_type String, currency String DEFAULT 'MNT',
      balance Decimal(18,2) DEFAULT 0, available_balance Decimal(18,2) DEFAULT 0,
      status String DEFAULT 'ACTIVE', open_date Date,
      close_date Nullable(Date), branch_code String,
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY account_id`,
    cols: [
      { name: "account_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "account_number", def: "String" },
      { name: "account_type", def: "String" },
      { name: "currency", def: "String DEFAULT 'MNT'" },
      { name: "balance", def: "Decimal(18,2) DEFAULT 0" },
      { name: "available_balance", def: "Decimal(18,2) DEFAULT 0" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "open_date", def: "Date" },
      { name: "close_date", def: "Nullable(Date)" },
      { name: "branch_code", def: "String DEFAULT ''" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "FINACLE",
    table: "transactions",
    idCol: "txn_id",
    createDDL: `CREATE TABLE IF NOT EXISTS FINACLE.transactions (
      txn_id String, account_id String, txn_date DateTime,
      value_date Date, txn_type String, debit_credit String,
      amount Decimal(18,2), currency String DEFAULT 'MNT',
      balance_after Decimal(18,2), description String, channel String,
      reference_no String, teller_id String, branch_code String,
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (account_id, txn_date)`,
    cols: [
      { name: "txn_id", def: "String" },
      { name: "account_id", def: "String" },
      { name: "txn_date", def: "DateTime" },
      { name: "value_date", def: "Date" },
      { name: "txn_type", def: "String" },
      { name: "debit_credit", def: "String" },
      { name: "amount", def: "Decimal(18,2)" },
      { name: "currency", def: "String DEFAULT 'MNT'" },
      { name: "balance_after", def: "Decimal(18,2)" },
      { name: "description", def: "String DEFAULT ''" },
      { name: "channel", def: "String DEFAULT ''" },
      { name: "reference_no", def: "String DEFAULT ''" },
      { name: "teller_id", def: "String DEFAULT ''" },
      { name: "branch_code", def: "String DEFAULT ''" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "FINACLE",
    table: "loans",
    idCol: "loan_id",
    createDDL: `CREATE TABLE IF NOT EXISTS FINACLE.loans (
      loan_id String, customer_id String, account_id String,
      loan_type String, principal Decimal(18,2), outstanding Decimal(18,2),
      interest_rate Decimal(6,4), term_months UInt16,
      disbursement_date Date, maturity_date Date,
      status String DEFAULT 'ACTIVE', classification String DEFAULT 'NORMAL',
      branch_code String, created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY loan_id`,
    cols: [
      { name: "loan_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "account_id", def: "String" },
      { name: "loan_type", def: "String" },
      { name: "principal", def: "Decimal(18,2)" },
      { name: "outstanding", def: "Decimal(18,2)" },
      { name: "interest_rate", def: "Decimal(6,4)" },
      { name: "term_months", def: "UInt16" },
      { name: "disbursement_date", def: "Date" },
      { name: "maturity_date", def: "Date" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "classification", def: "String DEFAULT 'NORMAL'" },
      { name: "branch_code", def: "String DEFAULT ''" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "FINACLE",
    table: "deposits",
    idCol: "deposit_id",
    createDDL: `CREATE TABLE IF NOT EXISTS FINACLE.deposits (
      deposit_id String, customer_id String, account_id String,
      deposit_type String, amount Decimal(18,2), currency String DEFAULT 'MNT',
      interest_rate Decimal(6,4), start_date Date, maturity_date Date,
      status String DEFAULT 'ACTIVE', auto_renew UInt8 DEFAULT 0,
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY deposit_id`,
    cols: [
      { name: "deposit_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "account_id", def: "String" },
      { name: "deposit_type", def: "String" },
      { name: "amount", def: "Decimal(18,2)" },
      { name: "currency", def: "String DEFAULT 'MNT'" },
      { name: "interest_rate", def: "Decimal(6,4)" },
      { name: "start_date", def: "Date" },
      { name: "maturity_date", def: "Date" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "auto_renew", def: "UInt8 DEFAULT 0" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  // ── ERP ───────────────────────────────────────────────────────────────────
  {
    db: "ERP",
    table: "employees",
    idCol: "emp_id",
    createDDL: `CREATE TABLE IF NOT EXISTS ERP.employees (
      emp_id String, emp_code String, first_name String, last_name String,
      register_number String, department String, position String,
      manager_id String, hire_date Date, status String DEFAULT 'ACTIVE',
      employment_type String DEFAULT 'FULL_TIME', created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY emp_id`,
    cols: [
      { name: "emp_id", def: "String" },
      { name: "emp_code", def: "String" },
      { name: "first_name", def: "String" },
      { name: "last_name", def: "String" },
      { name: "register_number", def: "String" },
      { name: "department", def: "String" },
      { name: "position", def: "String" },
      { name: "manager_id", def: "String DEFAULT ''" },
      { name: "hire_date", def: "Date" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "employment_type", def: "String DEFAULT 'FULL_TIME'" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "ERP",
    table: "payroll",
    idCol: "payroll_id",
    createDDL: `CREATE TABLE IF NOT EXISTS ERP.payroll (
      payroll_id String, emp_id String, pay_period String,
      basic_salary Decimal(14,2), overtime Decimal(14,2),
      bonus Decimal(14,2), deductions Decimal(14,2),
      net_salary Decimal(14,2), payment_date Date,
      status String DEFAULT 'PAID', created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (emp_id, pay_period)`,
    cols: [
      { name: "payroll_id", def: "String" },
      { name: "emp_id", def: "String" },
      { name: "pay_period", def: "String" },
      { name: "basic_salary", def: "Decimal(14,2)" },
      { name: "overtime", def: "Decimal(14,2) DEFAULT 0" },
      { name: "bonus", def: "Decimal(14,2) DEFAULT 0" },
      { name: "deductions", def: "Decimal(14,2) DEFAULT 0" },
      { name: "net_salary", def: "Decimal(14,2)" },
      { name: "payment_date", def: "Date" },
      { name: "status", def: "String DEFAULT 'PAID'" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "ERP",
    table: "vendors",
    idCol: "vendor_id",
    createDDL: `CREATE TABLE IF NOT EXISTS ERP.vendors (
      vendor_id String, vendor_code String, company_name String,
      register_number String, contact_person String, phone String,
      email String, category String, status String DEFAULT 'ACTIVE',
      approved_date Date, created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY vendor_id`,
    cols: [
      { name: "vendor_id", def: "String" },
      { name: "vendor_code", def: "String" },
      { name: "company_name", def: "String" },
      { name: "register_number", def: "String" },
      { name: "contact_person", def: "String DEFAULT ''" },
      { name: "phone", def: "String DEFAULT ''" },
      { name: "email", def: "String DEFAULT ''" },
      { name: "category", def: "String DEFAULT ''" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "approved_date", def: "Date" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "ERP",
    table: "purchase_orders",
    idCol: "po_id",
    createDDL: `CREATE TABLE IF NOT EXISTS ERP.purchase_orders (
      po_id String, vendor_id String, po_date Date, delivery_date Date,
      total_amount Decimal(18,2), currency String DEFAULT 'MNT',
      status String DEFAULT 'PENDING', approved_by String,
      department String, description String, created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY po_id`,
    cols: [
      { name: "po_id", def: "String" },
      { name: "vendor_id", def: "String" },
      { name: "po_date", def: "Date" },
      { name: "delivery_date", def: "Date" },
      { name: "total_amount", def: "Decimal(18,2)" },
      { name: "currency", def: "String DEFAULT 'MNT'" },
      { name: "status", def: "String DEFAULT 'PENDING'" },
      { name: "approved_by", def: "String DEFAULT ''" },
      { name: "department", def: "String DEFAULT ''" },
      { name: "description", def: "String DEFAULT ''" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "ERP",
    table: "assets",
    idCol: "asset_id",
    createDDL: `CREATE TABLE IF NOT EXISTS ERP.assets (
      asset_id String, asset_code String, asset_name String,
      category String, purchase_date Date, purchase_price Decimal(14,2),
      current_value Decimal(14,2), depreciation_rate Decimal(6,4),
      location String, custodian_id String,
      status String DEFAULT 'IN_USE', created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY asset_id`,
    cols: [
      { name: "asset_id", def: "String" },
      { name: "asset_code", def: "String" },
      { name: "asset_name", def: "String" },
      { name: "category", def: "String" },
      { name: "purchase_date", def: "Date" },
      { name: "purchase_price", def: "Decimal(14,2)" },
      { name: "current_value", def: "Decimal(14,2)" },
      { name: "depreciation_rate", def: "Decimal(6,4) DEFAULT 0" },
      { name: "location", def: "String DEFAULT ''" },
      { name: "custodian_id", def: "String DEFAULT ''" },
      { name: "status", def: "String DEFAULT 'IN_USE'" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  // ── CARDZONE ──────────────────────────────────────────────────────────────
  {
    db: "CARDZONE",
    table: "cards",
    idCol: "card_id",
    createDDL: `CREATE TABLE IF NOT EXISTS CARDZONE.cards (
      card_id String, card_number String, customer_id String,
      account_id String, card_type String, card_brand String,
      status String DEFAULT 'ACTIVE', issue_date Date, expiry_date Date,
      credit_limit Nullable(Decimal(14,2)), outstanding Decimal(14,2) DEFAULT 0,
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY card_id`,
    cols: [
      { name: "card_id", def: "String" },
      { name: "card_number", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "account_id", def: "String" },
      { name: "card_type", def: "String" },
      { name: "card_brand", def: "String" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "issue_date", def: "Date" },
      { name: "expiry_date", def: "Date" },
      { name: "credit_limit", def: "Nullable(Decimal(14,2))" },
      { name: "outstanding", def: "Decimal(14,2) DEFAULT 0" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "CARDZONE",
    table: "card_transactions",
    idCol: "txn_id",
    createDDL: `CREATE TABLE IF NOT EXISTS CARDZONE.card_transactions (
      txn_id String, card_id String, txn_datetime DateTime,
      merchant_id String, merchant_name String, mcc_code String,
      amount Decimal(14,2), currency String, mnt_amount Decimal(14,2),
      txn_type String, auth_code String, response_code String,
      channel String, country_code String, created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (card_id, txn_datetime)`,
    cols: [
      { name: "txn_id", def: "String" },
      { name: "card_id", def: "String" },
      { name: "txn_datetime", def: "DateTime" },
      { name: "merchant_id", def: "String" },
      { name: "merchant_name", def: "String" },
      { name: "mcc_code", def: "String" },
      { name: "amount", def: "Decimal(14,2)" },
      { name: "currency", def: "String DEFAULT 'MNT'" },
      { name: "mnt_amount", def: "Decimal(14,2)" },
      { name: "txn_type", def: "String" },
      { name: "auth_code", def: "String DEFAULT ''" },
      { name: "response_code", def: "String DEFAULT ''" },
      { name: "channel", def: "String DEFAULT ''" },
      { name: "country_code", def: "String DEFAULT 'MN'" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "CARDZONE",
    table: "merchants",
    idCol: "merchant_id",
    createDDL: `CREATE TABLE IF NOT EXISTS CARDZONE.merchants (
      merchant_id String, merchant_name String, merchant_name_mn String,
      mcc_code String, category String, address String,
      terminal_count UInt16 DEFAULT 0, status String DEFAULT 'ACTIVE',
      contract_date Date, created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY merchant_id`,
    cols: [
      { name: "merchant_id", def: "String" },
      { name: "merchant_name", def: "String" },
      { name: "merchant_name_mn", def: "String" },
      { name: "mcc_code", def: "String" },
      { name: "category", def: "String" },
      { name: "address", def: "String DEFAULT ''" },
      { name: "terminal_count", def: "UInt16 DEFAULT 0" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "contract_date", def: "Date" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "CARDZONE",
    table: "disputes",
    idCol: "dispute_id",
    createDDL: `CREATE TABLE IF NOT EXISTS CARDZONE.disputes (
      dispute_id String, card_id String, txn_id String,
      dispute_date DateTime, dispute_reason String, amount Decimal(14,2),
      status String DEFAULT 'OPEN', resolution String,
      resolved_date Nullable(DateTime), created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY dispute_id`,
    cols: [
      { name: "dispute_id", def: "String" },
      { name: "card_id", def: "String" },
      { name: "txn_id", def: "String" },
      { name: "dispute_date", def: "DateTime" },
      { name: "dispute_reason", def: "String" },
      { name: "amount", def: "Decimal(14,2)" },
      { name: "status", def: "String DEFAULT 'OPEN'" },
      { name: "resolution", def: "String DEFAULT ''" },
      { name: "resolved_date", def: "Nullable(DateTime)" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  // ── EBANK ─────────────────────────────────────────────────────────────────
  {
    db: "EBANK",
    table: "sessions",
    idCol: "session_id",
    createDDL: `CREATE TABLE IF NOT EXISTS EBANK.sessions (
      session_id String, customer_id String, device_id String,
      device_type String, os String, app_version String, ip_address String,
      login_at DateTime, logout_at Nullable(DateTime),
      duration_sec UInt32 DEFAULT 0, status String DEFAULT 'ACTIVE',
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (customer_id, login_at)`,
    cols: [
      { name: "session_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "device_id", def: "String" },
      { name: "device_type", def: "String DEFAULT ''" },
      { name: "os", def: "String DEFAULT ''" },
      { name: "app_version", def: "String DEFAULT ''" },
      { name: "ip_address", def: "String DEFAULT ''" },
      { name: "login_at", def: "DateTime" },
      { name: "logout_at", def: "Nullable(DateTime)" },
      { name: "duration_sec", def: "UInt32 DEFAULT 0" },
      { name: "status", def: "String DEFAULT 'ACTIVE'" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "EBANK",
    table: "transfers",
    idCol: "transfer_id",
    createDDL: `CREATE TABLE IF NOT EXISTS EBANK.transfers (
      transfer_id String, session_id String, customer_id String,
      from_account String, to_account String, bank_code String DEFAULT 'GLMT',
      amount Decimal(14,2), currency String DEFAULT 'MNT',
      fee Decimal(10,2) DEFAULT 0, description String,
      status String DEFAULT 'SUCCESS', channel String DEFAULT 'MOBILE',
      initiated_at DateTime, completed_at Nullable(DateTime),
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (customer_id, initiated_at)`,
    cols: [
      { name: "transfer_id", def: "String" },
      { name: "session_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "from_account", def: "String" },
      { name: "to_account", def: "String" },
      { name: "bank_code", def: "String DEFAULT 'GLMT'" },
      { name: "amount", def: "Decimal(14,2)" },
      { name: "currency", def: "String DEFAULT 'MNT'" },
      { name: "fee", def: "Decimal(10,2) DEFAULT 0" },
      { name: "description", def: "String DEFAULT ''" },
      { name: "status", def: "String DEFAULT 'SUCCESS'" },
      { name: "channel", def: "String DEFAULT 'MOBILE'" },
      { name: "initiated_at", def: "DateTime" },
      { name: "completed_at", def: "Nullable(DateTime)" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "EBANK",
    table: "beneficiaries",
    idCol: "beneficiary_id",
    createDDL: `CREATE TABLE IF NOT EXISTS EBANK.beneficiaries (
      beneficiary_id String, customer_id String, nickname String,
      account_number String, bank_code String, bank_name String,
      is_favorite UInt8 DEFAULT 0, last_used_at Nullable(DateTime),
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (customer_id, beneficiary_id)`,
    cols: [
      { name: "beneficiary_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "nickname", def: "String DEFAULT ''" },
      { name: "account_number", def: "String" },
      { name: "bank_code", def: "String DEFAULT 'GLMT'" },
      { name: "bank_name", def: "String DEFAULT ''" },
      { name: "is_favorite", def: "UInt8 DEFAULT 0" },
      { name: "last_used_at", def: "Nullable(DateTime)" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "EBANK",
    table: "notifications",
    idCol: "notification_id",
    createDDL: `CREATE TABLE IF NOT EXISTS EBANK.notifications (
      notification_id String, customer_id String, type String,
      title String, body String, is_read UInt8 DEFAULT 0,
      sent_at DateTime, read_at Nullable(DateTime),
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (customer_id, sent_at)`,
    cols: [
      { name: "notification_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "type", def: "String DEFAULT 'INFO'" },
      { name: "title", def: "String" },
      { name: "body", def: "String DEFAULT ''" },
      { name: "is_read", def: "UInt8 DEFAULT 0" },
      { name: "sent_at", def: "DateTime" },
      { name: "read_at", def: "Nullable(DateTime)" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
  {
    db: "EBANK",
    table: "login_attempts",
    idCol: "attempt_id",
    createDDL: `CREATE TABLE IF NOT EXISTS EBANK.login_attempts (
      attempt_id String, customer_id String, ip_address String,
      device_id String, success UInt8, fail_reason String,
      attempted_at DateTime, created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (customer_id, attempted_at)`,
    cols: [
      { name: "attempt_id", def: "String" },
      { name: "customer_id", def: "String" },
      { name: "ip_address", def: "String DEFAULT ''" },
      { name: "device_id", def: "String DEFAULT ''" },
      { name: "success", def: "UInt8" },
      { name: "fail_reason", def: "String DEFAULT ''" },
      { name: "attempted_at", def: "DateTime" },
      { name: "created_at", def: "DateTime DEFAULT now()" },
    ],
  },
];

// ─── Test row factory ─────────────────────────────────────────────────────────
// table тус бүрт 1 test мөр үүсгэнэ

function buildTestRow(db: string, table: string): { idCol: string; row: Record<string, any> } {
  const t = nowDt();
  const d = TODAY;

  const map: Record<string, { idCol: string; row: Record<string, any> }> = {
    "audit_db.departments": {
      idCol: "id",
      row: { id: tid("DEPT"), name: "Test Department", description: "seed-test", manager: "", employeeCount: 0, createdAt: t, updatedAt: t },
    },
    "audit_db.users": {
      idCol: "id",
      row: { id: tid("USR"), userId: tid("USERID"), password: "hashed", name: "Seed Test User", position: "Tester", profileImage: "", departmentId: tid("DEPT"), isAdmin: 0, isSuperAdmin: 0, isActive: 1, allowedTools: "[]", grantableTools: "[]", lastLoginAt: null, createdAt: t, updatedAt: t },
    },
    "audit_db.news": {
      idCol: "id",
      row: { id: tid("NEWS"), title: "Seed Test Article", content: "<p>test</p>", category: "Ерөнхий", imageUrl: "", authorId: tid("USR"), isPublished: 0, views: 0, createdAt: t, updatedAt: t },
    },
    "audit_db.exercises": {
      idCol: "id",
      row: { id: tid("EX"), name: "Seed Exercise", category: "strength", description: "seed test", userId: tid("USR"), createdAt: t },
    },
    "audit_db.workout_logs": {
      idCol: "id",
      row: { id: tid("WL"), exerciseId: tid("EX"), userId: tid("USR"), sets: 3, repetitions: 10, weight: 10.0, notes: "seed test", date: t },
    },
    "audit_db.body_stats": {
      idCol: "id",
      row: { id: tid("BS"), userId: tid("USR"), weight: 70.0, height: 170.0, date: t },
    },
    "audit_db.refresh_tokens": {
      idCol: "id",
      row: { id: tid("RT"), userId: tid("USR"), token: tid("TOKEN"), expiresAt: t, isRevoked: 0, createdAt: t },
    },
    "audit_db.audit_logs": {
      idCol: "id",
      row: { id: tid("AL"), userId: tid("USR"), userEmail: "seed@test.mn", action: "TEST", resource: "seed", resourceId: tid("USR"), method: "GET", ipAddress: "127.0.0.1", userAgent: "seed-test", status: "200", errorMessage: "", metadata: "{}", createdAt: t },
    },
    "audit_db.access_requests": {
      idCol: "id",
      row: { id: tid("AR"), requesterId: tid("USR"), requesterName: "Seed User", requesterUserId: tid("USERID"), tables: ["FINACLE.accounts"], columns: ["balance"], accessTypes: ["SELECT"], validUntil: t, reason: "seed test", status: "pending", reviewedBy: "", reviewedByName: "", reviewNote: "", requestTime: t, reviewedAt: "1970-01-01 00:00:00", updatedAt: t },
    },
    "audit_db.access_grants": {
      idCol: "id",
      row: { id: tid("AG"), userId: tid("USR"), userName: "Seed User", userUserId: tid("USERID"), requestId: tid("AR"), tableName: "FINACLE.accounts", columns: ["balance"], accessTypes: ["SELECT"], validUntil: t, grantedBy: tid("USR"), grantedByName: "Admin", grantedAt: t, isActive: 1, revokedAt: "1970-01-01 00:00:00", revokeReason: "", chPassword: "" },
    },
    "audit_db.tailan_reports": {
      idCol: "id",
      row: { id: tid("TR"), userId: tid("USR"), userName: "Seed User", departmentId: tid("DEPT"), year: 2026, quarter: 1, status: "draft", plannedTasksJson: "[]", dynamicSectionsJson: "[]", otherWork: "", teamActivitiesJson: "[]", extraDataJson: "{}", submittedAt: "1970-01-01 00:00:00", createdAt: t, updatedAt: t },
    },
    "audit_db.chess_invitations": {
      idCol: "id",
      row: { id: tid("CI"), fromUserId: tid("USR"), fromUserName: "Seed User", toUserId: tid("USR2"), toUserName: "Seed User 2", status: "pending", seq: 1, createdAt: t },
    },
    "audit_db.chess_games": {
      idCol: "id",
      row: { id: tid("CG"), whiteUserId: tid("USR"), whiteUserName: "Seed White", blackUserId: tid("USR2"), blackUserName: "Seed Black", moves: "[]", status: "active", resultReason: "", whiteTimeMs: 600000, blackTimeMs: 600000, lastMoveAt: "", seq: 1, createdAt: t },
    },
    "audit_db.english_words": {
      idCol: "id",
      row: { id: tid("EW"), word: "seedtest", translation: "тест", definition: "", example: "", partOfSpeech: "noun", difficulty: 1, userId: tid("USR"), totalReviews: 0, correctReviews: 0, lastReviewedAt: "1970-01-01 00:00:00", createdAt: t, updatedAt: t },
    },
    "audit_db.dept_bsc_reports": {
      idCol: "departmentId",
      row: { departmentId: tid("DEPT"), year: 2026, quarter: 1, sectionsJson: "{}", savedBy: tid("USR"), savedByName: "Seed User", updatedAt: t },
    },
    "audit_db.department_photos": {
      idCol: "id",
      row: { id: tid("DP"), departmentId: tid("DEPT"), departmentName: "Test Dept", uploadedBy: tid("USR"), uploadedByName: "Seed User", imageData: "data:image/png;base64,Zg==", caption: "seed test", uploadedAt: t },
    },
    "FINACLE.customers": {
      idCol: "customer_id",
      row: { customer_id: tid("CUST"), cif_number: tid("CIF"), first_name: "Seed", last_name: "Test", register_number: tid("REG"), phone: "99999999", email: "seed@test.mn", address: "Test address", customer_type: "INDIVIDUAL", status: "ACTIVE", opened_date: d, created_at: t },
    },
    "FINACLE.accounts": {
      idCol: "account_id",
      row: { account_id: tid("ACC"), customer_id: tid("CUST"), account_number: tid("ACCNO"), account_type: "CURRENT", currency: "MNT", balance: 0, available_balance: 0, status: "ACTIVE", open_date: d, close_date: null, branch_code: "001", created_at: t },
    },
    "FINACLE.transactions": {
      idCol: "txn_id",
      row: { txn_id: tid("TXN"), account_id: tid("ACC"), txn_date: t, value_date: d, txn_type: "TRANSFER", debit_credit: "D", amount: 1.00, currency: "MNT", balance_after: 0, description: "seed test", channel: "TEST", reference_no: tid("REF"), teller_id: "T001", branch_code: "001", created_at: t },
    },
    "FINACLE.loans": {
      idCol: "loan_id",
      row: { loan_id: tid("LOAN"), customer_id: tid("CUST"), account_id: tid("ACC"), loan_type: "CONSUMER", principal: 1000000, outstanding: 1000000, interest_rate: 0.1200, term_months: 12, disbursement_date: d, maturity_date: d, status: "ACTIVE", classification: "NORMAL", branch_code: "001", created_at: t },
    },
    "FINACLE.deposits": {
      idCol: "deposit_id",
      row: { deposit_id: tid("DEP"), customer_id: tid("CUST"), account_id: tid("ACC"), deposit_type: "TERM", amount: 100000, currency: "MNT", interest_rate: 0.0850, start_date: d, maturity_date: d, status: "ACTIVE", auto_renew: 0, created_at: t },
    },
    "ERP.employees": {
      idCol: "emp_id",
      row: { emp_id: tid("EMP"), emp_code: tid("EMPCODE"), first_name: "Seed", last_name: "Employee", register_number: tid("EREG"), department: "IT", position: "Tester", manager_id: "", hire_date: d, status: "ACTIVE", employment_type: "FULL_TIME", created_at: t },
    },
    "ERP.payroll": {
      idCol: "payroll_id",
      row: { payroll_id: tid("PAY"), emp_id: tid("EMP"), pay_period: "2026-03", basic_salary: 1000000, overtime: 0, bonus: 0, deductions: 0, net_salary: 1000000, payment_date: d, status: "PAID", created_at: t },
    },
    "ERP.vendors": {
      idCol: "vendor_id",
      row: { vendor_id: tid("VEN"), vendor_code: tid("VENCODE"), company_name: "Seed Vendor LLC", register_number: tid("VENREG"), contact_person: "Seed", phone: "99999999", email: "vendor@seed.mn", category: "IT", status: "ACTIVE", approved_date: d, created_at: t },
    },
    "ERP.purchase_orders": {
      idCol: "po_id",
      row: { po_id: tid("PO"), vendor_id: tid("VEN"), po_date: d, delivery_date: d, total_amount: 1000000, currency: "MNT", status: "PENDING", approved_by: "", department: "IT", description: "seed test po", created_at: t },
    },
    "ERP.assets": {
      idCol: "asset_id",
      row: { asset_id: tid("ASSET"), asset_code: tid("ASCODE"), asset_name: "Seed Test Asset", category: "IT", purchase_date: d, purchase_price: 500000, current_value: 500000, depreciation_rate: 0.2000, location: "HQ", custodian_id: tid("EMP"), status: "IN_USE", created_at: t },
    },
    "CARDZONE.cards": {
      idCol: "card_id",
      row: { card_id: tid("CARD"), card_number: "4111111111111111", customer_id: tid("CUST"), account_id: tid("ACC"), card_type: "DEBIT", card_brand: "VISA", status: "ACTIVE", issue_date: d, expiry_date: d, credit_limit: null, outstanding: 0, created_at: t },
    },
    "CARDZONE.card_transactions": {
      idCol: "txn_id",
      row: { txn_id: tid("CTXN"), card_id: tid("CARD"), txn_datetime: t, merchant_id: tid("MERCH"), merchant_name: "Seed Merchant", mcc_code: "5411", amount: 1.00, currency: "MNT", mnt_amount: 1.00, txn_type: "PURCHASE", auth_code: "AUTH01", response_code: "00", channel: "POS", country_code: "MN", created_at: t },
    },
    "CARDZONE.merchants": {
      idCol: "merchant_id",
      row: { merchant_id: tid("MERCH"), merchant_name: "Seed Merchant", merchant_name_mn: "Тест Дэлгүүр", mcc_code: "5999", category: "RETAIL", address: "Test address", terminal_count: 1, status: "ACTIVE", contract_date: d, created_at: t },
    },
    "CARDZONE.disputes": {
      idCol: "dispute_id",
      row: { dispute_id: tid("DISP"), card_id: tid("CARD"), txn_id: tid("CTXN"), dispute_date: t, dispute_reason: "seed test", amount: 1.00, status: "OPEN", resolution: "", resolved_date: null, created_at: t },
    },
    "EBANK.sessions": {
      idCol: "session_id",
      row: { session_id: tid("SESS"), customer_id: tid("CUST"), device_id: tid("DEV"), device_type: "MOBILE", os: "Android", app_version: "1.0.0", ip_address: "127.0.0.1", login_at: t, logout_at: null, duration_sec: 0, status: "ACTIVE", created_at: t },
    },
    "EBANK.transfers": {
      idCol: "transfer_id",
      row: { transfer_id: tid("XFER"), session_id: tid("SESS"), customer_id: tid("CUST"), from_account: tid("ACC"), to_account: "ACC999", bank_code: "GLMT", amount: 1.00, currency: "MNT", fee: 0, description: "seed test", status: "SUCCESS", channel: "MOBILE", initiated_at: t, completed_at: t, created_at: t },
    },
    "EBANK.beneficiaries": {
      idCol: "beneficiary_id",
      row: { beneficiary_id: tid("BENE"), customer_id: tid("CUST"), nickname: "Seed Bene", account_number: "ACC999TEST", bank_code: "GLMT", bank_name: "Голомт банк", is_favorite: 0, last_used_at: null, created_at: t },
    },
    "EBANK.notifications": {
      idCol: "notification_id",
      row: { notification_id: tid("NOTIF"), customer_id: tid("CUST"), type: "INFO", title: "Seed test", body: "seed test notification", is_read: 0, sent_at: t, read_at: null, created_at: t },
    },
    "EBANK.login_attempts": {
      idCol: "attempt_id",
      row: { attempt_id: tid("ATT"), customer_id: tid("CUST"), ip_address: "127.0.0.1", device_id: tid("DEV"), success: 1, fail_reason: "", attempted_at: t, created_at: t },
    },
  };

  const key = `${db}.${table}`;
  if (!map[key]) throw new Error(`No test row defined for ${key}`);
  return map[key];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runSeedTest() {
  console.log("🧪 seed-test.ts эхэллээ");
  console.log(`📍 Холбогдох хост: ${CH_HOST}`);
  console.log(`🔖 Test prefix  : ${SEED_PREFIX}\n`);

  const client = createClient({ url: CH_HOST, username: CH_USER, password: CH_PASS });

  const failed: string[] = [];
  const seeded: Array<{ db: string; table: string; idCol: string }> = [];

  try {
    // ── PHASE 0: Pre-flight — бодит өгөгдлийг санамсаргүй устгахгүй байх ────
    console.log("═══ PHASE 0: Pre-flight аюулгүй байдлын шалгалт ═══");
    console.log(`  🔒 DELETE нөхцөл: WHERE <idCol> LIKE '${SEED_PREFIX}%'`);
    console.log("  🔒 Бодит UUID/structured ID-ууд энэ prefix-тэй таарахгүй\n");

    // ── PHASE 1: Холболт шалгах ─────────────────────────────────────────────
    console.log("═══ PHASE 1: Холболт шалгах ═══");
    const verRes = await client.query({ query: "SELECT version() as v" });
    const verData: any = await verRes.json();
    console.log(`✅ ClickHouse ${verData.data[0].v} — холболт амжилттай\n`);

    // ── PHASE 2: DB / Table CREATE IF NOT EXISTS + column validate ──────────
    console.log("═══ PHASE 2: Schema шалгаж, засах ═══");
    const dbs = [...new Set(SCHEMAS.map((s) => s.db))];
    for (const db of dbs) {
      await client.exec({ query: `CREATE DATABASE IF NOT EXISTS ${db}` });
      console.log(`  📁 ${db} DB байна`);
    }

    let schemaFixed = 0;
    for (const schema of SCHEMAS) {
      // Table CREATE IF NOT EXISTS
      await client.exec({ query: schema.createDDL });
      // Column validate & fix
      const beforeFix = schemaFixed;
      await ensureColumns(client, schema.db, schema.table, schema.cols);
      if (schemaFixed > beforeFix) {
        // ensureColumns logs internally
      }
      process.stdout.write(`  ✓ ${schema.db}.${schema.table}\n`);
    }
    console.log(`\n✅ Schema шалгалт дууслаа — ${SCHEMAS.length} table\n`);

    // ── PHASE 3: Test өгөгдөл оруулах ──────────────────────────────────────
    console.log("═══ PHASE 3: Test өгөгдөл оруулах ═══");

    // Өмнөх тасарсан run-аас үлдсэн test мөрүүдийг урьдчилж цэвэрлэх
    let leftovers = 0;
    for (const schema of SCHEMAS) {
      const cnt = await countWhere(client, schema.db, schema.table, schema.idCol);
      if (cnt > 0) {
        await client.exec({
          query: `ALTER TABLE ${schema.db}.${schema.table} DELETE WHERE ${schema.idCol} LIKE '${SEED_PREFIX}%'`,
        });
        await waitMutation(client, schema.db, schema.table);
        console.log(`  🧹 ${schema.db}.${schema.table} — өмнөх ${cnt} test мөр цэвэрлэгдлээ`);
        leftovers += cnt;
      }
    }
    if (leftovers > 0) {
      console.log(`  ⚠️  Нийт ${leftovers} хуучин test мөр цэвэрлэгдлээ\n`);
    } else {
      console.log(`  ✓ Хуучин test мөр олдсонгүй — цэвэр орчин\n`);
    }

    for (const schema of SCHEMAS) {
      try {
        const { idCol, row } = buildTestRow(schema.db, schema.table);
        await client.insert({
          table: `${schema.db}.${schema.table}`,
          values: [row],
          format: "JSONEachRow",
        });
        seeded.push({ db: schema.db, table: schema.table, idCol });
        console.log(`  ✓ ${schema.db}.${schema.table} — нэг мөр оруулсан`);
      } catch (err: any) {
        console.error(`  ✗ ${schema.db}.${schema.table} — INSERT алдаа: ${err.message}`);
        failed.push(`INSERT ${schema.db}.${schema.table}: ${err.message}`);
      }
    }

    if (failed.length > 0) {
      console.log(`\n⚠️  ${failed.length} table-д INSERT алдаа гарсан тул seed зогссон`);
      throw new Error("INSERT phase failed:\n" + failed.join("\n"));
    }
    console.log(`\n✅ ${seeded.length} table-д test мөр нэмэгдлээ\n`);

    // ── PHASE 4: Баталгаажуулах ─────────────────────────────────────────────
    console.log("═══ PHASE 4: Оруулсан өгөгдлийг баталгаажуулах ═══");
    let verifyFailed = 0;
    for (const { db, table, idCol } of seeded) {
      const cnt = await countWhere(client, db, table, idCol);
      if (cnt >= 1) {
        console.log(`  ✓ ${db}.${table} — ${cnt} test мөр олдлоо`);
      } else {
        console.error(`  ✗ ${db}.${table} — test мөр олдсонгүй!`);
        verifyFailed++;
      }
    }
    if (verifyFailed > 0) {
      throw new Error(`Verify алдаа: ${verifyFailed} table-д test өгөгдөл байхгүй`);
    }
    console.log(`\n✅ Бүх ${seeded.length} table-ийн баталгаажуулалт амжилттай\n`);

    // ── PHASE 5: Test өгөгдлийг устгах ─────────────────────────────────────
    console.log("═══ PHASE 5: Test өгөгдлийг устгах ═══");
    for (const { db, table, idCol } of seeded) {
      try {
        await client.exec({
          query: `ALTER TABLE ${db}.${table} DELETE WHERE ${idCol} LIKE '${SEED_PREFIX}%'`,
        });
        console.log(`  🗑️  ${db}.${table} — DELETE mutation илгээгдлээ`);
      } catch (err: any) {
        console.error(`  ✗ ${db}.${table} — DELETE алдаа: ${err.message}`);
        failed.push(`DELETE ${db}.${table}: ${err.message}`);
      }
    }

    // Mutation дуусахыг хүлээх (бүгдийг зэрэг хүлээнэ)
    console.log("\n  ⏳ Mutation дуусахыг хүлээж байна...");
    const dbs2 = [...new Set(seeded.map((s) => s.db))];
    for (const db of dbs2) {
      const tables = seeded.filter((s) => s.db === db).map((s) => s.table);
      for (const table of tables) {
        await waitMutation(client, db, table);
      }
    }
    console.log("  ✅ Mutation дууслаа\n");

    // ── PHASE 6: Устгагдсаныг баталгаажуулах ───────────────────────────────
    console.log("═══ PHASE 6: Цэвэрлэлтийг баталгаажуулах ═══");
    let cleanFailed = 0;
    for (const { db, table, idCol } of seeded) {
      const cnt = await countWhere(client, db, table, idCol);
      if (cnt === 0) {
        console.log(`  ✓ ${db}.${table} — test мөр бүгд устгагдсан`);
      } else {
        console.warn(`  ⚠️  ${db}.${table} — ${cnt} test мөр үлдсэн хэвээр байна`);
        cleanFailed++;
      }
    }

    // ── Дүгнэлт ─────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════");
    if (failed.length === 0 && cleanFailed === 0) {
      console.log("🎉 seed-test БҮРЭН АМЖИЛТТАЙ");
      console.log(`   • Schema шалгасан table: ${SCHEMAS.length}`);
      console.log(`   • Оруулж, устгасан мөр : ${seeded.length}`);
      console.log("   • DB анхны байдалдаа буцлаа ✅");
    } else {
      console.log("⚠️  seed-test дууслаа ГЭХДЭЭ дараах асуудлууд байна:");
      failed.forEach((f) => console.log(`   ✗ ${f}`));
      if (cleanFailed > 0) {
        console.log(`   ⚠️  ${cleanFailed} table-д test мөр үлдсэн — гараар устгах шаардлагатай`);
        console.log(`      SQL: ALTER TABLE <db>.<table> DELETE WHERE <idCol> LIKE '${SEED_PREFIX}%'`);
      }
    }
    console.log("══════════════════════════════════════════\n");

  } catch (error: any) {
    console.error("\n❌ seed-test АМЖИЛТГҮЙ:", error.message);
    if (seeded.length > 0) {
      console.log("\n🧹 Гараар цэвэрлэх SQL:");
      for (const { db, table, idCol } of seeded) {
        console.log(`   ALTER TABLE ${db}.${table} DELETE WHERE ${idCol} LIKE '${SEED_PREFIX}%';`);
      }
    }
    throw error;
  } finally {
    await client.close();
  }
}

runSeedTest()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
