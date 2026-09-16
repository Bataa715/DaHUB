"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, Flag, Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
  dbChangesApi,
  getApiErrorMessage,
  type DbChangesDashboardResult,
  type DbChangesRangeRequest,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  COMMAND_BAR,
  CommandBadge,
  PRESETS,
  SQL_COMMANDS,
  SYSTEM_COLORS,
  SYSTEM_TYPES,
  lastDays,
  selectClass,
} from "../_lib/db-ui";

const toRecord = (rows: { name: string; count: number }[]) =>
  Object.fromEntries(rows.map((r) => [r.name, r.count]));

const tooltipProps = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
  itemStyle: { color: "hsl(var(--foreground))" },
};

/**
 * Үндсэн системүүдийн өгөгдлийн сангийн өөрчлөлтийн дашбоард. Өмнөх системийн
 * 14 хоногийн тайлан (системийн төрөл, домэйн, үйлдэл, сонгосон бичлэг)-г
 * хүссэн хугацаагаар шууд харуулна. Анхдагч нь өмнөхтэй адил 14 хоног.
 */
export default function DbChangesDashboardPage() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<DbChangesRangeRequest>(() =>
    lastDays(14),
  );
  const [applied, setApplied] = useState<DbChangesRangeRequest>(() =>
    lastDays(14),
  );
  const [data, setData] = useState<DbChangesDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    dbChangesApi
      .dashboard(
        { ...applied, systemType: applied.systemType || undefined },
        ctrl.signal,
      )
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [applied]);

  const apply = (next: DbChangesRangeRequest) => {
    setLoading(true);
    setError(null);
    setFilters(next);
    setApplied({ ...next });
  };

  const activePreset = PRESETS.find((p) => {
    const r = lastDays(p.days);
    return r.startDate === applied.startDate && r.endDate === applied.endDate;
  })?.days;

  // Үйлдэл × системийн хүснэгт — эх тайлангийн "үйлдлүүд" хэсэг
  const pivot = useMemo(() => {
    if (!data) return { systems: [] as string[], rows: [] };
    const systems = SYSTEM_TYPES.filter((s) =>
      data.actionsBySystem.some((r) => r.systemType === s),
    );
    const byAction = new Map<string, Record<string, number>>();
    for (const r of data.actionsBySystem) {
      const row = byAction.get(r.action) ?? {};
      row[r.systemType] = (row[r.systemType] ?? 0) + r.count;
      byAction.set(r.action, row);
    }
    const rows = [...byAction.entries()]
      .map(([action, counts]) => ({
        action,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);
    return { systems: systems as string[], rows };
  }, [data]);

  const stats = data?.stats;

  return (
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        icon={<Database className="h-4 w-4 text-violet-400" />}
        title={t("dbcDashboardTitle")}
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
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className={cn(toolFieldClass, "w-40")}
          />
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className={cn(toolFieldClass, "w-40")}
          />
          <select
            aria-label={t("dbcColSystem")}
            value={filters.systemType ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                systemType: e.target.value || undefined,
              }))
            }
            className={selectClass}
          >
            <option value="">
              {t("dbcColSystem")}: {t("netFilterAll")}
            </option>
            {SYSTEM_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <ToolStat
            label={t("dbcStatTotal")}
            value={stats?.total.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("dbcStatUsers")}
            value={stats?.users.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("dbcStatObjects")}
            value={stats?.objects.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("dbcStatDrops")}
            value={stats?.drops.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("dbcFlagged")}
            value={stats?.flagged.toLocaleString() ?? "—"}
            className={
              stats && stats.flagged > 0 ? "border-red-500/40" : undefined
            }
          />
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.stats.total === 0 ? (
          <ToolPanel>
            <ToolEmpty icon={Database} title={t("dbcEmpty")} />
          </ToolPanel>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-3">
              <ToolPanel className="lg:col-span-2">
                <ToolPanelHeader title={t("dbcDailyTitle")} />
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
                      <Tooltip {...tooltipProps} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name={t("dbcStatTotal")}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ToolPanelBody>
              </ToolPanel>

              <ToolPanel>
                <ToolPanelHeader title={t("dbcBySystem")} />
                <ToolPanelBody className="flex h-72 items-center gap-4">
                  <div className="h-full min-w-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.bySystem}
                          dataKey="count"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="85%"
                          paddingAngle={2}
                          stroke="none"
                        >
                          {data.bySystem.map((s) => (
                            <Cell
                              key={s.name}
                              fill={SYSTEM_COLORS[s.name] ?? "#94a3b8"}
                            />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipProps} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="shrink-0 space-y-2 text-xs">
                    {data.bySystem.map((s) => (
                      <li key={s.name} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background: SYSTEM_COLORS[s.name] ?? "#94a3b8",
                          }}
                        />
                        <span className="font-semibold">{s.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {s.count.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ToolPanelBody>
              </ToolPanel>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <ToolPanel>
                <ToolPanelHeader title={t("dbcByCommand")} />
                <ToolPanelBody>
                  <DistributionBars
                    data={toRecord(data.byCommand)}
                    order={[...SQL_COMMANDS]}
                    labelOf={(k) => k.toUpperCase()}
                    barClassOf={(k) => COMMAND_BAR[k] ?? "bg-primary"}
                  />
                </ToolPanelBody>
              </ToolPanel>
              <ToolPanel>
                <ToolPanelHeader title={t("dbcDomainsBySystem")} />
                <ToolPanelBody>
                  <DistributionBars
                    data={toRecord(data.domainsBySystem)}
                    labelOf={(k) => k}
                  />
                </ToolPanelBody>
              </ToolPanel>
              <ToolPanel>
                <ToolPanelHeader title={t("dbcTopUsers")} />
                <ToolPanelBody className="max-h-80 overflow-y-auto">
                  <DistributionBars
                    data={toRecord(data.topUsers)}
                    labelOf={(k) => k}
                  />
                </ToolPanelBody>
              </ToolPanel>
            </div>

            <ToolPanel>
              <ToolPanelHeader title={t("dbcActionsBySystem")} />
              <ToolTableWrap className="rounded-none border-0">
                <table className={toolTableClass}>
                  <thead className={toolTheadClass}>
                    <tr>
                      <th className={toolThClass}>{t("dbcColAction")}</th>
                      {pivot.systems.map((s) => (
                        <th key={s} className={cn(toolThClass, "text-right")}>
                          {s}
                        </th>
                      ))}
                      <th className={cn(toolThClass, "text-right")}>
                        {t("dbcStatTotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.rows.map((r) => (
                      <tr key={r.action}>
                        <td className={cn(toolTdClass, "font-semibold")}>
                          {r.action}
                        </td>
                        {pivot.systems.map((s) => (
                          <td
                            key={s}
                            className={cn(
                              toolTdClass,
                              "text-right tabular-nums",
                              !r.counts[s] && "text-muted-foreground",
                            )}
                          >
                            {(r.counts[s] ?? 0).toLocaleString()}
                          </td>
                        ))}
                        <td
                          className={cn(
                            toolTdClass,
                            "text-right font-semibold tabular-nums",
                          )}
                        >
                          {r.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ToolTableWrap>
            </ToolPanel>

            <ToolPanel>
              <ToolPanelHeader
                icon={Flag}
                title={t("dbcFlaggedRecords")}
                actions={
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {data.flagged.length}
                  </span>
                }
              />
              {data.flagged.length === 0 ? (
                <ToolEmpty title={t("dbcNoFlagged")} className="py-10" />
              ) : (
                <ToolTableWrap className="rounded-none border-0">
                  <table className={toolTableClass}>
                    <thead className={toolTheadClass}>
                      <tr>
                        <th className={toolThClass}>{t("dbcColTime")}</th>
                        <th className={toolThClass}>{t("dbcColUser")}</th>
                        <th className={toolThClass}>{t("dbcColSystem")}</th>
                        <th className={toolThClass}>{t("dbcColAction")}</th>
                        <th className={toolThClass}>{t("dbcColObject")}</th>
                        <th className={toolThClass}>SQL</th>
                        <th className={toolThClass}>{t("dbcNote")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.flagged.map((r) => (
                        <tr key={r.rowHash}>
                          <td
                            className={cn(
                              toolTdClass,
                              "whitespace-nowrap tabular-nums",
                            )}
                          >
                            {r.actionTime}
                          </td>
                          <td
                            className={cn(
                              toolTdClass,
                              "whitespace-nowrap font-semibold",
                            )}
                          >
                            {r.username}
                          </td>
                          <td className={cn(toolTdClass, "whitespace-nowrap")}>
                            {r.systemType}
                            <span className="block text-xs text-muted-foreground">
                              {r.owner}
                            </span>
                          </td>
                          <td className={cn(toolTdClass, "whitespace-nowrap")}>
                            <CommandBadge command={r.sqlCommand} />
                          </td>
                          <td className={cn(toolTdClass, "whitespace-nowrap")}>
                            {r.objectName || "—"}
                          </td>
                          <td
                            className={cn(
                              toolTdClass,
                              "min-w-[260px] max-w-[420px]",
                            )}
                          >
                            <span className="line-clamp-3 break-all font-mono text-xs">
                              {r.sqlText}
                            </span>
                          </td>
                          <td className={cn(toolTdClass, "min-w-[220px]")}>
                            {r.note || "—"}
                            <span className="block text-xs text-muted-foreground">
                              {r.reviewedByName}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ToolTableWrap>
              )}
            </ToolPanel>
          </>
        )}
      </div>
    </div>
  );
}
