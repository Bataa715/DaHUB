"use client";

import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { riskLevelClass, type BranchAggregate } from "../scoring-rules";
import {
  evaluateBranchDynamic,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import { type AnyRow } from "./types";

// ── Дэлгэрэнгүй: нэг салбарын бүх үзүүлэлтийн утга + score ─────────────────
const GROUP_LABELS: Record<number, { label: string; color: string }> = {
  1: {
    label: "S1",
    color: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25",
  },
  2: {
    label: "S2",
    color:
      "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25",
  },
  3: {
    label: "S3",
    color:
      "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
  },
  4: {
    label: "S4",
    color:
      "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  },
  5: {
    label: "J",
    color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25",
  },
};

const SCORE_COMPARISON_COLS = [
  {
    label: "S1",
    key: "s1" as const,
    cls: "text-sky-600 dark:text-sky-400 bg-sky-500/5 border-sky-500/20",
  },
  {
    label: "S2",
    key: "s2" as const,
    cls: "text-violet-600 dark:text-violet-400 bg-violet-500/5 border-violet-500/20",
  },
  {
    label: "S3",
    key: "s3" as const,
    cls: "text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/20",
  },
  {
    label: "S4",
    key: "s4" as const,
    cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/20",
  },
  {
    label: "J",
    key: "j" as const,
    cls: "text-rose-600 dark:text-rose-400 bg-rose-500/5 border-rose-500/20",
  },
  {
    label: "Нийт",
    key: "total" as const,
    cls: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/20",
  },
] as const;

function normDate(d: string | undefined): string {
  return d ? String(d).slice(0, 10) : "";
}

function isStaleIndicatorData(
  sourceDate: string | undefined,
  referenceDate: string | undefined,
): boolean {
  const ref = normDate(referenceDate);
  const src = normDate(sourceDate);
  if (!ref || !src) return false;
  return src !== ref;
}

function hasEvaluatedScore(score: number | null | undefined): boolean {
  return score != null && score > 0;
}

export function IndicatorDetailRow({
  branchName,
  catalog,
  rawRows,
  manualValues,
  colSpan,
  currentAgg,
  previousAgg,
  hideComparison = false,
  hideUnevaluatedInDetail = false,
  dataReferenceDate,
  judgementScore,
  judgementComment,
}: {
  branchId: string;
  branchName: string;
  catalog: DynamicCatalogIndicator[];
  rawRows: AnyRow[];
  manualValues: Record<string, number> | undefined;
  colSpan: number;
  currentAgg?: BranchAggregate;
  previousAgg?: BranchAggregate;
  hideComparison?: boolean;
  hideUnevaluatedInDetail?: boolean;
  dataReferenceDate?: string;
  judgementScore?: number | null;
  judgementComment?: string;
}) {
  const { t } = useLanguage();
  const evals = useMemo(
    () => evaluateBranchDynamic(catalog, rawRows, manualValues),
    [catalog, rawRows, manualValues],
  );

  const grouped = useMemo(() => {
    const g: Record<
      number,
      {
        ind: DynamicCatalogIndicator;
        ev: {
          score: number | null;
          source: string;
          autoRaw?: string;
          autoLabel?: string | null;
          sourceFetchedDate?: string;
        };
      }[]
    > = {};
    for (const ind of catalog) {
      if (ind.is_judgment || ind.group === 5) continue; // Judgement дэлгэрэнгүйд харуулахгүй
      const ev = evals[ind.id] ?? { score: null, source: "none" };
      if (hideUnevaluatedInDetail && !hasEvaluatedScore(ev.score)) continue;
      const grp = ind.group;
      if (!g[grp]) g[grp] = [];
      g[grp].push({ ind, ev });
    }
    for (const grp of Object.keys(g)) {
      g[Number(grp)].sort((a, b) => {
        if (!hideUnevaluatedInDetail) {
          const aNo = !hasEvaluatedScore(a.ev.score);
          const bNo = !hasEvaluatedScore(b.ev.score);
          if (aNo !== bNo) return aNo ? 1 : -1;
        }
        const na = parseFloat(a.ind.subid ?? "") || 0;
        const nb = parseFloat(b.ind.subid ?? "") || 0;
        if (na !== nb) return na - nb;
        return (a.ind.subid ?? "").localeCompare(b.ind.subid ?? "");
      });
    }
    return g;
  }, [catalog, evals, hideUnevaluatedInDetail]);

  return (
    <tr className="border-t border-sky-500/20 bg-sky-500/3">
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              {branchName} — {t("raReportViewDetailSuffix")}
            </div>
            <div className="flex items-center gap-2">
              {currentAgg?.total != null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-muted/40 text-[10px] font-bold tabular-nums text-foreground/80">
                  {t("raReportViewFinalScoreLabel")} {currentAgg.total.toFixed(2)} / 5
                  <span className="text-sky-600 dark:text-sky-400">
                    ({Math.round((currentAgg.total / 5) * 100)}%)
                  </span>
                </span>
              )}
              {currentAgg?.level && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${riskLevelClass(currentAgg.level)}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${currentAgg.level === "Өндөр" ? "bg-red-500" : currentAgg.level === "Дунд" ? "bg-amber-500" : "bg-emerald-500"}`}
                  />
                  {currentAgg.level}
                </span>
              )}
            </div>
          </div>

          {(judgementScore != null && judgementScore > 0) ||
          judgementComment ? (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                {t("raReportViewAuditorJudgementLabel")}
              </p>
              {judgementScore != null && judgementScore > 0 && (
                <p className="text-xs">
                  <span className="text-muted-foreground">
                    {t("raReportViewScoreLabel")}{" "}
                  </span>
                  <span className="font-bold tabular-nums text-rose-700 dark:text-rose-400">
                    {judgementScore % 1 === 0
                      ? judgementScore.toFixed(0)
                      : judgementScore.toFixed(1)}
                  </span>
                </p>
              )}
              {judgementComment ? (
                <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {judgementComment}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  {t("raReportViewNoCommentTooltip")}
                </p>
              )}
            </div>
          ) : null}

          {/* ── Харьцуулалтын score карт ── */}
          {!hideComparison && currentAgg && previousAgg && (
            <div className="rounded-xl border border-dashed border-border bg-gradient-to-br from-muted/30 to-muted/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <span className="w-3 h-px bg-muted-foreground/40" />
                {t("raReportViewComparisonTitle")}
                <span className="w-3 h-px bg-muted-foreground/40" />
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SCORE_COMPARISON_COLS.map(({ label, key, cls }) => {
                  const cur =
                    key === "s4" || key === "j"
                      ? (currentAgg[key] ?? 0) > 0
                        ? (currentAgg[key] as number)
                        : null
                      : (currentAgg[key] as number | null);
                  const pv =
                    key === "s4" || key === "j"
                      ? (previousAgg[key] ?? 0) > 0
                        ? (previousAgg[key] as number)
                        : null
                      : (previousAgg[key] as number | null);
                  const d = cur != null && pv != null ? cur - pv : null;
                  return (
                    <div
                      key={label}
                      className={`rounded-lg border p-2.5 ${cls}`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        {key === "total" ? t("raReportViewTotalCardLabel") : label}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold tabular-nums leading-none">
                          {cur != null ? cur.toFixed(2) : "—"}
                        </span>
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                          ← {pv != null ? pv.toFixed(2) : "—"}
                        </span>
                      </div>
                      {d != null ? (
                        <p
                          className={`text-[10px] font-bold tabular-nums mt-1 ${
                            d > 0.005
                              ? "text-rose-500"
                              : d < -0.005
                                ? "text-emerald-500"
                                : "text-muted-foreground/50"
                          }`}
                        >
                          {d > 0.005
                            ? `▲ +${d.toFixed(2)}`
                            : d < -0.005
                              ? `▼ ${d.toFixed(2)}`
                              : "━ 0.00"}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/30 mt-1">
                          {t("raReportViewNewLabel")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {([1, 2, 3, 4, 5] as const).map((grp) => {
            const items = grouped[grp];
            if (!items || items.length === 0) return null;
            const gl = GROUP_LABELS[grp];
            return (
              <div key={grp}>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold mb-1.5 ${gl.color}`}
                >
                  {gl.label}
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-muted-foreground/60 uppercase text-[10px]">
                      <th className="text-left py-0.5 pr-3 font-semibold w-8">
                        ID
                      </th>
                      <th className="text-left py-0.5 pr-3 font-semibold">
                        {t("raReportViewIndicatorNameCol")}
                      </th>
                      <th className="text-right py-0.5 pr-3 font-semibold">
                        {t("raReportViewValueResultCol")}
                      </th>
                      <th className="text-center py-0.5 font-semibold w-16">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ ind, ev }) => (
                      <tr
                        key={ind.id}
                        className="border-t border-border/30 hover:bg-accent/20"
                      >
                        <td className="py-1 pr-3 text-muted-foreground/50 font-mono tabular-nums">
                          {ind.subid || ind.id}
                        </td>
                        <td className="py-1 pr-3 font-medium text-foreground/90">
                          {ind.name}
                        </td>
                        <td className="py-1 pr-3 tabular-nums font-semibold text-right text-foreground">
                          {ev.autoRaw !== undefined ? (
                            <span className="inline-flex items-center justify-end gap-1.5 w-full">
                              <span>{ev.autoRaw || "—"}</span>
                              {isStaleIndicatorData(
                                ev.sourceFetchedDate,
                                dataReferenceDate,
                              ) && (
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                                  title={`${t("raReportViewStaleDataTooltip")} (${normDate(ev.sourceFetchedDate)})`}
                                />
                              )}
                            </span>
                          ) : ind.is_manual ? (
                            <span className="text-muted-foreground/40 italic">
                              {t("raReportViewManualEntry")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1 text-center tabular-nums font-semibold">
                          {ev.score != null && ev.score > 0 ? (
                            <span
                              className={
                                ev.score <= 1.5
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : ev.score <= 2.5
                                    ? "text-lime-600 dark:text-lime-400"
                                    : ev.score <= 3.5
                                      ? "text-amber-600 dark:text-amber-400"
                                      : ev.score <= 4.5
                                        ? "text-orange-600 dark:text-orange-400"
                                        : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {ev.score.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}
