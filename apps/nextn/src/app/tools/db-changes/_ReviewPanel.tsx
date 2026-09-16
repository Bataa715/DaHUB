"use client";

import { useEffect, useState } from "react";
import { Database, Flag, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ToolEmpty,
  ToolPanel,
  ToolPanelBody,
  ToolPanelHeader,
  ToolTableWrap,
  toolFieldClass,
  toolTableClass,
  toolTdClass,
  toolTheadClass,
  toolThClass,
} from "@/components/shared/tool-ui";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  dbChangesApi,
  getApiErrorMessage,
  type DbChangeRecord,
  type DbChangesRecordsRequest,
  type DbChangesRecordsResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CommandBadge,
  PRESETS,
  SQL_COMMANDS,
  SYSTEM_TYPES,
  lastDays,
  selectClass,
} from "./_lib/db-ui";
import { ReviewDialog } from "./_ReviewDialog";

const clean = (f: DbChangesRecordsRequest): DbChangesRecordsRequest => ({
  ...f,
  systemType: f.systemType || undefined,
  sqlCommand: f.sqlCommand || undefined,
  username: f.username || undefined,
  search: f.search?.trim() || undefined,
  flaggedOnly: f.flaggedOnly || undefined,
});

/**
 * Бичлэг бүрийг хянах — хугацаа, систем, команд, хэрэглэгчээр шүүж,
 * сэжигтэйг тэмдэглэн тайлбар бичнэ. `version` өөрчлөгдөхөд (шинэ файл
 * оруулах, багц устгах) дахин ачаална.
 */
export function ReviewPanel({ version }: { version: number }) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<DbChangesRecordsRequest>(() =>
    lastDays(14),
  );
  const [applied, setApplied] = useState<DbChangesRecordsRequest>(() =>
    lastDays(14),
  );
  const [data, setData] = useState<DbChangesRecordsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DbChangeRecord | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    dbChangesApi
      .records(clean(applied), ctrl.signal)
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
  }, [applied, version]);

  const apply = (next: DbChangesRecordsRequest) => {
    setLoading(true);
    setError(null);
    setFilters(next);
    setApplied({ ...next });
  };

  const set = <K extends keyof DbChangesRecordsRequest>(
    k: K,
    v: DbChangesRecordsRequest[K],
  ) => setFilters((f) => ({ ...f, [k]: v }));

  const activePreset = PRESETS.find((p) => {
    const r = lastDays(p.days);
    return r.startDate === applied.startDate && r.endDate === applied.endDate;
  })?.days;

  const flaggedCount = data?.items.filter((i) => i.flagged).length ?? 0;

  return (
    <ToolPanel>
      <ToolPanelHeader
        icon={Database}
        title={t("dbcReviewTitle")}
        actions={
          data && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {data.items.length.toLocaleString()}
              {flaggedCount > 0 && (
                <span className="ml-2 text-red-500">
                  · {t("dbcFlagged")} {flaggedCount}
                </span>
              )}
            </span>
          )
        }
      />
      <ToolPanelBody className="space-y-4 border-b border-border">
        <form
          className="flex flex-wrap items-end gap-2"
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
          <select
            aria-label={t("dbcColSystem")}
            value={filters.systemType ?? ""}
            onChange={(e) => set("systemType", e.target.value || undefined)}
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
          <select
            aria-label={t("dbcColCommand")}
            value={filters.sqlCommand ?? ""}
            onChange={(e) => set("sqlCommand", e.target.value || undefined)}
            className={selectClass}
          >
            <option value="">
              {t("dbcColCommand")}: {t("netFilterAll")}
            </option>
            {SQL_COMMANDS.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            aria-label={t("dbcColUser")}
            value={filters.username ?? ""}
            onChange={(e) => set("username", e.target.value || undefined)}
            className={cn(selectClass, "max-w-[12rem]")}
          >
            <option value="">
              {t("dbcColUser")}: {t("netFilterAll")}
            </option>
            {(data?.usernames ?? []).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => set("search", e.target.value)}
              placeholder={t("dbcSearchPlaceholder")}
              maxLength={200}
              className={cn(toolFieldClass, "pl-8")}
            />
          </div>
          <button
            type="button"
            onClick={() => set("flaggedOnly", !filters.flaggedOnly)}
            aria-pressed={!!filters.flaggedOnly}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
              filters.flaggedOnly
                ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                : "border-input text-muted-foreground hover:text-foreground",
            )}
          >
            <Flag className="h-3.5 w-3.5" />
            {t("dbcFlaggedOnly")}
          </button>
          <Button type="submit" size="sm" className="h-9" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("netApply")}
          </Button>
        </form>
        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}
        {data?.truncated && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            {t("dbcListCapped")}
          </p>
        )}
      </ToolPanelBody>

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <ToolEmpty icon={Database} title={t("dbcEmpty")} />
      ) : (
        <ToolTableWrap className="max-h-[640px] rounded-none border-0">
          <table className={toolTableClass}>
            <thead className={cn(toolTheadClass, "sticky top-0 z-10")}>
              <tr>
                <th className={toolThClass} />
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
              {data.items.map((r) => (
                <tr
                  key={r.rowHash}
                  onClick={() => setSelected(r)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/40",
                    r.flagged && "bg-red-500/[0.04]",
                  )}
                >
                  <td className={cn(toolTdClass, "w-8 pr-0")}>
                    {r.flagged && (
                      <Flag
                        className="h-4 w-4 fill-red-500 text-red-500"
                        aria-label={t("dbcFlagged")}
                      />
                    )}
                  </td>
                  <td
                    className={cn(
                      toolTdClass,
                      "whitespace-nowrap tabular-nums",
                    )}
                  >
                    {r.actionTime}
                  </td>
                  <td className={cn(toolTdClass, "whitespace-nowrap")}>
                    <span className="font-semibold">{r.username}</span>
                    {r.machine && (
                      <span className="block text-xs text-muted-foreground">
                        {r.machine}
                      </span>
                    )}
                  </td>
                  <td className={cn(toolTdClass, "whitespace-nowrap")}>
                    {r.systemType}
                    <span className="block text-xs text-muted-foreground">
                      {r.owner}
                    </span>
                  </td>
                  <td className={cn(toolTdClass, "whitespace-nowrap")}>
                    <CommandBadge command={r.sqlCommand} />
                    <span className="block pt-1 text-xs text-muted-foreground">
                      {r.action}
                    </span>
                  </td>
                  <td className={cn(toolTdClass, "whitespace-nowrap")}>
                    {r.objectName || "—"}
                  </td>
                  <td
                    className={cn(toolTdClass, "min-w-[280px] max-w-[460px]")}
                  >
                    <span className="line-clamp-2 break-all font-mono text-xs">
                      {r.sqlText}
                    </span>
                  </td>
                  <td
                    className={cn(toolTdClass, "min-w-[160px] max-w-[260px]")}
                  >
                    <span className="line-clamp-2 text-xs">{r.note}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ToolTableWrap>
      )}

      <ReviewDialog
        record={selected}
        onClose={() => setSelected(null)}
        onSaved={(res) =>
          setData((d) =>
            d
              ? {
                  ...d,
                  items: d.items.map((i) =>
                    i.rowHash === res.rowHash ? { ...i, ...res } : i,
                  ),
                }
              : d,
          )
        }
      />
    </ToolPanel>
  );
}
