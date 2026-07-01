"use client";

import { useState, useEffect, useCallback } from "react";
import { riskIndicatorConfigApi, type IndicatorConfig } from "@/lib/api";
import { INDICATOR_CATALOG, type CatalogIndicator } from "./indicator-catalog";
import {
  WEIGHTS,
  computeScoreDynamic,
  aggregateBranch,
  resolveEmptyNullScoreFromJson,
  type ScoreResult,
  type OracleValue,
  type BranchAggregate,
  type RiskLevel,
  type CatalogEntry,
} from "./scoring-rules";
import type { ManualMap } from "./indicator-catalog";
import {
  resolveManualBranch,
  resolveJudgementComment,
  resolveJudgementScore,
  normalizeJudgmentCatalog,
  pickJudgmentIndicator,
  readJudgmentScoreFromManual,
  judgementsFromManualSnapshot,
  judgementsFromList,
  judgementCommentsFromList,
  resolveBranchJudgementScore,
} from "./branch-resolve";

export {
  resolveManualBranch,
  resolveJudgementComment,
  resolveJudgementScore,
  pickJudgmentIndicator,
  nonJudgmentIndicators,
  normalizeJudgmentCatalog,
  readJudgmentScoreFromManual,
  judgementsFromManualSnapshot,
  judgementsFromList,
  judgementCommentsFromList,
  resolveBranchJudgementScore,
} from "./branch-resolve";

// ─── Dynamic catalog entry (mirrors CatalogIndicator) ────────────────────────

export interface DynamicCatalogIndicator {
  id: string;
  subid: string;
  name: string;
  group: 1 | 2 | 3 | 4 | 5;
  weight: number;
  is_manual: boolean;
  is_judgment: boolean;
  score_scale: string; // JSON
  hint?: string;
}

export interface DynamicWeights {
  UB: { s1: number; s2: number; s3: number; s4: number; j: number };
  LOC: { s1: number; s2: number; s3: number; s4: number; j: number };
}

export interface DynamicConfig {
  catalog: DynamicCatalogIndicator[];
  weights: DynamicWeights;
  loaded: boolean;
  /** true бол backend-ээс авч чадаагүй тул хуучин хатуу кодын тохиргоо ашиглаж байна */
  isFallback?: boolean;
}

// ─── Fallback: build from hardcoded catalog ──────────────────────────────────

function buildFallbackConfig(): DynamicConfig {
  const catalog: DynamicCatalogIndicator[] = INDICATOR_CATALOG.map(
    (c: CatalogIndicator) => ({
      id: c.id,
      subid: c.autoSubid != null ? String(c.autoSubid) : c.id,
      name: c.name,
      group: c.group,
      weight: c.weight,
      is_manual: c.autoSubid == null,
      is_judgment: c.group === 5,
      score_scale: JSON.stringify({ type: "manual", min: 1, max: 5, step: 1 }),
      hint: c.hint,
    }),
  );
  // Group weights = sum of indicator weights per group (dynamic, not hardcoded)
  const gsum = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
  for (const c of INDICATOR_CATALOG)
    gsum[c.group] = (gsum[c.group] ?? 0) + c.weight;
  const w = {
    s1: gsum[1] / 100,
    s2: gsum[2] / 100,
    s3: gsum[3] / 100,
    s4: gsum[4] / 100,
    j: gsum[5] / 100,
  };
  return {
    catalog: normalizeJudgmentCatalog(catalog),
    weights: { UB: w, LOC: w },
    loaded: true,
    isFallback: true,
  };
}

// ─── Build from DB config ─────────────────────────────────────────────────────

function buildDynamicConfig(indicators: IndicatorConfig[]): DynamicConfig {
  const catalog: DynamicCatalogIndicator[] = indicators.map((ind) => ({
    id: ind.id,
    subid: ind.subid.trim(),
    name: ind.name,
    group: ind.group_num as 1 | 2 | 3 | 4 | 5,
    weight: ind.weight,
    is_manual: ind.is_manual === 1,
    is_judgment: ind.is_judgment === 1,
    score_scale: ind.score_scale,
    hint: ind.hint || undefined,
  }));

  // Group weights = sum of indicator weights per group (from admin config, not hardcoded)
  const gsum = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
  for (const ind of indicators)
    gsum[ind.group_num] = (gsum[ind.group_num] ?? 0) + ind.weight;
  const w = {
    s1: gsum[1] / 100,
    s2: gsum[2] / 100,
    s3: gsum[3] / 100,
    s4: gsum[4] / 100,
    j: gsum[5] / 100,
  };

  return {
    catalog: normalizeJudgmentCatalog(catalog),
    weights: { UB: w, LOC: w },
    loaded: true,
  };
}

