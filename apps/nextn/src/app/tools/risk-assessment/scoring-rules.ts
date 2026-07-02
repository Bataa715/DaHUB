/**
 * Эрсдэлийн үнэлгээний автомат оноо тооцох дүрмүүд.
 *
 * Бүлэглэл:
 *   Score 1 — Санхүү/гүйцэтгэлийн KPI (SUBID 1–9)
 *   Score 2 — Үйл ажиллагаа/HR/хяналт (SUBID 11–29)
 *   Score 3 — Аудит/хяналтын түүх    (SUBID 30–33)
 *
 * SUBID нь Oracle-ийн жинхэнэ ID (rubric №-тэй яг таарахгүй байж болно).
 */

export type ScoreGroup = "Score 1" | "Score 2" | "Score 3" | "Score 4";

export type ScoreValue = 0 | 1 | 2 | 3 | 4 | 5;

/** Oracle DB багануудын боломжит утгын төрөл */
export type OracleValue = string | number | null;
export type ScoreResult = ScoreValue | "Үнэлэхгүй" | null;

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic score computation — uses JSON ScoreScale from DB instead of
// hardcoded INDICATOR_RULES. Shared format with risk-indicator-config backend.
// ─────────────────────────────────────────────────────────────────────────────

export interface DynamicScaleRule {
  min?: number | null;
  max?: number | null;
  matchType?: "exact" | "contains";
  values?: string[];
  score: number; // 1-5, or 0 = "Үнэлэхгүй"
  label: string;
}

/** Нэг indicator дотор олон SUBID-ийн өөр өөр scale (онцгой тохиолдол) */
export interface MultiSubidSource {
  subid: string;
  label?: string;
  type: "numeric" | "string" | "both";
  numericRules?: DynamicScaleRule[];
  stringRules?: DynamicScaleRule[];
  null_empty_score?: "unelehgui" | "1" | "5";
  null_is_unelehgui?: boolean;
}

export type MultiSubidCombine = "max" | "min" | "avg";

export interface DynamicScoreScale {
  type:
    | "numeric"
    | "string"
    | "both"
    | "manual"
    | "no_score"
    | "multi_subid";
  rules?: DynamicScaleRule[];
  numericRules?: DynamicScaleRule[];
  stringRules?: DynamicScaleRule[];
  min?: number;
  max?: number;
  step?: number;
  /** multi_subid: SUBID бүрт тусдаа scale */
  sources?: MultiSubidSource[];
  /** multi_subid: эх үүсвэрүүдийн оноог нэгтгэх арга (default: max = хамгийн муу) */
  combine?: MultiSubidCombine;
  /**
   * Хоосон/null утгын бодлого:
   * - unelehgui: жин хасагдана
   * - 5: хамгийн муу оноо
   * - 1: хоосон = 1 оноо
   * @deprecated null_is_unelehgui — зөвхөн хуучин тохиргоо
   */
  null_empty_score?: "unelehgui" | "1" | "5";
  null_is_unelehgui?: boolean;
}

export type OracleRowLike = {
  SUBID?: OracleValue;
  RESULT?: OracleValue;
  RESULT_TYPE?: OracleValue;
  sourceFetchedDate?: string;
};

export function parseScoreScale(scaleJson: string): DynamicScoreScale {
  try {
    return JSON.parse(scaleJson) as DynamicScoreScale;
  } catch {
    return { type: "manual" };
  }
}

export function isMultiSubidScale(
  scaleOrJson: DynamicScoreScale | string,
): boolean {
  const scale =
    typeof scaleOrJson === "string"
      ? parseScoreScale(scaleOrJson)
      : scaleOrJson;
  return scale.type === "multi_subid" && (scale.sources?.length ?? 0) > 0;
}

function sourceToScale(source: MultiSubidSource): DynamicScoreScale {
  return {
    type: source.type,
    numericRules: source.numericRules,
    stringRules: source.stringRules,
    null_empty_score: source.null_empty_score,
    null_is_unelehgui: source.null_is_unelehgui,
  };
}

