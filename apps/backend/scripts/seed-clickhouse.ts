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

async function seedClickHouse() {
  console.log("🌱 Starting ClickHouse seed...");
  console.log(`📍 Connecting to: ${CLICKHOUSE_HOST}`);

  // Connect without specifying database first (to create it)
  const client = createClient({
    url: CLICKHOUSE_HOST,
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
  });

  try {
    // Test connection
    const versionResult = await client.query({
      query: "SELECT version() as version",
    });
    const versionData: any = await versionResult.json();
    console.log(
      `✅ Connected to ClickHouse version: ${versionData.data[0].version}`,
    );

    // Create database and tables
    console.log(`\n🗄️  Creating database ${CLICKHOUSE_DATABASE}...`);
    await client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}`,
    });
    console.log(`✅ Database ${CLICKHOUSE_DATABASE} ready`);

    // Create departments table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.departments (
          id String,
          name String,
          description String,
          manager String,
          employeeCount UInt32 DEFAULT 0,
          createdAt DateTime DEFAULT now(),
          updatedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY id
      `,
    });

    // Create users table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.users (
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
      `,
    });

    // Create audit_logs table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.audit_logs (
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
      `,
    });

    console.log("✅ Tables created");

    // Create departments
    console.log("\n📦 Seeding departments...");
    const departments = [
      {
        id: randomUUID(),
        name: "Удирдлага",
        description: "Удирдах албаны хэлтэс",
        manager: "Удирдах газар",
        employeeCount: 0,
      },
      {
        id: randomUUID(),
        name: "Дата анализын алба",
        description: "Өгөгдлийн шинжилгээ хийх хэлтэс",
        manager: "",
        employeeCount: 0,
      },
      {
        id: randomUUID(),
        name: "Ерөнхий аудитын хэлтэс",
        description: "Ерөнхий аудит хийх хэлтэс",
        manager: "",
        employeeCount: 0,
      },
      {
        id: randomUUID(),
        name: "Зайны аудит чанарын баталгаажуулалтын хэлтэс",
        description: "Зайны аудит хийх болон чанар баталгаажуулах хэлтэс",
        manager: "",
        employeeCount: 0,
      },
      {
        id: randomUUID(),
        name: "Мэдээллийн технологийн аудитын хэлтэс",
        description: "IT аудит хийх хэлтэс",
        manager: "",
        employeeCount: 0,
      },
    ];

    for (const dept of departments) {
      await client.insert({
        table: `${CLICKHOUSE_DATABASE}.departments`,
        values: [
          {
            ...dept,
            createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
            updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          },
        ],
        format: "JSONEachRow",
      });
      console.log(`  ✓ ${dept.name}`);
    }

    // Create admin user
    console.log("\n👤 Creating admin user...");
    const adminPassword = await bcrypt.hash("admin123", 10);
    const adminId = randomUUID();
    const adminDepartment = departments[0]; // Удирдлага

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
          departmentId: adminDepartment.id,
          isAdmin: 1,
          isActive: 1,
          allowedTools: JSON.stringify(["todo", "fitness"]),
          createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        },
      ],
      format: "JSONEachRow",
    });

    // Update department employee count
    await client.exec({
      query: `ALTER TABLE ${CLICKHOUSE_DATABASE}.departments UPDATE employeeCount = 1 WHERE id = '${adminDepartment.id}'`,
    });

    console.log("  ✓ Admin user created");
    console.log("    Email: admin@internal.local");
    console.log("    Password: admin123");
    console.log("    User ID: .Admin-DAG");

    // Create sample user
    console.log("\n👤 Creating sample user...");
    const userPassword = await bcrypt.hash("user123", 10);
    const userId = randomUUID();
    const userDepartment = departments[1]; // Дата анализын алба

    await client.insert({
      table: `${CLICKHOUSE_DATABASE}.users`,
      values: [
        {
          id: userId,
          userId: "DAA-TestUser",
          email: "testuser@internal.local",
          password: userPassword,
          name: "Test User",
          position: "Data Analyst",
          profileImage: "",
          departmentId: userDepartment.id,
          isAdmin: 0,
          isActive: 1,
          allowedTools: JSON.stringify(["todo", "fitness"]),
          createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        },
      ],
      format: "JSONEachRow",
    });

    // Update department employee count
    await client.exec({
      query: `ALTER TABLE ${CLICKHOUSE_DATABASE}.departments UPDATE employeeCount = 1 WHERE id = '${userDepartment.id}'`,
    });

    // Create news table (also created by ClickHouseService but needed here for seeding)
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.news (
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
      `,
    });

    // Seed news articles
    console.log("\n📰 Seeding news articles...");
    const newsArticles = [
      {
        id: randomUUID(),
        title: "Дотоод аудитын газрын 2025 оны үйл ажиллагааны тайлан",
        content: `<p>Голомт Банкны Дотоод Аудитын Газар нь 2025 оны жилийн эцсийн үйл ажиллагааны тайланг дуусгаж, удирдлагын зөвлөлд танилцуулсан байна.</p>
<p>Тайланд туссан гол үзүүлэлтүүд:</p>
<ul>
  <li>Нийт <strong>48 аудитын ажил</strong> хийгдэж, 312 зөвлөмж өгөгдсөн</li>
  <li>Зөвлөмжийн хэрэгжилт <strong>87%</strong>-д хүрсэн</li>
  <li>Эрсдэлийн удирдлагын үнэлгээний дундаж оноо <strong>4.2/5.0</strong></li>
  <li>ИТ аудит, санхүүгийн аудит, дотоод хяналтын аудит зэрэг чиглэлээр тус тус ажиллалаа</li>
</ul>
<p>2026 онд аудитын ажлыг улам боловсронгуй болгох, хиймэл оюун ухааны хэрэгслийг ашиглан аудитын үр нөлөөг нэмэгдүүлэх зорилтыг тавьж байна.</p>`,
        category: "Мэдэгдэл",
        imageUrl:
          "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 342,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
      {
        id: randomUUID(),
        title: "Хиймэл оюун ухаан ба аудит: 2026 оны тулгамдсан асуудлууд",
        content: `<p>Дэлхий даяар банк санхүүгийн байгууллагуудын дотоод аудиторууд хиймэл оюун ухааны эрсдэлийг удирдахад тулгамдсан шинэ сорилтуудтай нүүр тулж байна.</p>
<p>Олон улсын Дотоод Аудиторуудын Хүрээлэнгийн (IIA) судалгаанаас харахад 2026 онд аудиторуудын тэргүүлэх чиглэл нь:</p>
<ul>
  <li><strong>Генератив AI-ийн эрсдэл</strong> — ChatGPT болон бусад хэрэгслийн хяналт</li>
  <li><strong>Кибер аюулгүй байдал</strong> — Дата зөрчлийн шалгалт</li>
  <li><strong>ESG тайлагнал</strong> — Тогтвортой байдлын аудит</li>
  <li><strong>Автоматжуулсан аудит</strong> — Continuous monitoring</li>
</ul>
<p>Манай газар энэ чиглэлд мэргэжлийн хөгжлийг эрчимжүүлж, 2026 онд ИТ аудитын хэвийн ажиллагааг бэхжүүлэхээр ажиллаж байна.</p>`,
        category: "Ерөнхий",
        imageUrl:
          "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 518,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
      {
        id: randomUUID(),
        title: "Мэдээллийн технологийн аудитын шинэ журам батлагдлаа",
        content: `<p>Дотоод Аудитын Газрын дарга нар 2026 оны 2 дугаар сарын 15-нд Мэдээллийн технологийн аудитын шинэчлэгдсэн журмыг баталж, даруй хэрэгжүүлж эхэллээ.</p>
<p><strong>Шинэ журмын гол өөрчлөлтүүд:</strong></p>
<ol>
  <li>Кибер аюулгүй байдлын аудитыг жилд дор хаяж 2 удаа хийх</li>
  <li>Системийн нэвтрэх эрхийн хяналтыг улирал бүр шалгах</li>
  <li>Гуравдагч талын vendors-ийн аюулгүй байдлын үнэлгээ хийх</li>
  <li>Аудитын ажлын хэрэгслийг клауд руу шилжүүлэх төлөвлөгөө</li>
</ol>
<p>Журам нь 2026 оны 3 дугаар сарын 1-нээс хүчин төгөлдөр болно.</p>`,
        category: "Мэдэгдэл",
        imageUrl:
          "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 287,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
      {
        id: randomUUID(),
        title: "Аудиторуудын мэргэжлийн хөгжлийн сургалт амжилттай явагдлаа",
        content: `<p>Дотоод Аудитын Газрын нийт 24 аудитор 2026 оны 2 дугаар сарын 10–14-ний хооронд явагдсан мэргэжлийн хөгжлийн сургалтад хамрагдлаа.</p>
<p>Сургалтын агуулга:</p>
<ul>
  <li>Data analytics ашиглан аудит хийх арга зүй</li>
  <li>Эрсдэлд суурилсан аудитын шинэ стандарт (IIA 2024)</li>
  <li>SQL болон Python ашиглан аудитын өгөгдөл шинжлэх</li>
  <li>Фрод илрүүлэх практик дасгал</li>
</ul>
<p>Сургалтыг KPMG Mongolia-ийн зөвлөхүүд удирдан явуулсан бөгөөд дараагийн сургалт 5 дугаар сард болно.</p>`,
        category: "Үйл явдал",
        imageUrl:
          "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 196,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
      {
        id: randomUUID(),
        title: "Санхүүгийн тайлангийн баталгаажуулалтын шинэчилсэн заавар",
        content: `<p>Монгол Банкны зохицуулалтын шинэчлэлтэй уялдуулан Голомт Банкны Дотоод Аудитын Газар санхүүгийн тайлангийн баталгаажуулалтын дотоод зааврыг шинэчиллээ.</p>
<p>Шинэчилсэн зааварт туссан чухал өөрчлөлтүүд:</p>
<ul>
  <li>IFRS 17 болон IFRS 9 стандартад нийцсэн шалгалтын жагсаалт</li>
  <li>Зээлийн эрсдэлийн нөөцийн тооцооны аудитын арга зүй</li>
  <li>Криптовалютын байрлалтай холбоотой шинэ ажиллагаа</li>
  <li>Цахим банкны гүйлгээний аудитын чиглэл</li>
</ul>
<p>Заавар нь ойрын хоёр долоо хоногт бүх аудиторт тарааж, хэлэлцүүлэг зохиогдоно.</p>`,
        category: "Танилцуулга",
        imageUrl:
          "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 423,
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
      {
        id: randomUUID(),
        title: "Цахим банкны дижитал аюулгүй байдлын аудит дуусгавар болов",
        content: `<p>Мэдээллийн Технологийн Аудитын Хэлтэс нь Голомт Банкны цахим банкны бүх системийн иж бүрэн дижитал аюулгүй байдлын аудитыг 2026 оны 1 дүгээр сард дуусгав.</p>
<p>Аудитын үр дүнд 3 өндөр эрсдэлтэй асуудал, 8 дунд эрсдэлтэй асуудал илрүүлж, хариуцах хэлтсүүдэд зөвлөмж өгсөн. Аудитад хамрагдсан системүүд:</p>
<ul>
  <li>Mbank mobile application</li>
  <li>Internet banking платформ</li>
  <li>API gateway болон middleware</li>
  <li>Core banking системтэй холбоо</li>
</ul>
<p>Зөвлөмжүүдийн хэрэгжилт 2026 оны 2 дугаар улиралд шалгагдана.</p>`,
        category: "Үйл явдал",
        imageUrl:
          "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 631,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
      {
        id: randomUUID(),
        title: "Аудитын хорооны хурал: 2026 оны аудитын төлөвлөгөө батлагдав",
        content: `<p>Голомт Банкны Аудитын Хороо 2026 оны 1 дүгээр сарын 30-нд хуралдаж, жилийн аудитын цогц төлөвлөгөөг баталлаа.</p>
<p>2026 оны аудитын гол чиглэлүүд:</p>
<ul>
  <li><strong>Санхүүгийн аудит</strong> — 12 нэгжид</li>
  <li><strong>ИТ аудит</strong> — 8 систем, 4 project</li>
  <li><strong>Дагаж мөрдөх байдлын аудит</strong> — AML/CFT, GDPR</li>
  <li><strong>Үйл ажиллагааны аудит</strong> — 6 чиглэл</li>
</ul>
<p>Нийт 52 аудитын ажил төлөвлөгдсөн бөгөөд ажилтнуудын нэмэгдүүлэх хүсэлт хорооны хуралд хүлээн авагдсан байна.</p>`,
        category: "Ерөнхий",
        imageUrl:
          "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 489,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
      {
        id: randomUUID(),
        title: "Дата аналитикс ашиглан аудитын үр нөлөөг хэрхэн нэмэгдүүлэх вэ",
        content: `<p>Орчин үеийн аудит нь мэдээллийн технологи, өгөгдөл шинжлэлтийг идэвхтэй ашиглах замаар уламжлалт аргачлалаас хальж, илүү гүнзгий дүн шинжилгээ хийх боломжтой болж байна.</p>
<p>Голомт Банкны Дата Анализын Алба болон Дотоод Аудитын Газар хамтран дараах хэрэгслийг нэвтрүүлсэн:</p>
<ul>
  <li><strong>SQL-д суурилсан гүйлгээний хяналт</strong> — 7.2 сая гүйлгээг автоматаар шинжилдэг</li>
  <li><strong>Аномали илрүүлэх загвар</strong> — Machine learning ашигласан</li>
  <li><strong>ClickHouse дата агуулах</strong> — Аудитын лог бүртгэл</li>
</ul>
<p>Энэ системийн ачаар аудиторуудын гарын ажлын цаг 40%-иар буурч, илрүүлгийн чанар мэдэгдэхүйц сайжирсан байна.</p>`,
        category: "Ерөнхий",
        imageUrl:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
        authorId: adminId,
        isPublished: 1,
        views: 754,
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        updatedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      },
    ];

    for (const article of newsArticles) {
      await client.insert({
        table: `${CLICKHOUSE_DATABASE}.news`,
        values: [article],
        format: "JSONEachRow",
      });
      console.log(`  ✓ ${article.title.substring(0, 50)}...`);
    }

    console.log(`✅ ${newsArticles.length} news articles seeded`);
    console.log("\n📊 Summary:");
    console.log(`  • ${departments.length} departments created`);
    console.log("  • 2 users created (1 admin, 1 regular user)");
  } catch (error: any) {
    console.error("\n❌ Seed failed:", error.message);
    throw error;
  } finally {
    await client.close();
  }
}

// Run seed
seedClickHouse()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
