"use client";

import { startAsync } from "@/lib/start-async";
import { useAlertsPage } from "./_useAlertsPage";
import { AlertSearchResults } from "./_AlertSearchResults";
import { AlertCharts } from "./_AlertCharts";
import { AlertList } from "./_AlertList";
import { AlertTriangle, Loader2, RefreshCw, Search, X } from "lucide-react";
import { ALERTS_PAGE_SIZE } from "./_alerts-shared";

export default function AlertsPage() {
  const access = useAlertsPage();
  const {
    t,
    data,
    loading,
    error,
    visibleCount,
    setVisibleCount,
    minDash,
    setMinDash,
    cifSearch,
    cifSearchResult,
    handleCifSearch,
    loadAlerts,
    setLoading,
  } = access;

  const refreshAlerts = () => {
    setLoading(true);
    startAsync(() => loadAlerts());
  };

  return (
    <div className="space-y-5">
      <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <h1 className="text-sm font-bold text-txt truncate">Alert</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-surface-card border border-surface-border rounded-lg px-3 py-1.5">
            <span className="text-[11px] text-txt-dim">
              {t("alertMinDash")}
            </span>
            <select
              value={minDash}
              onChange={(e) => {
                setLoading(true);
                setMinDash(Number(e.target.value));
              }}
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
            onClick={refreshAlerts}
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
      <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs text-txt-dim ml-3">
              {t("alertLoading")}
            </span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-red-400 text-xs text-center">{error}</p>
            <button
              onClick={refreshAlerts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-[11px] font-semibold text-txt hover:bg-surface-elevated transition-colors"
            >
              <RefreshCw size={12} />
              {t("abAlertsRetryBtn")}
            </button>
          </div>
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
                className="w-full bg-surface-card border border-surface-border rounded-xl pl-8 pr-9 py-2 text-xs text-txt placeholder:text-txt-dim outline-none focus:border-primary/50"
              />
              {cifSearchResult.loading && (
                <Loader2
                  size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary"
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
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span className="text-xs text-txt-dim ml-2">
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
                  <AlertSearchResults access={access} />
                )
              ) : null
            ) : (
              <>
                <AlertCharts access={access} />

                {data.totalAlerts === 0 && (
                  <div className="text-center py-12">
                    <AlertTriangle
                      size={32}
                      className="mx-auto text-txt-dim mb-2 opacity-50"
                    />
                    <p className="text-sm text-txt-dim">{t("alertNoResult")}</p>
                  </div>
                )}

                <AlertList access={access} />

                {visibleCount < data.alerts.length && (
                  <div className="flex flex-col items-center gap-1.5 py-4">
                    <button
                      onClick={() =>
                        setVisibleCount((c) => c + ALERTS_PAGE_SIZE)
                      }
                      className="px-5 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-txt hover:bg-surface-elevated transition-colors"
                    >
                      {t("abAlertsLoadMoreBtn")}
                    </button>
                    <span className="text-[11px] text-txt-dim">
                      {visibleCount} / {data.alerts.length}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