function combineNumericScores(
  scores: number[],
  combine: MultiSubidCombine,
): number | null {
  if (scores.length === 0) return null;
  if (combine === "min") return Math.min(...scores);
  if (combine === "avg")
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.max(...scores);
}

export function collectMultiSubidSecondarySubids(
  catalog: { subid: string; is_manual: boolean; score_scale: string }[],
): Set<string> {
  const out = new Set<string>();
  for (const ind of catalog) {
    if (ind.is_manual) continue;
    const scale = parseScoreScale(ind.score_scale);
    if (scale.type !== "multi_subid") continue;
    const primary = ind.subid.trim();
    for (const src of scale.sources ?? []) {
      const sid = src.subid.trim();
      if (sid && sid !== primary) out.add(sid);
    }
  }
  return out;
}

export type ResolvedSubidIndicator = {
  indicator: { subid: string; score_scale: string; group: number };
  source?: MultiSubidSource;
};

/** Oracle мөрөөс indicator олох (гол болон нэмэлт SUBID) */
export function resolveIndicatorForSubid<
  T extends { subid: string; is_manual: boolean; score_scale: string; group: number },
>(catalog: T[], subid: string): { indicator: T; source?: MultiSubidSource } | null {
  const sid = subid.trim();
  if (!sid) return null;

  const primary = catalog.find((c) => !c.is_manual && c.subid.trim() === sid);
  if (primary) {
    const scale = parseScoreScale(primary.score_scale);
    if (scale.type === "multi_subid") {
      const source = scale.sources?.find((s) => s.subid.trim() === sid);
      return { indicator: primary, source };
    }
    return { indicator: primary };
  }

  for (const ind of catalog) {
    if (ind.is_manual) continue;
    const scale = parseScoreScale(ind.score_scale);
    if (scale.type !== "multi_subid") continue;
    const source = scale.sources?.find((s) => s.subid.trim() === sid);
    if (source) return { indicator: ind, source };
  }
  return null;
}

export type NullEmptyScorePolicy = "unelehgui" | "1" | "5";

type NullEmptyScaleFields = Pick<
  DynamicScoreScale,
  "null_empty_score" | "null_is_unelehgui"
>;

export function getNullEmptyPolicy(
  scale: NullEmptyScaleFields,
): NullEmptyScorePolicy {
  const v = scale.null_empty_score;
  if (v === "1" || v === "5" || v === "unelehgui") return v;
  if (scale.null_is_unelehgui === false) return "5";
  return "unelehgui";
}

export function resolveEmptyNullScore(
  scale: NullEmptyScaleFields,
): { score: ScoreResult; label: string | null } {
  const policy = getNullEmptyPolicy(scale);
  if (policy === "5") return { score: 5, label: "Мэдээлэл байхгүй" };
  if (policy === "1") return { score: 1, label: "Мэдээлэл байхгүй" };
  return { score: "Үнэлэхгүй", label: "Мэдээлэл байхгүй" };
}

export function resolveEmptyNullScoreFromJson(
  scaleJson: string,
): { score: ScoreResult; label: string | null } {
  try {
    return resolveEmptyNullScore(JSON.parse(scaleJson) as DynamicScoreScale);
  } catch {
    return resolveEmptyNullScore({});
  }
}

