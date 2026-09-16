"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  Loader2,
  Network,
  Search,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
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
  networkAnalysisApi,
  type NetConfigChangesRequest,
  type NetConfigChangesResult,
  type NetReviewStatus,
  type NetRiskLevel,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DistributionBars,
  REVIEW_LABEL,
  REVIEW_ORDER,
  RISK_LABEL,
  RISK_ORDER,
  ReviewBadge,
  RiskBadge,
  defaultRange,
  downloadXlsx,
  riskBarClass,
} from "../_components/net-ui";
import { ConfigChangeDialog } from "./_ConfigChangeDialog";

const selectClass = cn(
  toolFieldClass,
  "border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
);

/** Palo Alto галт ханын тохиргооны өөрчлөлтийн дашбоард. */
export default function ConfigChangesPage() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<NetConfigChangesRequest>(defaultRange);
  const [applied, setApplied] = useState<NetConfigChangesRequest>(defaultRange);
  const [data, setData] = useState<NetConfigChangesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Шүүлтүүр батлагдах бүрт татна. setState нь зөвхөн promise callback дотор —
  // эхлэх төлөвийг (loading) товч дарах үед тавьдаг.
  useEffect(() => {
    const ctrl = new AbortController();
    networkAnalysisApi
      .listConfigChanges(
        {
          ...applied,
          riskLevel: applied.riskLevel || undefined,
          reviewStatus: applied.reviewStatus || undefined,
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

  const set = <K extends keyof NetConfigChangesRequest>(
    k: K,
    v: NetConfigChangesRequest[K],
  ) => setFilters((f) => ({ ...f, [k]: v }));

  const exportExcel = () => {
    if (!data) return;
    void downloadXlsx(
      `palo-alto-changes_${applied.startDate}_${applied.endDate}.xlsx`,
      "Palo Alto",
      [
        { header: "Seqno", width: 14 },
        { header: t("netColTime"), width: 20 },
        { header: t("netColDevice"), width: 20 },
        { header: t("netColAdmin"), width: 18 },
        { header: "IP", width: 16 },
        { header: t("netColCmd"), width: 10 },
        { header: t("netColPath"), width: 60 },
        { header: t("netColRisk"), width: 12 },
        { header: t("netDetailRule"), width: 20 },
        { header: t("netColReview"), width: 14 },
        { header: t("netDetailDescription"), width: 40 },
      ],
      data.items.map((i) => [
        i.seqno,
        i.receiveTime,
        i.deviceName,
        i.adminUsername,
        i.adminSourceIp,
        i.cmd,
        i.path,
        t(RISK_LABEL[i.riskLevel]),
        i.riskRule ?? "",
        t(REVIEW_LABEL[i.reviewStatus]),
        i.description,
      ]),
    );
  };

  const stats = data?.stats;

  return (
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        icon={<Network className="h-4 w-4 text-orange-400" />}
        title={t("netConfigTitle")}
        rightContent={
          <Button
            size="sm"
            variant="outline"
            onClick={exportExcel}
            disabled={!data || data.items.length === 0}
            className="h-8 gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            {t("netExport")}
          </Button>
        }
      />

      <ToolToolbar>
        <form
          className="flex w-full flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            setApplied({ ...filters });
          }}
        >
          <Input
            type="date"
            aria-label={t("netFilterFrom")}
            value={filters.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={cn(toolFieldClass, "w-40")}
          />
          <Input
            type="date"
            aria-label={t("netFilterTo")}
            value={filters.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            className={cn(toolFieldClass, "w-40")}
          />
          <select
            aria-label={t("netFilterRisk")}
            value={filters.riskLevel ?? ""}
            onChange={(e) =>
              set("riskLevel", (e.target.value || undefined) as NetRiskLevel)
            }
            className={selectClass}
          >
            <option value="">
              {t("netFilterRisk")}: {t("netFilterAll")}
            </option>
            {RISK_ORDER.map((r) => (
              <option key={r} value={r}>
                {t(RISK_LABEL[r])}
              </option>
            ))}
          </select>
          <select
            aria-label={t("netFilterReview")}
            value={filters.reviewStatus ?? ""}
            onChange={(e) =>
              set(
                "reviewStatus",
                (e.target.value || undefined) as NetReviewStatus,
              )
            }
            className={selectClass}
          >
            <option value="">
              {t("netFilterReview")}: {t("netFilterAll")}
            </option>
            {REVIEW_ORDER.map((r) => (
              <option key={r} value={r}>
                {t(REVIEW_LABEL[r])}
              </option>
            ))}
          </select>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => set("search", e.target.value)}
              placeholder={t("netSearchPlaceholder")}
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
            {t("netTruncated")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <ToolStat
            label={t("netStatChanges")}
            value={stats?.total.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatHighRisk")}
            value={stats?.highRisk.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatPending")}
            value={stats?.pendingReview.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatDevices")}
            value={stats?.devices.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatAdmins")}
            value={stats?.admins.toLocaleString() ?? "—"}
          />
        </div>

        {stats && stats.total > 0 && (
          <div className="grid gap-5 lg:grid-cols-2">
            <ToolPanel>
              <ToolPanelHeader title={t("netPanelRiskDistribution")} />
              <ToolPanelBody>
                <DistributionBars
                  data={stats.byRisk}
                  order={RISK_ORDER}
                  labelOf={(k) => t(RISK_LABEL[k as NetRiskLevel])}
                  barClassOf={riskBarClass}
                />
              </ToolPanelBody>
            </ToolPanel>
            <ToolPanel>
              <ToolPanelHeader title={t("netPanelTopAdmins")} />
              <ToolPanelBody className="p-0">
                <table className={toolTableClass}>
                  <thead className={toolTheadClass}>
                    <tr>
                      <th className={toolThClass}>{t("netColAdmin")}</th>
                      <th className={cn(toolThClass, "text-right")}>
                        {t("netColChanges")}
                      </th>
                      <th className={cn(toolThClass, "text-right")}>
                        {t("netStatHighRisk")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topAdmins.map((a) => (
                      <tr key={a.username}>
                        <td className={cn(toolTdClass, "font-semibold")}>
                          {a.username}
                        </td>
                        <td
                          className={cn(toolTdClass, "text-right tabular-nums")}
                        >
                          {a.changes}
                        </td>
                        <td
                          className={cn(
                            toolTdClass,
                            "text-right font-semibold tabular-nums",
                            a.highRisk > 0 &&
                              "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {a.highRisk}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ToolPanelBody>
            </ToolPanel>
          </div>
        )}

        <ToolPanel>
          <ToolPanelHeader
            title={t("netPanelChanges")}
            description={
              data && data.matched > data.items.length
                ? t("netListCapped")
                : undefined
            }
            actions={
              data ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {data.matched.toLocaleString()}
                </span>
              ) : undefined
            }
          />
          {loading && !data ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <ToolEmpty
              icon={Network}
              title={t("netEmpty")}
              hint={t("netEmptyHint")}
            />
          ) : (
            <ToolTableWrap className="rounded-none border-0">
              <table className={toolTableClass}>
                <thead className={toolTheadClass}>
                  <tr>
                    <th className={toolThClass}>{t("netColTime")}</th>
                    <th className={toolThClass}>{t("netColDevice")}</th>
                    <th className={toolThClass}>{t("netColAdmin")}</th>
                    <th className={toolThClass}>{t("netColCmd")}</th>
                    <th className={toolThClass}>{t("netColPath")}</th>
                    <th className={toolThClass}>{t("netColRisk")}</th>
                    <th className={toolThClass}>{t("netColReview")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr
                      key={i.seqno}
                      onClick={() => setSelected(i.seqno)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td
                        className={cn(
                          toolTdClass,
                          "whitespace-nowrap tabular-nums",
                        )}
                      >
                        {i.receiveTime}
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        {i.deviceName}
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        <span className="font-semibold">
                          {i.adminUsername || "—"}
                        </span>
                        {i.adminSourceIp && (
                          <span className="block text-xs text-muted-foreground">
                            {i.adminSourceIp}
                          </span>
                        )}
                      </td>
                      <td className={cn(toolTdClass, "font-mono text-xs")}>
                        {i.cmd}
                      </td>
                      <td className={cn(toolTdClass, "max-w-[420px]")}>
                        <span className="line-clamp-2 break-all font-mono text-xs text-muted-foreground">
                          {i.path}
                        </span>
                      </td>
                      <td className={toolTdClass}>
                        <RiskBadge level={i.riskLevel} t={t} />
                      </td>
                      <td className={toolTdClass}>
                        <ReviewBadge status={i.reviewStatus} t={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ToolTableWrap>
          )}
        </ToolPanel>
      </div>

      <ConfigChangeDialog
        seqno={selected}
        onClose={() => setSelected(null)}
        onSaved={(seqno, patch) =>
          setData((d) =>
            d
              ? {
                  ...d,
                  items: d.items.map((i) =>
                    i.seqno === seqno ? { ...i, ...patch } : i,
                  ),
                }
              : d,
          )
        }
      />
    </div>
  );
}
