"use client";

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
import {
  ALERT_COLORS,
  formatAmount,
  SevTooltip,
  DbFreqTooltip,
} from "./_alerts-shared";
import type { AlertsPageState } from "./_useAlertsPage";

/** Alert-ийн нэгтгэл график — давтамж, зэрэглэл, топ 10. */
export function AlertCharts({ access }: { access: AlertsPageState }) {
  const { t, data, chartData, Top10TooltipContent } = access;
  if (!data) return null;
  return (
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
                  <span className="text-xs text-txt-dim">Alert CIF</span>
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
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs text-txt-dim">
                      {t("abAlertsMlAmountLabel")}
                    </span>
                    <span className="text-xl font-extrabold text-primary">
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
                            fill={ALERT_COLORS[i % ALERT_COLORS.length]}
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
                              fill={SEV_COLORS[entry.name] || "#6b7280"}
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
                          <span className="text-txt-dim">{s.name}</span>
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
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
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
                <span className="text-xs text-txt-dim font-medium">
                  {data.alerts.length} {t("abAlertsCifListLabel")}
                </span>
                <div className="h-px flex-1 bg-surface-border" />
              </div>
            </div>
          );
        })()}
    </>
  );
}
