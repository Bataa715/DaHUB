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
/** SOLID / branchId түлхүүрүүдийг тааруулах (01001 vs 1001) */
export function lookupBranchRecord<T>(
  map: Record<string, T> | undefined,
  branchKey: string,
): T | undefined {
  if (!map) return undefined;
  const key = String(branchKey ?? "").trim();
  if (!key) return undefined;
  if (map[key] !== undefined) return map[key];
  const norm = key.replace(/^0+/, "") || key;
  for (const [k, v] of Object.entries(map)) {
    const kn = String(k).trim();
    const knNorm = kn.replace(/^0+/, "") || kn;
    if (kn === key || knNorm === norm) return v;
  }
  return undefined;
}

export function lookupJudgementScore(
  judgements: Record<string, number> | undefined,
  branchKey: string,
): number | null {
  const v = lookupBranchRecord(judgements, branchKey);
  return v != null && v > 0 ? v : null;
}

/** Oracle SOLID-уудтай тааруулж judgement map үүсгэнэ */
export function judgementsFromListForBranches(
  list: { branchId: string; score: number; comment?: string }[],
  branchIds: string[],
): { scores: Record<string, number>; comments: Record<string, string> } {
  const known = branchIds.map((s) => String(s ?? "").trim()).filter(Boolean);
  const scores: Record<string, number> = {};
  const comments: Record<string, string> = {};
  for (const j of list) {
    const raw = String(j.branchId ?? "").trim();
    if (!raw) continue;
    let canon = raw;
    const norm = raw.replace(/^0+/, "") || raw;
    for (const id of known) {
      const idNorm = id.replace(/^0+/, "") || id;
      if (id === raw || idNorm === norm) {
        canon = id;
        break;
      }
    }
    if (j.score > 0) scores[canon] = j.score;
    const c = String(j.comment ?? "").trim();
    if (c) comments[canon] = c;
  }
  return { scores, comments };
}

/**
 * Ачаалсан огноонд хамгийн ойр judgement огноог сонгоно:
 * 1) тухайн өдөр байвал түүнийг
 * 2) эсвэл <= огнооны хамгийн сүүлийн (fill-forward)
 * 3) өнгөрсөнд байхгүй бол > огнооны хамгийн ойр ирээдүй
 */
export function resolveNearestJudgements(
  allJudge: {
    branchId: string;
    fetchedDate: string;
    score: number;
    comment?: string;
  }[],
  anchorDate: string,
  branchIds: string[],
): {
  scores: Record<string, number>;
  comments: Record<string, string>;
  judgementDate: string | null;
} {
  const anchor = String(anchorDate ?? "").slice(0, 10);
  const empty = {
    scores: {} as Record<string, number>,
    comments: {} as Record<string, string>,
    judgementDate: null as string | null,
  };
  if (!anchor) return empty;

  const dated = allJudge
    .filter((j) => j.score > 0)
    .map((j) => ({
      ...j,
      d: String(j.fetchedDate ?? "").slice(0, 10),
    }))
    .filter((j) => /^\d{4}-\d{2}-\d{2}$/.test(j.d));

  if (dated.length === 0) return empty;

  const uniqueDates = Array.from(new Set(dated.map((j) => j.d))).sort();
  const pastOrSame = uniqueDates.filter((d) => d <= anchor);
  const chosen =
    pastOrSame[pastOrSame.length - 1] ??
    uniqueDates.find((d) => d > anchor) ??
    null;
  if (!chosen) return empty;

  const list = dated.filter((j) => j.d === chosen);
  const mapped = judgementsFromListForBranches(list, branchIds);
  return { ...mapped, judgementDate: chosen };
}

export function normalizeBranchKeyedMap<T>(
  map: Record<string, T>,
  branchIds: string[],
): Record<string, T> {
  const known = branchIds.map((s) => String(s ?? "").trim()).filter(Boolean);
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) {
    const raw = String(k).trim();
    if (!raw) continue;
    let canon = raw;
    const norm = raw.replace(/^0+/, "") || raw;
    for (const id of known) {
      const idNorm = id.replace(/^0+/, "") || id;
      if (id === raw || idNorm === norm) {
        canon = id;
        break;
      }
    }
    out[canon] = v;
  }
  return out;
}

export function oracleSolidsFromRows(
  rows: { rowType?: string; SOLID?: string | number | null }[],
): string[] {
  return rows
    .filter((r) => r.rowType === "oracle")
    .map((r) => String(r.SOLID ?? "").trim())
    .filter(Boolean);
}

export function resolveBranchJudgementScore(
  branchKey: string,
  externalJudgements: Record<string, number> | null | undefined,
  manualMap: ManualMap,
  judgmentIndId: string | undefined,
): number | null {
  if (externalJudgements != null) {
    return lookupJudgementScore(externalJudgements, branchKey);
  }
  if (!judgmentIndId) return null;
  const manual = resolveManualBranch(branchKey, manualMap);
  return readJudgmentScoreFromManual(manual, judgmentIndId) ?? null;
}

export function pickJudgmentIndicator<T extends JudgmentCatalogEntry>(
  catalog: T[],
): T | null {
  if (!catalog.length) return null;
  const marked = catalog.find((c) => c.is_judgment);
  if (marked) return marked;
  const g5 =
    catalog.find((c) => c.group === 5 && c.is_manual) ??
    catalog.find((c) => c.group === 5);
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
    (c) => c.id !== j.id && !c.is_judgment && !(c.group === 5 && c.is_manual),
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
  const ext = lookupJudgementScore(externalJudgements, branchKey);
  if (ext != null) return ext;
  if (!judgmentIndId) return null;
  return resolveJudgementScore(branchKey, manualMap, judgmentIndId, null);
}

export function judgementsFromManualSnapshot(
  manualMap: ManualMap,
  catalog: JudgmentCatalogEntry[],
): Record<string, number> {
  const judgmentIds = new Set<string>();
  const j = pickJudgmentIndicator(catalog);
  if (j) judgmentIds.add(j.id);
  for (const c of catalog) {
    if (c.is_judgment || (c.group === 5 && c.is_manual)) {
      judgmentIds.add(c.id);
    }
  }
  const out: Record<string, number> = {};
  for (const [branchId, indMap] of Object.entries(manualMap)) {
    if (!indMap) continue;
    for (const id of judgmentIds) {
      const v = indMap[id];
      if (v != null && v > 0) {
        out[branchId] = v;
        break;
      }
    }
  }
  return out;
}

export function judgementCommentsFromList(
  list: { branchId: string; comment: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const j of list) {
    const c = String(j.comment ?? "").trim();
    if (c) out[j.branchId] = c;
  }
  return out;
}

export function judgementsFromList(
  list: { branchId: string; score: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const j of list) {
    if (j.score > 0) out[j.branchId] = j.score;
  }
  return out;
}

export function mergeJudgementsIntoManualMap(
  manualMap: ManualMap,
  judgements: Record<string, number>,
  catalog: JudgmentCatalogEntry[],
): ManualMap {
  const j = pickJudgmentIndicator(catalog);
  if (!j || Object.keys(judgements).length === 0) return manualMap;
  const out: ManualMap = { ...manualMap };
  for (const [branchId, score] of Object.entries(judgements)) {
    if (score <= 0) continue;
    out[branchId] = { ...(out[branchId] || {}), [j.id]: score };
  }
  return out;
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
  const v = lookupBranchRecord(comments, branchKey);
  return v != null ? String(v) : "";
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
