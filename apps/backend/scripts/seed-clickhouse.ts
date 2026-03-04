import { createClient } from "@clickhouse/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

if (!process.env.CLICKHOUSE_HOST) {
  throw new Error("CLICKHOUSE_HOST environment variable is required");
}
const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST;
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || "default";
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || "";
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || "audit_db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86400000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

async function countRows(
  client: ReturnType<typeof createClient>,
  table: string,
  where = "",
): Promise<number> {
  const q = `SELECT count() as cnt FROM ${CLICKHOUSE_DATABASE}.${table}${where ? " WHERE " + where : ""}`;
  const res = await client.query({ query: q });
  const data: any = await res.json();
  return Number(data.data[0]?.cnt ?? 0);
}

// ─── Department list (matches auth.service.ts DEPARTMENT_CODES) ─────────────

const DEPARTMENTS = [
  { name: "Удирдлага", description: "Удирдах албаны хэлтэс" },
  {
    name: "Дата анализын алба",
    description: "Өгөгдлийн шинжилгээ хийх хэлтэс",
  },
  { name: "Ерөнхий аудитын хэлтэс", description: "Ерөнхий аудит хийх хэлтэс" },
  {
    name: "Зайны аудит чанарын баталгаажуулалтын хэлтэс",
    description: "Зайны аудит хийх болон чанар баталгаажуулах хэлтэс",
  },
  {
    name: "Мэдээллийн технологийн аудитын хэлтэс",
    description: "IT аудит хийх хэлтэс",
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function seedClickHouse() {
  console.log("🌱 Starting ClickHouse seed...");
  console.log(`📍 Connecting to: ${CLICKHOUSE_HOST}`);

  const client = createClient({
    url: CLICKHOUSE_HOST,
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
  });

  try {
    // 1. Connection test
    const versionResult = await client.query({
      query: "SELECT version() as version",
    });
    const versionData: any = await versionResult.json();
    console.log(
      `✅ Connected to ClickHouse version: ${versionData.data[0].version}`,
    );

    // 2. Ensure database exists
    await client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}`,
    });

    // 3. Ensure tables exist (idempotent)
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.departments (
          id String, name String, description String, manager String,
          employeeCount UInt32 DEFAULT 0,
          createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY id`,
    });
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.users (
          id String, userId String, password String,
          name String, position String, profileImage String, departmentId String,
          isAdmin UInt8 DEFAULT 0, isActive UInt8 DEFAULT 1,
          allowedTools String, lastLoginAt Nullable(DateTime),
          createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY id`,
    });
    console.log("✅ Tables ready");

    // ── STEP 1: Departments ──────────────────────────────────────────────────
    console.log("\n📦 Checking departments...");
    const deptCount = await countRows(client, "departments");
    let deptIdMap: Record<string, string> = {};

    if (deptCount > 0) {
      console.log(
        `  ℹ️  ${deptCount} departments already exist — skipping insert`,
      );
      // Load existing IDs so admin user can reference them
      const res = await client.query({
        query: `SELECT id, name FROM ${CLICKHOUSE_DATABASE}.departments`,
      });
      const rows: any = await res.json();
      for (const row of rows.data) {
        deptIdMap[row.name] = row.id;
      }
    } else {
      console.log("  ➕ Inserting departments...");
      for (const dept of DEPARTMENTS) {
        const id = randomUUID();
        deptIdMap[dept.name] = id;
        await client.insert({
          table: `${CLICKHOUSE_DATABASE}.departments`,
          values: [
            {
              id,
              name: dept.name,
              description: dept.description,
              manager: "",
              employeeCount: 0,
              createdAt: now(),
              updatedAt: now(),
            },
          ],
          format: "JSONEachRow",
        });
        console.log(`  ✓ ${dept.name}`);
      }
    }

    // ── STEP 2: Admin user ───────────────────────────────────────────────────
    console.log("\n👤 Checking admin user...");
    const adminCount = await countRows(
      client,
      "users",
      `userId = '.Admin-DAG'`,
    );

    let adminId: string;

    if (adminCount > 0) {
      console.log("  ℹ️  Admin user already exists — skipping");
      // Fetch existing admin id so news articles can reference it
      const res = await client.query({
        query: `SELECT id FROM ${CLICKHOUSE_DATABASE}.users WHERE userId = '.Admin-DAG' LIMIT 1`,
      });
      const rows: any = await res.json();
      adminId = rows.data[0]?.id ?? randomUUID();
    } else {
      const adminPassword = await bcrypt.hash("admin123", 10);
      adminId = randomUUID();
      await client.insert({
        table: `${CLICKHOUSE_DATABASE}.users`,
        values: [
          {
            id: adminId,
            userId: ".Admin-DAG",
            password: adminPassword,
            name: "Admin",
            position: "System Administrator",
            profileImage: "",
            departmentId: "",
            isAdmin: 1,
            isSuperAdmin: 0,
            isActive: 1,
            allowedTools: JSON.stringify([]),
            grantableTools: JSON.stringify([]),
            createdAt: now(),
            updatedAt: now(),
          },
        ],
        format: "JSONEachRow",
      });

      console.log("  ✓ Admin user created");
      console.log("    User ID  : .Admin-DAG");
      console.log("    Password : admin123");
      console.log("    ⚠️  Change the password after first login!");
    }

    // ── STEP 2.5: Super admin user ──────────────────────────────────────────
    console.log("\n👑 Checking super admin user...");
    const superAdminCount = await countRows(
      client,
      "users",
      `userId = '.SuperAdmin-DAG'`,
    );

    if (superAdminCount > 0) {
      console.log("  ℹ️  Super admin user already exists — skipping");
    } else {
      const superAdminPassword = await bcrypt.hash("superadmin123", 10);

      await client.insert({
        table: `${CLICKHOUSE_DATABASE}.users`,
        values: [
          {
            id: randomUUID(),
            userId: ".SuperAdmin-DAG",
            password: superAdminPassword,
            name: "Super Admin",
            position: "Super Administrator",
            profileImage: "",
            departmentId: "",
            isAdmin: 1,
            isSuperAdmin: 1,
            isActive: 1,
            allowedTools: JSON.stringify([]),
            grantableTools: JSON.stringify([]),
            createdAt: now(),
            updatedAt: now(),
          },
        ],
        format: "JSONEachRow",
      });

      console.log("  ✓ Super admin user created");
      console.log("    User ID  : .SuperAdmin-DAG");
      console.log("    Password : superadmin123");
      console.log("    ⚠️  Change the password after first login!");
    }

    // ── STEP 3: Sample regular user ───────────────────────────────────────────
    console.log("\n👤 Checking sample user...");
    const sampleUserCount = await countRows(
      client,
      "users",
      `userId = 'DAA-TestUser'`,
    );

    if (sampleUserCount > 0) {
      console.log("  ℹ️  Sample user exists — skipping");
    } else {
      const userPassword = await bcrypt.hash("user123", 10);
      const dataDeptId =
        deptIdMap["Дата анализын алба"] ??
        Object.values(deptIdMap)[1] ??
        randomUUID();

      await client.insert({
        table: `${CLICKHOUSE_DATABASE}.users`,
        values: [
          {
            id: randomUUID(),
            userId: "DAA-TestUser",
            password: userPassword,
            name: "Test User",
            position: "Data Analyst",
            profileImage: "",
            departmentId: dataDeptId,
            isAdmin: 0,
            isActive: 1,
            allowedTools: JSON.stringify(["todo", "fitness", "report"]),
            createdAt: now(),
            updatedAt: now(),
          },
        ],
        format: "JSONEachRow",
      });
      console.log(
        "  ✓ Sample user created  |  ID: DAA-TestUser  |  Pass: user123",
      );
    }

    // ── STEP 4: News articles ─────────────────────────────────────────────────
    console.log("\n📰 Checking news...");

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.news (
          id String, title String, content String,
          category String DEFAULT 'Ерөнхий', imageUrl String,
          authorId String, isPublished UInt8 DEFAULT 1, views UInt32 DEFAULT 0,
          createdAt DateTime DEFAULT now(), updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY createdAt`,
    });

    const newsCount = await countRows(client, "news");

    if (newsCount > 0) {
      console.log(`  🗑️  ${newsCount} news articles found — truncating for re-seed...`);
      await client.exec({
        query: `TRUNCATE TABLE ${CLICKHOUSE_DATABASE}.news`,
      });
      console.log("  ✓ news table cleared");
    }

    const articles = [
      {
        id: randomUUID(),
        title: "Дотоод аудитын газрын 2025 оны үйл ажиллагааны тайлан",
        content:
          "<p>Голомт Банкны Дотоод Аудитын Газар нь 2025 оны жилийн эцсийн үйл ажиллагааны тайланг дуусгаж, удирдлагын зөвлөлд танилцуулсан байна.</p><ul><li>Нийт <strong>48 аудитын ажил</strong> хийгдэж, 312 зөвлөмж өгөгдсөн</li><li>Зөвлөмжийн хэрэгжилт <strong>87%</strong>-д хүрсэн</li></ul>",
        category: "Мэдэгдэл",
        imageUrl:
          "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 342,
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
      {
        id: randomUUID(),
        title: "Хиймэл оюун ухаан ба аудит: 2026 оны тулгамдсан асуудлууд",
        content:
          "<p>Дэлхий даяар банк санхүүгийн байгууллагуудын дотоод аудиторууд хиймэл оюун ухааны эрсдэлийг удирдахад тулгамдсан шинэ сорилтуудтай нүүр тулж байна.</p><ul><li><strong>Генератив AI-ийн эрсдэл</strong></li><li><strong>Кибер аюулгүй байдал</strong></li><li><strong>ESG тайлагнал</strong></li></ul>",
        category: "Ерөнхий",
        imageUrl:
          "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 518,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
      {
        id: randomUUID(),
        title: "Мэдээллийн технологийн аудитын шинэ журам батлагдлаа",
        content:
          "<p>Дотоод Аудитын Газрын дарга нар МТ аудитын шинэчлэгдсэн журмыг баталж, даруй хэрэгжүүлж эхэллээ.</p><ol><li>Кибер аюулгүй байдлын аудитыг жилд 2 удаа хийх</li><li>Системийн нэвтрэх эрхийн хяналтыг улирал бүр шалгах</li></ol>",
        category: "Мэдэгдэл",
        imageUrl:
          "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 287,
        createdAt: daysAgo(5),
        updatedAt: daysAgo(5),
      },
      {
        id: randomUUID(),
        title: "Аудиторуудын мэргэжлийн хөгжлийн сургалт амжилттай явагдлаа",
        content:
          "<p>Дотоод Аудитын Газрын нийт 24 аудитор мэргэжлийн хөгжлийн сургалтад хамрагдлаа.</p><ul><li>Data analytics ашиглан аудит хийх арга зүй</li><li>Эрсдэлд суурилсан аудитын шинэ стандарт (IIA 2024)</li><li>SQL болон Python ашиглан аудитын өгөгдөл шинжлэх</li></ul>",
        category: "Үйл явдал",
        imageUrl:
          "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 196,
        createdAt: daysAgo(8),
        updatedAt: daysAgo(8),
      },
      {
        id: randomUUID(),
        title: "Цахим банкны дижитал аюулгүй байдлын аудит дуусгавар болов",
        content:
          "<p>Мэдээллийн Технологийн Аудитын Хэлтэс нь цахим банкны бүх системийн иж бүрэн аудитыг 2026 оны 1 дүгээр сард дуусгав.</p><ul><li>Mbank mobile application</li><li>Internet banking платформ</li><li>API gateway болон middleware</li></ul>",
        category: "Үйл явдал",
        imageUrl:
          "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 631,
        createdAt: daysAgo(15),
        updatedAt: daysAgo(15),
      },
      {
        id: randomUUID(),
        title: "Аудитын хорооны хурал: 2026 оны аудитын төлөвлөгөө батлагдав",
        content:
          "<p>Голомт Банкны Аудитын Хороо 2026 оны 1 сарын 30-нд хуралдаж, жилийн аудитын цогц төлөвлөгөөг баталлаа.</p><ul><li><strong>Санхүүгийн аудит</strong> — 12 нэгжид</li><li><strong>ИТ аудит</strong> — 8 систем</li><li><strong>AML/CFT дагаж мөрдөх аудит</strong></li></ul>",
        category: "Ерөнхий",
        imageUrl:
          "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 489,
        createdAt: daysAgo(20),
        updatedAt: daysAgo(20),
      },
      {
        id: randomUUID(),
        title:
          "Дата аналитикс ашиглан аудитын үр нөлөөг хэрхэн нэмэгдүүлэх вэ",
        content:
          "<p>Голомт Банкны Дата Анализын Алба болон Дотоод Аудитын Газар хамтран дараах хэрэгслийг нэвтрүүлсэн:</p><ul><li><strong>SQL-д суурилсан гүйлгээний хяналт</strong></li><li><strong>Аномали илрүүлэх загвар</strong> — ML</li><li><strong>ClickHouse дата агуулах</strong></li></ul>",
        category: "Ерөнхий",
        imageUrl:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 754,
        createdAt: daysAgo(25),
        updatedAt: daysAgo(25),
      },
      {
        id: randomUUID(),
        title: "Эрсдэлийн удирдлагын шинэ арга зүй нэвтрүүлэв",
        content:
          "<p>Дотоод Аудитын Газар нь байгууллагын эрсдэлийн удирдлагын процессыг шинэчлэн боловсруулж, 2026 оноос эхлэн хэрэгжүүлж байна.</p><ul><li><strong>Эрсдэлийн үнэлгээний матриц</strong> шинэчлэгдлээ</li><li><strong>Хяналтын орчны тогтолцоо</strong> бэхжлээ</li><li>Аудитын 3 шугамын загварыг нэвтрүүлэв</li></ul>",
        category: "Мэдэгдэл",
        imageUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 423,
        createdAt: daysAgo(30),
        updatedAt: daysAgo(30),
      },
    ];

    for (const article of articles) {
      await client.insert({
        table: `${CLICKHOUSE_DATABASE}.news`,
        values: [article],
        format: "JSONEachRow",
      });
      console.log(`  ✓ ${article.title.substring(0, 55)}...`);
    }
    console.log(`  ✅ ${articles.length} news articles inserted`);

    // ── STEP 5: External DB schemas (FINACLE, ERP, CARDZONE, EBANK) ─────────
    console.log("\n🗄️  Setting up external database schemas...");

    // FINACLE — гол банкны систем
    await client.exec({ query: `CREATE DATABASE IF NOT EXISTS FINACLE` });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS FINACLE.customers (
          customer_id     String,
          cif_number      String,
          first_name      String,
          last_name       String,
          register_number String,
          phone           String,
          email           String,
          address         String,
          customer_type   String,
          status          String DEFAULT 'ACTIVE',
          opened_date     Date,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY customer_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS FINACLE.accounts (
          account_id      String,
          customer_id     String,
          account_number  String,
          account_type    String,
          currency        String DEFAULT 'MNT',
          balance         Decimal(18, 2) DEFAULT 0,
          available_balance Decimal(18, 2) DEFAULT 0,
          status          String DEFAULT 'ACTIVE',
          open_date       Date,
          close_date      Nullable(Date),
          branch_code     String,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY account_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS FINACLE.transactions (
          txn_id          String,
          account_id      String,
          txn_date        DateTime,
          value_date      Date,
          txn_type        String,
          debit_credit    String,
          amount          Decimal(18, 2),
          currency        String DEFAULT 'MNT',
          balance_after   Decimal(18, 2),
          description     String,
          channel         String,
          reference_no    String,
          teller_id       String,
          branch_code     String,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (account_id, txn_date)`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS FINACLE.loans (
          loan_id         String,
          customer_id     String,
          account_id      String,
          loan_type       String,
          principal       Decimal(18, 2),
          outstanding     Decimal(18, 2),
          interest_rate   Decimal(6, 4),
          term_months     UInt16,
          disbursement_date Date,
          maturity_date   Date,
          status          String DEFAULT 'ACTIVE',
          classification  String DEFAULT 'NORMAL',
          branch_code     String,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY loan_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS FINACLE.deposits (
          deposit_id      String,
          customer_id     String,
          account_id      String,
          deposit_type    String,
          amount          Decimal(18, 2),
          currency        String DEFAULT 'MNT',
          interest_rate   Decimal(6, 4),
          start_date      Date,
          maturity_date   Date,
          status          String DEFAULT 'ACTIVE',
          auto_renew      UInt8 DEFAULT 0,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY deposit_id`,
    });

    console.log(
      "  ✅ FINACLE: customers, accounts, transactions, loans, deposits",
    );

    // ERP — корпорат удирдлагын систем
    await client.exec({ query: `CREATE DATABASE IF NOT EXISTS ERP` });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ERP.employees (
          emp_id          String,
          emp_code        String,
          first_name      String,
          last_name       String,
          register_number String,
          department      String,
          position        String,
          manager_id      String,
          hire_date       Date,
          status          String DEFAULT 'ACTIVE',
          employment_type String DEFAULT 'FULL_TIME',
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY emp_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ERP.payroll (
          payroll_id      String,
          emp_id          String,
          pay_period      String,
          basic_salary    Decimal(14, 2),
          overtime        Decimal(14, 2),
          bonus           Decimal(14, 2),
          deductions      Decimal(14, 2),
          net_salary      Decimal(14, 2),
          payment_date    Date,
          status          String DEFAULT 'PAID',
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (emp_id, pay_period)`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ERP.vendors (
          vendor_id       String,
          vendor_code     String,
          company_name    String,
          register_number String,
          contact_person  String,
          phone           String,
          email           String,
          category        String,
          status          String DEFAULT 'ACTIVE',
          approved_date   Date,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY vendor_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ERP.purchase_orders (
          po_id           String,
          vendor_id       String,
          po_date         Date,
          delivery_date   Date,
          total_amount    Decimal(18, 2),
          currency        String DEFAULT 'MNT',
          status          String DEFAULT 'PENDING',
          approved_by     String,
          department      String,
          description     String,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY po_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ERP.assets (
          asset_id        String,
          asset_code      String,
          asset_name      String,
          category        String,
          purchase_date   Date,
          purchase_price  Decimal(14, 2),
          current_value   Decimal(14, 2),
          depreciation_rate Decimal(6, 4),
          location        String,
          custodian_id    String,
          status          String DEFAULT 'IN_USE',
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY asset_id`,
    });

    console.log(
      "  ✅ ERP: employees, payroll, vendors, purchase_orders, assets",
    );

    // CARDZONE — карт менежментийн систем
    await client.exec({ query: `CREATE DATABASE IF NOT EXISTS CARDZONE` });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS CARDZONE.cards (
          card_id         String,
          card_number     String,
          customer_id     String,
          account_id      String,
          card_type       String,
          card_brand      String,
          status          String DEFAULT 'ACTIVE',
          issue_date      Date,
          expiry_date     Date,
          credit_limit    Nullable(Decimal(14, 2)),
          outstanding     Decimal(14, 2) DEFAULT 0,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY card_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS CARDZONE.card_transactions (
          txn_id          String,
          card_id         String,
          txn_datetime    DateTime,
          merchant_id     String,
          merchant_name   String,
          mcc_code        String,
          amount          Decimal(14, 2),
          currency        String,
          mnt_amount      Decimal(14, 2),
          txn_type        String,
          auth_code       String,
          response_code   String,
          channel         String,
          country_code    String,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (card_id, txn_datetime)`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS CARDZONE.merchants (
          merchant_id     String,
          merchant_name   String,
          merchant_name_mn String,
          mcc_code        String,
          category        String,
          address         String,
          terminal_count  UInt16 DEFAULT 0,
          status          String DEFAULT 'ACTIVE',
          contract_date   Date,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY merchant_id`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS CARDZONE.disputes (
          dispute_id      String,
          card_id         String,
          txn_id          String,
          dispute_date    DateTime,
          dispute_reason  String,
          amount          Decimal(14, 2),
          status          String DEFAULT 'OPEN',
          resolution      String,
          resolved_date   Nullable(DateTime),
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY dispute_id`,
    });

    console.log("  ✅ CARDZONE: cards, card_transactions, merchants, disputes");

    // EBANK — цахим банкны систем
    await client.exec({ query: `CREATE DATABASE IF NOT EXISTS EBANK` });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS EBANK.sessions (
          session_id      String,
          customer_id     String,
          device_id       String,
          device_type     String,
          os              String,
          app_version     String,
          ip_address      String,
          login_at        DateTime,
          logout_at       Nullable(DateTime),
          duration_sec    UInt32 DEFAULT 0,
          status          String DEFAULT 'ACTIVE',
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (customer_id, login_at)`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS EBANK.transfers (
          transfer_id     String,
          session_id      String,
          customer_id     String,
          from_account    String,
          to_account      String,
          bank_code       String DEFAULT 'GLMT',
          amount          Decimal(14, 2),
          currency        String DEFAULT 'MNT',
          fee             Decimal(10, 2) DEFAULT 0,
          description     String,
          status          String DEFAULT 'SUCCESS',
          channel         String DEFAULT 'MOBILE',
          initiated_at    DateTime,
          completed_at    Nullable(DateTime),
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (customer_id, initiated_at)`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS EBANK.beneficiaries (
          beneficiary_id  String,
          customer_id     String,
          nickname        String,
          account_number  String,
          bank_code       String,
          bank_name       String,
          is_favorite     UInt8 DEFAULT 0,
          last_used_at    Nullable(DateTime),
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (customer_id, beneficiary_id)`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS EBANK.notifications (
          notification_id String,
          customer_id     String,
          type            String,
          title           String,
          body            String,
          is_read         UInt8 DEFAULT 0,
          sent_at         DateTime,
          read_at         Nullable(DateTime),
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (customer_id, sent_at)`,
    });

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS EBANK.login_attempts (
          attempt_id      String,
          customer_id     String,
          ip_address      String,
          device_id       String,
          success         UInt8,
          fail_reason     String,
          attempted_at    DateTime,
          created_at      DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (customer_id, attempted_at)`,
    });

    console.log(
      "  ✅ EBANK: sessions, transfers, beneficiaries, notifications, login_attempts",
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    const [totalDepts, totalUsers, totalNews] = await Promise.all([
      countRows(client, "departments"),
      countRows(client, "users"),
      countRows(client, "news"),
    ]);
    console.log("\n📊 Current state:");
    console.log(`  • ${totalDepts} departments`);
    console.log(`  • ${totalUsers} users`);
    console.log(`  • ${totalNews} news articles`);
  } catch (error: any) {
    console.error("\n❌ Seed failed:", error.message);
    throw error;
  } finally {
    await client.close();
  }
}

seedClickHouse()
  .then(() => {
    console.log("\n🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
