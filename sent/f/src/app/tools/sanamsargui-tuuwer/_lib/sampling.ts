// ── Types ─────────────────────────────────────────────────────────────────────
export type DesignType = "srswr" | "srswor" | "prop" | "nonprop";

export const DESIGN_LABELS: Record<DesignType, string> = {
  srswr: "1. Буцаалттай энгийн санамсаргүй (SRSWR)",
  srswor: "2. Буцаалтгүй энгийн санамсаргүй (SRSWOR)",
  prop: "3. Пропорциональ",
  nonprop: "4. Пропорциональ биш",
};

export interface GroupResult {
  label: string;
  indices: number[];
  rows: unknown[][];
  size?: number;
}

export interface SamplingResult {
  n: number;
  N: number;
  Z: number;
  design: DesignType;
  confidence: number;
  margin: number;
  stdDev: number;
  groups: GroupResult[];
  headers: string[];
}

// ── Z-score from confidence level ─────────────────────────────────────────────
export function getZ(cl: number): number {
  const p = 1 - (1 - cl) / 2;
  if (p >= 1) return 3.5;
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  return parseFloat((t - num / den).toFixed(4));
}

// ── Formulas ──────────────────────────────────────────────────────────────────
export function calcSampleSize(
  N: number,
  Z: number,
  E: number,
  stdDev: number,
): number {
  const e = E / 100;
  const n0 = Math.pow((Z * stdDev) / e, 2);
  return Math.round(n0 / (1 + (n0 - 1) / N));
}

export function calcStratifiedSampleSize(
  N: number,
  Z: number,
  E: number,
): number {
  const e = E / 100;
  const p = 0.05;
  const n0 = (Z * Z * p * (1 - p)) / (e * e);
  return Math.round(n0 / (1 + (n0 - 1) / N));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function normalizeFilterValue(value: unknown): string {
  if (value == null) return "(хоосон)";
  const str = String(value).trim();
  return str.length ? str : "(хоосон)";
}

export function sampleWithReplacement(total: number, k: number): number[] {
  return Array.from({ length: k }, () => Math.floor(Math.random() * total) + 1);
}

export function sampleWithoutReplacement(total: number, k: number): number[] {
  k = Math.min(k, total);
  const arr = Array.from({ length: total }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k).sort((a, b) => a - b);
}

// ── CSV Export ────────────────────────────────────────────────────────────────
export const LARGE_EXPORT_ROW_THRESHOLD = 20_000;

function toCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildCsvContent(
  result: SamplingResult,
  isStratified: boolean,
): string {
  const lines: string[] = [];
  lines.push(`Дизайн,${toCsvCell(result.design)}`);
  lines.push(`Түүврийн хэмжээ (n),${result.n}`);
  lines.push(`Хүн ам (N),${result.N}`);
  lines.push(`Итгэлийн түвшин,${(result.confidence * 100).toFixed(0)}%`);
  lines.push(`Алдааны марж,${result.margin}%`);
  lines.push("");

  for (const g of result.groups) {
    lines.push(`Бүлэг,${toCsvCell(g.label)}`);
    if (isStratified) {
      lines.push("Мөр №,Санамсаргүй хувьсагч");
      for (const idx of g.indices) {
        lines.push(`${idx},${idx}`);
      }
    } else {
      lines.push(["Мөр №", ...result.headers].map(toCsvCell).join(","));
      g.indices.forEach((idx, i) => {
        const row = g.rows[i] ?? [];
        const cells = [idx, ...result.headers.map((_, ci) => row[ci] ?? "")];
        lines.push(cells.map(toCsvCell).join(","));
      });
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function logExportFailure(
  reason: string,
  error?: unknown,
  extra?: Record<string, unknown>,
) {
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const payload = {
    reason,
    timestamp: new Date().toISOString(),
    userAgent,
    ...extra,
  };

  if (error instanceof Error) {
    console.error("[SanamsarguiTuuwer][Export]", payload, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  if (error) {
    console.error("[SanamsarguiTuuwer][Export]", payload, { error });
    return;
  }

  console.warn("[SanamsarguiTuuwer][Export]", payload);
}
