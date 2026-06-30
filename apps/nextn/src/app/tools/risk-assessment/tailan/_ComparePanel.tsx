"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { riskApi, type RiskHistoryEntry, type RiskCurrentRow } from "@/lib/api";
import {
  aggregateBranch,
  computeScoreDynamic,
  type BranchAggregate,
} from "../scoring-rules";
import { useIndicatorConfig } from "../use-indicator-config";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  X,
  TrendingUp,
  Loader2,
  GitCompare,
  Table,
  BarChart2,
  Hash,
  Database,
} from "lucide-react";

const PALETTE = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#e11d48",
  "#7c3aed",
  "#0ea5e9",
  "#d97706",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#0891b2",
  "#ca8a04",
];

const MAX_COMPARE_BRANCHES = 10;

function fmt(v: number | null, isRaw = false) {
  if (v == null) return "—";
  return isRaw ? `${v.toFixed(2)}` : v.toFixed(2);
}
function scoreClass(v: number | null) {
  if (v == null) return "text-muted-foreground/50";
  if (v >= 3.5) return "text-rose-600 dark:text-rose-400";
  if (v >= 2.5) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}
function scoreBg(v: number | null) {
  if (v == null) return "";
  if (v >= 3.5) return "bg-rose-500/10";
  if (v >= 2.5) return "bg-amber-500/10";
  return "bg-emerald-500/10";
}

type MetricMode = "total" | "score" | "raw";

