import { Injectable, BadRequestException } from "@nestjs/common";
import {
  SampleSizeDto,
  StratifiedSizeDto,
  SrsDto,
  StratifiedSampleDto,
  PivotBuildDto,
  PivotSampleDto,
} from "./dto/tuuwer.dto";

// ─── Statistical helpers ──────────────────────────────────────────────────────

/**
 * Rational approximation of the inverse normal CDF (Abramowitz & Stegun 26.2.17).
 * Accurate to ~4.5e-4 for p in (0,1).
 */
function getZ(p: number): number {
  const q = 1 - p;
  const alpha = 1 - (1 - q) / 2; // two-tailed -> one-tailed
  const a1 = 2.515517;
  const a2 = 0.802853;
  const a3 = 0.010328;
  const b1 = 1.432788;
  const b2 = 0.189269;
  const b3 = 0.001308;
  const t = Math.sqrt(-2 * Math.log(1 - alpha));
  return (
    t - (a1 + a2 * t + a3 * t * t) / (1 + b1 * t + b2 * t * t + b3 * t * t * t)
  );
}

/**
 * Sample size for a proportion using finite population correction.
 * Mirrors Python: n0 = (Z/E)^2 * p*(1-p); n = N*n0 / (N + n0 - 1)
 */
function calcSampleSize(
  population: number,
  confidence: number,
  marginError: number,
  p = 0.5,
): number {
  const Z = getZ(confidence);
  const n0 = Math.pow(Z / marginError, 2) * p * (1 - p);
  const n = (population * n0) / (population + n0 - 1);
  return Math.ceil(n);
}

/**
 * Stratified sample size using p = 0.05 (matches Python sampler stratified logic).
 * Returns total n that is then distributed across strata.
 */
function calcStratifiedSampleSize(
  totalN: number,
  confidence: number,
  marginError: number,
): number {
  return calcSampleSize(totalN, confidence, marginError, 0.05);
}

// ─── Pivot helpers ────────────────────────────────────────────────────────────

/** Extract first 3 chars if the value matches [A-Z]{2}[0-9]{3}... pattern */
function extractCode(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (/^[A-Z]{2}[0-9]{3}/.test(s)) return s.slice(0, 3);
  return null;
}

/** Convert an Excel serial date or date string to a 4-digit year number */
function toYear(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    // Excel serial date: days since 1899-12-30
    const ms = (value - 25569) * 86400 * 1000;
    return new Date(ms).getFullYear();
  }
  const s = String(value).trim();
  // ISO / "YYYY-MM-DD ..." / "DD/MM/YYYY" / "YYYY/MM/DD"
  const m4 = s.match(/(\d{4})/);
  if (m4) return parseInt(m4[1], 10);
  return null;
}

// ─── Pivot result types ───────────────────────────────────────────────────────

export interface PivotRow {
  year: number;
  count: number;
  pct: number;
  sampleSize: number;
}

