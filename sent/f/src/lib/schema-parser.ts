import fs from "fs";
import path from "path";
import type {
  Column,
  DataDocDatabase,
  DatabaseTable,
  DatabaseSchema,
} from "./data-doc-types";

const DB_COLORS: Record<string, string> = {
  EBANK: "#06b6d4",
  ERP: "#a78bfa",
  FINACLE: "#fbbf24",
  CARDZONE: "#34d399",
};

export function parseSchema(): DatabaseSchema {
  const mdPath = process.env.MD_FILE_PATH
    ? path.resolve(process.cwd(), process.env.MD_FILE_PATH)
    : path.join(process.cwd(), "..", "..", "Data", "Database_Dictionary.md");

  let content: string;
  try {
    content = fs.readFileSync(mdPath, "utf-8");
  } catch {
    return {
      databases: [],
      totalTables: 0,
      totalColumns: 0,
      describedColumns: 0,
    };
  }

  const lines = content.split("\n");
  const databases: DataDocDatabase[] = [];
  let currentDb: DataDocDatabase | null = null;
  let currentTable: DatabaseTable | null = null;
  let inExampleSection = false;
  let inColumnTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inExampleSection) {
      if (
        trimmed.startsWith("###") ||
        trimmed.startsWith("##") ||
        trimmed === "<br>"
      ) {
        inExampleSection = false;
      } else {
        continue;
      }
    }

    if (trimmed.startsWith("## ") && trimmed.includes("🗄")) {
      const m = trimmed.match(/`([^`]+)`/);
      if (m) {
        currentDb = {
          name: m[1],
          tables: [],
          color: DB_COLORS[m[1]] || "#64748b",
        };
        databases.push(currentDb);
        currentTable = null;
        inColumnTable = false;
      }
      continue;
    }

    if (trimmed.startsWith("### ") && trimmed.includes("📋") && currentDb) {
      const nm = trimmed.match(/`([^`]+)`/);
      const cn = trimmed.match(/\((\d+)\s+багана/);
      if (nm && cn) {
        currentTable = {
          name: nm[1],
          database: currentDb.name,
          totalColumns: parseInt(cn[1]),
          columns: [],
        };
        currentDb.tables.push(currentTable);
        inColumnTable = false;
        inExampleSection = false;
      }
      continue;
    }

    if (trimmed.includes("Жишээ өгөгдөл")) {
      inExampleSection = true;
      inColumnTable = false;
      continue;
    }

    if (
      trimmed.startsWith("|") &&
      trimmed.includes("Баганын нэр") &&
      trimmed.includes("Төрөл")
    ) {
      inColumnTable = true;
      continue;
    }

    if (trimmed.match(/^\|[\s|:-]+\|$/) && inColumnTable) {
      continue;
    }

    if (inColumnTable && trimmed.startsWith("|") && currentTable) {
      const parts = trimmed
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 3) {
        const name = parts[0].replace(/\*\*/g, "").trim();
        const type = parts[1].replace(/`/g, "").trim();
        const rawDesc = parts.slice(2).join(" ").trim();
        const description = rawDesc === "—" || rawDesc === "" ? "" : rawDesc;
        if (name && type && !name.startsWith("-") && name.length > 0) {
          currentTable.columns.push({ name, type, description });
        }
      }
      continue;
    }

    if (
      !trimmed.startsWith("|") &&
      trimmed.length > 0 &&
      !trimmed.startsWith(">") &&
      !trimmed.startsWith("<") &&
      !trimmed.startsWith("#")
    ) {
      inColumnTable = false;
    }
  }

  const totalTables = databases.reduce((s, db) => s + db.tables.length, 0);
  const totalColumns = databases.reduce(
    (s, db) => s + db.tables.reduce((t, tbl) => t + tbl.totalColumns, 0),
    0,
  );
  const describedColumns = databases.reduce(
    (s, db) =>
      s +
      db.tables.reduce(
        (t, tbl) =>
          t + tbl.columns.filter((c) => c.description.length > 0).length,
        0,
      ),
    0,
  );

  return { databases, totalTables, totalColumns, describedColumns };
}

export function getMdPath(): string {
  return process.env.MD_FILE_PATH
    ? path.resolve(process.cwd(), process.env.MD_FILE_PATH)
    : path.join(process.cwd(), "..", "..", "Data", "Database_Dictionary.md");
}