export function computeScoreFromScale(
  scale: DynamicScoreScale,
  result: OracleValue | undefined,
  resultType?: OracleValue,
): { score: ScoreResult; label: string | null } {
  if (scale.type === "no_score" || scale.type === "manual" || scale.type === "multi_subid") {
    return { score: null, label: null };
  }

  const raw = result == null ? "" : String(result).trim();
  const rawNorm = raw.replace(/[\s\u00A0\u200B]+/g, " ").trim();
  if (!rawNorm) {
    return resolveEmptyNullScore(scale);
  }
  const isStringType = String(resultType ?? "").toUpperCase() === "STRING";

  const normalize = (s: string) => s.replace(/[\s\u00A0\u200B]+/g, " ").trim();

  const matchRule = (rule: DynamicScaleRule, s: string): boolean => {
    if (!rule.values?.length) return false;
    const t = normalize(s);
    if (rule.matchType === "contains") {
      return rule.values.some((v) => t.includes(normalize(v)));
    }
    return rule.values.some((v) => normalize(v) === t);
  };

  const applyNumericRules = (
    rules: DynamicScaleRule[],
  ): { score: ScoreResult; label: string | null } | null => {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    const sorted = [...rules].sort((a, b) => b.score - a.score);
    for (const r of sorted) {
      const minOk = r.min == null || n >= r.min;
      const maxOk = r.max == null || n < r.max;
      if (minOk && maxOk) {
        return {
          score: r.score === 0 ? "Үнэлэхгүй" : (r.score as ScoreValue),
          label: r.label,
        };
      }
    }
    return null;
  };

  const applyStringRules = (
    rules: DynamicScaleRule[],
  ): { score: ScoreResult; label: string | null } | null => {
    for (const r of rules) {
      if (matchRule(r, rawNorm)) {
        return {
          score: r.score === 0 ? "Үнэлэхгүй" : (r.score as ScoreValue),
          label: r.label,
        };
      }
    }
    return null;
  };

  if (scale.type === "string") {
    const hit = applyStringRules(scale.stringRules ?? scale.rules ?? []);
    if (hit) return hit;
  } else if (scale.type === "numeric") {
    const numRules = scale.numericRules ?? scale.rules ?? [];
    const strRules = scale.stringRules ?? scale.rules ?? [];
    if (isStringType) {
      const hit = applyStringRules(strRules);
      if (hit) return hit;
    }
    const hit = applyNumericRules(numRules);
    if (hit) return hit;
    if (!isStringType) {
      const sHit = applyStringRules(strRules);
      if (sHit) return sHit;
    }
  } else if (scale.type === "both") {
    if (isStringType || isNaN(Number(raw.replace(",", ".")))) {
      const hit = applyStringRules(scale.stringRules ?? []);
      if (hit) return hit;
    }
    const hit = applyNumericRules(scale.numericRules ?? []);
    if (hit) return hit;
    const sHit = applyStringRules(scale.stringRules ?? []);
    if (sHit) return sHit;
  }

  return { score: "Үнэлэхгүй", label: "тодорхойлогдоогүй" };
}

export function computeOracleRowScore<
  T extends { subid: string; is_manual: boolean; score_scale: string; group: number },
>(
  catalog: T[],
  rowSubid: string,
  result: OracleValue | undefined,
  resultType?: OracleValue,
): { score: ScoreResult; label: string | null; indicator: T | null } {
  const hit = resolveIndicatorForSubid(catalog, rowSubid);
  if (!hit) return { score: null, label: null, indicator: null };

  if (hit.source) {
    const { score, label } = computeScoreFromScale(
      sourceToScale(hit.source),
      result,
      resultType,
    );
    return { score, label, indicator: hit.indicator };
  }

  const scale = parseScoreScale(hit.indicator.score_scale);
  if (scale.type === "multi_subid") {
    const source = scale.sources?.find((s) => s.subid.trim() === rowSubid.trim());
    if (source) {
      const { score, label } = computeScoreFromScale(
        sourceToScale(source),
        result,
        resultType,
      );
      return { score, label, indicator: hit.indicator };
    }
    return { score: null, label: null, indicator: hit.indicator };
  }

  const { score, label } = computeScoreFromScale(scale, result, resultType);
  return { score, label, indicator: hit.indicator };
}

