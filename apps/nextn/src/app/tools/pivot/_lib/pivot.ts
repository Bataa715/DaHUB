/**
 * Pivot туслах функцууд (цэвэр, side-effect-гүй) — page.tsx-ээс задалж гаргав.
 */

// ─── Inverse normal CDF (Abramowitz & Stegun)
export function getZ(cl: number): number {
  const p = 1 - (1 - cl) / 2;
  if (p >= 1) return 3.5;
  if (p <= 0) return 0;
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  const z = t - num / den;
  return p < 0.5 ? -z : z;
}

// sample_size(population, confidence, margin_error, p=0.5)
// n0 = Z² * p * (1-p) / E²
// n  = n0 / (1 + (n0-1) / population)
// return math.ceil(n)
export function calcSampleSize(
  population: number,
  confidence: number,
  marginError: number,
  p = 0.5,
): number {
  if (population <= 0) return 0;
  const Z = getZ(confidence);
  const n0 = (Z * Z * p * (1 - p)) / (marginError * marginError);
  const n = n0 / (1 + (n0 - 1) / population);
  return Math.ceil(n);
}

// Fisher–Yates shuffle — bias-гүй санамсаргүй түүвэр.
// (arr.sort(() => Math.random() - 0.5) нь статистикийн хувьд bias-тай!)
export function fisherYatesSample<T>(arr: T[], k: number): T[] {
  const a = [...arr];
  const n = Math.min(k, a.length);
  for (let i = a.length - 1; i > a.length - 1 - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(a.length - n);
}

// Extract prefix: first `len` chars of the value, uppercase. Skips empty values.
export function extractCode(value: unknown, len: number): string {
  const s =
    typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!s) return "";
  return s.slice(0, len).toUpperCase();
}

// Parse CSV text into rows (handles quoted fields)
export function parseCsv(text: string): unknown[][] {
  const rows: unknown[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

// Extract 4-digit year from various date representations
export function toYear(value: unknown): number | null {
  if (value == null) return null;
  // ExcelJS returns date cells as Date objects
  if (value instanceof Date) {
    return value.getFullYear();
  }
  if (typeof value === "number") {
    // Excel serial date: Unix epoch = serial 25569 (Jan 1 1970)
    try {
      const d = new Date(Math.round((value - 25569) * 86400 * 1000));
      const y = d.getUTCFullYear();
      if (y >= 1900 && y <= 2100) return y;
    } catch {
      // ignore
    }
  }
  const str = String(value);
  const m = str.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

export interface PrefixRow {
  year: number;
  codeCounts: Record<string, number>;
  total: number;
  pct: number;
  sampleSize: number;
}

export interface PrefixGroup {
  prefix: string;
  rows: PrefixRow[];
  codes: string[];
}

export function buildPrefixGroups(
  data: unknown[][],
  headers: string[],
  dateCol: string,
  codeCol: string,
  confidence: number,
  marginError: number,
  prefixLen: number,
): PrefixGroup[] {
  const dateIdx = headers.indexOf(dateCol);
  const codeIdx = headers.indexOf(codeCol);
  if (dateIdx < 0 || codeIdx < 0) return [];

  // prefix → year → code → count
  const map: Record<string, Record<number, Record<string, number>>> = {};

  for (const row of data) {
    const rawCode = (row as unknown[])[codeIdx];
    const rawDate = (row as unknown[])[dateIdx];
    const prefix = extractCode(rawCode, prefixLen);
    if (!prefix) continue;
    const year = toYear(rawDate);
    if (year == null) continue;
    const code =
      typeof rawCode === "string" ? rawCode.trim() : String(rawCode ?? "");
    if (!map[prefix]) map[prefix] = {};
    if (!map[prefix][year]) map[prefix][year] = {};
    map[prefix][year][code] = (map[prefix][year][code] || 0) + 1;
  }

  return Object.keys(map)
    .sort()
    .map((prefix) => {
      const yearMap = map[prefix];
      const allCodes = Array.from(
        new Set(Object.values(yearMap).flatMap((y) => Object.keys(y))),
      ).sort();
      const rows: PrefixRow[] = Object.keys(yearMap)
        .map(Number)
        .sort()
        .map((year) => {
          const codeCounts = yearMap[year];
          const total = Object.values(codeCounts).reduce((s, v) => s + v, 0);
          return { year, codeCounts, total, pct: 0, sampleSize: 0 };
        });
      const totalAll = rows.reduce((s, r) => s + r.total, 0);
      rows.forEach((r) => {
        r.pct =
          totalAll > 0 ? Math.round((r.total / totalAll) * 10000) / 100 : 0;
        r.sampleSize = calcSampleSize(r.total, confidence, marginError);
      });
      return { prefix, rows, codes: allCodes };
    });
}
