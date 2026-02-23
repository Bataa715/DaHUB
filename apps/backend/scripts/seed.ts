import Database from "better-sqlite3";
import * as bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import * as path from "path";
import * as fs from "fs";

const dbPath =
  process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "audit.db");
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    manager TEXT,
    employeeCount INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    position TEXT,
    profileImage TEXT,
    departmentId TEXT REFERENCES departments(id),
    isAdmin INTEGER DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    allowedTools TEXT,
    lastLoginAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workout_logs (
    id TEXT PRIMARY KEY,
    exerciseId TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sets INTEGER,
    repetitions INTEGER,
    weight REAL,
    notes TEXT,
    date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS body_stats (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight REAL NOT NULL,
    height REAL NOT NULL,
    date TEXT DEFAULT (datetime('now'))
  );
`);

async function main() {
  console.log("🌱 Starting seed...");

  const hashedPassword = await bcrypt.hash("admin123", 10);

  // Upsert admin
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("admin@golomt.bank") as any;
  if (!existingAdmin) {
    db.prepare(
      `INSERT INTO users (id, userId, email, password, name, position, isAdmin, isActive)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
    ).run(
      uuid(),
      "ADMIN001",
      "admin@golomt.bank",
      hashedPassword,
      "Систем Админ",
      "Систем Администратор",
    );
    console.log("✅ Admin user created: admin@golomt.bank");
  } else {
    console.log("⏭️  Admin user already exists");
  }

  // Create departments
  const departments = [
    {
      name: "Удирдлага",
      description: "Удирдлагын албаны хэлтэс",
      manager: "TBD",
    },
    {
      name: "Data анализын алба",
      description: "Өгөгдлийн шинжилгээний хэлтэс",
      manager: "TBD",
    },
    {
      name: "Зээлийн аудит чанарын баталгаажуулалтын хэлтэс",
      description: "Зээлийн аудитын чанарын баталгаажуулалт",
      manager: "TBD",
    },
    {
      name: "Мэдээллийн технологийн аудитын хэлтэс",
      description: "IT аудитын хэлтэс",
      manager: "TBD",
    },
    {
      name: "Ерөнхий аудитын хэлтэс",
      description: "Ерөнхий аудитын хэлтэс",
      manager: "TBD",
    },
  ];

  const upsertDept = db.prepare(
    `INSERT INTO departments (id, name, description, manager)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO NOTHING`,
  );

  for (const dept of departments) {
    upsertDept.run(uuid(), dept.name, dept.description, dept.manager);
    console.log("✅ Department:", dept.name);
  }

  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
