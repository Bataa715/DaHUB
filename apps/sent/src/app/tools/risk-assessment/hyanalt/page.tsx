"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  riskApi,
  getApiErrorMessage,
  type RiskCurrentRow,
  type RiskHistoryEntry,
  type BranchScore,
} from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  Search,
  Download,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  X,
  Eye,
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  Activity,
  RefreshCw,
  Calendar,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  computeScoreDynamic,
  scoreColorClass,
  scoreDisplay,
  aggregateBranch,
  type ScoreGroup,
  type ScoreResult,
  type BranchAggregate,
} from "../scoring-rules";
import { CATALOG_BY_GROUP } from "../indicator-catalog";

type RiskRow = RiskCurrentRow;

type ScoredRow = RiskRow & {
  __score: ScoreResult;
  __scoreLabel: string | null;
  __group: ScoreGroup | null;
};

type FilterKey = "all" | ScoreGroup | "Score 4";

const SCORE4_SUBIDS = new Set(
  CATALOG_BY_GROUP[4]
    .filter((i) => i.autoSubid != null)
    .map((i) => Number(i.autoSubid)),
);

const GROUP_OPTIONS: { key: FilterKey; label: string; cls: string }[] = [
  { key: "all", label: "Бүгд", cls: "text-foreground" },
  { key: "Score 1", label: "Score 1", cls: "text-rose-600" },
  { key: "Score 2", label: "Score 2", cls: "text-amber-600" },
  { key: "Score 3", label: "Score 3", cls: "text-blue-600" },
  { key: "Score 4", label: "Score 4", cls: "text-violet-600" },
];

const fmt = (n: number | null | undefined) =>
  n == null || n === 0 ? "—" : n.toFixed(2);