// ── Main Component ──────────────────────────────────────────────────────────
export default function ComparePanel({
  open,
  onCloseAction: onClose,
  historyList = [],
}: {
  open: boolean;
  onCloseAction: () => void;
  historyList?: RiskHistoryEntry[];
}) {
  const cacheRef = useRef<Map<string, RiskCurrentRow[]>>(new Map());
  const [loadedMap, setLoadedMap] = useState<Map<string, RiskCurrentRow[]>>(
    new Map(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [mode, setMode] = useState<"table" | "graph">("table");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [showSub, setShowSub] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    new Set(),
  );

  // Metric selection
  const [metricMode, setMetricMode] = useState<MetricMode>("total");
  const [selectedSubId, setSelectedSubId] = useState<number>(1);

  const dynamicConfig = useIndicatorConfig();
  const scoreIndicators = useMemo(
    () => dynamicConfig.catalog.filter((r) => !r.is_manual && !r.is_judgment),
    [dynamicConfig.catalog],
  );
  const selectedIndicator = useMemo(
    () => scoreIndicators.find((r) => Number(r.subid) === selectedSubId),
    [scoreIndicators, selectedSubId],
  );

  const sortedHistory = useMemo(
    () => [...historyList].sort((a, b) => a.pDate.localeCompare(b.pDate)),
    [historyList],
  );

  // ── Fetch when selection changes ──
  useEffect(() => {
    if (!open || !selectedIds.size) return;
    const toFetch = [...selectedIds].filter((id) => !cacheRef.current.has(id));
    if (!toFetch.length) {
      setLoadedMap(new Map(cacheRef.current));
      return;
    }
    setFetching(true);
    Promise.all(
      toFetch.map((id) =>
        riskApi
          .getHistory(id)
          .then((res) => {
            cacheRef.current.set(id, res.rows ?? []);
          })
          .catch(() => {
            cacheRef.current.set(id, []);
          }),
      ),
    ).finally(() => {
      setLoadedMap(new Map(cacheRef.current));
      setFetching(false);
    });
  }, [open, selectedIds]);

  const selectedReports = useMemo(
    () => sortedHistory.filter((h) => selectedIds.has(h.id)),
    [sortedHistory, selectedIds],
  );

  // ── All branches across selected reports ──
  const allBranches = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of selectedReports) {
      const rows = loadedMap.get(h.id) ?? [];
      if (metricMode === "total") {
        for (const a of aggregateBranch(rows, {}, {}, dynamicConfig.catalog)) {
          if (!m.has(a.branchId)) m.set(a.branchId, a.branchName);
        }
      } else {
        for (const r of rows) {
          const bid = r.SOLID;
          if (bid && !m.has(bid)) m.set(bid, String(r.BRANCHNAME ?? bid));
        }
      }
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "mn"));
  }, [selectedReports, loadedMap, metricMode]);

  const branchColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    allBranches.forEach((b, i) => {
      m[b.id] = PALETTE[i % PALETTE.length];
    });
    return m;
  }, [allBranches]);

  const branchNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    allBranches.forEach((b) => {
      m[b.id] = b.name;
    });
    return m;
  }, [allBranches]);

  // ── Aggregated data: reportId -> branchId -> BranchAggregate ──
  const aggMap = useMemo(() => {
    const m = new Map<string, Map<string, BranchAggregate>>();
    for (const h of selectedReports) {
      const bmap = new Map<string, BranchAggregate>();
      for (const a of aggregateBranch(
        loadedMap.get(h.id) ?? [],
        {},
        {},
        dynamicConfig.catalog,
      ))
        bmap.set(a.branchId, a);
      m.set(h.id, bmap);
    }
    return m;
  }, [selectedReports, loadedMap]);

  // ── Per-indicator lookup: reportId -> branchId -> value (score or raw) ──
  const indMap = useMemo(() => {
    if (metricMode === "total")
      return new Map<string, Map<string, number | null>>();
    const outer = new Map<string, Map<string, number | null>>();
    for (const h of selectedReports) {
      const bmap = new Map<string, number | null>();
      for (const r of loadedMap.get(h.id) ?? []) {
        if (Number(r.SUBID) !== selectedSubId) continue;
        if (!r.SOLID) continue;
        if (metricMode === "score") {
          const ind = dynamicConfig.catalog.find(
            (c) => Number(c.subid) === selectedSubId,
          );
          const { score } =
            ind && !ind.is_manual
              ? computeScoreDynamic(ind.score_scale, r.RESULT, r.RESULT_TYPE)
              : { score: null };
          if (typeof score === "number" && score > 0) bmap.set(r.SOLID, score);
        } else {
          const raw = parseFloat(String(r.RESULT));
          if (!isNaN(raw)) bmap.set(r.SOLID, raw);
        }
      }
      outer.set(h.id, bmap);
    }
    return outer;
  }, [selectedReports, loadedMap, metricMode, selectedSubId]);

  // Helper: get display value for a (reportId, branchId) pair
  const getValue = (reportId: string, branchId: string): number | null => {
    if (metricMode === "total")
      return aggMap.get(reportId)?.get(branchId)?.total ?? null;
    return indMap.get(reportId)?.get(branchId) ?? null;
  };

  const isRaw = metricMode === "raw";

  // ── Table: sorted branches ──
  const tableBranches = useMemo(() => {
    const active = allBranches.filter((b) => selectedBranches.has(b.id));
    if (!selectedReports.length) return active;
    const first = selectedReports[0];
    return [...active].sort((a, b) => {
      const va = getValue(first.id, a.id) ?? 0;
      const vb = getValue(first.id, b.id) ?? 0;
      return vb - va;
    });
  }, [
    allBranches,
    selectedReports,
    aggMap,
    indMap,
    metricMode,
    selectedBranches,
  ]);

  // ── Chart data: X = reports, series = branches ──
  const chartData = useMemo(() => {
    const activeBranchIds = allBranches
      .filter((b) => selectedBranches.has(b.id))
      .map((b) => b.id);
    return selectedReports.map((h) => {
      const point: Record<string, number | string> = { label: h.pDate };
      for (const bId of activeBranchIds) {
        const v = getValue(h.id, bId);
        if (v != null) point[bId] = parseFloat(v.toFixed(isRaw ? 4 : 3));
      }
      return point;
    });
  }, [
    selectedReports,
    aggMap,
    indMap,
    allBranches,
    metricMode,
    selectedBranches,
  ]);

  const activeBranchIds = useMemo(
    () =>
      allBranches.filter((b) => selectedBranches.has(b.id)).map((b) => b.id),
    [selectedBranches, allBranches],
  );

  // ── Y domain for graph ──
  const yDomain = useMemo<[number, number]>(() => {
    if (!isRaw) return [0, 10.2];
    const vals = chartData.flatMap((d) =>
      activeBranchIds
        .map((id) => (typeof d[id] === "number" ? (d[id] as number) : null))
        .filter((v): v is number => v != null),
    );
    if (!vals.length) return [0, 100];
    return [
      Math.max(0, Math.floor(Math.min(...vals) * 0.9)),
      Math.ceil(Math.max(...vals) * 1.1),
    ];
  }, [isRaw, chartData, activeBranchIds]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelectedIds(
      selectedIds.size === historyList.length
        ? new Set()
        : new Set(historyList.map((h) => h.id)),
    );
  };
  const toggleBranch = (id: string) => {
    setSelectedBranches((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (n.size < MAX_COMPARE_BRANCHES) n.add(id);
      return n;
    });
  };

  if (!open) return null;

  const hasData = selectedReports.length > 0 && !fetching;
  const readyForTable =
    hasData && selectedReports.every((h) => loadedMap.has(h.id));

  return (
    <div className="fixed inset-0 z-50 flex bg-background text-foreground">
      {/* ── Sidebar: report selector ── */}
      <div className="w-60 shrink-0 border-r-2 border-border flex flex-col bg-muted/20">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Тайлан сонгох
          </span>
          <button
            onClick={toggleAll}
            className="text-[10px] text-emerald-500 font-bold hover:underline"
          >
            {selectedIds.size === historyList.length ? "Болих" : "Бүгд"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {sortedHistory.map((h) => {
            const checked = selectedIds.has(h.id);
            return (
              <button
                key={h.id}
                onClick={() => toggleId(h.id)}
                className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 ${checked ? "bg-emerald-500/[0.08]" : ""}`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-all ${checked ? "bg-emerald-500 border-emerald-500" : "border-border"}`}
                >
                  {checked && (
                    <span className="w-2 h-2 bg-white rounded-sm block" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground leading-tight truncate">
                    {h.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {h.pDate}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground">
            {selectedIds.size} тайлан сонгогдсон
          </p>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b-2 border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <GitCompare className="w-4 h-4 text-violet-500" />
            </div>
            <h2 className="text-base font-bold">Тайлангуудын харьцуулалт</h2>
            {fetching && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
            {readyForTable && (
              <span className="text-xs text-muted-foreground">
                {selectedReports.length} тайлан · {allBranches.length} салбар
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* View mode */}
            <div className="flex h-8 rounded-lg border-2 border-border overflow-hidden">
              <button
                onClick={() => setMode("table")}
                className={`px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors ${mode === "table" ? "bg-violet-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                <Table className="w-3 h-3" /> Хүснэгт
              </button>
              <button
                onClick={() => setMode("graph")}
                className={`px-3 text-xs font-semibold flex items-center gap-1.5 border-l border-border transition-colors ${mode === "graph" ? "bg-violet-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                <TrendingUp className="w-3 h-3" /> График
              </button>
            </div>
            {mode === "graph" && (
              <div className="flex h-8 rounded-lg border-2 border-border overflow-hidden">
                <button
                  onClick={() => setChartType("line")}
                  className={`px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors ${chartType === "line" ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}
                >
                  <TrendingUp className="w-3 h-3" /> Шугам
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-3 text-xs font-semibold flex items-center gap-1.5 border-l border-border transition-colors ${chartType === "bar" ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}
                >
                  <BarChart2 className="w-3 h-3" /> Баганан
                </button>
              </div>
            )}
            {mode === "table" && metricMode === "total" && (
              <button
                onClick={() => setShowSub((v) => !v)}
                className={`h-8 px-3 text-xs font-semibold rounded-lg border-2 transition-colors ${showSub ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400" : "border-border text-muted-foreground hover:bg-muted/50"}`}
              >
                S1·S2·S3
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Metric controls ── */}
        {readyForTable && (
          <div className="px-6 py-2.5 border-b border-border bg-muted/20 shrink-0 flex flex-wrap gap-3 items-end">
            {/* Metric mode */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Үзүүлэлт
              </span>
              <div className="flex h-8 rounded-lg border-2 border-border overflow-hidden">
                {[
                  {
                    key: "total" as MetricMode,
                    label: "Нийт оноо",
                    icon: <BarChart2 className="w-3 h-3" />,
                  },
                  {
                    key: "score" as MetricMode,
                    label: "Score",
                    icon: <Hash className="w-3 h-3" />,
                  },
                  {
                    key: "raw" as MetricMode,
                    label: "Өгөгдөл",
                    icon: <Database className="w-3 h-3" />,
                  },
                ].map(({ key, label, icon }, idx) => (
                  <button
                    key={key}
                    onClick={() => setMetricMode(key)}
                    className={`px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors ${idx > 0 ? "border-l border-border" : ""} ${metricMode === key ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Indicator picker (score / raw mode) */}
            {(metricMode === "score" || metricMode === "raw") && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {metricMode === "score"
                    ? "Үзүүлэлт (оноо 1–5)"
                    : "Үзүүлэлт (үнэн утга)"}
                </span>
                <select
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(Number(e.target.value))}
                  className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[280px] cursor-pointer"
                >
                  {([1, 2, 3, 4] as const).map((grp) => (
                    <optgroup key={grp} label={`Score ${grp}`}>
                      {scoreIndicators
                        .filter((r) => r.group === grp)
                        .map((r) => (
                          <option key={r.subid} value={Number(r.subid)}>
                            {r.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Branch filter — dropdown */}
        {readyForTable && allBranches.length > 0 && (
          <div className="px-6 py-2 border-b border-border bg-muted/10 shrink-0 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mr-1">
              Салбар (макс {MAX_COMPARE_BRANCHES}):
            </span>
            <div className="relative">
              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground hover:border-violet-400 transition-colors min-w-[180px]"
                >
                  <span className="flex-1 text-left truncate">
                    {selectedBranches.size === 0
                      ? "Салбар сонгоно уу…"
                      : `${selectedBranches.size} салбар сонгогдсон`}
                  </span>
                  <svg
                    className="w-3 h-3 text-muted-foreground shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-premium-lg ring-hairline hidden group-focus-within:block">
                  {allBranches.map((b, i) => {
                    const checked = selectedBranches.has(b.id);
                    const color = PALETTE[i % PALETTE.length];
                    const atMax =
                      selectedBranches.size >= MAX_COMPARE_BRANCHES && !checked;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={atMax}
                        onClick={() => toggleBranch(b.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                          checked ? "bg-violet-500/10" : "hover:bg-muted/40"
                        } ${atMax ? "opacity-30 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center"
                          style={
                            checked
                              ? { background: color, borderColor: color }
                              : {}
                          }
                        >
                          {checked && (
                            <span className="w-1.5 h-1.5 bg-white rounded-sm block" />
                          )}
                        </span>
                        <span className="truncate font-medium">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {Array.from(selectedBranches).map((id) => {
              const b = allBranches.find((x) => x.id === id);
              const i = allBranches.findIndex((x) => x.id === id);
              const color = PALETTE[i % PALETTE.length];
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ background: color }}
                >
                  {b?.name ?? id}
                  <button
                    onClick={() => toggleBranch(id)}
                    className="ml-0.5 hover:opacity-70"
                  >
                    ×
                  </button>
                </span>
              );
            })}
            {selectedBranches.size > 0 && (
              <button
                onClick={() => setSelectedBranches(new Set())}
                className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
              >
                Цэвэрлэх
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {selectedIds.size === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <GitCompare className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium">
                Зүүн талаас харьцуулах тайлануудаа сонгоно уу
              </p>
              <p className="text-xs opacity-60">
                Хэдэн ч тайлан сонгон харьцуулж болно
              </p>
            </div>
          ) : fetching ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <span className="text-sm">Өгөгдөл ачааллаж байна…</span>
            </div>
          ) : mode === "table" ? (
            <TableView
              selectedReports={selectedReports}
              tableBranches={tableBranches}
              aggMap={aggMap}
              indMap={indMap}
              metricMode={metricMode}
              showSub={showSub}
              getValue={getValue}
              isRaw={isRaw}
            />
          ) : (
            <GraphView
              chartData={chartData}
              activeBranchIds={activeBranchIds}
              branchColorMap={branchColorMap}
              branchNameMap={branchNameMap}
              chartType={chartType}
              selectedReports={selectedReports}
              yDomain={yDomain}
              isRaw={isRaw}
              metricLabel={
                metricMode === "total"
                  ? "Нийт эрсдэлийн оноо (1–5)"
                  : metricMode === "score"
                    ? `«${selectedIndicator?.name ?? "–"}» оноо (1–5)`
                    : `«${selectedIndicator?.name ?? "–"}» үнэн утга`
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Table View ──────────────────────────────────────────────────────────────
function TableView({
  selectedReports,
  tableBranches,
  aggMap,
  indMap,
  metricMode,
  showSub,
  getValue,
  isRaw,
}: {
  selectedReports: RiskHistoryEntry[];
  tableBranches: { id: string; name: string }[];
  aggMap: Map<string, Map<string, BranchAggregate>>;
  indMap: Map<string, Map<string, number | null>>;
  metricMode: MetricMode;
  showSub: boolean;
  getValue: (reportId: string, branchId: string) => number | null;
  isRaw: boolean;
}) {
  if (!selectedReports.length || !tableBranches.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Өгөгдөл байхгүй байна
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/40 border-b-2 border-border">
            <th className="sticky left-0 z-10 bg-muted/60 px-4 py-2.5 text-left font-bold text-[11px] min-w-[180px] border-r border-border">
              Салбар
            </th>
            {selectedReports.map((h) => (
              <th
                key={h.id}
                className="px-3 py-2.5 text-center font-bold text-[11px] min-w-[110px] border-r border-border last:border-r-0"
              >
                <p
                  className="text-foreground truncate max-w-[160px] mx-auto"
                  title={h.name}
                >
                  {h.name}
                </p>
                <p className="text-[10px] font-normal text-muted-foreground mt-0.5">
                  {h.pDate}
                </p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableBranches.map((b, bi) => (
            <tr
              key={b.id}
              className={`border-b border-border/50 ${bi % 2 === 1 ? "bg-muted/10" : ""} hover:bg-muted/20 transition-colors`}
            >
              <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-medium text-[11px] border-r border-border whitespace-nowrap max-w-[220px] truncate">
                {b.name}
              </td>
              {selectedReports.map((h) => {
                const v = getValue(h.id, b.id);
                const a =
                  metricMode === "total"
                    ? (aggMap.get(h.id)?.get(b.id) ?? null)
                    : null;
                return (
                  <td
                    key={h.id}
                    className={`px-3 py-2 text-center border-r border-border last:border-r-0 ${isRaw ? "" : scoreBg(v)}`}
                  >
                    <span
                      className={`text-sm font-black tabular-nums ${isRaw ? "text-foreground" : scoreClass(v)}`}
                    >
                      {isRaw && v != null ? v.toFixed(2) : fmt(v)}
                    </span>
                    {showSub && metricMode === "total" && a && (
                      <div className="flex justify-center gap-2 mt-1">
                        {(
                          [
                            ["S1", a.s1],
                            ["S2", a.s2],
                            ["S3", a.s3],
                          ] as [string, number | null][]
                        ).map(([lbl, sv]) => (
                          <div key={lbl} className="text-center">
                            <p className="text-[8px] text-muted-foreground leading-none">
                              {lbl}
                            </p>
                            <p
                              className={`text-[10px] font-bold tabular-nums leading-tight ${scoreClass(sv)}`}
                            >
                              {fmt(sv)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Graph View ──────────────────────────────────────────────────────────────
function GraphView({
  chartData,
  activeBranchIds,
  branchColorMap,
  branchNameMap,
  chartType,
  selectedReports,
  yDomain,
  isRaw,
  metricLabel,
}: {
  chartData: Record<string, number | string>[];
  activeBranchIds: string[];
  branchColorMap: Record<string, string>;
  branchNameMap: Record<string, string>;
  chartType: "line" | "bar";
  selectedReports: RiskHistoryEntry[];
  yDomain: [number, number];
  isRaw: boolean;
  metricLabel: string;
}) {
  if (selectedReports.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <TrendingUp className="w-8 h-8 opacity-30" />
        <p className="text-sm">
          График харахад хамгийн багадаа 2 тайлан сонгох шаардлагатай
        </p>
      </div>
    );
  }

  const CustomDot = (props: any) => {
    const { cx, cy, stroke, value } = props;
    if (value == null) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={stroke}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    );
  };

  const TooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-border bg-card shadow-premium-lg ring-hairline px-4 py-3 min-w-[200px]">
        <p className="text-xs font-bold text-foreground mb-2">{label}</p>
        {payload
          .filter((p: any) => p.value != null)
          .sort((a: any, b: any) => b.value - a.value)
          .map((p: any) => (
            <div key={p.dataKey} className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                {branchNameMap[p.dataKey] ?? p.dataKey}
              </span>
              <span
                className="ml-auto text-[11px] font-bold tabular-nums"
                style={{ color: p.color }}
              >
                {isRaw
                  ? Number(p.value).toFixed(2)
                  : Number(p.value).toFixed(2)}
              </span>
            </div>
          ))}
      </div>
    );
  };

  const showRefLines = !isRaw;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="h-5 w-1 rounded-full bg-violet-500" />
        <span className="text-sm font-bold">{metricLabel}</span>
        {isRaw && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold"></span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={450}>
        {chartType === "line" ? (
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 20, left: 10, bottom: 80 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(128,128,128,0.12)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              angle={-35}
              textAnchor="end"
              height={80}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              ticks={showRefLines ? [0, 2, 4, 6, 8, 10] : undefined}
              tickFormatter={isRaw ? (v) => `${v}` : undefined}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={isRaw ? 50 : 32}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<TooltipContent />} />
            <Legend
              formatter={(val) => (
                <span
                  style={{
                    fontSize: 11,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {branchNameMap[val] ?? val}
                </span>
              )}
              wrapperStyle={{ paddingTop: 14 }}
            />
            {showRefLines && (
              <>
                <ReferenceLine
                  y={3.5}
                  stroke="#ef4444"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{
                    value: "Өндөр ≥3.5",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#ef4444",
                  }}
                />
                <ReferenceLine
                  y={2.5}
                  stroke="#f59e0b"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{
                    value: "Дунд ≥2.5",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#f59e0b",
                  }}
                />
              </>
            )}
            {activeBranchIds.map((bId) => (
              <Line
                key={bId}
                type="monotone"
                dataKey={bId}
                stroke={branchColorMap[bId] ?? "#888"}
                strokeWidth={2.5}
                dot={<CustomDot />}
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                  stroke: "hsl(var(--background))",
                }}
                connectNulls={false}
                isAnimationActive
                animationDuration={600}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 20, left: 10, bottom: 80 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(128,128,128,0.12)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              angle={-35}
              textAnchor="end"
              height={80}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              ticks={showRefLines ? [0, 2, 4, 6, 8, 10] : undefined}
              tickFormatter={isRaw ? (v) => `${v}` : undefined}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={isRaw ? 50 : 32}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<TooltipContent />} />
            <Legend
              formatter={(val) => (
                <span
                  style={{
                    fontSize: 11,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {branchNameMap[val] ?? val}
                </span>
              )}
              wrapperStyle={{ paddingTop: 14 }}
            />
            {showRefLines && (
              <>
                <ReferenceLine
                  y={3.5}
                  stroke="#ef4444"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                />
                <ReferenceLine
                  y={2.5}
                  stroke="#f59e0b"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                />
              </>
            )}
            {activeBranchIds.map((bId) => (
              <Bar
                key={bId}
                dataKey={bId}
                fill={branchColorMap[bId] ?? "#888"}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                isAnimationActive
                animationDuration={600}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>

      {/* Summary cards per branch */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-2">
        {activeBranchIds.map((bId) => {
          const vals = chartData
            .map((d) => d[bId])
            .filter((v): v is number => typeof v === "number");
          if (!vals.length) return null;
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const color = branchColorMap[bId] ?? "#888";
          return (
            <div
              key={bId}
              className="rounded-xl border-2 border-border bg-card px-3.5 py-3"
              style={{ borderLeftColor: color, borderLeftWidth: 4 }}
            >
              <p
                className="text-[10px] font-bold truncate mb-2"
                style={{ color }}
              >
                {branchNameMap[bId] ?? bId}
              </p>
              <div className="grid grid-cols-3 gap-1 text-center">
                {(
                  [
                    ["Дундаж", avg],
                    ["Min", min],
                    ["Max", max],
                  ] as [string, number][]
                ).map(([lbl, v]) => (
                  <div key={lbl}>
                    <p className="text-[9px] text-muted-foreground mb-0.5">
                      {lbl}
                    </p>
                    <p
                      className={`text-xs font-black tabular-nums ${isRaw ? "text-foreground" : scoreClass(v)}`}
                    >
                      {v.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