export interface PrefixGroup {
  prefix: string;
  total: number;
  rows: PivotRow[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TuuwerService {
  // ── Sample size ─────────────────────────────────────────────────────────────

  computeSampleSize(dto: SampleSizeDto): {
    n: number;
    population: number;
    confidence: number;
    marginError: number;
  } {
    const { population, confidence, marginError, stdDev = 0.5 } = dto;
    if (population < 1)
      throw new BadRequestException("population must be >= 1");
    if (confidence <= 0 || confidence >= 1)
      throw new BadRequestException("confidence must be in (0, 1)");
    if (marginError <= 0 || marginError >= 1)
      throw new BadRequestException("marginError must be in (0, 1)");
    const n = calcSampleSize(population, confidence, marginError, stdDev);
    return { n, population, confidence, marginError };
  }

  computeStratifiedSizes(dto: StratifiedSizeDto): {
    totalN: number;
    totalSample: number;
    strata: Array<{
      name: string;
      count: number;
      sampleSize: number;
      pct: number;
    }>;
  } {
    const { strata, confidence, marginError } = dto;
    if (!strata?.length)
      throw new BadRequestException("strata must not be empty");
    const totalN = strata.reduce((s, r) => s + r.count, 0);
    const totalSample = calcStratifiedSampleSize(
      totalN,
      confidence,
      marginError,
    );

    const result = strata.map((st) => ({
      name: st.name,
      count: st.count,
      pct: totalN > 0 ? (st.count / totalN) * 100 : 0,
      sampleSize: Math.ceil((st.count / totalN) * totalSample),
    }));

    return { totalN, totalSample, strata: result };
  }

  // ── SRS sampling ─────────────────────────────────────────────────────────────

  performSrs(dto: SrsDto): {
    method: string;
    requestedN: number;
    sampledN: number;
    data: Record<string, unknown>[];
  } {
    const { data, n, method } = dto;
    if (!data?.length) throw new BadRequestException("data must not be empty");

    const N = data.length;
    const count = Math.min(n, N);

    let sampled: Record<string, unknown>[];
    if (method === "srswr") {
      // With replacement — each draw independent
      sampled = Array.from(
        { length: count },
        () => data[Math.floor(Math.random() * N)],
      );
    } else {
      // Without replacement — Fisher-Yates shuffle then slice
      const copy = [...data];
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      sampled = copy.slice(0, count);
    }

    // Attach a 1-based sample index
    const indexed = sampled.map((row, i) => ({
      ...row,
      "Түүврийн индекс": i + 1,
    }));

    return { method, requestedN: n, sampledN: count, data: indexed };
  }

  // ── Stratified sampling ──────────────────────────────────────────────────────

  performStratifiedSample(dto: StratifiedSampleDto): {
    method: string;
    totalN: number;
    totalSample: number;
    groups: Array<{
      name: string;
      count: number;
      sampleSize: number;
      rows: Record<string, unknown>[];
    }>;
  } {
    const { strata, confidence, marginError, method } = dto;
    if (!strata?.length)
      throw new BadRequestException("strata must not be empty");

    const totalN = strata.reduce((s, r) => s + r.rows.length, 0);
    const totalSample = calcStratifiedSampleSize(
      totalN,
      confidence,
      marginError,
    );

    const groups = strata.map((st) => {
      const N = st.rows.length;
      let sampleSize: number;

      if (method === "prop") {
        // Proportional: n_i = n * (N_i / N_total)
        sampleSize = Math.ceil((N / totalN) * totalSample);
      } else {
        // Non-proportional (equal): same n for every stratum
        sampleSize = Math.ceil(totalSample / strata.length);
      }

      const count = Math.min(sampleSize, N);
      const copy = [...st.rows];
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      const sampled = copy.slice(0, count);

      return { name: st.name, count: N, sampleSize: count, rows: sampled };
    });

    return { method, totalN, totalSample, groups };
  }

  // ── Pivot build ──────────────────────────────────────────────────────────────

  buildPivot(dto: PivotBuildDto): PrefixGroup[] {
    const { headers, rows, dateCol, codeCol, confidence, marginError } = dto;

    const dateIdx = headers.indexOf(dateCol);
    const codeIdx = headers.indexOf(codeCol);
    if (dateIdx === -1)
      throw new BadRequestException(
        `dateCol "${dateCol}" not found in headers`,
      );
    if (codeIdx === -1)
      throw new BadRequestException(
        `codeCol "${codeCol}" not found in headers`,
      );

    // 1. Group rows by (prefix, year)
    const prefixYearMap = new Map<string, Map<number, number>>(); // prefix -> year -> count

    for (const row of rows) {
      const arr = row as unknown[];
      const code = extractCode(arr[codeIdx]);
      const year = toYear(arr[dateIdx]);
      if (!code || !year) continue;

      if (!prefixYearMap.has(code)) prefixYearMap.set(code, new Map());
      const yearMap = prefixYearMap.get(code)!;
      yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
    }

    // 2. Build result array
    const result: PrefixGroup[] = [];
    for (const [prefix, yearMap] of prefixYearMap) {
      const total = Array.from(yearMap.values()).reduce((s, v) => s + v, 0);
      const pivotRows: PivotRow[] = [];

      for (const [year, count] of Array.from(yearMap.entries()).sort(
        (a, b) => a[0] - b[0],
      )) {
        const pct = total > 0 ? (count / total) * 100 : 0;
        const sampleSize = calcSampleSize(count, confidence, marginError);
        pivotRows.push({ year, count, pct, sampleSize });
      }

      result.push({ prefix, total, rows: pivotRows });
    }

    return result.sort((a, b) => a.prefix.localeCompare(b.prefix));
  }

  // ── Pivot sample ─────────────────────────────────────────────────────────────

  buildPivotSample(dto: PivotSampleDto): Record<string, unknown[][]> {
    const { headers, rows, dateCol, codeCol, prefix, yearSizes } = dto;

    const dateIdx = headers.indexOf(dateCol);
    const codeIdx = headers.indexOf(codeCol);
    if (dateIdx === -1)
      throw new BadRequestException(
        `dateCol "${dateCol}" not found in headers`,
      );
    if (codeIdx === -1)
      throw new BadRequestException(
        `codeCol "${codeCol}" not found in headers`,
      );

    // Filter rows matching the given prefix
    const prefixRows = rows.filter((row) => {
      const arr = row as unknown[];
      return extractCode(arr[codeIdx]) === prefix;
    });

    const result: Record<string, unknown[][]> = {};

    for (const [yearStr, n] of Object.entries(yearSizes)) {
      const year = parseInt(yearStr, 10);
      const yearRows = prefixRows.filter((row) => {
        const arr = row as unknown[];
        return toYear(arr[dateIdx]) === year;
      });

      const count = Math.min(n, yearRows.length);
      const shuffled = [...yearRows].sort(() => Math.random() - 0.5);
      result[yearStr] = shuffled.slice(0, count);
    }

    return result;
  }
}
