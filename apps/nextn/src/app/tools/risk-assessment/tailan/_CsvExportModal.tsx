"use client";

import { useState, useMemo } from "react";
import { X, Download, FileSpreadsheet, LayoutList, Table2, ChevronDown, ChevronUp, Check } from "lucide-react";
import {
  aggregateBranch,
  type BranchAggregate,
  type CatalogEntry,
} from "../scoring-rules";
import {
  evaluateBranchDynamic,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import type { RiskCurrentRow } from "@/lib/api";
import type { ManualMap } from "../indicator-catalog";
import type { RiskHistoryEntry } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null) return "";
  return n.toFixed(d);
}

function buildSummaryCsv(
  agg: BranchAggregate[],
  prevAgg: BranchAggregate[] | null,
  primaryName: string,
  prevName: string | null,
): string {
  const prevMap = prevAgg
    ? new Map(prevAgg.map((a) => [a.branchId, a]))
    : null;

  const baseHeaders = [
    "Салбарын нэр",
    "SOLID",
    "Score 1",
    "Score 2",
    "Score 3",
    "Score 4",
    "J",
    "Нийт",
    "Түвшин",
  ];
  const prevHeaders = prevMap
    ? [
        `S1 (${prevName})`,
        `S2 (${prevName})`,
        `S3 (${prevName})`,
        `S4 (${prevName})`,
        `J (${prevName})`,
        `Нийт (${prevName})`,
        "Нийт өөрчлөлт",
      ]
    : [];

  const rows: string[][] = [
    [...baseHeaders, ...prevHeaders],
    ...agg.map((a) => {
      const base = [
        a.branchName,
        a.solid,
        fmt(a.s1),
        fmt(a.s2),
        fmt(a.s3),
        fmt(a.s4),
        fmt(a.j),
        fmt(a.total),
        a.level || "",
      ];
      if (prevMap) {
        const p = prevMap.get(a.branchId);
        const diff =
          a.total != null && p?.total != null
            ? a.total - p.total
            : null;
        base.push(
          fmt(p?.s1),
          fmt(p?.s2),
          fmt(p?.s3),
          fmt(p?.s4),
          fmt(p?.j),
          fmt(p?.total),
          diff != null ? (diff >= 0 ? `+${fmt(diff)}` : fmt(diff)) : "",
        );
      }
      return base;
    }),
  ];

  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function buildIndicatorCsv(
  rows: RiskCurrentRow[],
  catalog: DynamicCatalogIndicator[],
  manualMap: ManualMap,
  filterIds: Set<string> | null,
  includeRaw = false,
): string {
  const sorted = [...catalog]
    .filter((c) => !filterIds || filterIds.has(c.id))
    .sort((a, b) => a.group - b.group || a.id.localeCompare(b.id));

  const byBranch = new Map<string, { name: string; rows: RiskCurrentRow[] }>();
  for (const r of rows) {
    if (r.rowType !== "oracle") continue;
    const id = String(r.SOLID ?? "");
    if (!id) continue;
    if (!byBranch.has(id))
      byBranch.set(id, { name: String(r.BRANCHNAME ?? ""), rows: [] });
    byBranch.get(id)!.rows.push(r);
  }

  const header = [
    "Салбарын нэр",
    "SOLID",
    ...sorted.flatMap((c) =>
      includeRaw
        ? [`[G${c.group}] ${c.name} (Оноо)`, `[G${c.group}] ${c.name} (Утга)`]
        : [`[G${c.group}] ${c.name}`],
    ),
  ];

  const dataRows = [...byBranch.entries()].map(([solid, b]) => {
    const ev = evaluateBranchDynamic(catalog, b.rows, manualMap[solid]);
    return [
      b.name,
      solid,
      ...sorted.flatMap((c) => {
        const val = ev[c.id];
        const score = val?.score != null ? fmt(val.score, 2) : "";
        if (!includeRaw) return [score];
        const raw = val?.autoRaw ?? "";
        return [score, raw];
      }),
    ];
  });

  dataRows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), "mn"));

  return [header, ...dataRows].map((r) => r.map(esc).join(",")).join("\n");
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  primaryRows: RiskCurrentRow[];
  primaryManualMap: ManualMap;
  primaryName: string;
  primaryDate: string;
  prevRows: RiskCurrentRow[];
  prevManualMap: ManualMap;
  prevName: string | null;
  catalog: DynamicCatalogIndicator[];
  historyList: RiskHistoryEntry[];
  // Аль харьцуулах тайлан одоо сонгогдсон байгааг дамжуулна
  currentComparisonId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CsvExportModal({
  open,
  onClose,
  primaryRows,
  primaryManualMap,
  primaryName,
  primaryDate,
  prevRows,
  prevManualMap,
  prevName,
  catalog,
  historyList,
  currentComparisonId,
}: Props) {
  type ExportMode = "summary" | "indicator";

  const [mode, setMode] = useState<ExportMode>("summary");
  const [includeComparison, setIncludeComparison] = useState(true);
  const [selectedCompId, setSelectedCompId] = useState(currentComparisonId);
  const [includeRaw, setIncludeRaw] = useState(false);

  // Indicator filter state — null = бүгд сонгогдсон
  const [selectedIndIds, setSelectedIndIds] = useState<Set<string> | null>(null);
  const [indFilterOpen, setIndFilterOpen] = useState(false);

  // Indicator-уудыг бүлгээр нь ангилах
  const indByGroup = useMemo(() => {
    const m = new Map<number, DynamicCatalogIndicator[]>();
    for (const c of [...catalog].sort((a, b) => a.group - b.group || a.name.localeCompare(a.name))) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    return m;
  }, [catalog]);

  const allIds = useMemo(() => new Set(catalog.map((c) => c.id)), [catalog]);
  const effectiveSelected = selectedIndIds ?? allIds;
  const allSelected = selectedIndIds === null || selectedIndIds.size === allIds.size;

  function toggleInd(id: string) {
    setSelectedIndIds((prev) => {
      const cur = prev ?? new Set(allIds);
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // бүгд сонгогдсон бол null болго
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

  function selectAll() { setSelectedIndIds(null); }
  function clearAll() { setSelectedIndIds(new Set()); }

  const hasComparison = prevRows.length > 0 && prevName != null;

  const catalogCasted = catalog as unknown as CatalogEntry[];

  // manualMap-с judgement утгуудыг гаргах (key = "j-001")
  const primaryJudgeMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [branchId, indMap] of Object.entries(primaryManualMap)) {
      const v = (indMap as Record<string, number>)["j-001"];
      if (v && v > 0) m[branchId] = v;
    }
    return m;
  }, [primaryManualMap]);

  const prevJudgeMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [branchId, indMap] of Object.entries(prevManualMap)) {
      const v = (indMap as Record<string, number>)["j-001"];
      if (v && v > 0) m[branchId] = v;
    }
    return m;
  }, [prevManualMap]);

  const primaryAgg = useMemo(
    () => aggregateBranch(primaryRows.filter(r => r.rowType === "oracle"), {}, primaryJudgeMap, catalogCasted),
    [primaryRows, primaryJudgeMap, catalogCasted],
  );

  const prevAgg = useMemo(
    () =>
      hasComparison && includeComparison
        ? aggregateBranch(prevRows.filter(r => r.rowType === "oracle"), {}, prevJudgeMap, catalogCasted)
        : null,
    [prevRows, hasComparison, includeComparison, prevJudgeMap, catalogCasted],
  );

  const doDownload = () => {
    let content = "";
    let filename = "";

    if (mode === "summary") {
      content = buildSummaryCsv(primaryAgg, prevAgg, primaryName, prevName);
      filename = `risk-summary-${primaryDate}.csv`;
    } else {
      content = buildIndicatorCsv(primaryRows, catalog, primaryManualMap, selectedIndIds, includeRaw);
      filename = `risk-indicators-${primaryDate}${includeRaw ? "-detailed" : ""}.csv`;
    }

    const blob = new Blob(["\uFEFF" + content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-premium-xl ring-hairline p-6 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">CSV татах</h3>
              <p className="text-[11px] text-muted-foreground">{primaryName} · {primaryDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Формат
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("summary")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "summary"
                  ? "border-emerald-500/60 bg-emerald-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <LayoutList className={`w-3.5 h-3.5 ${mode === "summary" ? "text-emerald-600" : "text-muted-foreground"}`} />
                <span className={`text-xs font-semibold ${mode === "summary" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                  Нийлмэл
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Салбар бүрийн S1/S2/S3/S4/J/Нийт оноо нэг мөрт
              </p>
            </button>

            <button
              onClick={() => setMode("indicator")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "indicator"
                  ? "border-blue-500/60 bg-blue-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Table2 className={`w-3.5 h-3.5 ${mode === "indicator" ? "text-blue-600" : "text-muted-foreground"}`} />
                <span className={`text-xs font-semibold ${mode === "indicator" ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
                  Indicator бүрээр
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Indicator тус бүр өөр багана болгон pivot хийж татах
              </p>
            </button>
          </div>
        </div>

        {/* Comparison option — summary mode only */}
        {mode === "summary" && (
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Харьцуулалт
            </p>
            {hasComparison ? (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setIncludeComparison((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    includeComparison ? "bg-emerald-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      includeComparison ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-xs text-foreground/80">
                  Өмнөх тайлан хамт оруулах
                  <span className="ml-1.5 text-muted-foreground text-[10px]">({prevName})</span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">
                Харьцуулах тайлан сонгогдоогүй байна — <br/>
                хуудасны "Өмнөх улирал" dropdown-с сонгоно уу.
              </p>
            )}
          </div>
        )}

        {/* Indicator filter — indicator mode only */}
        {mode === "indicator" && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Indicator шүүлтүүр
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Бүгд
                </button>
                <span className="text-muted-foreground text-[10px]">/</span>
                <button
                  onClick={clearAll}
                  className="text-[10px] text-muted-foreground hover:underline"
                >
                  Цэвэрлэх
                </button>
              </div>
            </div>

            {/* Collapsible indicator list */}
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Summary row — click to toggle open */}
              <button
                onClick={() => setIndFilterOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-xs text-foreground/80">
                  {allSelected
                    ? "Бүгд indicator сонгогдсон"
                    : `${effectiveSelected.size} / ${allIds.size} indicator сонгогдсон`}
                </span>
                {indFilterOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>

              {/* Expanded list grouped by group */}
              {indFilterOpen && (
                <div className="max-h-52 overflow-y-auto divide-y divide-border/50">
                  {[...indByGroup.entries()].map(([grp, inds]) => {
                    const groupIds = inds.map((c) => c.id);
                    const allGroupIn = groupIds.every((id) => effectiveSelected.has(id));
                    const someGroupIn = groupIds.some((id) => effectiveSelected.has(id));
                    return (
                      <div key={grp}>
                        {/* Group header */}
                        <button
                          onClick={() => toggleGroup(groupIds)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                              allGroupIn
                                ? "bg-blue-500 border-blue-500"
                                : someGroupIn
                                  ? "bg-blue-500/40 border-blue-400"
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
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {groupIds.filter((id) => effectiveSelected.has(id)).length}/{groupIds.length}
                          </span>
                        </button>
                        {/* Indicator items */}
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
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-border bg-background"
                                }`}
                              >
                                {checked && <Check className="w-2.5 h-2.5 text-white" />}
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
        )}

        {/* Raw result toggle — indicator mode only */}
        {mode === "indicator" && (
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Агуулга
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setIncludeRaw((v) => !v)}
                className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                  includeRaw ? "bg-blue-500" : "bg-muted"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    includeRaw ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
              <div>
                <span className="text-xs text-foreground/80">Дэлгэрэнгүй — Oracle утга хамт татах</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Indicator тус бүрд оноо + Oracle-ийн бодит утга (RESULT) хоёр багана болно
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Preview info */}
        <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 mb-5 space-y-0.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Салбар</span>
            <span className="font-semibold tabular-nums">{primaryAgg.length}</span>
          </div>
          {mode === "summary" && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Багана</span>
              <span className="font-semibold tabular-nums">
                {10 + (hasComparison && includeComparison ? 7 : 0)}
              </span>
            </div>
          )}
          {mode === "indicator" && (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Indicator тоо</span>
                <span className="font-semibold tabular-nums">
                  {allSelected ? catalog.length : effectiveSelected.size}
                  {!allSelected && (
                    <span className="text-muted-foreground font-normal"> / {catalog.length}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Нийт багана</span>
                <span className="font-semibold tabular-nums">
                  {2 + (allSelected ? catalog.length : effectiveSelected.size) * (includeRaw ? 2 : 1)}
                  {includeRaw && (
                    <span className="text-muted-foreground font-normal"> (оноо + утга)</span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted/40 transition-colors"
          >
            Болих
          </button>
          <button
            onClick={doDownload}
            disabled={mode === "indicator" && effectiveSelected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-premium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Татах
          </button>
        </div>
      </div>
    </div>
  );
}
