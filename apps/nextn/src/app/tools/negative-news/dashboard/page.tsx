"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Newspaper, Search } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  DistributionBars,
  TOOL_CONTAINER,
  ToolEmpty,
  ToolPanel,
  ToolPanelBody,
  ToolPanelHeader,
  ToolStat,
  ToolTableWrap,
  ToolToolbar,
  toolFieldClass,
  toolTableClass,
  toolTdClass,
  toolTheadClass,
  toolThClass,
} from "@/components/shared/tool-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getApiErrorMessage,
  negativeNewsApi,
  type NegativeNewsDashboardRequest,
  type NegativeNewsDashboardResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { AiInsightsPanel } from "./_AiInsightsPanel";

const selectClass = cn(
  toolFieldClass,
  "border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
);

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Сүүлийн N хоног (өнөөдрийг оруулаад) */
function lastDays(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { startDate: ymd(start), endDate: ymd(end) };
}

const PRESETS = [
  { days: 7, labelKey: "nnPeriod7" },
  { days: 14, labelKey: "nnPeriod14" },
  { days: 28, labelKey: "nnPeriod28" },
] as const;

const toRecord = (rows: { name: string; count: number }[]) =>
  Object.fromEntries(rows.map((r) => [r.name, r.count]));

/**
 * Сөрөг мэдээний дашбоард. Өмнөх систем 7 хоног тутам имэйлээр илгээдэг
 * тайланг (нийт тоо, өдрийн график, суваг/банк/ангилал, давтагдсан мэдээ)
 * хүссэн хугацаагаар шууд харуулна. Анхдагч хугацаа нь өмнөхтэй адил 7 хоног.
 */
