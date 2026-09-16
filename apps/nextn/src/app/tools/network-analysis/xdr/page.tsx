"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  Eye,
  Loader2,
  ShieldAlert,
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
  type NetRiskLevel,
  type NetXdrItem,
  type NetXdrRequest,
  type NetXdrResult,
  type NetXdrStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DistributionBars,
  RISK_LABEL,
  RISK_ORDER,
  RiskBadge,
  XDR_STATUS_LABEL,
  XDR_STATUS_ORDER,
  XdrStatusBadge,
  defaultRange,
  downloadXlsx,
  riskBarClass,
} from "../_components/net-ui";
import { XdrDialog } from "./_XdrDialog";

const selectClass = cn(
  toolFieldClass,
  "border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
);

/** Microsoft Defender XDR мэдэгдлийн дашбоард. */
export default function XdrPage() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<NetXdrRequest>(defaultRange);
  const [applied, setApplied] = useState<NetXdrRequest>(defaultRange);
  const [data, setData] = useState<NetXdrResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NetXdrItem | null>(null);

  // Шүүлтүүр батлагдах бүрт татна. setState нь зөвхөн promise callback дотор —
  // эхлэх төлөвийг (loading) товч дарах үед тавьдаг.
  useEffect(() => {
    const ctrl = new AbortController();
    networkAnalysisApi
      .listXdr(
        {
          ...applied,
          riskLevel: applied.riskLevel || undefined,
          status: applied.status || undefined,
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

  const set = <K extends keyof NetXdrRequest>(k: K, v: NetXdrRequest[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const exportExcel = () => {
    if (!data) return;
    void downloadXlsx(
      `defender-xdr_${applied.startDate}_${applied.endDate}.xlsx`,
      "Defender XDR",
      [
        { header: t("netColTime"), width: 20 },
        { header: t("netColCategory"), width: 20 },
        { header: "Keyword", width: 20 },
        { header: t("netColDevice"), width: 22 },
        { header: t("netColUser"), width: 22 },
        { header: t("netColRisk"), width: 12 },
        { header: t("netRequiresReview"), width: 14 },
        { header: t("netColStatus"), width: 14 },
        { header: t("netDetailAssignedTo"), width: 18 },
        { header: t("netDetailNote"), width: 40 },
      ],
      data.items.map((i) => [
        i.detectedAt,
        i.category,
        i.actionKeyword,
        i.device,
        i.userName,
        t(RISK_LABEL[i.riskLevel]),
        i.requiresReview ? "✓" : "",
        t(XDR_STATUS_LABEL[i.status]),
        i.assignedTo,
        i.note,
      ]),
    );
  };

  const stats = data?.stats;

  return (
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        icon={<ShieldAlert className="h-4 w-4 text-sky-400" />}
        title={t("netXdrTitle")}
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
            aria-label={t("netFilterStatus")}
            value={filters.status ?? ""}
            onChange={(e) =>
              set("status", (e.target.value || undefined) as NetXdrStatus)
            }
            className={selectClass}
          >
            <option value="">
              {t("netFilterStatus")}: {t("netFilterAll")}
            </option>
            {XDR_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {t(XDR_STATUS_LABEL[s])}
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

        {data?.truncated && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            {t("netTruncated")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <ToolStat
            label={t("netStatNotifications")}
            value={stats?.total.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatHighRisk")}
            value={stats?.highRisk.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatOpenReview")}
            value={stats?.openReview.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatPrivileged")}
            value={stats?.privileged.toLocaleString() ?? "—"}
          />
          <ToolStat
            label={t("netStatDevices")}
            value={stats?.devices.toLocaleString() ?? "—"}
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
              <ToolPanelHeader title={t("netPanelCategories")} />
              <ToolPanelBody>
                <DistributionBars data={stats.byCategory} labelOf={(k) => k} />
              </ToolPanelBody>
            </ToolPanel>
          </div>
        )}

        <ToolPanel>
          <ToolPanelHeader
            title={t("netPanelNotifications")}
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
              icon={ShieldAlert}
              title={t("netEmpty")}
              hint={t("netEmptyHint")}
            />
          ) : (
            <ToolTableWrap className="rounded-none border-0">
              <table className={toolTableClass}>
                <thead className={toolTheadClass}>
                  <tr>
                    <th className={toolThClass}>{t("netColTime")}</th>
                    <th className={toolThClass}>{t("netColCategory")}</th>
                    <th className={toolThClass}>{t("netColDevice")}</th>
                    <th className={toolThClass}>{t("netColUser")}</th>
                    <th className={toolThClass}>{t("netColRisk")}</th>
                    <th className={toolThClass}>{t("netColStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr
                      key={i.notificationId}
                      onClick={() => setSelected(i)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td
                        className={cn(
                          toolTdClass,
                          "whitespace-nowrap tabular-nums",
                        )}
                      >
                        {i.detectedAt}
                      </td>
                      <td className={toolTdClass}>
                        <span className="flex items-center gap-1.5 font-semibold">
                          {i.requiresReview && (
                            <Eye
                              className="h-3.5 w-3.5 shrink-0 text-amber-500"
                              aria-label={t("netRequiresReview")}
                            />
                          )}
                          {i.category}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {i.actionKeyword}
                        </span>
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        {i.device || "—"}
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        {i.userName || "—"}
                      </td>
                      <td className={toolTdClass}>
                        <RiskBadge level={i.riskLevel} t={t} />
                      </td>
                      <td className={toolTdClass}>
                        <XdrStatusBadge status={i.status} t={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ToolTableWrap>
          )}
        </ToolPanel>
      </div>

      <XdrDialog
        item={selected}
        onClose={() => setSelected(null)}
        onSaved={(patch) =>
          setData((d) =>
            d
              ? {
                  ...d,
                  items: d.items.map((i) =>
                    i.notificationId === patch.notificationId
                      ? { ...i, ...patch }
                      : i,
                  ),
                }
              : d,
          )
        }
      />
    </div>
  );
}
