"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { riskApi, getApiErrorMessage } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  Search,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Activity,
  ListTree,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { riskLevelClass, type BranchAggregate } from "../../scoring-rules";
import { useIndicatorConfig } from "../../use-indicator-config";
import {
  oracleSolidsFromRows,
  resolveNearestJudgements,
} from "../../branch-resolve";
import {
  type RiskRow,
  type ScoredRow,
  type FilterKey,
  type BranchGroup,
  type GroupOption,
  GROUP_OPTIONS,
  fmt,
  buildScoredRows,
  aggregateFromScoredRows,
  sortByTotalDesc,
  ScoreBadge,
  filterScoredRows,
  groupScoredByBranch,
} from "../../hyanalt-shared";

function DetailRowTable({ rows }: { rows: ScoredRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">SUBID</th>
            <th className="px-3 py-2 text-left font-semibold">Тайлбар</th>
            <th className="px-3 py-2 text-right font-semibold">RESULT</th>
            <th className="px-3 py-2 text-center font-semibold">TYPE</th>
            <th className="px-3 py-2 text-center font-semibold">Score</th>
            <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">
              P_DATE
            </th>
            <th className="px-3 py-2 text-left font-semibold">ID</th>
            <th className="px-3 py-2 text-left font-semibold">OP</th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort((a, b) => Number(a.SUBID ?? 0) - Number(b.SUBID ?? 0))
            .map((r, i) => (
              <tr
                key={`${r.SUBID}-${i}`}
                className="border-t border-border/60 hover:bg-accent/25 transition-colors"
              >
                <td className="px-3 py-2 tabular-nums font-semibold text-muted-foreground">
                  {r.SUBID}
                </td>
                <td
                  className="px-3 py-2 max-w-sm truncate"
                  title={r.DESCRIPTION_TEXT ?? ""}
                >
                  {r.DESCRIPTION_TEXT || "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {r.RESULT ?? "—"}
                </td>
                <td className="px-3 py-2 text-center text-[10px] text-muted-foreground">
                  {r.RESULT_TYPE ?? "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <ScoreBadge row={r} />
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground tabular-nums whitespace-nowrap">
                  {r.P_DATE ?? "—"}
                </td>
                <td
                  className="px-3 py-2 max-w-[140px] truncate font-mono text-[10px]"
                  title={r.ID ?? ""}
                >
                  {r.ID ?? "—"}
                </td>
                <td className="px-3 py-2 text-[10px] text-muted-foreground">
                  {r.OPERATION_TYPE ?? "—"}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function BranchCard({
  branchName,
  solid,
  rows,
  agg,
  expanded,
  onToggle,
}: {
  branchName: string;
  solid: string;
  rows: ScoredRow[];
  agg?: BranchAggregate;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm ring-hairline">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent/20 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{branchName}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
              SOL {solid}
            </span>
            {agg?.level && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskLevelClass(agg.level)}`}
              >
                {agg.level}
              </span>
            )}
          </div>
          {agg && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {[
                { label: "S1", val: agg.s1, cls: "text-sky-600" },
                { label: "S2", val: agg.s2, cls: "text-violet-600" },
                { label: "S3", val: agg.s3, cls: "text-amber-600" },
                { label: "S4", val: agg.s4, cls: "text-emerald-600" },
                { label: "J", val: agg.j, cls: "text-rose-600" },
              ].map(({ label, val, cls }) => (
                <span
                  key={label}
                  className={`text-[10px] tabular-nums ${cls} font-semibold`}
                >
                  {label}: {fmt(val)}
                </span>
              ))}
              {agg.total != null && (
                <span className="text-[10px] font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  Total: {fmt(agg.total)}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums px-2.5 py-1 rounded-full bg-muted/60 border border-border whitespace-nowrap flex-shrink-0">
          {rows.length} үзүүлэлт
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border bg-background/40">
          <DetailRowTable rows={rows} />
        </div>
      )}
    </div>
  );
}

export default function HyanaltDetailPage() {
  const { t } = useLanguage();

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [judgements, setJudgements] = useState<Record<string, number>>({});
  const [judgementDate, setJudgementDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { catalog, loaded: catalogLoaded } = useIndicatorConfig();

  const applyLatest = useCallback(async (oracleRows: RiskRow[], dates: string[]) => {
    const filtered = oracleRows.filter((r) => r.rowType === "oracle") as RiskRow[];
    setRows(filtered);
    let max = "";
    for (const r of filtered) {
      const d = String(
        (r as RiskRow & { latestFetchedDate?: string }).latestFetchedDate ??
          r.sourceFetchedDate ??
          "",
      ).slice(0, 10);
      if (d && d > max) max = d;
    }
    const anchor = max || (dates[0] ? String(dates[0]).slice(0, 10) : "");
    if (!anchor) {
      setJudgements({});
      setJudgementDate(null);
      return;
    }
    const allJudge = await riskApi.listJudgements();
    const solids = oracleSolidsFromRows(filtered);
    const resolved = resolveNearestJudgements(allJudge, anchor, solids);
    setJudgements(resolved.scores);
    setJudgementDate(resolved.judgementDate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, dates] = await Promise.all([
          riskApi.getRiskbranchLatestAll(),
          riskApi.listRiskbranchDates(),
        ]);
        if (cancelled) return;
        await applyLatest(
          res.rows.filter((r) => r.rowType === "oracle") as RiskRow[],
          dates,
        );
      } catch (e: unknown) {
        if (!cancelled) setErrorMsg(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLatest]);

  const scoredRows = useMemo(
    () => buildScoredRows(rows, catalog),
    [rows, catalog],
  );

  const aggregates = useMemo(
    () => sortByTotalDesc(aggregateFromScoredRows(scoredRows, judgements)),
    [scoredRows, judgements],
  );

  const groupFilteredRows = useMemo(
    () => filterScoredRows(scoredRows, "", groupFilter, catalog),
    [scoredRows, groupFilter, catalog],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupFilteredRows;
    return groupFilteredRows.filter((r) =>
      String(r.SOLID ?? "")
        .toLowerCase()
        .includes(q),
    );
  }, [groupFilteredRows, search]);

  const grouped = useMemo(
    (): BranchGroup[] => groupScoredByBranch(filteredRows, aggregates),
    [filteredRows, aggregates],
  );

  const allExpanded =
    grouped.length > 0 &&
    grouped.every((g: BranchGroup) => expandedIds.has(g.branchId || g.solid));

  const toggleBranch = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(
        new Set(grouped.map((g: BranchGroup) => g.branchId || g.solid)),
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment/hyanalt"
        icon={<ListTree className="w-4 h-4 text-emerald-500" />}
        title="Дэлгэрэнгүй өгөгдөл"
        rightContent={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25">
              Хамгийн сүүлийн
            </span>
            {judgementDate && (
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/25 hidden sm:inline">
                J: {judgementDate}
              </span>
            )}
          </div>
        }
      />

      <div className="container mx-auto px-4 py-6 flex-1 max-w-[1600px] space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-rose-500/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-red-600/80">{errorMsg}</div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {loading || !catalogLoaded ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        ) : null}

        {!loading && catalogLoaded && scoredRows.length === 0 && (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <Activity className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <div className="text-sm font-semibold text-muted-foreground">
              Өгөгдөл байхгүй
            </div>
            <Link
              href="/tools/risk-assessment/hyanalt"
              className="inline-block mt-4 text-xs text-emerald-600 hover:underline"
            >
              ← Хяналт руу буцах
            </Link>
          </div>
        )}

        {!loading && catalogLoaded && scoredRows.length > 0 && (
          <>
            <div className="sticky top-14 z-10 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-premium px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-border overflow-hidden bg-background/60">
                {GROUP_OPTIONS.map((opt: GroupOption) => (
                  <button
                    key={opt.key}
                    onClick={() => setGroupFilter(opt.key)}
                    className={`px-3 py-1.5 text-[11px] font-semibold border-r last:border-r-0 border-border transition-all ${
                      groupFilter === opt.key
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-inner"
                        : `hover:bg-accent/60 ${opt.cls}`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SOLID..."
                  className="pl-8 pr-8 py-1.5 rounded-lg border border-border bg-background text-xs w-44 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex rounded-lg border border-border overflow-hidden bg-background/60 p-0.5 ml-auto">
                {[
                  {
                    key: "grouped" as const,
                    icon: LayoutGrid,
                    label: t("viewGrouped"),
                  },
                  {
                    key: "table" as const,
                    icon: TableIcon,
                    label: t("viewTable"),
                  },
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    className={`px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 rounded-md transition-all ${
                      viewMode === key
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "hover:bg-accent/60 text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {viewMode === "grouped" && (
                <button
                  onClick={toggleAll}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background/60 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-accent/60 transition-all"
                >
                  {allExpanded ? (
                    <>
                      <ChevronsDownUp className="w-3.5 h-3.5" />
                      Бүгдийг хураах
                    </>
                  ) : (
                    <>
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                      Бүгдийг дэлгэх
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Content */}
            {filteredRows.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
                Шүүлтэнд тохирох өгөгдөл олдсонгүй
              </div>
            ) : viewMode === "table" ? (
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-premium ring-hairline">
                <DetailRowTable rows={filteredRows} />
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map((g: BranchGroup) => {
                  const id = g.branchId || g.solid;
                  const agg = aggregates.find(
                    (a: BranchAggregate) => a.branchId === g.branchId,
                  );
                  return (
                    <BranchCard
                      key={id}
                      branchName={g.branchName}
                      solid={g.solid}
                      rows={g.rows}
                      agg={agg}
                      expanded={expandedIds.has(id)}
                      onToggle={() => toggleBranch(id)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
