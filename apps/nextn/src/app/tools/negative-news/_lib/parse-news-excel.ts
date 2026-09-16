import type { NegativeNewsRowInput } from "@/lib/api";

/** Excel-ийн толгой мөрөнд байх ёстой багана (өмнөх системийн файлын бүтэц) */
export const REQUIRED_COLUMNS = {
  newsDate: "Мэдээллийн он сар",
  channel: "Мэдээллийн суваг",
  bank: "Банк",
  category: "Мэдээллийн ангилал",
  content: "Мэдээллийн агуулга",
} as const;

type Field = keyof typeof REQUIRED_COLUMNS;

export interface ParsedSheet {
  name: string;
  /** Олдоогүй баганууд — хоосон бол хуудсыг оруулж болно */
  missing: string[];
  rows: NegativeNewsRowInput[];
  /** Огноо/агуулга/банкгүй тул алгасах мөр */
  invalid: number;
}

// Backend DTO-ийн хязгаар — илүү урт утгыг таслахгүй бол бүх хэсэг 400 өгнө
const LIMITS: Record<Field, number> = {
  newsDate: 10,
  channel: 100,
  bank: 100,
  category: 200,
  content: 5000,
};

const pad = (n: number) => String(n).padStart(2, "0");

function cellText(value: unknown): string {
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

/** Огноог YYYY-MM-DD болгоно. Уншигдахгүй бол хоосон (мөрийг алгасна). */
function cellDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // exceljs огноог UTC-ээр өгдөг — цагийн бүсээс болж өдөр шилжихгүй
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    // Excel serial огноо (1899-12-30-аас хойших өдөр)
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return cellDate((value as { result: unknown }).result);
  }
  const text = cellText(value).trim();
  const m = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  return "";
}

const isRealDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

/** Ажлын номын хуудас бүрийг уншина. Толгой мөрийг эхний 10 мөрөөс хайна. */
export async function parseNewsWorkbook(
  buffer: ArrayBuffer,
): Promise<ParsedSheet[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  return wb.worksheets.map((ws) => {
    let headerRow = -1;
    const columns: Partial<Record<Field, number>> = {};

    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
      const found: Partial<Record<Field, number>> = {};
      ws.getRow(r).eachCell((cell, col) => {
        const text = cellText(cell.value).trim();
        for (const [field, header] of Object.entries(REQUIRED_COLUMNS) as [
          Field,
          string,
        ][]) {
          if (text === header) found[field] = col;
        }
      });
      if (Object.keys(found).length > Object.keys(columns).length) {
        Object.assign(columns, found);
        headerRow = r;
      }
      if (Object.keys(found).length === Object.keys(REQUIRED_COLUMNS).length)
        break;
    }

    const missing = (Object.entries(REQUIRED_COLUMNS) as [Field, string][])
      .filter(([field]) => columns[field] === undefined)
      .map(([, header]) => header);
    if (missing.length || headerRow < 0)
      return { name: ws.name, missing, rows: [], invalid: 0 };

    const rows: NegativeNewsRowInput[] = [];
    let invalid = 0;
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (field: Field) => row.getCell(columns[field]!).value;
      const content = cellText(get("content")).trim();
      const bank = cellText(get("bank")).trim();
      const channel = cellText(get("channel")).trim();
      const category = cellText(get("category")).trim();
      const newsDate = cellDate(get("newsDate"));

      // Бүрэн хоосон мөр — тоолохгүй
      if (!content && !bank && !channel && !category && !newsDate) continue;
      if (!isRealDate(newsDate) || !content || !bank) {
        invalid++;
        continue;
      }
      rows.push({
        newsDate,
        channel: channel.slice(0, LIMITS.channel),
        bank: bank.slice(0, LIMITS.bank),
        category: category.slice(0, LIMITS.category),
        content: content.slice(0, LIMITS.content),
      });
    }
    return { name: ws.name, missing: [], rows, invalid };
  });
}

/**
 * Backend-ийн body хязгаар (1MB)-аас доогуур байхаар хэсэглэнэ.
 * Кирилл үсэг UTF-8-д 2 байт тул тэмдэгтээр биш байтаар тооцно.
 */
export function chunkRows<T>(
  rows: T[],
  maxBytes = 700_000,
  maxRows = 1000,
): T[][] {
  const encoder = new TextEncoder();
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length + 1;
    if (
      current.length &&
      (bytes + size > maxBytes || current.length >= maxRows)
    ) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