// ── Score summary table (Score 1–4 only, no J, no Total) ────────────────────
function ScoreTable({ rows }: { rows: BranchAggregate[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-premium ring-hairline">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-emerald-500" />
        <h3 className="text-sm font-semibold">Салбаруудын оноо</h3>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground px-2 py-0.5 rounded-full bg-background border border-border">
          {rows.length} салбар
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">№</th>
              <th className="px-2 py-2 text-left font-semibold">SOL</th>
              <th className="px-2 py-2 text-left font-semibold">
                Салбарын нэр
              </th>
              <th className="px-2 py-2 text-center font-semibold">Зэрэглэл</th>
              <th className="px-2 py-2 text-right font-semibold text-sky-600 dark:text-sky-400">
                Score 1
              </th>
              <th className="px-2 py-2 text-right font-semibold text-violet-600 dark:text-violet-400">
                Score 2
              </th>
              <th className="px-2 py-2 text-right font-semibold text-amber-600 dark:text-amber-400">
                Score 3
              </th>
              <th className="px-2 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                Score 4
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr
                key={b.branchId}
                className="border-t border-border hover:bg-accent/30"
              >
                <td className="px-2 py-2 tabular-nums text-muted-foreground font-semibold">
                  {i + 1}
                </td>
                <td className="px-2 py-2 tabular-nums font-bold">{b.solid}</td>
                <td className="px-2 py-2 font-bold">{b.branchName}</td>
                <td className="px-2 py-2 text-center text-xs text-muted-foreground font-semibold">
                  {b.rating}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-bold text-sky-700 dark:text-sky-400">
                  {fmt(b.s1)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-bold text-violet-700 dark:text-violet-400">
                  {fmt(b.s2)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                  {fmt(b.s3)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                  {(b.s4 ?? 0) > 0 ? fmt(b.s4) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Local helpers using static catalog ────────────────────────────────────────
const ALL_CATALOG = ([] as typeof CATALOG_BY_GROUP[1]).concat(
  CATALOG_BY_GROUP[1],
  CATALOG_BY_GROUP[2],
  CATALOG_BY_GROUP[3],
  CATALOG_BY_GROUP[4],
  CATALOG_BY_GROUP[5],
);

function computeScore(
  subid: unknown,
  result: unknown,
  resultType: unknown,
): { score: ScoreResult; label: string | null } {
  const ind = ALL_CATALOG.find((c) => c.autoSubid === Number(subid));
  if (!ind) return { score: null, label: null };
  return computeScoreDynamic(
    (ind as { score_scale?: string }).score_scale ?? "",
    result as string | number | null,
    resultType as string | number | null,
  );
}

function getGroup(subid: unknown): ScoreGroup | null {
  const ind = ALL_CATALOG.find((c) => c.autoSubid === Number(subid));
  if (!ind) return null;
  const g = ind.group;
  if (g === 1) return "Score 1";
  if (g === 2) return "Score 2";
  if (g === 3) return "Score 3";
  if (g === 4) return "Score 4";
  return null;
}

// ── Main monitoring page ───────────────────────────────────────────────────────
export default function RiskAssessmentDetailPage() {
  const { t } = useLanguage();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [fetchedDate, setFetchedDate] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [loading, setLoading] = useState(true);
  const [loadingDate, setLoadingDate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // "latest-all" = бүх indicator-ын хамгийн сүүлийн утга
  // "by-date"    = тодорхой өдрийн өгөгдөл
  const [dataMode, setDataMode] = useState<"latest-all" | "by-date">("latest-all");

  // ETL-аас pre-computed оноо — realtime date-тай тохирно
  const [branchScores, setBranchScores] = useState<BranchScore[]>([]);

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [viewHistoryRows, setViewHistoryRows] = useState<RiskRow[]>([]);
  const [viewHistoryLoading, setViewHistoryLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");

  const [showDetail, setShowDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // latest-all горим: хуудас нээгдэхэд бүх indicator-ын сүүлийн утга татна
  const loadLatestAll = useCallback(async () => {
    setLoadingDate(true);
    setErrorMsg(null);
    try {
      const res = await riskApi.getRiskbranchLatestAll();
      setRows(res.rows.filter((r) => r.rowType === "oracle") as RiskRow[]);
      setFetchedDate("Хамгийн сүүлийн");
      setBranchScores([]);
    } catch (e: unknown) {
      setErrorMsg(getApiErrorMessage(e));
    } finally {
      setLoadingDate(false);
    }
  }, []);

  // Хуудас нээгдэхэд: latest-all татна + түүх + огнооны жагсаалт
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hist, dates, latestRes] = await Promise.all([
          riskApi.listHistory(),
          riskApi.listRiskbranchDates(),
          riskApi.getRiskbranchLatestAll(),
        ]);
        if (cancelled) return;
        setHistoryList(hist);
        setAvailableDates(dates);
        setRows(latestRes.rows.filter((r) => r.rowType === "oracle") as RiskRow[]);
        setFetchedDate("Хамгийн сүүлийн");
        setBranchScores([]);
        // selectedDate-г хамгийн ойр огноод тохируулна (date picker-д зориулж)
        const today = new Date().toISOString().slice(0, 10);
        const sorted = [...dates].sort();
        const targetDate = dates.includes(today)
          ? today
          : sorted.length > 0
          ? sorted.reduce((closest, d) =>
              Math.abs(new Date(d).getTime() - Date.now()) <
              Math.abs(new Date(closest).getTime() - Date.now())
                ? d
                : closest
            )
          : today;
        setSelectedDate(targetDate);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadDate = useCallback(
    async (date: string) => {
      if (!date) return;
      setDataMode("by-date");
      setLoadingDate(true);
      setErrorMsg(null);
      try {
        const [res, scores] = await Promise.all([
          riskApi.getRiskbranch(date),
          riskApi.getBranchScores(date).catch(() => []),
        ]);
        if (!res.rows || res.rows.length === 0) {
          setRows([]);
          setFetchedDate("");
          setBranchScores([]);
          const hint =
            availableDates.length > 0
              ? ` Боломжтой огнооууд: ${availableDates.slice(0, 5).join(", ")}${availableDates.length > 5 ? " ..." : ""}`
              : "";
          setErrorMsg(`"${date}" огноонд өгөгдөл байхгүй байна.${hint}`);
        } else {
          setRows(res.rows.filter((r) => r.rowType === "oracle") as RiskRow[]);
          setFetchedDate(res.fetchedDate || date);
          setSelectedDate(date);
          setBranchScores(scores);
        }
      } catch (e: unknown) {
        setErrorMsg(getApiErrorMessage(e));
      } finally {
        setLoadingDate(false);
      }
    },
    [availableDates],
  );

  const openHistoryView = useCallback(
    async (id: string) => {
      if (id === viewHistoryId) {
        setViewHistoryId(null);
        setViewHistoryRows([]);
        setMenuOpen(false);
        return;
      }
      setViewHistoryLoading(true);
      setMenuOpen(false);
      try {
        const data = await riskApi.getHistory(id);
        setViewHistoryId(id);
        setViewHistoryRows(
          data.rows.filter((r) => r.rowType === "oracle") as RiskRow[],
        );
      } catch {
        /* silent */
      } finally {
        setViewHistoryLoading(false);
      }
    },
    [viewHistoryId],
  );

  const openDeleteConfirm = useCallback((id: string) => {
    setDeleteTargetId(id);
    setDeletePassword("");
    setDeletePasswordError("");
    setDeleteModalOpen(true);
    setMenuOpen(false);
  }, []);

  const doDeleteHistory = useCallback(async () => {
    if (deletePassword !== "OmnohDelete#24") {
      setDeletePasswordError("Нууц үг буруу байна");
      return;
    }
    if (!deleteTargetId) return;
    setDeleteModalOpen(false);
    try {
      await riskApi.deleteHistory(deleteTargetId);
      setHistoryList((prev) => prev.filter((h) => h.id !== deleteTargetId));
      if (viewHistoryId === deleteTargetId) {
        setViewHistoryId(null);
        setViewHistoryRows([]);
      }
    } catch (e: unknown) {
      setErrorMsg(getApiErrorMessage(e) || "Устгахад алдаа гарлаа");
    }
    setDeleteTargetId(null);
    setDeletePassword("");
  }, [deletePassword, deleteTargetId, viewHistoryId]);

  const activeRows = viewHistoryId ? viewHistoryRows : rows;

  const scoredRows: ScoredRow[] = useMemo(
    () =>
      activeRows.map((r) => {
        const sr = computeScore(r.SUBID, r.RESULT, r.RESULT_TYPE);
        return {
          ...r,
          __score: sr.score,
          __scoreLabel: sr.label,
          __group: getGroup(r.SUBID),
        };
      }),
    [activeRows],
  );

  const aggregates: BranchAggregate[] = useMemo(() => {
    // History харахад pre-computed байхгүй — browser дотор тооцно
    if (viewHistoryId) return aggregateBranch(scoredRows);
    // Realtime: ETL-аас ирсэн оноо байвал тэрийг ашигла
    if (branchScores.length > 0) {
      return branchScores.map((s) => ({
        branchId: s.branchId,
        branchName: s.branchName,
        solid: s.solid,
        rating: s.rating,
        region: s.region as import("../scoring-rules").Region,
        s1: s.s1,
        s2: s.s2,
        s3: s.s3,
        s4: s.s4,
        j: s.j,
        total: s.total,
        level: s.level as BranchAggregate["level"],
      }));
    }
    return aggregateBranch(scoredRows);
  }, [viewHistoryId, branchScores, scoredRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoredRows.filter((r) => {
      if (groupFilter !== "all") {
        if (groupFilter === "Score 4") {
          if (!SCORE4_SUBIDS.has(Number(r.SUBID))) return false;
        } else {
          if (r.__group !== groupFilter) return false;
        }
      }
      if (!q) return true;
      return [
        r.SOLID,
        r.BRANCHNAME,
        r.RESULT,
        r.DESCRIPTION_TEXT,
        r.ID,
        r.SUBID,
        r.OPERATION_TYPE,
        r.__score,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .some((s) => s.includes(q));
    });
  }, [scoredRows, search, groupFilter]);

  const downloadCsv = useCallback(() => {
    const cols = [
      "SOLID",
      "BRANCHNAME",
      "BRANCHID",
      "PARENTBRANCH",
      "RESULT",
      "RESULT_TYPE",
      "DESCRIPTION_TEXT",
      "P_DATEBEG",
      "P_DATE",
      "ID",
      "SUBID",
      "OPERATION_TYPE",
      "SCORE_GROUP",
      "SCORE",
      "SCORE_LABEL",
    ] as const;
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      cols.join(","),
      ...filteredRows.map((r) =>
        cols
          .map((c) => {
            if (c === "SCORE_GROUP") return escape(r.__group ?? "");
            if (c === "SCORE") return escape(r.__score ?? "");
            if (c === "SCORE_LABEL") return escape(r.__scoreLabel ?? "");
            return escape((r as unknown as Record<string, unknown>)[c]);
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `realtime-${fetchedDate || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, fetchedDate]);

  const grouped = useMemo(() => {
    const m = new Map<
      string,
      { branchId: string; branchName: string; solid: string; rows: ScoredRow[] }
    >();
    for (const r of filteredRows) {
      const key = String(r.SOLID ?? "");
      if (!m.has(key))
        m.set(key, {
          branchId: String(r.SOLID ?? ""),
          branchName: String(r.BRANCHNAME ?? ""),
          solid: String(r.SOLID ?? ""),
          rows: [],
        });
      m.get(key)!.rows.push(r);
    }
    return Array.from(m.values()).sort((a, b) =>
      a.branchName.localeCompare(b.branchName, "mn"),
    );
  }, [filteredRows]);

  const toggle = (k: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const viewHistoryEntry = historyList.find((h) => h.id === viewHistoryId);
  const hasData = rows.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<Activity className="w-4 h-4 text-emerald-500" />}
        title={t("riskMonitorCardTitle")}
        subtitle={t("riskDetailSubtitle")}
        rightContent={
          <div className="flex items-center gap-2">
            {/* Горим сонгох */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => {
                  if (dataMode !== "latest-all") {
                    setDataMode("latest-all");
                    loadLatestAll();
                  }
                }}
                className={`px-3 py-1.5 font-semibold transition-colors ${dataMode === "latest-all" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                Хамгийн сүүлийн
              </button>
              <button
                onClick={() => setDataMode("by-date")}
                className={`px-3 py-1.5 font-semibold transition-colors border-l border-border ${dataMode === "by-date" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                Өдрөөр
              </button>
            </div>
            {/* Date picker — зөвхөн by-date горимд */}
            {dataMode === "by-date" && (
              <>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const d = e.target.value;
                    setSelectedDate(d);
                    if (d) loadDate(d);
                  }}
                  disabled={loadingDate}
                  className="h-7 px-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium disabled:opacity-40 outline-none cursor-pointer"
                />
                <button
                  onClick={() => selectedDate && loadDate(selectedDate)}
                  disabled={loadingDate || !selectedDate}
                  className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-all"
                >
                  {loadingDate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
            {/* Refresh for latest-all mode */}
            {dataMode === "latest-all" && (
              <button
                onClick={loadLatestAll}
                disabled={loadingDate}
                className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-all"
              >
                {loadingDate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            )}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              <span>{fetchedDate || selectedDate}</span>
              {rows.length > 0 && (
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </span>
              )}
            </span>
          </div>
        }
      />
      <div className="container mx-auto px-4 py-6 space-y-5 flex-1 max-w-[1600px]">
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

        {viewHistoryId && viewHistoryEntry && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 flex items-center gap-3">
            <Eye className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">
                {viewHistoryEntry.name}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {viewHistoryEntry.pDateBeg} → {viewHistoryEntry.pDate} ·{" "}
                {viewHistoryEntry.branchCount} салбар
              </div>
            </div>
            <button
              onClick={() => {
                setViewHistoryId(null);
                setViewHistoryRows([]);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/40 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" /> Хаах
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        )}

        {!loading && !hasData && !viewHistoryId && (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              Өнөөдрийн өгөгдөл байхгүй байна
            </div>
            <div className="text-xs text-muted-foreground/60 mt-1">
              Airflow-с өгөгдөл ирсний дараа автоматаар харагдана
            </div>
          </div>
        )}

        {/* Score summary table */}
        {!loading && scoredRows.length > 0 && <ScoreTable rows={aggregates} />}

        {/* Дэлгэрэнгүй өгөгдөл (нуугддаг) */}
        {!loading && scoredRows.length > 0 && (
          <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-premium ring-hairline">
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-accent/30 transition-colors text-left"
            >
              {showDetail ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">Дэлгэрэнгүй өгөгдөл</span>
              <span className="text-[11px] text-muted-foreground ml-1">
                ({scoredRows.length} мөр · Scale тооцоогүй)
              </span>
            </button>

            {showDetail && (
              <>
                <div className="px-4 sm:px-5 py-3 border-t border-border bg-card/80 backdrop-blur flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 tabular-nums font-semibold">
                      {viewMode === "grouped"
                        ? `${grouped.length} салбар`
                        : `${filteredRows.length} мөр`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="hidden lg:flex rounded-lg border border-border overflow-hidden bg-background/60">
                      {GROUP_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setGroupFilter(opt.key)}
                          className={`px-3 py-1.5 text-[11px] font-semibold border-r last:border-r-0 border-border transition-all ${
                            groupFilter === opt.key
                              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-inner"
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
                        placeholder={t("search") + "..."}
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                    <div className="flex rounded-lg border border-border overflow-hidden bg-background/60 p-0.5">
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
                              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                              : "hover:bg-accent/60 text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={downloadCsv}
                      disabled={filteredRows.length === 0}
                      className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  </div>
                </div>

                {filteredRows.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="text-sm text-muted-foreground">
                      Өгөгдөл олдсонгүй
                    </div>
                  </div>
                ) : viewMode === "table" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left">SOLID</th>
                          <th className="px-2 py-2 text-left">BRANCHNAME</th>

                          <th className="px-2 py-2 text-right">RESULT</th>
                          <th className="px-2 py-2 text-center">TYPE</th>
                          <th className="px-2 py-2 text-left">DESCRIPTION</th>
                          <th className="px-2 py-2 text-center whitespace-nowrap">
                            P_DATEBEG
                          </th>
                          <th className="px-2 py-2 text-center whitespace-nowrap">
                            P_DATE
                          </th>
                          <th className="px-2 py-2 text-left">ID</th>
                          <th className="px-2 py-2 text-center">SUBID</th>
                          <th className="px-2 py-2 text-center">Score</th>
                          <th className="px-2 py-2 text-left">OP_TYPE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((r, i) => (
                          <tr
                            key={`${r.SOLID}-${r.SUBID}-${i}`}
                            className="border-t border-border hover:bg-accent/30"
                          >
                            <td className="px-2 py-1.5 tabular-nums">
                              {r.SOLID}
                            </td>
                            <td className="px-2 py-1.5 font-medium">
                              {r.BRANCHNAME}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                              {r.RESULT}
                            </td>
                            <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
                              {r.RESULT_TYPE}
                            </td>
                            <td
                              className="px-2 py-1.5 max-w-md truncate"
                              title={r.DESCRIPTION_TEXT}
                            >
                              {r.DESCRIPTION_TEXT}
                            </td>
                            <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">
                              {r.P_DATEBEG}
                            </td>
                            <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">
                              {r.P_DATE}
                            </td>
                            <td
                              className="px-2 py-1.5 max-w-xs truncate"
                              title={r.ID}
                            >
                              {r.ID}
                            </td>
                            <td className="px-2 py-1.5 text-center tabular-nums">
                              {r.SUBID}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <ScoreBadge row={r} />
                            </td>
                            <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                              {r.OPERATION_TYPE}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {grouped.map((g) => {
                      const key = g.branchId || g.solid;
                      const isOpen = expanded.has(key);
                      return (
                        <div key={key}>
                          <button
                            onClick={() => toggle(key)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/40 transition-colors text-left group/row"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isOpen ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-muted/60 text-muted-foreground group-hover/row:bg-blue-500/10 group-hover/row:text-blue-500"}`}
                              >
                                {isOpen ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <span className="font-semibold text-sm truncate">
                                {g.branchName}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
                                {g.branchId}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground tabular-nums px-2 py-0.5 rounded-full bg-muted/60 border border-border whitespace-nowrap">
                              {g.rows.length} үнэлгээ
                            </span>
                          </button>
                          {isOpen && (
                            <div className="overflow-x-auto bg-background/50">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left">
                                      SOLID
                                    </th>
                                    <th className="px-2 py-1.5 text-left">
                                      BRANCHNAME
                                    </th>
                                    <th className="px-2 py-1.5 text-left">
                                      BRANCHID
                                    </th>
                                    <th className="px-2 py-1.5 text-left">
                                      PARENT
                                    </th>
                                    <th className="px-2 py-1.5 text-right">
                                      RESULT
                                    </th>
                                    <th className="px-2 py-1.5 text-center">
                                      TYPE
                                    </th>
                                    <th className="px-2 py-1.5 text-left">
                                      DESCRIPTION
                                    </th>
                                    <th className="px-2 py-1.5 text-center whitespace-nowrap">
                                      P_DATEBEG
                                    </th>
                                    <th className="px-2 py-1.5 text-center whitespace-nowrap">
                                      P_DATE
                                    </th>
                                    <th className="px-2 py-1.5 text-left">
                                      ID
                                    </th>
                                    <th className="px-2 py-1.5 text-center">
                                      SUBID
                                    </th>
                                    <th className="px-2 py-1.5 text-center">
                                      Score
                                    </th>
                                    <th className="px-2 py-1.5 text-left">
                                      OP_TYPE
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...g.rows]
                                    .sort(
                                      (a, b) =>
                                        Number(a.SUBID ?? 0) -
                                        Number(b.SUBID ?? 0),
                                    )
                                    .map((r, i) => (
                                      <tr
                                        key={`${r.SUBID}-${i}`}
                                        className="border-t border-border hover:bg-accent/30"
                                      >
                                        <td className="px-2 py-1.5 tabular-nums">
                                          {r.SOLID}
                                        </td>
                                        <td className="px-2 py-1.5 font-medium">
                                          {r.BRANCHNAME}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                                          {r.RESULT}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
                                          {r.RESULT_TYPE}
                                        </td>
                                        <td
                                          className="px-2 py-1.5 max-w-md truncate"
                                          title={r.DESCRIPTION_TEXT}
                                        >
                                          {r.DESCRIPTION_TEXT}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                          {r.P_DATEBEG}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                          {r.P_DATE}
                                        </td>
                                        <td
                                          className="px-2 py-1.5 max-w-xs truncate"
                                          title={r.ID}
                                        >
                                          {r.ID}
                                        </td>
                                        <td className="px-2 py-1.5 text-center tabular-nums">
                                          {r.SUBID}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                          <ScoreBadge row={r} />
                                        </td>
                                        <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                                          {r.OPERATION_TYPE}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {/* Устгах modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-premium-xl ring-hairline p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Тайлан устгах</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Үргэлжлүүлэхийн түлд нууц үг оруулна уу
                </p>
              </div>
            </div>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeletePasswordError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && doDeleteHistory()}
              placeholder="Нууц үг"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
            {deletePasswordError && (
              <p className="text-xs text-red-500 mt-1.5">
                {deletePasswordError}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/40 transition-colors"
              >
                Болих
              </button>
              <button
                onClick={doDeleteHistory}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-foreground text-xs font-semibold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Устгах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ row }: { row: ScoredRow }) {
  if (row.__score == null)
    return <span className="text-muted-foreground/50 text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded border text-[11px] font-bold ${scoreColorClass(row.__score)}`}
      title={
        row.__scoreLabel
          ? `${row.__group} · ${row.__scoreLabel}`
          : (row.__group ?? "")
      }
    >
      {scoreDisplay(row.__score)}
    </span>
  );
}