export type MultiSubidEvalPart = {
  subid: string;
  label?: string;
  raw: string;
  score: ScoreResult;
  ruleLabel: string | null;
  sourceFetchedDate?: string;
};

export function evaluateMultiSubidScale(
  scale: DynamicScoreScale,
  rowsBySubid: Map<
    string,
    { RESULT?: OracleValue; RESULT_TYPE?: OracleValue; sourceFetchedDate?: string }
  >,
): {
  score: number | "Үнэлэхгүй" | null;
  parts: MultiSubidEvalPart[];
  autoRaw: string;
  autoLabel: string | null;
  sourceFetchedDate?: string;
} {
  const sources = scale.sources ?? [];
  const parts: MultiSubidEvalPart[] = [];

  for (const src of sources) {
    const sid = src.subid.trim();
    const row = rowsBySubid.get(sid);
    const raw = row?.RESULT == null ? "" : String(row.RESULT);
    const { score, label } = row
      ? computeScoreFromScale(sourceToScale(src), row.RESULT, row.RESULT_TYPE)
      : resolveEmptyNullScore(src);
    parts.push({
      subid: sid,
      label: src.label,
      raw,
      score,
      ruleLabel: label,
      sourceFetchedDate: row?.sourceFetchedDate
        ? String(row.sourceFetchedDate).slice(0, 10)
        : undefined,
    });
  }

  const numericScores = parts
    .filter((p) => typeof p.score === "number" && p.score > 0)
    .map((p) => p.score as number);

  let finalScore: number | "Үнэлэхгүй" | null = null;
  if (numericScores.length > 0) {
    finalScore = combineNumericScores(
      numericScores,
      scale.combine ?? "max",
    );
  } else if (parts.some((p) => p.score === "Үнэлэхгүй")) {
    finalScore = "Үнэлэхгүй";
  } else {
    finalScore = resolveEmptyNullScore(scale).score;
  }

  const autoRaw = parts
    .map((p) => {
      const tag = p.label?.trim() || p.subid;
      return `${tag}: ${p.raw || "—"}`;
    })
    .join(" · ");
  const autoLabel =
    parts
      .map((p) => p.ruleLabel)
      .filter((l): l is string => !!l)
      .join("; ") || null;
  const sourceFetchedDate = parts.find((p) => p.sourceFetchedDate)?.sourceFetchedDate;

  return { score: finalScore, parts, autoRaw, autoLabel, sourceFetchedDate };
}

export function buildRowsBySubid(rows: OracleRowLike[]): Map<
  string,
  { RESULT?: OracleValue; RESULT_TYPE?: OracleValue; sourceFetchedDate?: string }
> {
  const map = new Map<
    string,
    { RESULT?: OracleValue; RESULT_TYPE?: OracleValue; sourceFetchedDate?: string }
  >();
  for (const r of rows) {
    const sid = String(r.SUBID ?? "").trim();
    if (!sid || map.has(sid)) continue;
    map.set(sid, {
      RESULT: r.RESULT,
      RESULT_TYPE: r.RESULT_TYPE,
      sourceFetchedDate: r.sourceFetchedDate
        ? String(r.sourceFetchedDate).slice(0, 10)
        : undefined,
    });
  }
  return map;
}

export function computeScoreDynamic(
  scaleJson: string,
  result: OracleValue | undefined,
  resultType?: OracleValue,
): { score: ScoreResult; label: string | null } {
  const scale = parseScoreScale(scaleJson);
  return computeScoreFromScale(scale, result, resultType);
}

/** UI-д харагдах өнгө. */
export function scoreColorClass(score: ScoreResult): string {
  if (score === 5) return "bg-red-500/15 text-red-600 border-red-500/30";
  if (score === 4)
    return "bg-orange-500/15 text-orange-600 border-orange-500/30";
  if (score === 3) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  if (score === 2) return "bg-lime-500/15 text-lime-700 border-lime-500/30";
  if (score === 1)
    return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (score === 0 || score === "Үнэлэхгүй")
    return "bg-muted/20 text-muted-foreground/70 border-border/30";
  return "bg-transparent text-muted-foreground border-transparent";
}

