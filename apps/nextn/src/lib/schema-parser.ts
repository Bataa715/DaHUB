import fs from "fs";
import path from "path";
import type {
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

const MD_BASENAME = "Database_Dictionary.md";

/**
 * Build-д савлагдсан толь бичгийн боломжит байрлалууд.
 *
 * ⚠️ `output: "standalone"` үед энэ файл ӨӨРӨӨ орж ирдэггүй — Next нь зөвхөн
 * статикаар import хийсэн зүйлийг мөрддөг бол энэ нь ажиллах үед `fs`-ээр
 * уншигддаг. Тиймээс `next.config.ts`-д `outputFileTracingIncludes` заасан
 * бөгөөд Data/ хавтас standalone гаралтын ҮНДЭС дээр буудаг
 * (`.next/standalone/Data/...`), server нь `.next/standalone/apps/nextn`-ээс
 * ажилладаг тул доорх "../.." хувилбар түүнд таарна.
 */
function bundledCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "Data", MD_BASENAME),
    path.join(cwd, "..", "Data", MD_BASENAME),
    path.join(cwd, "..", "..", "Data", MD_BASENAME),
    path.join(cwd, "..", "..", "..", "Data", MD_BASENAME),
    path.join("/app", "Data", MD_BASENAME),
  ].map((p) => path.resolve(/*turbopackIgnore: true*/ p));
}

/** MD_FILE_PATH-ийг үнэмлэхүй зам болгож хөрвүүлнэ (тохируулаагүй бол null). */
function configuredPath(): string | null {
  const configured = process.env.MD_FILE_PATH?.trim();
  if (!configured) return null;
  return path.isAbsolute(configured)
    ? path.resolve(/*turbopackIgnore: true*/ configured)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
}

/**
 * Өгөгдлийн толь бичгийн MD файлын замыг олно.
 *
 * MD_FILE_PATH заасан бол ТЭР нь эрхэм — уг зам нь байнгын хадгалалт
 * (volume) дээр байрлах ёстой, эс бөгөөс tool-оос хийсэн засвар дараагийн
 * deploy дээр устана. Тэр файл хараахан байхгүй бол савлагдсан хувилбараас
 * НЭГ УДАА хуулж эхлүүлнэ (seed) — ингэснээр ops-д гар ажиллагаа шаардахгүй.
 */
export function getMdPath(): string {
  const configured = configuredPath();
  const bundled = bundledCandidates().find((p) =>
    fs.existsSync(/*turbopackIgnore: true*/ p),
  );

  if (configured) {
    if (fs.existsSync(/*turbopackIgnore: true*/ configured)) return configured;
    // Байнгын зам хоосон байна — савлагдсан хувилбараас нэг удаа үрждүүлнэ.
    if (bundled) {
      try {
        fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(configured), {
          recursive: true,
        });
        fs.copyFileSync(/*turbopackIgnore: true*/ bundled, configured);
        return configured;
      } catch {
        // Бичих эрхгүй / read-only FS — уншихад савлагдсан хувилбар руу ухарна.
        return bundled;
      }
    }
    return configured;
  }

  return (
    bundled ??
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), "Data", MD_BASENAME)
  );
}

export function parseSchema(): DatabaseSchema {
  const mdPath = getMdPath();

  let content: string;
  try {
    content = fs.readFileSync(/*turbopackIgnore: true*/ mdPath, "utf-8");
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