// ─── Module-level cache (бүх ReportView instance хуваалцана) ─────────────────
let _cachedConfig: DynamicConfig | null = null;
let _loadingPromise: Promise<DynamicConfig> | null = null;

/** Admin-аас indicator хадгалсны дараа cache-г цэвэрлэх */
export function invalidateIndicatorCache() {
  _cachedConfig = null;
  _loadingPromise = null;
}

function fetchConfig(): Promise<DynamicConfig> {
  if (_cachedConfig) return Promise.resolve(_cachedConfig);
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    try {
      const indicators = await riskIndicatorConfigApi.list();
      const cfg =
        indicators.length === 0
          ? buildFallbackConfig()
          : buildDynamicConfig(indicators);
      _cachedConfig = cfg;
      return cfg;
    } catch {
      const fallback = buildFallbackConfig();
      _cachedConfig = fallback;
      return fallback;
    } finally {
      _loadingPromise = null;
    }
  })();
  return _loadingPromise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIndicatorConfig(): DynamicConfig & {
  reload: () => Promise<void>;
} {
  const [config, setConfig] = useState<DynamicConfig>(
    _cachedConfig ?? { catalog: [], weights: { ...WEIGHTS }, loaded: false },
  );

  useEffect(() => {
    if (_cachedConfig) {
      setConfig(_cachedConfig);
      return;
    }
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig(buildFallbackConfig()));
  }, []);

  const reload = useCallback(async () => {
    _cachedConfig = null;
    _loadingPromise = null;
    const cfg = await fetchConfig();
    setConfig(cfg);
  }, []);

  return { ...config, reload };
}

// ─── Dynamic scoring helper ───────────────────────────────────────────────────

/**
 * Evaluate a branch's indicators using dynamic config.
 * Returns { [indicatorId]: { score, source, autoRaw, autoLabel } }
 */
export function evaluateBranchDynamic(
  catalog: DynamicCatalogIndicator[],
  rows: {
    SUBID?: OracleValue;
    RESULT?: OracleValue;
    RESULT_TYPE?: OracleValue;
    sourceFetchedDate?: string;
  }[],
  manual: Record<string, number> | undefined,
): Record<
  string,
  {
    score: number | null;
    source: "auto" | "manual" | "none";
    autoRaw?: string;
    autoLabel?: string | null;
    sourceFetchedDate?: string;
  }
> {
  // Index Oracle rows by SUBID
  const autoBySubid = new Map<
    string,
    {
      score: ScoreResult;
      raw: string;
      label: string | null;
      sourceFetchedDate?: string;
    }
  >();
  for (const r of rows) {
    const sid = String(r.SUBID ?? "").trim();
    if (!sid || autoBySubid.has(sid)) continue;
    // Find indicator with matching subid
    const ind = catalog.find((c) => !c.is_manual && c.subid === sid);
    if (!ind) continue;
    const { score, label } = computeScoreDynamic(
      ind.score_scale,
      r.RESULT,
      r.RESULT_TYPE,
    );
    autoBySubid.set(sid, {
      score,
      raw: r.RESULT == null ? "" : String(r.RESULT),
      label,
      sourceFetchedDate: r.sourceFetchedDate
        ? String(r.sourceFetchedDate).slice(0, 10)
        : undefined,
    });
  }

  const result: Record<
    string,
    {
      score: number | null;
      source: "auto" | "manual" | "none";
      autoRaw?: string;
      autoLabel?: string | null;
      sourceFetchedDate?: string;
    }
  > = {};
  for (const ind of catalog) {
    let score: number | null = null;
    let source: "auto" | "manual" | "none" = "none";
    let autoRaw: string | undefined;
    let autoLabel: string | null | undefined;
    let sourceFetchedDate: string | undefined;

    const manualVal = manual?.[ind.id];
    if (typeof manualVal === "number" && manualVal > 0) {
      score = manualVal;
      source = "manual";
    } else if (!ind.is_manual) {
      const a = autoBySubid.get(ind.subid);
      if (a) {
        autoRaw = a.raw;
        autoLabel = a.label;
        sourceFetchedDate = a.sourceFetchedDate;
        if (typeof a.score === "number" && a.score > 0) {
          score = a.score;
          source = "auto";
        } else if (a.score === "Үнэлэхгүй") {
          score = null;
          source = "auto";
        }
      }
    }
    // Oracle мөр байхгүй эсвэл хоосон утга — score_scale-ийн null_empty_score бодлого
    if (score === null && !ind.is_manual) {
      const empty = resolveEmptyNullScoreFromJson(ind.score_scale);
      if (typeof empty.score === "number" && empty.score > 0) {
        score = empty.score;
        source = "auto";
        autoRaw = autoRaw ?? "";
        autoLabel = autoLabel ?? empty.label ?? "Мэдээлэл байхгүй";
      }
    }

    result[ind.id] = { score, source, autoRaw, autoLabel, sourceFetchedDate };
  }
  return result;
}