export function scoreDisplay(score: ScoreResult): string {
  if (score == null) return "—";
  if (score === "Үнэлэхгүй") return "Ү";
  return String(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated branch helpers (Final report)
// ─────────────────────────────────────────────────────────────────────────────

export type Region = "UB" | "LOC";
export type RiskLevel = "Өндөр" | "Дунд" | "Бага";

const UB_RATINGS = new Set(["УБТ", "A1", "A2", "A3", "SME", "C", "БИЗНЕС ТӨВ"]);
const LOC_RATINGS = new Set(["ОБТ", "Б1", "Б2"]);

export const WEIGHTS: Record<
  Region,
  { s1: number; s2: number; s3: number; s4: number; j: number }
> = {
  UB: { s1: 0.35, s2: 0.2, s3: 0.2, s4: 0.15, j: 0.1 },
  LOC: { s1: 0.25, s2: 0.2, s3: 0.2, s4: 0.1, j: 0.1 },
};

export function detectRegion(rating: string): Region {
  const t = (rating || "").toUpperCase().trim();
  if (LOC_RATINGS.has(t)) return "LOC";
  if (UB_RATINGS.has(t)) return "UB";
  if (/^Б/.test(t)) return "LOC";
  return "UB";
}

export function riskLevel(total: number | null | undefined): RiskLevel | "" {
  if (total == null || !Number.isFinite(total)) return "";
  if (total >= 3.5) return "Өндөр";
  if (total >= 2.5) return "Дунд";
  return "Бага";
}

export function riskLevelClass(lv: string): string {
  if (lv === "Өндөр") return "bg-rose-500/15 text-rose-600 border-rose-500/30";
  if (lv === "Дунд")
    return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  if (lv === "Бага")
    return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  return "text-muted-foreground border-transparent";
}

export type BranchAggregate = {
  branchId: string;
  branchName: string;
  solid: string;
  rating: string;
  /** riskbranch STATUS — УБ-Салбар / ОН-Салбар */
  status: string;
  region: Region;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s4: number | null;
  j: number | null;
  total: number | null;
  level: RiskLevel | "";
};

/** Тайлангийн хүснэгтийг STATUS-аар UB / ON бүлэгт хуваах */
export function classifyBranchTableGroup(
  status: string,
  rating: string,
): "UB" | "ON" {
  const s = (status || "").trim().toUpperCase();
  if (s.includes("ОН") && s.includes("САЛБАР")) return "ON";
  if (s.includes("УБ") && s.includes("САЛБАР")) return "UB";
  if (s.startsWith("ОН")) return "ON";
  if (s.startsWith("УБ")) return "UB";
  return detectRegion(rating) === "LOC" ? "ON" : "UB";
}

/** Жинлэсэн дундаж — байгаа компонентуудаар (хоосон бол жингээс хасах). */
export function computeTotal(
  region: Region,
  s1: number | null,
  s2: number | null,
  s3: number | null,
  s4: number | null,
  j: number | null,
): number | null {
  const w = WEIGHTS[region];
  let wsum = 0;
  let vsum = 0;
  if (s1 != null) {
    vsum += s1 * w.s1;
    wsum += w.s1;
  }
  if (s2 != null) {
    vsum += s2 * w.s2;
    wsum += w.s2;
  }
  if (s3 != null) {
    vsum += s3 * w.s3;
    wsum += w.s3;
  }
  if (s4 != null) {
    vsum += s4 * w.s4;
    wsum += w.s4;
  }
  if (j != null) {
    vsum += j * w.j;
    wsum += w.j;
  }
  return wsum > 0 ? vsum / wsum : null;
}

type AggInputRow = {
  SOLID?: OracleValue;
  BRANCHID?: OracleValue;
  BRANCHNAME?: OracleValue;
  STATUS?: OracleValue;
  SUBID?: OracleValue;
  RESULT?: OracleValue;
  RESULT_TYPE?: OracleValue;
};

/** Минимал каталогийн бичлэг (DynamicCatalogIndicator-тэй нийцтэй) */
export interface CatalogEntry {
  subid: string;
  group: 1 | 2 | 3 | 4 | 5;
  score_scale: string;
  is_manual: boolean;
  is_judgment?: boolean;
}

/**
 * Score-той rows-аас салбараар бүлэглэн Score 1/2/3 дунджийг
 * тооцоолж BranchAggregate жагсаалт буцаана.
 *  - score4 / judgement: { [branchId]: number } гар оруулга
 *  - catalog: динамик тохиргоо (useIndicatorConfig-аас)
 */
export function aggregateBranch(
  rows: AggInputRow[],
  score4Map: Record<string, number> = {},
  judgementMap: Record<string, number> = {},
  catalog: CatalogEntry[] = [],
): BranchAggregate[] {
  type Acc = {
    branchId: string;
    branchName: string;
    solid: string;
    rating: string;
    status: string;
    sums: Record<ScoreGroup, { sum: number; cnt: number }>;
  };
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const key = String(r.SOLID || "");
    if (!key) continue;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        branchId: String(r.SOLID || ""),
        branchName: String(r.BRANCHNAME ?? ""),
        solid: String(r.SOLID ?? ""),
        rating: "",
        status: "",
        sums: {
          "Score 1": { sum: 0, cnt: 0 },
          "Score 2": { sum: 0, cnt: 0 },
          "Score 3": { sum: 0, cnt: 0 },
          "Score 4": { sum: 0, cnt: 0 },
        },
      };
      map.set(key, acc);
    }

    if (Number(r.SUBID) === 6 && r.RESULT != null) {
      acc.rating = String(r.RESULT).trim();
    }

    const statusVal = String(r.STATUS ?? "").trim();
    if (statusVal && !acc.status) {
      acc.status = statusVal;
    }

    const subidStr = String(r.SUBID ?? "");
    const ind = catalog.find((c) => c.subid === subidStr);
    if (!ind || ind.is_manual || ind.group > 4) continue;
    const grp = `Score ${ind.group}` as ScoreGroup;
    const { score } = computeScoreDynamic(
      ind.score_scale,
      r.RESULT,
      r.RESULT_TYPE,
    );
    if (typeof score === "number" && score > 0) {
      acc.sums[grp].sum += score;
      acc.sums[grp].cnt += 1;
    }
  }

  const list: BranchAggregate[] = [];
  for (const acc of map.values()) {
    const s1 = acc.sums["Score 1"].cnt
      ? acc.sums["Score 1"].sum / acc.sums["Score 1"].cnt
      : null;
    const s2 = acc.sums["Score 2"].cnt
      ? acc.sums["Score 2"].sum / acc.sums["Score 2"].cnt
      : null;
    const s3 = acc.sums["Score 3"].cnt
      ? acc.sums["Score 3"].sum / acc.sums["Score 3"].cnt
      : null;
    const region = detectRegion(acc.rating);
    const s4 = acc.sums["Score 4"].cnt
      ? acc.sums["Score 4"].sum / acc.sums["Score 4"].cnt
      : null;
    const j = acc.branchId in judgementMap ? judgementMap[acc.branchId] : null;
    const total = computeTotal(region, s1, s2, s3, s4, j);
    list.push({
      branchId: acc.branchId,
      branchName: acc.branchName,
      solid: acc.solid,
      rating: acc.rating || "—",
      status: acc.status,
      region,
      s1,
      s2,
      s3,
      s4,
      j,
      total,
      level: riskLevel(total),
    });
  }

  list.sort((a, b) => a.branchName.localeCompare(b.branchName, "mn"));
  return list;
}
