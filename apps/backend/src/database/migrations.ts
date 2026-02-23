/**
 * Database Migration System
 *
 * Migrations are run in order based on version number.
 * Each migration has up() and down() functions.
 *
 * HOW TO ADD A NEW MIGRATION:
 * 1. Add new migration object to migrations array
 * 2. Increment version number
 * 3. Write up() function (apply changes)
 * 4. Write down() function (rollback changes)
 * 5. Restart backend server
 */

import Database from "better-sqlite3";

export interface Migration {
  version: string;
  name: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

/**
 * All migrations in chronological order
 */
export const migrations: Migration[] = [
  // Example migration (commented out):
  // {
  //   version: '1.0.1',
  //   name: 'add_tasks_table',
  //   up: (db) => {
  //     db.exec(`
  //       CREATE TABLE IF NOT EXISTS tasks (
  //         id TEXT PRIMARY KEY,
  //         title TEXT NOT NULL,
  //         description TEXT,
  //         userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  //         status TEXT DEFAULT 'pending',
  //         priority TEXT DEFAULT 'medium',
  //         dueDate TEXT,
  //         completedAt TEXT,
  //         createdAt TEXT DEFAULT (datetime('now')),
  //         updatedAt TEXT DEFAULT (datetime('now'))
  //       );
  //       CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId);
  //       CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  //     `);
  //     console.log('  ✓ Tasks table created');
  //   },
  //   down: (db) => {
  //     db.exec('DROP TABLE IF EXISTS tasks;');
  //     console.log('  ✓ Tasks table dropped');
  //   },
  // },
  // {
  //   version: '1.0.2',
  //   name: 'add_priority_column_to_tasks',
  //   up: (db) => {
  //     db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium';`);
  //     console.log('  ✓ Priority column added to tasks');
  //   },
  //   down: (db) => {
  //     // SQLite doesn't support DROP COLUMN easily, so recreate table
  //     console.log('  ! Cannot rollback column addition in SQLite');
  //   },
  // },
];

/**
 * Create migrations tracking table
 */
export function createMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt TEXT DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Get list of applied migrations
 */
export function getAppliedMigrations(db: Database.Database): string[] {
  createMigrationsTable(db);
  const rows = db
    .prepare("SELECT version FROM migrations ORDER BY version")
    .all() as { version: string }[];
  return rows.map((r) => r.version);
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database) {
  if (migrations.length === 0) {
    console.log("  ℹ No migrations to run");
    return;
  }

  createMigrationsTable(db);
  const applied = getAppliedMigrations(db);

  const pending = migrations.filter((m) => !applied.includes(m.version));

  if (pending.length === 0) {
    console.log("  ✓ All migrations up to date");
    return;
  }

  console.log(`  🔄 Running ${pending.length} pending migration(s)...`);

  for (const migration of pending) {
    try {
      console.log(`  → Migration ${migration.version}: ${migration.name}`);
      migration.up(db);

      db.prepare("INSERT INTO migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name,
      );

      console.log(`  ✓ Migration ${migration.version} completed`);
    } catch (error: any) {
      console.error(
        `  ✗ Migration ${migration.version} failed:`,
        error.message,
      );
      throw error;
    }
  }

  console.log("  ✓ All migrations completed successfully");
}

/**
 * Rollback last migration
 */
export function rollbackLastMigration(db: Database.Database) {
  const applied = getAppliedMigrations(db);

  if (applied.length === 0) {
    console.log("  ℹ No migrations to rollback");
    return;
  }

  const lastVersion = applied[applied.length - 1];
  const migration = migrations.find((m) => m.version === lastVersion);

  if (!migration) {
    throw new Error(`Migration ${lastVersion} not found`);
  }

  console.log(
    `  🔄 Rolling back migration ${migration.version}: ${migration.name}`,
  );

  try {
    migration.down(db);
    db.prepare("DELETE FROM migrations WHERE version = ?").run(lastVersion);
    console.log(`  ✓ Migration ${migration.version} rolled back`);
  } catch (error: any) {
    console.error(`  ✗ Rollback failed:`, error.message);
    throw error;
  }
}
