"use client";

import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { CifDetailDashboard, formatAmount } from "./_alerts-shared";
import type { AlertsPageState } from "./_useAlertsPage";

/** Alert жагсаалт — CIF бүрийн карт, дэлгэрэнгүй задаргаа. */
export function AlertList({ access }: { access: AlertsPageState }) {
  const {
    router,
    t,
    data,
    visibleCount,
    expandedCif,
    cifDetail,
    loadingDetail,
    handleExpand,
    getStdAmount,
    getSeverityColor,
  } = access;
  if (!data) return null;
  return (
    <>
      {data.alerts.slice(0, visibleCount).map((alert, idx) => (
        <div
          key={alert.cif}
          className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden"
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
                  {alert.dashboards.map((d) => `DB${d.id}`).join(", ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-base font-extrabold text-txt">
                  {alert.totalTransactions}
                </p>
                <p className="text-xs text-txt-dim">{t("alertTransactions")}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold text-amber-400">
                  {formatAmount(getStdAmount(alert))}₮
                </p>
                <p className="text-xs text-txt-dim">
                  {t("abAlertsStdAmountLabel")}
                </p>
                {(alert.mlAmount ?? 0) > 0 && (
                  <p className="text-xs text-primary/70">
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
                      <span className="text-xs font-extrabold text-primary">
                        DB{d.id}
                      </span>
                      <span className="text-xs text-txt-dim">{d.name}</span>
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
                  <Loader2 size={14} className="animate-spin text-primary" />
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
                        <table className="text-[11px] border-collapse">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-surface-elevated">
                              <th className="px-3 py-2 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated">
                                #
                              </th>
                              {dr.rows.length > 0 &&
                                Object.keys(dr.rows[0]).map((col: string) => (
                                  <th
                                    key={col}
                                    className="px-2 py-1.5 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated"
                                  >
                                    {col}
                                  </th>
                                ))}
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
                                {Object.values(row).map((val, ci: number) => (
                                  <td
                                    key={ci}
                                    className="px-3 py-2 text-txt whitespace-nowrap"
                                  >
                                    {val == null ? "-" : String(val)}
                                  </td>
                                ))}
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
                  router.push(`/tools/alert-box/search?cif=${alert.cif}`)
                }
                className="mt-3 text-sm font-semibold text-primary hover:underline"
              >
                {t("abAlertsViewOnSearchEngine")}
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
