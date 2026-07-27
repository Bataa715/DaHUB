"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { abFetchAlerts, abSearchByCif, abSearchAlertByCif } from "../_lib/api";
import { getApiErrorMessage } from "@/lib/api";
import {
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";

const ML_DASH_IDS = new Set([13, 14, 15, 16]);
const ALERT_COLORS = [
  "#f97316",
  "#fb7185",
  "#f472b6",
  "#e879f9",
  "#c084fc",
  "#a78bfa",
  "#818cf8",
  "#6366f1",
  "#34d399",
  "#facc15",
];

interface AlertDashboard {
  id: number;
  name: string;
  count: number;
  totalAmount: number;
}

interface AlertItem {
  cif: string;
  dashboardCount: number;
  totalTransactions: number;
  totalAmount: number; // стандарт дашборд (1-12) дүн — ML (13-16) хасагдсан
  mlAmount: number; // ML дашборд (13-16) дүн тусдаа
  dashboards: AlertDashboard[];
}

interface CifDetailDashboard {
  dashboardId: number;
  dashboardName: string;
  matchCount: number;
  rows: Record<string, unknown>[];
}
interface CifDetail {
  cif: string;
  results: CifDetailDashboard[];
}

interface FailedDashboard {
  id: number;
  name: string;
  error: string;
}

interface AlertData {
  minDashboards: number;
  totalAlerts: number;
  alerts: AlertItem[];
  failedDashboards: FailedDashboard[];
}

function formatAmount(n: number) {
  if (!n) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}Т`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}К`;
  return String(Math.round(n));
}

function createTop10Tooltip(t: (key: TranslationKey) => string) {
  return function Top10Tooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as AlertItem & { stdAmount: number };
    return (
      <div className="bg-surface-elevated border border-surface-border rounded-xl px-3 py-2.5 text-xs shadow-2xl space-y-1">
        <p className="font-mono font-extrabold text-txt text-sm">{d.cif}</p>
        <p className="text-txt-dim">
          {t("abAlertsAmountLabel")}{" "}
          <span className="text-amber-400 font-bold">
            {formatAmount(d.stdAmount)}₮
          </span>
        </p>
        {d.mlAmount > 0 && (
          <p className="text-txt-dim">
            ML:{" "}
            <span className="text-golomt-400 font-bold">
              +{formatAmount(d.mlAmount)}₮
            </span>
          </p>
        )}
        <p className="text-txt-dim">
          {t("abAlertsTxnLabel")}{" "}
          <span className="text-txt font-bold">{d.totalTransactions}</span>
        </p>
        <p className="text-txt-dim">
          Dashboard:{" "}
          <span className="text-golomt-400 font-bold">
            {d.dashboardCount}
            {t("abAlertsCountSuffix")}
          </span>
        </p>
      </div>
    );
  };
}

function SevTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-txt">{String(payload[0].name ?? "")}</p>
      <p className="text-txt-dim">{payload[0].value} CIF</p>
    </div>
  );
}

function DbFreqTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { name: string; count: number };
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-txt">{d.name}</p>
      <p className="text-txt-dim">{d.count} CIF</p>
    </div>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCif, setExpandedCif] = useState<string | null>(null);
  const [cifDetail, setCifDetail] = useState<CifDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [minDash, setMinDash] = useState(2);
  const [cifSearch, setCifSearch] = useState("");
  const [cifSearchResult, setCifSearchResult] = useState<{
    loading: boolean;
    alerts: AlertItem[];
    searched: boolean;
  }>({ loading: false, alerts: [], searched: false });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCifSearch = (val: string) => {
    setCifSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) {
      setCifSearchResult({ loading: false, alerts: [], searched: false });
      return;
    }
    setCifSearchResult((p) => ({ ...p, loading: true, searched: false }));
    const searchedVal = val.trim().toLowerCase();
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await abSearchAlertByCif(val.trim(), minDash);
        // Client-side exact match guard — backend may return unfiltered list
        const filtered = (res.alerts || []).filter(
          (a: AlertItem) =>
            String(a.cif || "")
              .trim()
              .toLowerCase() === searchedVal,
        );
        setCifSearchResult({
          loading: false,
          alerts: filtered,
          searched: true,
        });
      } catch {
        setCifSearchResult({ loading: false, alerts: [], searched: true });
      }
    }, 400);
  };

  const loadAlerts = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await abFetchAlerts(minDash, 10000, signal);
        setData(res);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(getApiErrorMessage(e) || t("alertNoResult"));
      } finally {
        setLoading(false);
      }
    },
    [minDash, t],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    loadAlerts(ctrl.signal);
    return () => ctrl.abort();
  }, [loadAlerts]);

  const handleExpand = async (cifId: string) => {
    if (expandedCif === cifId) {
      setExpandedCif(null);
      setCifDetail(null);
      return;
    }
    setExpandedCif(cifId);
    setCifDetail(null);
    setLoadingDetail(true);
    try {
      const detail = await abSearchByCif(cifId);
      setCifDetail(detail);
    } catch {
      setCifDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ML dashboard (ID 13–16)-ийг хасваад стандарт дүнгийн тооцоолл
  const getStdAmount = (alert: AlertItem) =>
    alert.dashboards
      .filter((d) => !ML_DASH_IDS.has(d.id))
      .reduce((s, d) => s + (d.totalAmount || 0), 0);

  const chartData = useMemo(() => {
    if (!data?.alerts?.length) return null;
    const alerts = data.alerts;

    const totalTxns = alerts.reduce((s, a) => s + a.totalTransactions, 0);
    const totalStdAmt = alerts.reduce((s, a) => s + getStdAmount(a), 0);
    const totalMLAmt = alerts.reduce((s, a) => s + (a.mlAmount || 0), 0);

    const sevMap: Record<string, number> = {
      "2 DB": 0,
      "3 DB": 0,
      "4 DB": 0,
      "5+ DB": 0,
    };
    alerts.forEach((a) => {
      if (a.dashboardCount >= 5) sevMap["5+ DB"]++;
      else if (a.dashboardCount === 4) sevMap["4 DB"]++;
      else if (a.dashboardCount === 3) sevMap["3 DB"]++;
      else sevMap["2 DB"]++;
    });
    const sevData = Object.entries(sevMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));

    const dbFreq: Record<string, number> = {};
    alerts.forEach((a) =>
      a.dashboards.forEach((d) => {
        const k = `DB${d.id}`;
        dbFreq[k] = (dbFreq[k] || 0) + 1;
      }),
    );
    const dbFreqData = Object.entries(dbFreq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => Number(a.name.slice(2)) - Number(b.name.slice(2)));

    const top10 = [...alerts]
      .sort((a, b) => getStdAmount(b) - getStdAmount(a))
      .slice(0, 10)
      .map((a) => ({ ...a, stdAmount: getStdAmount(a) }));
    const reversedTop10 = [...top10].reverse();

    return {
      totalTxns,
      totalStdAmt,
      totalMLAmt,
      sevData,
      dbFreqData,
      top10,
      reversedTop10,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const getSeverityColor = (count: number) => {
    if (count >= 5) return "text-red-400 bg-red-500/10 border-red-500/25";
    if (count >= 3) return "text-amber-400 bg-amber-500/10 border-amber-500/25";
    return "text-blue-400 bg-blue-500/10 border-blue-500/25";
  };

  const Top10TooltipContent = useMemo(() => createTop10Tooltip(t), [t]);

  return (
    <div className="space-y-5">
      <div className="px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <h1 className="text-sm font-bold text-txt truncate">Alert</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-surface-card border border-surface-border rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-txt-dim">
              {t("alertMinDash")}
            </span>
            <select
              value={minDash}
              onChange={(e) => setMinDash(Number(e.target.value))}
              className="bg-transparent text-[11px] font-bold text-txt border-none focus:outline-none cursor-pointer"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}+ dashboard
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => loadAlerts()}
            disabled={loading}
            className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={`text-txt-dim ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
      <div className="px-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-golomt-400" />
            <span className="text-[12px] text-txt-dim ml-3">
              12 Dashboard {t("alertLoading")}
            </span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-[12px] text-center py-8">{error}</p>
        )}

        {data && !loading && data.failedDashboards?.length > 0 && (
          <details className="bg-amber-500/8 border border-amber-500/25 rounded-xl overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer flex items-center gap-2 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors">
              <span>⚠</span>
              <span>
                {data.failedDashboards.length} dashboard {t("alertNoResult")} —
              </span>
            </summary>
            <div className="px-4 pb-3 pt-1 space-y-2">
              {data.failedDashboards.map((f) => (
                <div key={f.id} className="text-[10.5px] space-y-0.5">
                  <p className="font-semibold text-amber-300">
                    DB{f.id}: {f.name}
                  </p>
                  <p className="font-mono text-red-300/80 break-all">
                    {f.error}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* CIF Search — always hits backend */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim"
              />
              <input
                value={cifSearch}
                onChange={(e) => handleCifSearch(e.target.value)}
                placeholder={t("alertCifSearch")}
                className="w-full bg-surface-card border border-surface-border rounded-xl pl-8 pr-9 py-2 text-[12px] text-txt placeholder:text-txt-dim outline-none focus:border-golomt-500/50"
              />
              {cifSearchResult.loading && (
                <Loader2
                  size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-golomt-400"
                />
              )}
              {cifSearch && !cifSearchResult.loading && (
                <button
                  onClick={() => handleCifSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-dim hover:text-txt"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Search results vs main list */}
            {cifSearch.trim() ? (
              cifSearchResult.loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={16} className="animate-spin text-golomt-400" />
                  <span className="text-[12px] text-txt-dim ml-2">
                    {t("alertOracleSearching")}
                  </span>
                </div>
              ) : cifSearchResult.searched ? (
                cifSearchResult.alerts.length === 0 ? (
                  <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-sm text-txt-dim">
                    <span className="font-mono text-txt">
                      {cifSearch.trim()}
                    </span>{" "}
                    — {minDash}+ {t("alertNoResult")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cifSearchResult.alerts.map((alert) => (
                      <div
                        key={alert.cif}
                        className="bg-surface-card rounded-xl border border-surface-border overflow-hidden"
                      >
                        <button
                          onClick={() => handleExpand(alert.cif)}
                          className="w-full p-5 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`px-3 py-1.5 rounded-lg border text-sm font-extrabold ${getSeverityColor(alert.dashboardCount)}`}
                            >
                              {alert.dashboardCount} DB
                            </div>
                            <div className="text-left">
                              <h3 className="text-base font-extrabold text-txt tracking-wide">
                                {alert.cif}
                              </h3>
                              <p className="text-xs text-txt-dim mt-0.5">
                                {alert.dashboards
                                  .map((d) => `DB${d.id}`)
                                  .join(", ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[15px] font-extrabold text-txt">
                                {alert.totalTransactions}
                              </p>
                              <p className="text-xs text-txt-dim">
                                {t("alertTransactions")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[15px] font-extrabold text-amber-400">
                                {formatAmount(getStdAmount(alert))}₮
                              </p>
                              <p className="text-xs text-txt-dim">
                                {t("abAlertsStdAmountLabel")}
                              </p>
                              {(alert.mlAmount ?? 0) > 0 && (
                                <p className="text-xs text-golomt-400/70">
                                  +ML {formatAmount(alert.mlAmount ?? 0)}₮
                                </p>
                              )}
                            </div>
                            {expandedCif === alert.cif ? (
                              <ChevronUp size={18} className="text-txt-dim" />
                            ) : (
                              <ChevronDown size={18} className="text-txt-dim" />
                            )}
                          </div>
                        </button>

                        {expandedCif === alert.cif && (
                          <div className="border-t border-surface-border p-5 bg-surface-elevated/30">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                              {alert.dashboards.map((d) => (
                                <div
                                  key={d.id}
                                  className="bg-surface-card rounded-lg border border-surface-border p-3"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-extrabold text-golomt-400">
                                      DB{d.id}
                                    </span>
                                    <span className="text-xs text-txt-dim">
                                      {d.name}
                                    </span>
                                  </div>
                                  <p className="text-sm font-extrabold text-txt">
                                    {d.count}{" "}
                                    <span className="text-xs text-txt-dim font-normal">
                                      {t("alertRows")}
                                    </span>
                                  </p>
                                  <p className="text-sm font-bold text-amber-400">
                                    {formatAmount(d.totalAmount)}₮
                                  </p>
                                </div>
                              ))}
                            </div>
                            {loadingDetail && (
                              <div className="flex items-center gap-2 py-3">
                                <Loader2
                                  size={14}
                                  className="animate-spin text-golomt-400"
                                />
                                <span className="text-[11px] text-txt-dim">
                                  {t("alertLoadingDetail")}
                                </span>
                              </div>
                            )}
                            {cifDetail?.results && (
                              <div className="space-y-2 mt-2">
                                {cifDetail.results.map(
                                  (dr: CifDetailDashboard) => (
                                    <details
                                      key={dr.dashboardId}
                                      className="bg-surface-card rounded-lg border border-surface-border overflow-hidden"
                                    >
                                      <summary className="px-4 py-2.5 cursor-pointer hover:bg-surface-elevated/50 text-sm font-semibold text-txt">
                                        DB{dr.dashboardId}: {dr.dashboardName} (
                                        {dr.matchCount} {t("alertRows")})
                                      </summary>
                                      <div className="overflow-auto border-t border-surface-border max-h-[380px]">
                                        <table className="text-xs border-collapse">
                                          <thead className="sticky top-0 z-10">
                                            <tr className="bg-surface-elevated">
                                              <th className="px-3 py-2 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated">
                                                #
                                              </th>
                                              {dr.rows.length > 0 &&
                                                Object.keys(dr.rows[0]).map(
                                                  (col: string) => (
                                                    <th
                                                      key={col}
                                                      className="px-3 py-2 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated"
                                                    >
                                                      {col}
                                                    </th>
                                                  ),
                                                )}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {dr.rows.map((row, ri: number) => (
                                              <tr
                                                key={ri}
                                                className="border-t border-surface-border hover:bg-surface-elevated/30 text-xs"
                                              >
                                                <td className="px-3 py-2 text-txt-dim whitespace-nowrap">
                                                  {ri + 1}
                                                </td>
                                                {Object.values(row).map(
                                                  (val, ci: number) => (
                                                    <td
                                                      key={ci}
                                                      className="px-3 py-2 text-txt whitespace-nowrap"
                                                    >
                                                      {val == null
                                                        ? "-"
                                                        : String(val)}
                                                    </td>
                                                  ),
                                                )}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </details>
                                  ),
                                )}
                              </div>
                            )}
                            <button
                              onClick={() =>
                                router.push(
                                  `/tools/alert-box/search?cif=${alert.cif}`,
                                )
                              }
                              className="mt-3 text-sm font-semibold text-golomt-400 hover:underline"
                            >
                              {t("abAlertsViewOnSearchEngine")}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : null
            ) : (
              <>
                {chartData &&
                  (() => {
                    const {
                      totalTxns,
                      totalStdAmt,
                      totalMLAmt,
                      sevData,
                      dbFreqData,
                      top10,
                      reversedTop10,
                    } = chartData;
                    const SEV_COLORS: Record<string, string> = {
                      "2 DB": "#60a5fa",
                      "3 DB": "#fbbf24",
                      "4 DB": "#f97316",
                      "5+ DB": "#f43f5e",
                    };
                    return (
                      <div className="space-y-4">
                        {/* Summary chips */}
                        <div className="flex flex-wrap gap-2.5">
                          <div className="flex items-center gap-2.5 bg-surface-card border border-surface-border rounded-xl px-4 py-2.5">
                            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                            <span className="text-xs text-txt-dim">
                              Alert CIF
                            </span>
                            <span className="text-xl font-extrabold text-txt">
                              {data.alerts.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 bg-surface-card border border-surface-border rounded-xl px-4 py-2.5">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className="text-xs text-txt-dim">
                              {t("abAlertsTotalTxnLabel")}
                            </span>
                            <span className="text-xl font-extrabold text-txt">
                              {totalTxns.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 bg-surface-card border border-surface-border rounded-xl px-4 py-2.5">
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="text-xs text-txt-dim">
                              {t("abAlertsStdAmountChipLabel")}
                            </span>
                            <span className="text-xl font-extrabold text-amber-400">
                              {formatAmount(totalStdAmt)}₮
                            </span>
                          </div>
                          {totalMLAmt > 0 && (
                            <div className="flex items-center gap-2.5 bg-surface-card border border-surface-border rounded-xl px-4 py-2.5">
                              <div className="w-2 h-2 rounded-full bg-golomt-400" />
                              <span className="text-xs text-txt-dim">
                                {t("abAlertsMlAmountLabel")}
                              </span>
                              <span className="text-xl font-extrabold text-golomt-400">
                                +{formatAmount(totalMLAmt)}₮
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Charts row: Top CIFs bar + Severity donut */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                          {/* Top 10 CIFs horizontal bar */}
                          <div className="lg:col-span-3 bg-surface-card border border-surface-border rounded-2xl p-5">
                            <p className="text-sm font-bold text-txt">
                              Top {top10.length} CIF — {t("abAlertsByAmountLabel")}
                            </p>
                            <p className="text-xs text-txt-dim mb-4">
                              {t("abAlertsSortedByStdAmount")}
                            </p>
                            <ResponsiveContainer
                              width="100%"
                              height={top10.length * 32 + 8}
                            >
                              <BarChart
                                data={reversedTop10}
                                layout="vertical"
                                margin={{
                                  top: 0,
                                  right: 72,
                                  left: 0,
                                  bottom: 0,
                                }}
                              >
                                <XAxis
                                  type="number"
                                  tick={{ fontSize: 9, fill: "#6b7280" }}
                                  tickFormatter={formatAmount}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="cif"
                                  width={82}
                                  tick={{
                                    fontSize: 9,
                                    fontFamily: "monospace",
                                    fill: "#9ca3af",
                                  }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                  content={Top10TooltipContent}
                                />
                                <Bar
                                  dataKey="stdAmount"
                                  radius={[0, 6, 6, 0]}
                                  maxBarSize={22}
                                >
                                  {reversedTop10.map((_, i) => (
                                    <Cell
                                      key={i}
                                      fill={
                                        ALERT_COLORS[i % ALERT_COLORS.length]
                                      }
                                      fillOpacity={0.9}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Severity donut */}
                          <div className="lg:col-span-2 bg-surface-card border border-surface-border rounded-2xl p-5">
                            <p className="text-sm font-bold text-txt">
                              {t("abAlertsSeverityDistribution")}
                            </p>
                            <p className="text-xs text-txt-dim mb-4">
                              {t("abAlertsClassifiedByDashCount")}
                            </p>
                            <div className="flex items-center justify-center gap-6">
                              <ResponsiveContainer width={120} height={120}>
                                <PieChart>
                                  <Pie
                                    data={sevData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={32}
                                    outerRadius={54}
                                    paddingAngle={3}
                                    dataKey="value"
                                  >
                                    {sevData.map((entry, i) => (
                                      <Cell
                                        key={i}
                                        fill={
                                          SEV_COLORS[entry.name] || "#6b7280"
                                        }
                                      />
                                    ))}
                                  </Pie>
                                  <Tooltip content={SevTooltip} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="space-y-2.5">
                                {sevData.map((s) => (
                                  <div
                                    key={s.name}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <div
                                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                      style={{
                                        backgroundColor: SEV_COLORS[s.name],
                                      }}
                                    />
                                    <span className="text-txt-dim">
                                      {s.name}
                                    </span>
                                    <span className="font-extrabold text-txt ml-1">
                                      {s.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* DB hit frequency */}
                        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
                          <p className="text-sm font-bold text-txt">
                            {t("abAlertsDashCoverage")}
                          </p>
                          <p className="text-xs text-txt-dim mb-4">
                            {t("abAlertsRuleTriggerHint")}
                          </p>
                          <ResponsiveContainer width="100%" height={150}>
                            <BarChart
                              data={dbFreqData}
                              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                            >
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 9, fill: "#9ca3af" }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 9, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                              />
                              <Tooltip
                                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                content={DbFreqTooltip}
                              />
                              <Bar
                                dataKey="count"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={28}
                              >
                                {dbFreqData.map((_, i) => (
                                  <Cell
                                    key={i}
                                    fill={ALERT_COLORS[i % ALERT_COLORS.length]}
                                    fillOpacity={0.85}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3 py-1">
                          <div className="h-px flex-1 bg-surface-border" />
                          <span className="text-xs text-txt-dim font-medium tracking-wide uppercase">
                            {data.alerts.length} {t("abAlertsCifListLabel")}
                          </span>
                          <div className="h-px flex-1 bg-surface-border" />
                        </div>
                      </div>
                    );
                  })()}

                {data.totalAlerts === 0 && (
                  <div className="text-center py-12">
                    <AlertTriangle
                      size={32}
                      className="mx-auto text-txt-dim mb-2 opacity-50"
                    />
                    <p className="text-[13px] text-txt-dim">
                      {t("alertNoResult")}
                    </p>
                  </div>
                )}

                {data.alerts.map((alert, idx) => (
                  <div
                    key={alert.cif}
                    className="bg-surface-card rounded-xl border border-surface-border overflow-hidden"
                  >
                    <button
                      onClick={() => handleExpand(alert.cif)}
                      className="w-full p-5 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-txt-dim w-7">
                          {idx + 1}
                        </span>
                        <div
                          className={`px-3 py-1.5 rounded-lg border text-sm font-extrabold ${getSeverityColor(alert.dashboardCount)}`}
                        >
                          {alert.dashboardCount} DB
                        </div>
                        <div className="text-left">
                          <h3 className="text-base font-extrabold text-txt tracking-wide">
                            {alert.cif}
                          </h3>
                          <p className="text-xs text-txt-dim mt-0.5">
                            {alert.dashboards
                              .map((d) => `DB${d.id}`)
                              .join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[15px] font-extrabold text-txt">
                            {alert.totalTransactions}
                          </p>
                          <p className="text-xs text-txt-dim">
                            {t("alertTransactions")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[15px] font-extrabold text-amber-400">
                            {formatAmount(getStdAmount(alert))}₮
                          </p>
                          <p className="text-xs text-txt-dim">
                            {t("abAlertsStdAmountLabel")}
                          </p>
                          {(alert.mlAmount ?? 0) > 0 && (
                            <p className="text-xs text-golomt-400/70">
                              +ML {formatAmount(alert.mlAmount ?? 0)}₮
                            </p>
                          )}
                        </div>
                        {expandedCif === alert.cif ? (
                          <ChevronUp size={18} className="text-txt-dim" />
                        ) : (
                          <ChevronDown size={18} className="text-txt-dim" />
                        )}
                      </div>
                    </button>

                    {expandedCif === alert.cif && (
                      <div className="border-t border-surface-border p-4 bg-surface-elevated/30">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                          {alert.dashboards.map((d) => (
                            <div
                              key={d.id}
                              className="bg-surface-card rounded-lg border border-surface-border p-3"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-extrabold text-golomt-400">
                                  DB{d.id}
                                </span>
                                <span className="text-xs text-txt-dim">
                                  {d.name}
                                </span>
                              </div>
                              <p className="text-sm font-extrabold text-txt">
                                {d.count}{" "}
                                <span className="text-xs text-txt-dim font-normal">
                                  {t("alertRows")}
                                </span>
                              </p>
                              <p className="text-sm font-bold text-amber-400">
                                {formatAmount(d.totalAmount)}₮
                              </p>
                            </div>
                          ))}
                        </div>
                        {loadingDetail && (
                          <div className="flex items-center gap-2 py-3">
                            <Loader2
                              size={14}
                              className="animate-spin text-golomt-400"
                            />
                            <span className="text-[11px] text-txt-dim">
                              {t("alertLoadingDetail")}
                            </span>
                          </div>
                        )}
                        {cifDetail?.results && (
                          <div className="space-y-2 mt-2">
                            {cifDetail.results.map((dr: CifDetailDashboard) => (
                              <details
                                key={dr.dashboardId}
                                className="bg-surface-card rounded-lg border border-surface-border overflow-hidden"
                              >
                                <summary className="px-4 py-2.5 cursor-pointer hover:bg-surface-elevated/50 text-sm font-semibold text-txt flex items-center justify-between">
                                  <span>
                                    DB{dr.dashboardId}: {dr.dashboardName} (
                                    {dr.matchCount} {t("alertRows")})
                                  </span>
                                </summary>
                                <div className="overflow-auto border-t border-surface-border max-h-[380px]">
                                  <table className="text-[10px] border-collapse">
                                    <thead className="sticky top-0 z-10">
                                      <tr className="bg-surface-elevated">
                                        <th className="px-3 py-2 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated">
                                          #
                                        </th>
                                        {dr.rows.length > 0 &&
                                          Object.keys(dr.rows[0]).map(
                                            (col: string) => (
                                              <th
                                                key={col}
                                                className="px-2 py-1.5 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated"
                                              >
                                                {col}
                                              </th>
                                            ),
                                          )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dr.rows.map((row, ri: number) => (
                                        <tr
                                          key={ri}
                                          className="border-t border-surface-border hover:bg-surface-elevated/30"
                                        >
                                          <td className="px-3 py-2 text-txt-dim whitespace-nowrap">
                                            {ri + 1}
                                          </td>
                                          {Object.values(row).map(
                                            (val, ci: number) => (
                                              <td
                                                key={ci}
                                                className="px-3 py-2 text-txt whitespace-nowrap"
                                              >
                                                {val == null
                                                  ? "-"
                                                  : String(val)}
                                              </td>
                                            ),
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </details>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() =>
                            router.push(
                              `/tools/alert-box/search?cif=${alert.cif}`,
                            )
                          }
                          className="mt-3 text-sm font-semibold text-golomt-400 hover:underline"
                        >
                          {t("abAlertsViewOnSearchEngine")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
