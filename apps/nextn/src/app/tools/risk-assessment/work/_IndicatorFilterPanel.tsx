"use client";

import { useEffect, useMemo } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  evaluateBranchDynamic,
  pickJudgmentIndicator,
  nonJudgmentIndicators,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import {
  resolveManualBranch,
  resolveBranchJudgementScore,
} from "../branch-resolve";
import type { ManualMap } from "../indicator-catalog";
import type { RiskCurrentRow } from "@/lib/api";

interface Props {
  rows: RiskCurrentRow[];
  catalog: DynamicCatalogIndicator[];
  catalogLoaded?: boolean;
  manualMap: ManualMap;
  /** ReportView-ийн externalJudgements-тэй ижил */
  externalJudgements?: Record<string, number>;
  selectedIndId: string;
  onSelectInd: (id: string) => void;
  onClose: () => void;
}

function isJudgmentIndicator(
  ind: DynamicCatalogIndicator,
  judgmentInd: DynamicCatalogIndicator | null,
): boolean {
  if (ind.is_judgment || ind.group === 5) return true;
  return judgmentInd != null && ind.id === judgmentInd.id;
}

export default function IndicatorFilterPanel({
  rows,
  catalog,
  catalogLoaded = true,
  manualMap,
  externalJudgements,
  selectedIndId,
  onSelectInd,
  onClose,
}: Props) {
  const { t } = useLanguage();
  const judgmentInd = useMemo(() => pickJudgmentIndicator(catalog), [catalog]);

  // ReportView catalog-тай ижил — judgment нэг л удаа
  const byGroup = useMemo(() => {
    const m = new Map<number, DynamicCatalogIndicator[]>();
    for (const c of nonJudgmentIndicators(catalog).sort(
      (a, b) => a.group - b.group || Number(a.subid) - Number(b.subid),
    )) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    if (judgmentInd) {
      if (!m.has(5)) m.set(5, []);
      if (!m.get(5)!.some((x) => x.id === judgmentInd.id)) {
        m.get(5)!.push(judgmentInd);
      }
    }
    return m;
  }, [catalog, judgmentInd]);

  // Шүүлтүүр нээхэд judgment автоматаар сонгох
  useEffect(() => {
    if (!catalogLoaded || !judgmentInd || selectedIndId) return;
    onSelectInd(judgmentInd.id);
  }, [catalogLoaded, judgmentInd, selectedIndId, onSelectInd]);

  const selectedInd =
    catalog.find((c) => c.id === selectedIndId) ??
    (judgmentInd && selectedIndId === judgmentInd.id ? judgmentInd : null);

  const isJudgmentSelected =
    selectedInd != null && isJudgmentIndicator(selectedInd, judgmentInd);

  const judgmentIndId = judgmentInd?.id;

  const byBranch = useMemo(() => {
    const m = new Map<string, { name: string; oracleRows: RiskCurrentRow[] }>();
    for (const r of rows) {
      if (r.rowType !== "oracle") continue;
      const id = String(r.SOLID ?? "");
      if (!id) continue;
      if (!m.has(id))
        m.set(id, { name: String(r.BRANCHNAME ?? ""), oracleRows: [] });
      m.get(id)!.oracleRows.push(r);
    }
    return m;
  }, [rows]);

  const branchScores = useMemo(() => {
    if (!selectedInd) return [];
    return [...byBranch.entries()]
      .map(([solid, b]) => {
        if (isJudgmentSelected) {
          const score = resolveBranchJudgementScore(
            solid,
            externalJudgements,
            manualMap,
            judgmentIndId,
          );
          return {
            solid,
            name: b.name,
            score,
            source: "manual" as const,
            autoRaw: "",
          };
        }
        const branchManual = resolveManualBranch(solid, manualMap);
        const ev = evaluateBranchDynamic(catalog, b.oracleRows, branchManual);
        const val = ev[selectedInd.id];
        return {
          solid,
          name: b.name,
          score: val?.score ?? null,
          source: val?.source ?? ("none" as const),
          autoRaw: val?.autoRaw ?? "",
        };
      })
      .sort(
        (a, b) =>
          Number(a.solid) - Number(b.solid) || a.solid.localeCompare(b.solid),
      );
  }, [
    selectedInd,
    isJudgmentSelected,
    byBranch,
    catalog,
    manualMap,
    externalJudgements,
    judgmentIndId,
  ]);

  const filledCount = branchScores.filter((b) => b.score != null).length;
  const avgScore =
    filledCount > 0
      ? branchScores.reduce(
          (s, b) => s + (typeof b.score === "number" ? b.score : 0),
          0,
        ) / filledCount
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="flex items-center justify-between px-6 py-3 border-b-2 border-border shrink-0 bg-card">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <SlidersHorizontal className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-base font-bold tracking-tight">
            {t("raFilterPanelTitle")}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 py-3 border-b border-border bg-muted/20 shrink-0 flex items-center gap-3 flex-wrap">
        <select
          value={selectedIndId}
          onChange={(e) => onSelectInd(e.target.value)}
          disabled={!catalogLoaded}
          className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/30 min-w-[300px] cursor-pointer disabled:opacity-50"
        >
          <option value="">
            {catalogLoaded
              ? t("raFilterPanelSelectPlaceholder")
              : t("raFilterPanelConfigLoading")}
          </option>
          {[...byGroup.entries()].map(([grp, inds]) => (
            <optgroup key={grp} label={`── Score ${grp} ──`}>
              {inds.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {selectedInd && (
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                selectedInd.is_manual || isJudgmentSelected
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
              }`}
            >
              {selectedInd.is_manual || isJudgmentSelected
                ? t("raFilterPanelManualBadge")
                : t("raFilterPanelAutoBadge")}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Score {selectedInd.group}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">
              {filledCount}/{branchScores.length} {t("raFilterPanelEvaluatedSuffix")}
            </span>
            {avgScore != null && (
              <>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] font-semibold text-foreground/70">
                  {t("tailan_avgLabel")}: {avgScore.toFixed(2)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {!catalogLoaded ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {t("raFilterPanelFullLoading")}
        </div>
      ) : selectedInd ? (
        <div className="flex-1 overflow-auto px-6 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 sticky top-0 z-10">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-9">
                  #
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("raSharedBranchNameCol")}
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">
                  SOLID
                </th>
                {!isJudgmentSelected && (
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                    {t("raFilterPanelValueCol")}
                  </th>
                )}
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">
                  {t("admRiskIndColScore")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {branchScores.map((b, i) => (
                <tr
                  key={b.solid}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5 text-muted-foreground/40 tabular-nums text-[11px]">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[12px]">
                    {b.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                    {b.solid}
                  </td>
                  {!isJudgmentSelected && (
                    <td className="px-4 py-2.5 text-right">
                      {b.autoRaw ? (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {b.autoRaw}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30 text-[11px]">
                          —
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    {b.score != null ? (
                      <span
                        className={`inline-block tabular-nums font-bold text-xl leading-none ${
                          b.source === "manual"
                            ? "text-amber-500"
                            : b.score >= 4
                              ? "text-red-500"
                              : b.score >= 3
                                ? "text-orange-500"
                                : b.score >= 2
                                  ? "text-yellow-500"
                                  : "text-emerald-500"
                        }`}
                      >
                        {b.score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xl font-bold">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("raFilterPanelSelectHint")}
          </p>
        </div>
      )}
    </div>
  );
}
