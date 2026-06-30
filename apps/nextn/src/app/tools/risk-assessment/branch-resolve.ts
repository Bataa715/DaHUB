import type { ManualMap } from "./indicator-catalog";

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
  const branchManual = resolveManualBranch(branchKey, manualMap);
  if (!branchManual) return null;
  const v = branchManual["j-001"] ?? branchManual[judgmentIndId];
  return v != null && v > 0 ? v : null;
}
