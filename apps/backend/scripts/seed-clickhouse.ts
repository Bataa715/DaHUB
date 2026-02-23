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
  { name: "Дата анализын алба", description: "Өгөгдлийн шинжилгээ хийх хэлтэс" },
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
          id String, userId String, email String, password String,
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
      const managementDeptId =
        deptIdMap["Удирдлага"] ??
        Object.values(deptIdMap)[0] ??
        randomUUID();

      adminId = randomUUID();
      await client.insert({
        table: `${CLICKHOUSE_DATABASE}.users`,
        values: [
          {
            id: adminId,
            userId: ".Admin-DAG",
            email: "admin@internal.local",
            password: adminPassword,
            name: "Admin",
            position: "System Administrator",
            profileImage: "",
            departmentId: managementDeptId,
            isAdmin: 1,
            isActive: 1,
            allowedTools: JSON.stringify([]),
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
            email: "testuser@internal.local",
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
      console.log(`  ℹ️  ${newsCount} news articles exist — skipping`);
    } else {
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
          title: "Дата аналитикс ашиглан аудитын үр нөлөөг хэрхэн нэмэгдүүлэх вэ",
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
    }

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
