"use client";

import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  X,
  Download,
  FileSpreadsheet,
  LayoutList,
  Table2,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { classifyBranchTableGroup } from "../scoring-rules";
import {
  computeBranchAggregates,
  pickJudgmentIndicator,
  nonJudgmentIndicators,
  type DynamicCatalogIndicator,
  type DynamicWeights,
} from "../use-indicator-config";
import { mergeJudgementsIntoManualMap } from "../branch-resolve";
import { riskApi, HOLD_GLOBAL_PERIOD, type RiskCurrentRow } from "@/lib/api";
import type { ManualMap } from "../indicator-catalog";
import {
  downloadSummaryXlsx,
  downloadIndicatorXlsx,
  triggerDownload,
} from "./_export/xlsx-download";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  primaryRows: RiskCurrentRow[];
  primaryManualMap: ManualMap;
  primaryJudgements?: Record<string, number>;
  primaryJudgementComments?: Record<string, string>;
  primaryName: string;
  primaryDate: string;
  prevRows: RiskCurrentRow[];
  prevManualMap: ManualMap;
  prevJudgements?: Record<string, number>;
  prevName: string | null;
  catalog: DynamicCatalogIndicator[];
  weights: DynamicWeights;
  currentComparisonId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CsvExportModal({
  open,
  onClose,
  primaryRows,
  primaryManualMap,
  primaryJudgements = {},
  primaryJudgementComments = {},
  primaryName,
  primaryDate,
  prevRows,
  prevManualMap,
  prevJudgements = {},
  prevName,
  catalog,
  weights,
}: Props) {
  type ExportMode = "summary" | "indicator";

  const { t } = useLanguage();
  const [mode, setMode] = useState<ExportMode>("summary");
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeRaw, setIncludeRaw] = useState(false);

  const [selectedIndIds, setSelectedIndIds] = useState<Set<string> | null>(
    null,
  );
  const [indFilterOpen, setIndFilterOpen] = useState(false);
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    riskApi
      .listHolds(HOLD_GLOBAL_PERIOD)
      .then((data) => setHeldIds(new Set(data.map((d) => d.indicatorId))))
      .catch(() => setHeldIds(new Set()));
  }, [open]);

  const activeCatalog = useMemo(
    () =>
      heldIds.size > 0 ? catalog.filter((c) => !heldIds.has(c.id)) : catalog,
    [catalog, heldIds],
  );

  const judgmentInd = useMemo(() => pickJudgmentIndicator(catalog), [catalog]);

  const indByGroup = useMemo(() => {
    const m = new Map<number, DynamicCatalogIndicator[]>();
    for (const c of nonJudgmentIndicators(catalog).sort(
      (a, b) => a.group - b.group || a.name.localeCompare(b.name),
    )) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    if (!m.has(5)) m.set(5, []);
    if (judgmentInd && !m.get(5)!.some((c) => c.id === judgmentInd.id)) {
      m.get(5)!.push(judgmentInd);
    }
    return m;
  }, [catalog, judgmentInd]);

  const allIds = useMemo(() => new Set(catalog.map((c) => c.id)), [catalog]);
  const effectiveSelected = selectedIndIds ?? allIds;
  const allSelected =
    selectedIndIds === null || selectedIndIds.size === allIds.size;

  function toggleInd(id: string) {
    setSelectedIndIds((prev) => {
      const cur = prev ?? new Set(allIds);
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === allIds.size ? null : next;
    });
  }

  function toggleGroup(groupIds: string[]) {
    setSelectedIndIds((prev) => {
      const cur = prev ?? new Set(allIds);
      const allIn = groupIds.every((id) => cur.has(id));
      const next = new Set(cur);
      if (allIn) groupIds.forEach((id) => next.delete(id));
      else groupIds.forEach((id) => next.add(id));
      return next.size === allIds.size ? null : next;
    });
  }

  function selectAll() {
    setSelectedIndIds(null);
  }
  function clearAll() {
    setSelectedIndIds(new Set());
  }

  const hasComparison = prevRows.length > 0 && prevName != null;

  const oraclePrimary = useMemo(
    () => primaryRows.filter((r) => r.rowType === "oracle"),
    [primaryRows],
  );
  const oraclePrev = useMemo(
    () => prevRows.filter((r) => r.rowType === "oracle"),
    [prevRows],
  );

  const primaryManualForAgg = useMemo(
    () =>
      mergeJudgementsIntoManualMap(
        primaryManualMap,
        primaryJudgements,
        catalog,
      ),
    [primaryManualMap, primaryJudgements, catalog],
  );

  const prevManualForAgg = useMemo(
    () => mergeJudgementsIntoManualMap(prevManualMap, prevJudgements, catalog),
    [prevManualMap, prevJudgements, catalog],
  );

  const primaryAgg = useMemo(
    () =>
      computeBranchAggregates(
        oraclePrimary,
        primaryManualForAgg,
        catalog,
        weights,
        heldIds,
      ),
    [oraclePrimary, primaryManualForAgg, catalog, weights, heldIds],
  );

  const prevAgg = useMemo(
    () =>
      hasComparison && includeComparison
        ? computeBranchAggregates(
            oraclePrev,
            prevManualForAgg,
            catalog,
            weights,
            heldIds,
          )
        : null,
    [
      oraclePrev,
      prevManualForAgg,
      hasComparison,
      includeComparison,
      catalog,
      weights,
      heldIds,
    ],
  );

  const doDownload = async () => {
    if (mode === "summary") {
      const buf = await downloadSummaryXlsx(
        primaryAgg,
        prevAgg,
        primaryName,
        primaryDate,
        prevName,
        weights,
      );
      triggerDownload(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Эрсдэлийн_үнэлгээ_${primaryDate || "tailan"}.xlsx`,
      );
    } else {
      const buf = await downloadIndicatorXlsx(
        primaryRows,
        catalog,
        activeCatalog,
        primaryManualMap,
        primaryJudgements,
        primaryJudgementComments,
        primaryAgg,
        selectedIndIds,
        primaryDate,
        primaryName,
        includeRaw,
      );
      triggerDownload(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Эрсдэлийн_indicator_${primaryDate || "detail"}${includeRaw ? "_дэлгэрэнгүй" : ""}.xlsx`,
      );
    }
    onClose();
  };

  if (!open) return null;

  const ubCount = primaryAgg.filter(
    (b) => classifyBranchTableGroup(b.status, b.rating) === "UB",
  ).length;
  const onCount = primaryAgg.length - ubCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-500/15 border border-slate-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                {t("raCsvExportModalTitle")}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {primaryName} · {primaryDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {t("raCsvExportFormatLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("summary")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "summary"
                  ? "border-slate-500/60 bg-slate-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <LayoutList
                  className={`w-3.5 h-3.5 ${mode === "summary" ? "text-slate-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-semibold ${mode === "summary" ? "text-slate-700 dark:text-slate-300" : "text-foreground"}`}
                >
                  {t("riskReportCardTitle")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("raCsvExportSummaryDesc")}
              </p>
            </button>

            <button
              onClick={() => setMode("indicator")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "indicator"
                  ? "border-slate-500/60 bg-slate-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Table2
                  className={`w-3.5 h-3.5 ${mode === "indicator" ? "text-slate-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-semibold ${mode === "indicator" ? "text-slate-700 dark:text-slate-300" : "text-foreground"}`}
                >
                  {t("raCsvExportDetailModeLabel")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("raCsvExportDetailDesc")}
              </p>
            </button>
          </div>
        </div>

        {mode === "summary" && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {t("raCsvExportComparisonLabel")}
            </p>
            {hasComparison ? (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setIncludeComparison((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    includeComparison ? "bg-slate-600" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      includeComparison ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-xs text-foreground/80">
                  {t("raCsvExportIncludePrevToggle")}
                  <span className="ml-1.5 text-muted-foreground text-[11px]">
                    ({prevName})
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">
                {t("raCsvExportNoComparisonHint")}
              </p>
            )}
          </div>
        )}

        {mode === "indicator" && (
          <>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("raCsvExportIndFilterLabel")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-[11px] text-slate-600 dark:text-slate-300 hover:underline"
                  >
                    {t("admRegAllTab")}
                  </button>
                  <span className="text-muted-foreground text-[11px]">/</span>
                  <button
                    onClick={clearAll}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    {t("admReportsClearBtn")}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setIndFilterOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-xs text-foreground/80">
                    {allSelected
                      ? t("raCsvExportAllIndSelected")
                      : `${effectiveSelected.size} / ${allIds.size} ${t("raCsvExportIndSelectedSuffix")}`}
                  </span>
                  {indFilterOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>

                {indFilterOpen && (
                  <div className="max-h-52 overflow-y-auto divide-y divide-border/50">
                    {[...indByGroup.entries()].map(([grp, inds]) => {
                      const groupIds = inds.map((c) => c.id);
                      const allGroupIn = groupIds.every((id) =>
                        effectiveSelected.has(id),
                      );
                      const someGroupIn = groupIds.some((id) =>
                        effectiveSelected.has(id),
                      );
                      return (
                        <div key={grp}>
                          <button
                            onClick={() => toggleGroup(groupIds)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                                allGroupIn
                                  ? "bg-slate-600 border-slate-600"
                                  : someGroupIn
                                    ? "bg-slate-500/40 border-slate-400"
                                    : "border-border bg-background"
                              }`}
                            >
                              {(allGroupIn || someGroupIn) && (
                                <Check className="w-2.5 h-2.5 text-white" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-foreground/70">
                              Score {grp}
                            </span>
                            <span className="text-[11px] text-muted-foreground ml-auto">
                              {
                                groupIds.filter((id) =>
                                  effectiveSelected.has(id),
                                ).length
                              }
                              /{groupIds.length}
                            </span>
                          </button>
                          {inds.map((ind) => {
                            const checked = effectiveSelected.has(ind.id);
                            return (
                              <button
                                key={ind.id}
                                onClick={() => toggleInd(ind.id)}
                                className="w-full flex items-center gap-2 pl-7 pr-3 py-1 hover:bg-muted/30 transition-colors text-left"
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                                    checked
                                      ? "bg-slate-600 border-slate-600"
                                      : "border-border bg-background"
                                  }`}
                                >
                                  {checked && (
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  )}
                                </div>
                                <span className="text-[11px] text-foreground/80 truncate">
                                  {ind.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {t("raCsvExportContentLabel")}
              </p>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setIncludeRaw((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    includeRaw ? "bg-slate-600" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      includeRaw ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
                <div>
                  <span className="text-xs text-foreground/80">
                    {t("raCsvExportIncludeRawToggle")}
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("raCsvExportRawDesc")}
                  </p>
                </div>
              </label>
            </div>
          </>
        )}

        <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 mb-5 space-y-0.5">
          {mode === "summary" ? (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t("raCsvExportUbBranchLabel")}
                </span>
                <span className="font-semibold tabular-nums">{ubCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t("raCsvExportOnBranchLabel")}
                </span>
                <span className="font-semibold tabular-nums">{onCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t("raCsvExportComparisonLabel")}
                </span>
                <span className="font-semibold">
                  {hasComparison && includeComparison ? prevName : "—"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t("raCsvExportBranchWord")}
                </span>
                <span className="font-semibold tabular-nums">
                  {primaryAgg.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Indicator</span>
                <span className="font-semibold tabular-nums">
                  {allSelected ? catalog.length : effectiveSelected.size}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted/40 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={doDownload}
            disabled={mode === "indicator" && effectiveSelected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {t("reportsOutputExcel")}
          </button>
        </div>
      </div>
    </div>
  );
}
