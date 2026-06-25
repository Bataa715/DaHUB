"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { riskApi, type RiskHistoryEntry, type RiskCurrentRow } from "@/lib/api";
import { aggregateBranch, computeScoreDynamic } from "../scoring-rules";
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
  BarChart2,
  TrendingUp,
  Loader2,
  RefreshCw,
  Database,
  Hash,
  CalendarDays,
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

type LoadedEntry = { rows: RiskCurrentRow[] };
type Mode = "total" | "score" | "data";
type ChartType = "line" | "bar";

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

const CustomTooltip = ({
  active,
  payload,
  label,
  branchMap,
  isData,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  branchMap: Record<string, string>;
  isData: boolean;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card shadow-premium-lg ring-hairline px-4 py-3 min-w-[200px] max-w-xs">
      <p className="text-xs font-bold text-foreground mb-2">{label}</p>
      {payload
        .filter((p) => p.value != null)
        .sort((a, b) => (isData ? 0 : b.value - a.value))
        .map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
              {branchMap[p.dataKey] ?? p.dataKey}
            </span>
            <span
              className="ml-auto text-[11px] font-bold tabular-nums"
              style={{ color: p.color }}
            >
              {isData
                ? `${Number(p.value).toFixed(2)}%`
                : Number(p.value).toFixed(2)}
            </span>
          </div>
        ))}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
