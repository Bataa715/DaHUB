import type { DbChangeRowInput } from "@/lib/api";

/**
 * Oracle audit trail-ийн экспорт (өмнөх "DB analyze" системийн файлын бүтэц).
 * Толгойг том/жижиг үсэг ялгахгүй таньна.
 */
export const REQUIRED_COLUMNS = {
  username: "USERNAME",
  action: "ACTION",
  owner: "OWNER",
  actionTime: "TIMESTAMP",
  sqlText: "SQL_TEXT",
} as const;

export const OPTIONAL_COLUMNS = {
  machine: "MACHINE",
  objectName: "OBJECT_NAME",
  domain: "DOMAIN",
  sourceDescription: "DESCRIPTION",
  jira: "JIRA",
} as const;

type Field = keyof DbChangeRowInput;

const ALL_COLUMNS: Record<Field, string> = {
  ...REQUIRED_COLUMNS,
  ...OPTIONAL_COLUMNS,
};

// Backend DTO-ийн хязгаар — илүү урт утгыг таслахгүй бол бүх хэсэг 400 өгнө
const LIMITS: Record<Field, number> = {
  actionTime: 19,
  username: 255,
  machine: 255,
  action: 255,
  owner: 255,
  objectName: 255,
  domain: 255,
  sqlText: 50_000,
  sourceDescription: 2000,
  jira: 255,
};

export interface ParsedDbSheet {
  name: string;
  /** Олдоогүй заавал баганууд — хоосон бол хуудсыг оруулж болно */
  missing: string[];
  rows: DbChangeRowInput[];
  /** Огноо/USERNAME/ACTION-гүй тул алгасах мөр */
  invalid: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

function format(
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
): string {
  const date = new Date(Date.UTC(y, mo - 1, d));
  // 2026-02-30 гэх мэт бодит бус огноог хүлээж авахгүй
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d ||
    h > 23 ||
    mi > 59 ||
    s > 59
  )
    return "";
  return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
}

const to24h = (h: number, ampm?: string) => {
  if (!ampm) return h;
  const pm = ampm.toUpperCase() === "PM";
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
};

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[])
        .map((r) => r.text ?? "")
        .join("");
    }
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return cellText(v.text);
    return "";
  }
  return String(value);
}

/**
 * TIMESTAMP-ийг `YYYY-MM-DD HH:MM:SS` болгоно. Уншигдахгүй бол хоосон.
 * Excel огноо, serial тоо, ISO, Oracle (`10-SEP-26 10.23.45.000000 AM`),
 * `M/D/YYYY h:mm AM` хэлбэрүүдийг хүлээж авна.
 */
export function parseTimestamp(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    // exceljs огноог UTC-ээр өгдөг — файл дээрх цагийг яг хэвээр нь авна
    return format(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    );
  }
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return "";
    // Excel serial (1899-12-30-аас хойших өдөр, бутархай нь цаг)
    const ms = Math.round((value * 86_400_000) / 1000) * 1000;
    return parseTimestamp(new Date(Date.UTC(1899, 11, 30) + ms));
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return parseTimestamp((value as { result: unknown }).result);
  }

  const text = cellText(value).trim();
  if (!text) return "";

  let m = text.match(
    /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T](\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/,
  );
  if (m) {
    return format(
      +m[1],
      +m[2],
      +m[3],
      +(m[4] ?? 0),
      +(m[5] ?? 0),
      +(m[6] ?? 0),
    );
  }

  m = text.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})(?:\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2})(?:[.,]\d+)?)?\s*(AM|PM)?)?$/i,
  );
  if (m) {
    const month = MONTHS[m[2].toUpperCase()];
    if (!month) return "";
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return format(
      year,
      month,
      +m[1],
      to24h(+(m[4] ?? 0), m[7]),
      +(m[5] ?? 0),
      +(m[6] ?? 0),
    );
  }

  m = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (m) {
    return format(
      +m[3],
      +m[1],
      +m[2],
      to24h(+(m[4] ?? 0), m[7]),
      +(m[5] ?? 0),
      +(m[6] ?? 0),
    );
  }
  return "";
}

/** Ажлын номын хуудас бүрийг уншина. Толгой мөрийг эхний 10 мөрөөс хайна. */
export async function parseDbWorkbook(
  buffer: ArrayBuffer,
): Promise<ParsedDbSheet[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  return wb.worksheets.map((ws) => {
    let headerRow = -1;
    let columns: Partial<Record<Field, number>> = {};

    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
      const found: Partial<Record<Field, number>> = {};
      ws.getRow(r).eachCell((cell, col) => {
        const text = cellText(cell.value).trim().toUpperCase();
        for (const [field, header] of Object.entries(ALL_COLUMNS) as [
          Field,
          string,
        ][]) {
          if (text === header) found[field] = col;
        }
      });
      if (Object.keys(found).length > Object.keys(columns).length) {
        columns = found;
        headerRow = r;
      }
    }

    const missing = (Object.entries(REQUIRED_COLUMNS) as [Field, string][])
      .filter(([field]) => columns[field] === undefined)
      .map(([, header]) => header);
    if (missing.length || headerRow < 0)
      return { name: ws.name, missing, rows: [], invalid: 0 };

    const rows: DbChangeRowInput[] = [];
    let invalid = 0;
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const text = (field: Field) => {
        const col = columns[field];
        if (col === undefined) return "";
        return cellText(row.getCell(col).value).trim().slice(0, LIMITS[field]);
      };
      const out: DbChangeRowInput = {
        actionTime: parseTimestamp(row.getCell(columns.actionTime!).value),
        username: text("username"),
        machine: text("machine"),
        action: text("action"),
        owner: text("owner"),
        objectName: text("objectName"),
        domain: text("domain"),
        sqlText: text("sqlText"),
        sourceDescription: text("sourceDescription"),
        jira: text("jira"),
      };

      // Бүрэн хоосон мөр — тоолохгүй
      if (Object.values(out).every((v) => !v)) continue;
      // Эх систем шиг USERNAME / ACTION-гүй мөрийг алгасна
      if (!out.actionTime || !out.username || !out.action) {
        invalid++;
        continue;
      }
      rows.push(out);
    }
    return { name: ws.name, missing: [], rows, invalid };
  });
}
