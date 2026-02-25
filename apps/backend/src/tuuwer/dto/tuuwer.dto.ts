// ─── Санамсаргүй Түүвэр (Random Sampler) DTOs ────────────────────────────────

/** Compute sample size n for a population */
export class SampleSizeDto {
  /** Total population size N */
  population: number;
  /** Confidence level, e.g. 0.95 */
  confidence: number;
  /** Margin of error, e.g. 0.05 */
  marginError: number;
  /** Standard deviation (fraction), defaults to 0.5 */
  stdDev?: number;
}

/** A single stratum descriptor */
export class StratumDto {
  name: string;
  count: number;
}

/** Compute per-stratum sample sizes for stratified sampling */
export class StratifiedSizeDto {
  strata: StratumDto[];
  /** Confidence level, e.g. 0.95 */
  confidence: number;
  /** Margin of error, e.g. 0.05 */
  marginError: number;
}

/** Perform SRSWR or SRSWOR on a flat dataset */
export class SrsDto {
  /** Array of row objects */
  data: Record<string, unknown>[];
  /** Desired sample size n (if 0, computed automatically) */
  n: number;
  /** 'srswr' = with replacement, 'srswor' = without replacement */
  method: "srswr" | "srswor";
}

/** A stratum with its rows for stratified sampling */
export class StratumDataDto {
  name: string;
  rows: Record<string, unknown>[];
}

/** Perform proportional or non-proportional stratified sampling */
export class StratifiedSampleDto {
  strata: StratumDataDto[];
  /** Confidence level, e.g. 0.95 */
  confidence: number;
  /** Margin of error, e.g. 0.05 */
  marginError: number;
  /** 'prop' = proportional, 'nonprop' = non-proportional (equal) */
  method: "prop" | "nonprop";
}

// ─── Зээлзэс Түүвэр (Pivot / Loan Sampler) DTOs ─────────────────────────────

/** Build prefix-grouped pivot tables from raw spreadsheet data */
export class PivotBuildDto {
  /** Header row of the spreadsheet */
  headers: string[];
  /**
   * Data rows as arrays aligned to `headers`.
   * Each element can be a number (Excel serial date), string, or null.
   */
  rows: unknown[][];
  /** Header name of the date column */
  dateCol: string;
  /** Header name of the code column (e.g. loan scheme code) */
  codeCol: string;
  /** Confidence level for sample-size calculation, e.g. 0.9 */
  confidence: number;
  /** Margin of error, e.g. 0.1 */
  marginError: number;
}

/** Extract a random sample for a given prefix, broken down by year */
export class PivotSampleDto {
  /** Same payload as PivotBuildDto */
  headers: string[];
  rows: unknown[][];
  dateCol: string;
  codeCol: string;
  /** Target prefix (first 3 chars of the code, e.g. "AB1") */
  prefix: string;
  /**
   * Per-year sample sizes to draw.
   * Key = year as string (e.g. "2023"), value = n.
   */
  yearSizes: Record<string, number>;
}