export default function NegativeNewsDashboardPage() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<NegativeNewsDashboardRequest>(() =>
    lastDays(7),
  );
  const [applied, setApplied] = useState<NegativeNewsDashboardRequest>(() =>
    lastDays(7),
  );
  const [data, setData] = useState<NegativeNewsDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    negativeNewsApi
      .dashboard(
        {
          ...applied,
          bank: applied.bank || undefined,
          channel: applied.channel || undefined,
          category: applied.category || undefined,
          search: applied.search?.trim() || undefined,
        },
        ctrl.signal,
      )
      .then((res) => setData(res))
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [applied]);

  const apply = (next: NegativeNewsDashboardRequest) => {
    setLoading(true);
    setError(null);
    setFilters(next);
    setApplied({ ...next });
  };

  const set = <K extends keyof NegativeNewsDashboardRequest>(
    k: K,
    v: NegativeNewsDashboardRequest[K],
  ) => setFilters((f) => ({ ...f, [k]: v }));

  const activePreset = PRESETS.find((p) => {
    const r = lastDays(p.days);
    return r.startDate === applied.startDate && r.endDate === applied.endDate;
  })?.days;

  const stats = data?.stats;
  const options = data?.options;

  return (
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        icon={<Newspaper className="h-4 w-4 text-rose-400" />}
        title={t("nnDashboardTitle")}
      />

      <ToolToolbar>
        <form
          className="flex w-full flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply(filters);
          }}
        >
          <div className="flex rounded-lg bg-muted p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => apply({ ...filters, ...lastDays(p.days) })}
                aria-pressed={activePreset === p.days}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-semibold transition-colors",
                  activePreset === p.days
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={cn(toolFieldClass, "w-40")}
          />
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            className={cn(toolFieldClass, "w-40")}
          />
          {(
            [
              ["bank", "nnFilterBank", options?.banks],
              ["channel", "nnFilterChannel", options?.channels],
              ["category", "nnFilterCategory", options?.categories],
            ] as const
          ).map(([key, labelKey, values]) => (
            <select
              key={key}
              aria-label={t(labelKey)}
              value={filters[key] ?? ""}
              onChange={(e) => set(key, e.target.value || undefined)}
              className={cn(selectClass, "max-w-[12rem]")}
            >
              <option value="">
                {t(labelKey)}: {t("netFilterAll")}
              </option>
              {(values ?? []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ))}
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => set("search", e.target.value)}
              placeholder={t("nnSearchPlaceholder")}
              maxLength={200}
              className={cn(toolFieldClass, "pl-8")}
            />
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("netApply")}
          </Button>
        </form>
      </ToolToolbar>

      <div className={cn(TOOL_CONTAINER, "space-y-5 py-6")}>
        {error && (
          <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {data?.truncated && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            {t("nnTruncated")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ToolStat
            label={t("nnStatTotal")}
            value={stats?.total.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("nnStatGolomt")}
            value={stats?.golomt.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("nnStatBanks")}
            value={stats?.banks.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("nnStatChannels")}
            value={stats?.channels.toLocaleString() ?? "—"}
          />
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.stats.total === 0 ? (
          <ToolPanel>
            <ToolEmpty icon={Newspaper} title={t("nnEmpty")} />
          </ToolPanel>
        ) : (
          <>
            <ToolPanel>
              <ToolPanelHeader title={t("nnDailyTitle")} />
              <ToolPanelBody className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.daily}
                    margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => d.slice(5)}
                      tick={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelStyle={{
                        color: "hsl(var(--foreground))",
                        fontWeight: 600,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name={t("nnStatTotal")}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ToolPanelBody>
            </ToolPanel>

            <div className="grid gap-5 lg:grid-cols-3">
              {(
                [
                  ["nnByChannel", data.byChannel],
                  ["nnByBank", data.byBank],
                  ["nnByCategory", data.byCategory],
                ] as const
              ).map(([titleKey, rows]) => (
                <ToolPanel key={titleKey}>
                  <ToolPanelHeader
                    title={t(titleKey)}
                    actions={
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {rows.length}
                      </span>
                    }
                  />
                  <ToolPanelBody className="max-h-80 overflow-y-auto">
                    <DistributionBars
                      data={toRecord(rows)}
                      labelOf={(k) => k}
                    />
                  </ToolPanelBody>
                </ToolPanel>
              ))}
            </div>

            <AiInsightsPanel
              // Шүүлтүүр солигдвол хуучин AI хариу өөр мэдээнд хамаарна — шинээр эхлүүлнэ
              key={JSON.stringify(applied)}
              filters={applied}
            />

            <ToolPanel>
              <ToolPanelHeader
                title={t("nnNewsList")}
                description={
                  data.matched > data.items.length
                    ? t("nnListCapped")
                    : undefined
                }
                actions={
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {data.matched.toLocaleString()}
                  </span>
                }
              />
              <ToolTableWrap className="rounded-none border-0">
                <table className={toolTableClass}>
                  <thead className={toolTheadClass}>
                    <tr>
                      <th className={toolThClass}>{t("nnColDate")}</th>
                      <th className={toolThClass}>{t("nnFilterBank")}</th>
                      <th className={toolThClass}>{t("nnFilterChannel")}</th>
                      <th className={toolThClass}>{t("nnFilterCategory")}</th>
                      <th className={toolThClass}>{t("nnColContent")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((i) => (
                      <tr key={i.rowHash}>
                        <td
                          className={cn(
                            toolTdClass,
                            "whitespace-nowrap tabular-nums",
                          )}
                        >
                          {i.newsDate}
                        </td>
                        <td
                          className={cn(
                            toolTdClass,
                            "whitespace-nowrap font-semibold",
                          )}
                        >
                          {i.bank}
                        </td>
                        <td className={cn(toolTdClass, "whitespace-nowrap")}>
                          {i.channel}
                        </td>
                        <td className={cn(toolTdClass, "whitespace-nowrap")}>
                          {i.category}
                        </td>
                        <td className={cn(toolTdClass, "min-w-[320px]")}>
                          {i.content}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ToolTableWrap>
            </ToolPanel>
          </>
        )}
      </div>
    </div>
  );
}