/**
 * Compute group weighted averages from dynamic indicator values.
 */
export function computeGroupScoresDynamic(
  catalog: DynamicCatalogIndicator[],
  values: Record<string, { score: number | null }>,
  heldIds?: Set<string>,
): Record<1 | 2 | 3 | 4 | 5, number | null> {
  const sums: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const wts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const ind of catalog) {
    if (heldIds?.has(ind.id)) continue; // held → excluded, weight redistributed naturally
    const v = values[ind.id];
    if (v?.score != null && ind.weight > 0) {
      sums[ind.group] += v.score * ind.weight;
      wts[ind.group] += ind.weight;
    }
  }
  return {
    1: wts[1] > 0 ? sums[1] / wts[1] : null,
    2: wts[2] > 0 ? sums[2] / wts[2] : null,
    3: wts[3] > 0 ? sums[3] / wts[3] : null,
    4: wts[4] > 0 ? sums[4] / wts[4] : null,
    5: wts[5] > 0 ? sums[5] / wts[5] : null,
  };
}

type AggRow = {
  SOLID?: OracleValue;
  BRANCHNAME?: OracleValue;
  SUBID?: OracleValue;
  RESULT?: OracleValue;
  RESULT_TYPE?: OracleValue;
  STATUS?: OracleValue;
  sourceFetchedDate?: string;
  rowType?: string;
};

/** ReportView-тай ижил aggregate тооцоо (tailan export-д ашиглана) */
export function computeBranchAggregates(
  rows: AggRow[],
  manualMap: ManualMap,
  catalog: DynamicCatalogIndicator[],
  weights: DynamicWeights,
  heldIds?: Set<string>,
): BranchAggregate[] {
  const activeCatalog =
    heldIds && heldIds.size > 0
      ? catalog.filter((c) => !heldIds.has(c.id))
      : catalog;
  const catalogCast = activeCatalog as unknown as CatalogEntry[];
  const base = aggregateBranch(rows, {}, {}, catalogCast);

  const byBranch = new Map<string, AggRow[]>();
  for (const r of rows) {
    const id = String(r.SOLID ?? "");
    if (!id) continue;
    const arr = byBranch.get(id);
    if (arr) arr.push(r);
    else byBranch.set(id, [r]);
  }

  return base.map((b) => {
    const branchRows = byBranch.get(b.branchId) ?? [];
    const branchManual = resolveManualBranch(b.branchId, manualMap);
    const ev = computeGroupScoresDynamic(
      activeCatalog,
      evaluateBranchDynamic(activeCatalog, branchRows, branchManual),
      heldIds,
    );
    const w = weights[b.region];
    const s1 = ev[1] ?? b.s1;
    const s2 = ev[2] ?? b.s2;
    const s3 = ev[3] ?? b.s3;
    const s4 = ev[4] ?? b.s4 ?? null;
    const judgmentInd = pickJudgmentIndicator(catalog);
    const snapJ = judgmentInd
      ? readJudgmentScoreFromManual(branchManual, judgmentInd.id)
      : undefined;
    const j = snapJ && snapJ > 0 ? snapJ : null;

    let vsum = 0;
    let wsum = 0;
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
    const total: number | null = wsum > 0 ? vsum / wsum : null;
    const level: RiskLevel | "" =
      total == null
        ? ""
        : total >= 3.5
          ? "Өндөр"
          : total >= 2.5
            ? "Дунд"
            : "Бага";
    return { ...b, s1, s2, s3, s4, j, total, level };
  });
}
