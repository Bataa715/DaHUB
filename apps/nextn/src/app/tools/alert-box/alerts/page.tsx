"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { abFetchAlerts, abSearchByCif, abSearchAlertByCif } from "../_lib/api";
import {
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
  Search,
  X,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";

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
  totalAmount: number;
  dashboards: AlertDashboard[];
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

export default function AlertsPage() {
  const router = useRouter();

  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCif, setExpandedCif] = useState<string | null>(null);
  const [cifDetail, setCifDetail] = useState<Record<string, any> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [minDash, setMinDash] = useState(2);
  const [cifSearch, setCifSearch] = useState("");
  const [cifSearchResult, setCifSearchResult] = useState<{
    loading: boolean;
    alerts: any[];
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
          (a: any) =>
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

  const loadAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await abFetchAlerts(minDash, 10000);
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

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

  const formatAmount = (n: number) => {
    if (!n) return "0";
    return new Intl.NumberFormat("mn-MN").format(Math.round(n));
  };

  const getSeverityColor = (count: number) => {
    if (count >= 5) return "text-red-400 bg-red-500/10 border-red-500/25";
    if (count >= 3) return "text-amber-400 bg-amber-500/10 border-amber-500/25";
    return "text-blue-400 bg-blue-500/10 border-blue-500/25";
  };

  return (
    <div className="space-y-5">
      <ToolPageHeader
        href="/tools"
        icon={<AlertTriangle size={16} className="text-red-400" />}
        title="Alert"
        subtitle="2+ Dashboard-д илэрсэн CIF-үүд"
        rightContent={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-surface-card border border-surface-border rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-txt-dim">Хамгийн бага:</span>
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
              onClick={loadAlerts}
              disabled={loading}
              className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-elevated transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={`text-txt-dim ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        }
      />
      <div className="px-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-golomt-400" />
            <span className="text-[12px] text-txt-dim ml-3">
              12 Dashboard шалгаж байна...
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
                {data.failedDashboards.length} dashboard ачаалагдаагүй — дарж
                дэлгэрэнгүй харна уу
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
                placeholder="CIF хайх... (шууд Oracle-с хайна)"
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
                    Oracle-с хайж байна...
                  </span>
                </div>
              ) : cifSearchResult.searched ? (
                cifSearchResult.alerts.length === 0 ? (
                  <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-[11px] text-txt-dim">
                    <span className="font-mono text-txt">
                      {cifSearch.trim()}
                    </span>{" "}
                    — {minDash}+ dashboard-д давхардсан alert илэрсэнгүй
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
                          className="w-full p-4 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getSeverityColor(alert.dashboardCount)}`}
                            >
                              {alert.dashboardCount} DB
                            </div>
                            <div className="text-left">
                              <h3 className="text-[13px] font-bold text-txt">
                                {alert.cif}
                              </h3>
                              <p className="text-[10px] text-txt-dim">
                                {alert.dashboards
                                  .map((d: any) => `DB${d.id}`)
                                  .join(", ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-5">
                            <div className="text-right">
                              <p className="text-[13px] font-bold text-txt">
                                {alert.totalTransactions}
                              </p>
                              <p className="text-[9px] text-txt-dim">гүйлгээ</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[12px] font-bold text-amber-400">
                                {formatAmount(alert.totalAmount)}₮
                              </p>
                              <p className="text-[9px] text-txt-dim">
                                нийт дүн
                              </p>
                            </div>
                            {expandedCif === alert.cif ? (
                              <ChevronUp size={16} className="text-txt-dim" />
                            ) : (
                              <ChevronDown size={16} className="text-txt-dim" />
                            )}
                          </div>
                        </button>

                        {expandedCif === alert.cif && (
                          <div className="border-t border-surface-border p-4 bg-surface-elevated/30">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                              {alert.dashboards.map((d: any) => (
                                <div
                                  key={d.id}
                                  className="bg-surface-card rounded-lg border border-surface-border p-2.5"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-golomt-400">
                                      DB{d.id}
                                    </span>
                                    <span className="text-[10px] text-txt-dim">
                                      {d.name}
                                    </span>
                                  </div>
                                  <p className="text-[12px] font-bold text-txt">
                                    {d.count}{" "}
                                    <span className="text-[9px] text-txt-dim font-normal">
                                      мөр
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-amber-400">
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
                                  Дэлгэрэнгүй ачааллаж байна...
                                </span>
                              </div>
                            )}
                            {cifDetail?.results && (
                              <div className="space-y-2 mt-2">
                                {cifDetail.results.map((dr: any) => (
                                  <details
                                    key={dr.dashboardId}
                                    className="bg-surface-card rounded-lg border border-surface-border overflow-hidden"
                                  >
                                    <summary className="px-3 py-2 cursor-pointer hover:bg-surface-elevated/50 text-[11px] font-semibold text-txt">
                                      DB{dr.dashboardId}: {dr.dashboardName} (
                                      {dr.matchCount} мөр)
                                    </summary>
                                    <div className="overflow-auto border-t border-surface-border max-h-[380px]">
                                      <table className="text-[10px] border-collapse">
                                        <thead className="sticky top-0 z-10">
                                          <tr className="bg-surface-elevated">
                                            <th className="px-2 py-1.5 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated">
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
                                          {dr.rows.map(
                                            (row: any, ri: number) => (
                                              <tr
                                                key={ri}
                                                className="border-t border-surface-border hover:bg-surface-elevated/30"
                                              >
                                                <td className="px-2 py-1.5 text-txt-dim whitespace-nowrap">
                                                  {ri + 1}
                                                </td>
                                                {Object.values(row).map(
                                                  (val: any, ci: number) => (
                                                    <td
                                                      key={ci}
                                                      className="px-2 py-1.5 text-txt whitespace-nowrap text-[10px]"
                                                    >
                                                      {val == null
                                                        ? "-"
                                                        : String(val)}
                                                    </td>
                                                  ),
                                                )}
                                              </tr>
                                            ),
                                          )}
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
                              className="mt-3 text-[11px] text-golomt-400 hover:underline"
                            >
                              Search Engine дээр дэлгэрэнгүй харах →
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
                <div className="bg-surface-card rounded-xl border border-surface-border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Users size={20} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-txt">
                        {data.totalAlerts}
                      </p>
                      <p className="text-[10px] text-txt-dim">
                        {minDash}+ dashboard-д давхардсан CIF
                      </p>
                    </div>
                  </div>
                </div>

                {data.totalAlerts === 0 && (
                  <div className="text-center py-12">
                    <AlertTriangle
                      size={32}
                      className="mx-auto text-txt-dim mb-2 opacity-50"
                    />
                    <p className="text-[13px] text-txt-dim">Alert илэрсэнгүй</p>
                  </div>
                )}

                {data.alerts.map((alert, idx) => (
                  <div
                    key={alert.cif}
                    className="bg-surface-card rounded-xl border border-surface-border overflow-hidden"
                  >
                    <button
                      onClick={() => handleExpand(alert.cif)}
                      className="w-full p-4 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-txt-dim w-6">
                          {idx + 1}
                        </span>
                        <div
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getSeverityColor(alert.dashboardCount)}`}
                        >
                          {alert.dashboardCount} DB
                        </div>
                        <div className="text-left">
                          <h3 className="text-[13px] font-bold text-txt">
                            {alert.cif}
                          </h3>
                          <p className="text-[10px] text-txt-dim">
                            {alert.dashboards
                              .map((d) => `DB${d.id}`)
                              .join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-txt">
                            {alert.totalTransactions}
                          </p>
                          <p className="text-[9px] text-txt-dim">гүйлгээ</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-bold text-amber-400">
                            {formatAmount(alert.totalAmount)}₮
                          </p>
                          <p className="text-[9px] text-txt-dim">нийт дүн</p>
                        </div>
                        {expandedCif === alert.cif ? (
                          <ChevronUp size={16} className="text-txt-dim" />
                        ) : (
                          <ChevronDown size={16} className="text-txt-dim" />
                        )}
                      </div>
                    </button>

                    {expandedCif === alert.cif && (
                      <div className="border-t border-surface-border p-4 bg-surface-elevated/30">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                          {alert.dashboards.map((d) => (
                            <div
                              key={d.id}
                              className="bg-surface-card rounded-lg border border-surface-border p-2.5"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-golomt-400">
                                  DB{d.id}
                                </span>
                                <span className="text-[10px] text-txt-dim">
                                  {d.name}
                                </span>
                              </div>
                              <p className="text-[12px] font-bold text-txt">
                                {d.count}{" "}
                                <span className="text-[9px] text-txt-dim font-normal">
                                  мөр
                                </span>
                              </p>
                              <p className="text-[10px] text-amber-400">
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
                              Дэлгэрэнгүй ачааллаж байна...
                            </span>
                          </div>
                        )}
                        {cifDetail?.results && (
                          <div className="space-y-2 mt-2">
                            {cifDetail.results.map((dr: any) => (
                              <details
                                key={dr.dashboardId}
                                className="bg-surface-card rounded-lg border border-surface-border overflow-hidden"
                              >
                                <summary className="px-3 py-2 cursor-pointer hover:bg-surface-elevated/50 text-[11px] font-semibold text-txt flex items-center justify-between">
                                  <span>
                                    DB{dr.dashboardId}: {dr.dashboardName} (
                                    {dr.matchCount} мөр)
                                  </span>
                                </summary>
                                <div className="overflow-auto border-t border-surface-border max-h-[380px]">
                                  <table className="text-[10px] border-collapse">
                                    <thead className="sticky top-0 z-10">
                                      <tr className="bg-surface-elevated">
                                        <th className="px-2 py-1.5 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated">
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
                                      {dr.rows.map((row: any, ri: number) => (
                                        <tr
                                          key={ri}
                                          className="border-t border-surface-border hover:bg-surface-elevated/30"
                                        >
                                          <td className="px-2 py-1.5 text-txt-dim whitespace-nowrap">
                                            {ri + 1}
                                          </td>
                                          {Object.values(row).map(
                                            (val: any, ci: number) => (
                                              <td
                                                key={ci}
                                                className="px-2 py-1.5 text-txt whitespace-nowrap text-[10px]"
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
                          className="mt-3 text-[11px] text-golomt-400 hover:underline"
                        >
                          Search Engine дээр дэлгэрэнгүй харах →
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
