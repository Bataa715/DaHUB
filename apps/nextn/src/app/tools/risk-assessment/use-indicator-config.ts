"use client";

import { useState, useEffect, useCallback } from "react";
import {
  riskIndicatorConfigApi,
  type IndicatorConfig,
  type GroupConfig,
} from "@/lib/api";
import { INDICATOR_CATALOG, type CatalogIndicator } from "./indicator-catalog";
import {
  WEIGHTS,
  computeScoreDynamic,
  type ScoreResult,
  type OracleValue,
} from "./scoring-rules";

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
      is_judgment: c.id === "j-001",
      score_scale: JSON.stringify({ type: "manual", min: 1, max: 5, step: 1 }),
      hint: c.hint,
    }),
  );
  return { catalog, weights: { ...WEIGHTS }, loaded: true, isFallback: true };
}

// ─── Build from DB config ─────────────────────────────────────────────────────

function buildDynamicConfig(
  indicators: IndicatorConfig[],
  groupConfigs: GroupConfig[],
): DynamicConfig {
  const catalog: DynamicCatalogIndicator[] = indicators.map((ind) => ({
    id: ind.id,
    subid: ind.subid,
    name: ind.name,
    group: ind.group_num as 1 | 2 | 3 | 4 | 5,
    weight: ind.weight,
    is_manual: ind.is_manual === 1,
    is_judgment: ind.is_judgment === 1,
    score_scale: ind.score_scale,
    hint: ind.hint || undefined,
  }));

  // Build weights from group config — defaults to hardcoded WEIGHTS if missing
  const wUB = {
    s1: WEIGHTS.UB.s1,
    s2: WEIGHTS.UB.s2,
    s3: WEIGHTS.UB.s3,
    s4: WEIGHTS.UB.s4,
    j: WEIGHTS.UB.j,
  };
  const wLOC = {
    s1: WEIGHTS.LOC.s1,
    s2: WEIGHTS.LOC.s2,
    s3: WEIGHTS.LOC.s3,
    s4: WEIGHTS.LOC.s4,
    j: WEIGHTS.LOC.j,
  };

  const groupKey = (_region: string, gn: number): keyof typeof wUB => {
    const map: Record<number, keyof typeof wUB> = {
      1: "s1",
      2: "s2",
      3: "s3",
      4: "s4",
      5: "j",
    };
    return map[gn] ?? "s1";
  };

  for (const gc of groupConfigs) {
    const key = groupKey(gc.region, gc.group_num);
    // Admin UI stores weights as percentages (e.g. 35 for 35%);
    // convert to decimal fraction for use in the weighted-sum formula.
    const w = gc.weight > 1 ? gc.weight / 100 : gc.weight;
    if (gc.region === "UB") wUB[key] = w;
    else if (gc.region === "LOC") wLOC[key] = w;
  }

  return { catalog, weights: { UB: wUB, LOC: wLOC }, loaded: true };
}

// ─── Module-level cache (бүх ReportView instance хуваалцана) ─────────────────
let _cachedConfig: DynamicConfig | null = null;
let _loadingPromise: Promise<DynamicConfig> | null = null;

function fetchConfig(): Promise<DynamicConfig> {
  if (_cachedConfig) return Promise.resolve(_cachedConfig);
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    try {
      const [indicators, groupConfigs] = await Promise.all([
        riskIndicatorConfigApi.list(),
        riskIndicatorConfigApi.listGroupConfig(),
      ]);
      const cfg =
        indicators.length === 0
          ? buildFallbackConfig()
          : buildDynamicConfig(indicators, groupConfigs);
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
  rows: { SUBID?: OracleValue; RESULT?: OracleValue; RESULT_TYPE?: OracleValue }[],
  manual: Record<string, number> | undefined,
): Record<
  string,
  {
    score: number | null;
    source: "auto" | "manual" | "none";
    autoRaw?: string;
    autoLabel?: string | null;
  }
> {
  // Index Oracle rows by SUBID
  const autoBySubid = new Map<
    string,
    { score: ScoreResult; raw: string; label: string | null }
  >();
  for (const r of rows) {
    const sid = String(r.SUBID ?? "");
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
    });
  }

  const result: Record<
    string,
    {
      score: number | null;
      source: "auto" | "manual" | "none";
      autoRaw?: string;
      autoLabel?: string | null;
    }
  > = {};
  for (const ind of catalog) {
    let score: number | null = null;
    let source: "auto" | "manual" | "none" = "none";
    let autoRaw: string | undefined;
    let autoLabel: string | null | undefined;

    const manualVal = manual?.[ind.id];
    if (typeof manualVal === "number" && manualVal > 0) {
      score = manualVal;
      source = "manual";
    } else if (!ind.is_manual) {
      const a = autoBySubid.get(ind.subid);
      if (a) {
        autoRaw = a.raw;
        autoLabel = a.label;
        if (typeof a.score === "number" && a.score > 0) {
          score = a.score;
          source = "auto";
        }
      }
    }
    // If still no score: check null_is_unelehgui flag.
    // - null_is_unelehgui=true  → missing data is OK, exclude from group avg (weight redistributed)
    // - null_is_unelehgui=false/absent → missing data means worst case → score 5
    if (score === null) {
      let sc: { null_is_unelehgui?: boolean } = {};
      try {
        sc = JSON.parse(ind.score_scale);
      } catch {
        /* ignore */
      }
      if (!sc.null_is_unelehgui) {
        score = 5;
        source = "auto";
        autoRaw = autoRaw ?? "";
        autoLabel = autoLabel ?? "Мэдээлэл байхгүй";
      }
    }

    result[ind.id] = { score, source, autoRaw, autoLabel };
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