export default function StatPanel({
  open,
  onCloseAction: onClose,
  historyList = [],
  useRealtime = false,
}: {
  open: boolean;
  onCloseAction: () => void;
  historyList?: RiskHistoryEntry[];
  useRealtime?: boolean;
}) {
  // ── History mode state ──
  const cacheRef = useRef<Map<string, LoadedEntry>>(new Map());
  const [loadedMap, setLoadedMap] = useState<Map<string, LoadedEntry>>(
    new Map(),
  );

  // ── Realtime mode state ──
  const rtCacheRef = useRef<Map<string, LoadedEntry>>(new Map());
  const [rtDates, setRtDates] = useState<string[]>([]);
  const [rtLoadedMap, setRtLoadedMap] = useState<Map<string, LoadedEntry>>(
    new Map(),
  );
  const [rtFrom, setRtFrom] = useState<string>("");
  const [rtTo, setRtTo] = useState<string>("");

  const [fetching, setFetching] = useState(false);
  const [mode, setMode] = useState<Mode>("total");
  const [selectedSubId, setSelectedSubId] = useState<number>(1);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    new Set(),
  );

  // Sorted history for history mode
  const sortedHistory = useMemo(
    () => [...historyList].sort((a, b) => a.pDate.localeCompare(b.pDate)),
    [historyList],
  );
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(Math.max(0, sortedHistory.length - 1));
  useEffect(() => {
    setToIdx(Math.max(0, sortedHistory.length - 1));
  }, [sortedHistory.length]);

  // ── Fetch: history mode ──
  const doFetchHistory = useCallback((entries: RiskHistoryEntry[]) => {
    if (!entries.length) {
      setLoadedMap(new Map(cacheRef.current));
      return;
    }
    setFetching(true);
    Promise.all(
      entries.map((h) =>
        riskApi
          .getHistory(h.id)
          .then((res) => {
            cacheRef.current.set(h.id, { rows: res.rows ?? [] });
          })
          .catch(() => {
            cacheRef.current.set(h.id, { rows: [] });
          }),
      ),
    ).finally(() => {
      setLoadedMap(new Map(cacheRef.current));
      setFetching(false);
    });
  }, []);

  useEffect(() => {
    if (!open || useRealtime || !sortedHistory.length) return;
    const toFetch = sortedHistory.filter((h) => !cacheRef.current.has(h.id));
    doFetchHistory(toFetch);
    if (!toFetch.length) setLoadedMap(new Map(cacheRef.current));
  }, [open, useRealtime, sortedHistory, doFetchHistory]);

  // ── Fetch: riskbranch mode — dates list ──
  useEffect(() => {
    if (!open || !useRealtime) return;
    riskApi
      .listRiskbranchDates()
      .then((dates) => {
        const sorted = [...dates].sort();
        setRtDates(sorted);
        if (sorted.length) {
          setRtTo(sorted[sorted.length - 1]);
          const cutoff = new Date(sorted[sorted.length - 1]);
          cutoff.setDate(cutoff.getDate() - 29);
          const cutStr = cutoff.toISOString().slice(0, 10);
          setRtFrom(sorted.find((d) => d >= cutStr) ?? sorted[0]);
        }
      })
      .catch((e) => console.error("listRiskbranchDates амжилтгүй:", e));
  }, [open, useRealtime]);

  // Active realtime dates in range
  const activeRtDates = useMemo(
    () => rtDates.filter((d) => d >= rtFrom && d <= rtTo),
    [rtDates, rtFrom, rtTo],
  );

  // Fetch realtime rows for active dates
  useEffect(() => {
    if (!open || !useRealtime || !activeRtDates.length) return;
    const toFetch = activeRtDates.filter((d) => !rtCacheRef.current.has(d));
    if (!toFetch.length) {
      setRtLoadedMap(new Map(rtCacheRef.current));
      return;
    }
    setFetching(true);
    Promise.all(
      toFetch.map((d) =>
        riskApi
          .getRiskbranch(d)
          .then((res) => {
            rtCacheRef.current.set(d, { rows: res.rows ?? [] });
          })
          .catch(() => {
            rtCacheRef.current.set(d, { rows: [] });
          }),
      ),
    ).finally(() => {
      setRtLoadedMap(new Map(rtCacheRef.current));
      setFetching(false);
    });
  }, [open, useRealtime, activeRtDates]);

  // Force refetch
  const forceRefetch = useCallback(() => {
    if (!open) return;
    if (useRealtime) {
      rtCacheRef.current.clear();
      setRtLoadedMap(new Map());
      setRtDates([]);
      riskApi
        .listRiskbranchDates()
        .then((dates) => {
          const sorted = [...dates].sort();
          setRtDates(sorted);
          if (sorted.length) setRtTo(sorted[sorted.length - 1]);
        })
        .catch((e) => console.error("listRiskbranchDates амжилтгүй:", e));
    } else {
      cacheRef.current.clear();
      setLoadedMap(new Map());
      doFetchHistory(sortedHistory);
    }
  }, [open, useRealtime, sortedHistory, doFetchHistory]);

  // ── Unified "range entries" for chart ──
  const rangeEntries = useMemo(() => {
    if (useRealtime) {
      return activeRtDates
        .filter((d) => rtLoadedMap.has(d))
        .map((d) => ({ label: d, rows: rtLoadedMap.get(d)!.rows }));
    }
    return sortedHistory
      .slice(fromIdx, toIdx + 1)
      .filter((h) => loadedMap.has(h.id))
      .map((h) => ({ label: h.pDate, rows: loadedMap.get(h.id)!.rows }));
  }, [
    useRealtime,
    activeRtDates,
    rtLoadedMap,
    sortedHistory,
    fromIdx,
    toIdx,
    loadedMap,
  ]);

  // ── Branches ──
  const allBranches = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of rangeEntries) {
      for (const r of e.rows) {
        const bid = r.SOLID;
        if (bid && !map.has(bid)) map.set(bid, String(r.BRANCHNAME ?? bid));
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "mn"));
  }, [rangeEntries]);

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

  const activeBranchIds = useMemo(
    () => Array.from(selectedBranches),
    [selectedBranches],
  );

  // ── Chart data ──
  const dynamicConfig = useIndicatorConfig();
  const scoreIndicators = useMemo(
    () => dynamicConfig.catalog.filter((r) => !r.is_manual && !r.is_judgment),
    [dynamicConfig.catalog],
  );
  const selectedIndicator = useMemo(
    () => scoreIndicators.find((r) => Number(r.subid) === selectedSubId),
    [scoreIndicators, selectedSubId],
  );

  const chartData = useMemo(() => {
    return rangeEntries.map((e) => {
      const point: Record<string, number | string> = { label: e.label };
      if (mode === "total") {
        const agg = aggregateBranch(e.rows, {}, {}, dynamicConfig.catalog);
        for (const b of agg) {
          if (!activeBranchIds.includes(b.branchId)) continue;
          if (b.total != null)
            point[b.branchId] = parseFloat(b.total.toFixed(3));
        }
      } else if (mode === "score") {
        for (const r of e.rows) {
          if (Number(r.SUBID) !== selectedSubId) continue;
          if (!activeBranchIds.includes(r.SOLID)) continue;
          const ind = dynamicConfig.catalog.find(
            (c) => Number(c.subid) === selectedSubId,
          );
          const { score } =
            ind && !ind.is_manual
              ? computeScoreDynamic(ind.score_scale, r.RESULT, r.RESULT_TYPE)
              : { score: null };
          if (typeof score === "number" && score > 0) point[r.SOLID] = score;
        }
      } else {
        for (const r of e.rows) {
          if (Number(r.SUBID) !== selectedSubId) continue;
          if (!activeBranchIds.includes(r.SOLID)) continue;
          const raw = parseFloat(String(r.RESULT));
          if (!isNaN(raw)) point[r.SOLID] = raw;
        }
      }
      return point;
    });
  }, [
    rangeEntries,
    mode,
    selectedSubId,
    activeBranchIds,
    dynamicConfig.catalog,
  ]);

  const isDataMode = mode === "data";
  const showIndicatorPicker = mode === "score" || mode === "data";

  const yDomain = useMemo<[number, number]>(() => {
    if (!isDataMode) return [0, 5.2];
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
  }, [isDataMode, chartData, activeBranchIds]);

  if (!open) return null;

  const hasData = rangeEntries.length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b-2 border-border shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <h2 className="text-base font-bold">
            Статистик · Өөрчлөлтийн чиг хандлага
          </h2>
          {useRealtime && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 font-bold uppercase tracking-wide">
              Realtime
            </span>
          )}
          {hasData && (
            <span className="text-xs text-muted-foreground">
              {rangeEntries.length} өгөгдөл · {activeBranchIds.length} салбар
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={forceRefetch}
            title="Дахин ачааллах"
            disabled={fetching}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground disabled:opacity-40"
          >
            <RefreshCw
              className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-3 border-b border-border bg-muted/20 shrink-0 flex flex-wrap gap-3 items-end">
        {/* ── Realtime date range ── */}
        {useRealtime ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Эхлэх
              </span>
              <select
                value={rtFrom}
                onChange={(e) => setRtFrom(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[140px]"
              >
                {rtDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Дуусах
              </span>
              <select
                value={rtTo}
                onChange={(e) => setRtTo(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[140px]"
              >
                {rtDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          /* ── History date range ── */
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Эхлэх огноо
              </span>
              <select
                value={fromIdx}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFromIdx(v);
                  if (v > toIdx) setToIdx(v);
                }}
                className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[180px]"
              >
                {sortedHistory.map((h, i) => (
                  <option key={h.id} value={i}>
                    {h.pDate} — {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Дуусах огноо
              </span>
              <select
                value={toIdx}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setToIdx(v);
                  if (v < fromIdx) setFromIdx(v);
                }}
                className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[180px]"
              >
                {sortedHistory.map((h, i) => (
                  <option key={h.id} value={i}>
                    {h.pDate} — {h.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Mode */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Харах утга
          </span>
          <div className="flex h-8 rounded-lg border-2 border-border overflow-hidden">
            {[
              {
                key: "total" as Mode,
                label: "Нийт оноо",
                icon: <BarChart2 className="w-3 h-3" />,
              },
              {
                key: "score" as Mode,
                label: "Score",
                icon: <Hash className="w-3 h-3" />,
              },
              {
                key: "data" as Mode,
                label: "Өгөгдөл",
                icon: <Database className="w-3 h-3" />,
              },
            ].map(({ key, label, icon }, idx) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${idx > 0 ? "border-l border-border" : ""} ${
                  mode === key
                    ? "bg-emerald-500 text-white"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {showIndicatorPicker && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Үзүүлэлт
            </span>
            <select
              value={selectedSubId}
              onChange={(e) => setSelectedSubId(Number(e.target.value))}
              className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[250px]"
            >
              {([1, 2, 3] as const).map((grp) => (
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

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Диаграм
          </span>
          <div className="flex h-8 rounded-lg border-2 border-border overflow-hidden">
            <button
              onClick={() => setChartType("line")}
              className={`px-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${chartType === "line" ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              <TrendingUp className="w-3 h-3" /> Шугам
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-3 text-xs font-semibold transition-colors border-l border-border flex items-center gap-1.5 ${chartType === "bar" ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              <BarChart2 className="w-3 h-3" /> Баганан
            </button>
          </div>
        </div>
      </div>

      {/* Branch filter — dropdown, max 5 */}
      {allBranches.length > 0 && !fetching && (
        <div className="px-6 py-2 border-b border-border bg-muted/10 shrink-0 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mr-1">
            Салбар (макс 5):
          </span>
          <div className="relative">
            <select
              multiple
              size={1}
              value={Array.from(selectedBranches)}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions).map(
                  (o) => o.value,
                );
                if (opts.length <= 5) setSelectedBranches(new Set(opts));
              }}
              className="hidden"
            />
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground hover:border-emerald-400 transition-colors min-w-[180px]"
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
                  const atMax = selectedBranches.size >= 5 && !checked;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={atMax}
                      onClick={() =>
                        setSelectedBranches((prev) => {
                          const n = new Set(prev);
                          if (n.has(b.id)) n.delete(b.id);
                          else if (n.size < 5) n.add(b.id);
                          return n;
                        })
                      }
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                        checked ? "bg-emerald-500/10" : "hover:bg-muted/40"
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
          {/* Selected pills */}
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
                  onClick={() =>
                    setSelectedBranches((prev) => {
                      const n = new Set(prev);
                      n.delete(id);
                      return n;
                    })
                  }
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

      {/* Chart */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {fetching ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-sm">Өгөгдөл ачааллаж байна…</span>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <CalendarDays className="w-10 h-10 opacity-30" />
            <span className="text-sm">
              {useRealtime
                ? "Realtime өгөгдөл байхгүй байна — хугацааны интервал өөрчлөнө үү"
                : "Харьцуулахад хамгийн багадаа 2 тайлан шаардлагатай"}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-1 rounded-full bg-emerald-500" />
              <span className="text-sm font-bold text-foreground">
                {mode === "total"
                  ? "Нийт эрсдэлийн оноо (1–5)"
                  : mode === "score"
                    ? `«${selectedIndicator?.name ?? "–"}» — оноо (1–5)`
                    : `«${selectedIndicator?.name ?? "–"}» — үнэн утга (%)`}
              </span>
              {isDataMode && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold"></span>
              )}
            </div>

            <ResponsiveContainer width="100%" height={420}>
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
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    angle={-35}
                    textAnchor="end"
                    height={80}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={yDomain}
                    ticks={isDataMode ? undefined : [0, 1, 2, 3, 4, 5]}
                    tickFormatter={isDataMode ? (v) => `${v}%` : undefined}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    width={isDataMode ? 55 : 32}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        branchMap={branchNameMap}
                        isData={isDataMode}
                      />
                    }
                  />
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
                  {!isDataMode && (
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
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    angle={-35}
                    textAnchor="end"
                    height={80}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={yDomain}
                    ticks={isDataMode ? undefined : [0, 1, 2, 3, 4, 5]}
                    tickFormatter={isDataMode ? (v) => `${v}%` : undefined}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    width={isDataMode ? 55 : 32}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        branchMap={branchNameMap}
                        isData={isDataMode}
                      />
                    }
                  />
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
                  {!isDataMode && (
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
                      radius={[5, 5, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive
                      animationDuration={600}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>

            {/* Summary cards */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {activeBranchIds.map((bId) => {
                const vals = chartData
                  .map((d) => d[bId])
                  .filter((v): v is number => typeof v === "number");
                if (!vals.length) return null;
                const first = vals[0];
                const last = vals[vals.length - 1];
                const delta = last - first;
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                const color = branchColorMap[bId] ?? "#888";
                const fmt = (n: number) =>
                  isDataMode ? `${n.toFixed(1)}%` : n.toFixed(2);
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
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">
                          Дундаж
                        </p>
                        <p className="text-xs font-black tabular-nums text-foreground">
                          {fmt(avg)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">
                          Сүүлд
                        </p>
                        <p className="text-xs font-black tabular-nums text-foreground">
                          {fmt(last)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">
                          Өөрчлөлт
                        </p>
                        <p
                          className={`text-xs font-black tabular-nums ${
                            isDataMode
                              ? delta > 0.5
                                ? "text-emerald-500"
                                : delta < -0.5
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                              : delta > 0.05
                                ? "text-red-500"
                                : delta < -0.05
                                  ? "text-emerald-500"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {delta > 0 ? "+" : ""}
                          {fmt(delta)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
