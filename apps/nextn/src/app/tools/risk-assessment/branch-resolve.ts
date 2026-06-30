import type { ManualMap } from "./indicator-catalog";

/** Judgment indicator-ийн хамгийн бага талбар (circular import-оос зайлсхийх) */
export interface JudgmentCatalogEntry {
  id: string;
  subid: string;
  name: string;
  group: number;
  weight: number;
  is_manual: boolean;
  is_judgment: boolean;
  score_scale: string;
  hint?: string;
}

/** Catalog-аас judgment indicator олно (байхгүй бол null) */
export function pickJudgmentIndicator<T extends JudgmentCatalogEntry>(
  catalog: T[],
): T | null {
  if (!catalog.length) return null;
  const marked = catalog.find((c) => c.is_judgment);
  if (marked) return marked;
  const g5 = catalog.find((c) => c.group === 5 && c.is_manual);
  if (g5) return { ...g5, is_judgment: true };
  return null;
}

/** Excel/filter-д judgment-ийг давхардуулахгүй — group 5 гар оруулгыг хасна */
export function nonJudgmentIndicators<T extends JudgmentCatalogEntry>(
  catalog: T[],
): T[] {
  const j = pickJudgmentIndicator(catalog);
  if (!j) return catalog.filter((c) => !c.is_judgment);
  return catalog.filter(
    (c) =>
      c.id !== j.id &&
      !c.is_judgment &&
      !(c.group === 5 && c.is_manual),
  );
}

/** DB catalog: нэг л judgment indicator үлдээнэ */
export function normalizeJudgmentCatalog<T extends JudgmentCatalogEntry>(
  catalog: T[],
): T[] {
  const canonical =
    catalog.find((c) => c.is_judgment) ??
    catalog.find((c) => c.group === 5 && c.is_manual);
  if (!canonical) return catalog;
  return catalog.map((c) => {
    if (c.id === canonical.id) return { ...c, is_judgment: true };
    if (c.is_judgment || (c.group === 5 && c.is_manual))
      return { ...c, is_judgment: false };
    return c;
  });
}

export function readJudgmentScoreFromManual(
  branchManual: Record<string, number> | undefined,
  judgmentIndId: string,
): number | undefined {
  if (!branchManual || !judgmentIndId) return undefined;
  const v = branchManual[judgmentIndId];
  return v != null && v > 0 ? v : undefined;
}

export function resolveJudgementScoreFromMaps(
  branchKey: string,
  manualMap: ManualMap,
  judgmentIndId: string,
  aggJ?: number | null,
  externalJudgements?: Record<string, number>,
): number | null {
  if (aggJ != null && aggJ > 0) return aggJ;
  const key = String(branchKey ?? "").trim();
  if (externalJudgements && key) {
    if ((externalJudgements[key] ?? 0) > 0) return externalJudgements[key];
    const norm = key.replace(/^0+/, "") || key;
    for (const [k, v] of Object.entries(externalJudgements)) {
      const kn = String(k).replace(/^0+/, "") || k;
      if (k === key || kn === norm) return v > 0 ? v : null;
    }
  }
  if (!judgmentIndId) return null;
  return resolveJudgementScore(branchKey, manualMap, judgmentIndId, null);
}

export function resolveManualBranch(
  branchKey: string,
  manualMap: ManualMap,
): Record<string, number> | undefined {
  const key = String(branchKey ?? "").trim();
  if (!key) return undefined;
  if (manualMap[key]) return manualMap[key];
  const norm = key.replace(/^0+/, "") || key;
  for (const [k, v] of Object.entries(manualMap)) {
    const kn = String(k).replace(/^0+/, "") || k;
    if (k === key || kn === norm) return v;
  }
  return undefined;
}

export function resolveJudgementComment(
  branchKey: string,
  comments: Record<string, string> | undefined,
): string {
  if (!comments) return "";
  const key = String(branchKey ?? "").trim();
  if (!key) return "";
  if (comments[key]) return comments[key];
  const norm = key.replace(/^0+/, "") || key;
  for (const [k, v] of Object.entries(comments)) {
    const kn = String(k).trim();
    if (kn === key || (kn.replace(/^0+/, "") || kn) === norm) return v;
  }
  return "";
}

export function resolveJudgementScore(
  branchKey: string,
  manualMap: ManualMap,
  judgmentIndId: string,
  aggJ?: number | null,
): number | null {
  if (aggJ != null && aggJ > 0) return aggJ;
  if (!judgmentIndId) return null;
  const branchManual = resolveManualBranch(branchKey, manualMap);
  if (!branchManual) return null;
  const v = readJudgmentScoreFromManual(branchManual, judgmentIndId);
  return v ?? null;
}
