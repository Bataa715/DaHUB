"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  riskApi,
  getApiErrorMessage,
  type RiskHistoryEntry,
  type RiskCurrentRow,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  AlertTriangle,
  Bookmark,
  Trash2,
  BookmarkCheck,
  Search,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  computeOracleRowScore,
  type ScoreResult,
  type ScoreGroup,
} from "../scoring-rules";
import {
  useIndicatorConfig,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import {
  judgementsFromManualSnapshot,
  judgementsFromListForBranches,
  normalizeBranchKeyedMap,
  oracleSolidsFromRows,
  resolveNearestJudgements,
} from "../branch-resolve";
import ReportView from "../report-view";
import MonthFilter, { formatMonthMn, prevMonthKey } from "./_MonthFilter";
import { cn } from "@/lib/utils";

type ScoredRow = RiskCurrentRow & {
  __score: ScoreResult;
  __scoreLabel: string | null;
  __group: ScoreGroup | null;
};

function toScored(
  rows: RiskCurrentRow[],
  catalog: DynamicCatalogIndicator[],
): ScoredRow[] {
  return rows
    .filter((r) => r.rowType === "oracle")
    .map((r) => {
      const subid = String(r.SUBID ?? "").trim();
      const {
        score,
        label,
        indicator: ind,
      } = computeOracleRowScore(catalog, subid, r.RESULT, r.RESULT_TYPE);
      const grpNum = ind?.group;
      const __group: ScoreGroup | null =
        grpNum === 1
          ? "Score 1"
          : grpNum === 2
            ? "Score 2"
            : grpNum === 3
              ? "Score 3"
              : null;
      return {
        ...r,
        __score: score as ScoreResult,
        __scoreLabel: label,
        __group,
      };
    });
}

function monthKeyFromDate(iso: string): string {
  return iso.slice(0, 7);
}

function currentMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** YYYY-MM → тухайн сарын сүүлийн өдөр (backend fill-forward-д өгнө) */
function monthEndDate(monthKey: string): string {
  const m = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!m) return monthKey;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const last = new Date(y, mo, 0).getDate();
  return `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}`;
}

function hasJudgementScores(map: Record<string, number>): boolean {
  return Object.values(map).some((v) => Number(v) > 0);
}

type MonthBundle = {
  actualDate: string;
  rows: RiskCurrentRow[];
  manualMap: Record<string, Record<string, number>>;
  judgements: Record<string, number>;
  judgementComments: Record<string, string>;
};

/** Үнэлгээ хийхтэй адил riskbranch сарын дата + хамгийн ойрын judgement */
async function loadRiskbranchMonth(
  monthKey: string,
  catalog: DynamicCatalogIndicator[],
): Promise<MonthBundle> {
  const target = monthEndDate(monthKey);
  const res = await riskApi.getRiskbranch(target);
  const rows = res.rows ?? [];
  const actualDate = (res.fetchedDate || target).slice(0, 10);
  const solids = oracleSolidsFromRows(rows);
  const manualMap = res.manualMap || {};
  const snapJ = judgementsFromManualSnapshot(manualMap, catalog);

  const [exactList, allJudge] = await Promise.all([
    riskApi.listJudgements(actualDate),
    riskApi.listJudgements(),
  ]);
  const exact = judgementsFromListForBranches(exactList, solids);
  const nearest = resolveNearestJudgements(allJudge, actualDate, solids);

  // Ойрын judgement-ийг үндэс болгож, exact/snapshot байвал давхарлана
  const judgements = hasJudgementScores(snapJ)
    ? { ...nearest.scores, ...exact.scores, ...snapJ }
    : { ...nearest.scores, ...exact.scores };

  return {
    actualDate,
    rows,
    manualMap,
    judgements,
    judgementComments: { ...nearest.comments, ...exact.comments },
  };
}

export default function RiskReportsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.isAdmin === true;
  const { catalog } = useIndicatorConfig();

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [riskbranchDates, setRiskbranchDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Сараар шүүх (YYYY-MM) — хайлт дарсан үед л хэрэгжинэ */
  const [filterMonth, setFilterMonth] = useState("");
  const [compareMonth, setCompareMonth] = useState("");
  const [draftFilterMonth, setDraftFilterMonth] = useState("");
  const [draftCompareMonth, setDraftCompareMonth] = useState("");
  const [compareMonthOptOut, setCompareMonthOptOut] = useState(false);
  const [filterMode, setFilterMode] = useState<"month" | "quarter">("month");

  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const selectedReportIdRef = useRef(selectedReportId);
  selectedReportIdRef.current = selectedReportId;
  const [reportRows, setReportRows] = useState<RiskCurrentRow[]>([]);
  const [reportManualMap, setReportManualMap] = useState<
    Record<string, Record<string, number>>
  >({});
  const [reportJudgements, setReportJudgements] = useState<
    Record<string, number>
  >({});
  const [reportJudgementComments, setReportJudgementComments] = useState<
    Record<string, string>
  >({});
  const [loadingReport, setLoadingReport] = useState(false);
  const [monthAnchorDate, setMonthAnchorDate] = useState<string>("");

  const [comparisonReportId, setComparisonReportId] = useState<string>("");
  const comparisonReportIdRef = useRef(comparisonReportId);
  comparisonReportIdRef.current = comparisonReportId;
  const [comparisonRows, setComparisonRows] = useState<RiskCurrentRow[]>([]);
  const [comparisonManualMap, setComparisonManualMap] = useState<
    Record<string, Record<string, number>>
  >({});
  const [comparisonJudgements, setComparisonJudgements] = useState<
    Record<string, number>
  >({});
  const [, setComparisonJudgementComments] =
    useState<Record<string, string>>({});
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [compareOptOut, setCompareOptOut] = useState(false);

  const [riskFilter, setRiskFilter] = useState<
    "all" | "Өндөр" | "Дунд" | "Бага"
  >("all");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const monthLoadGen = useRef(0);

  // Init: riskbranch огноо + хадгалсан тайлан (улирлаар)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dates, history] = await Promise.all([
          riskApi.listRiskbranchDates(),
          riskApi.listHistory().catch(() => [] as RiskHistoryEntry[]),
        ]);
        if (cancelled) return;
        setRiskbranchDates(dates || []);
        setHistoryList(history || []);

        const latest =
          dates?.[0] ||
          (history?.[0]?.pDate ? history[0].pDate.slice(0, 10) : "");
        const month = latest
          ? monthKeyFromDate(latest)
          : currentMonthKey();
        const prev = prevMonthKey(month);
        setFilterMonth(month);
        setCompareMonth(prev);
        setDraftFilterMonth(month);
        setDraftCompareMonth(prev);
        if (history?.length) setSelectedReportId(history[0].id);
      } catch (e: unknown) {
        if (!cancelled)
          setErrorMsg(getApiErrorMessage(e) || "Өгөгдөл уншихад алдаа гарлаа");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Draft үндсэн сар солигдоход — өмнөх сарыг автоматаар */
  useEffect(() => {
    if (!draftFilterMonth) {
      setDraftCompareMonth("");
      return;
    }
    if (compareMonthOptOut) return;
    setDraftCompareMonth(prevMonthKey(draftFilterMonth));
  }, [draftFilterMonth, compareMonthOptOut]);

  const monthFilterDirty =
    draftFilterMonth !== filterMonth || draftCompareMonth !== compareMonth;

  const applyMonthFilter = useCallback(() => {
    setFilterMonth(draftFilterMonth);
    setCompareMonth(draftCompareMonth);
    setCompareMonthOptOut(!draftCompareMonth);
    if (draftCompareMonth) setCompareOptOut(true);
    setErrorMsg(null);
  }, [draftFilterMonth, draftCompareMonth]);

  // ── Сараар: riskbranch сарын дата + ойрын judgement ─────────────────────
  useEffect(() => {
    if (filterMode !== "month" || !filterMonth) return;
    const gen = ++monthLoadGen.current;
    let cancelled = false;
    setLoadingReport(true);
    setErrorMsg(null);
    setSelectedReportId("");
    setComparisonReportId("");

    (async () => {
      try {
        const primary = await loadRiskbranchMonth(filterMonth, catalog);
        if (cancelled || gen !== monthLoadGen.current) return;
        // Сонгосон сард дата байхгүй (өөр сар руу fill-forward) эсэх
        if (monthKeyFromDate(primary.actualDate) !== filterMonth) {
          setReportRows([]);
          setReportManualMap({});
          setReportJudgements({});
          setReportJudgementComments({});
          setMonthAnchorDate("");
          setComparisonRows([]);
          setComparisonJudgements({});
          return;
        }
        setReportRows(primary.rows);
        setReportManualMap(primary.manualMap);
        setReportJudgements(primary.judgements);
        setReportJudgementComments(primary.judgementComments);
        setMonthAnchorDate(primary.actualDate);

        if (compareMonth) {
          setLoadingComparison(true);
          try {
            const prev = await loadRiskbranchMonth(compareMonth, catalog);
            if (cancelled || gen !== monthLoadGen.current) return;
            if (monthKeyFromDate(prev.actualDate) !== compareMonth) {
              setComparisonRows([]);
              setComparisonManualMap({});
              setComparisonJudgements({});
            } else {
              setComparisonRows(prev.rows);
              setComparisonManualMap(prev.manualMap);
              setComparisonJudgements(prev.judgements);
              setComparisonJudgementComments(prev.judgementComments);
            }
          } catch {
            if (!cancelled && gen === monthLoadGen.current) {
              setComparisonRows([]);
              setComparisonJudgements({});
            }
          } finally {
            if (!cancelled && gen === monthLoadGen.current) {
              setLoadingComparison(false);
            }
          }
        } else {
          setComparisonRows([]);
          setComparisonManualMap({});
          setComparisonJudgements({});
          setLoadingComparison(false);
        }
      } catch (e: unknown) {
        if (cancelled || gen !== monthLoadGen.current) return;
        setErrorMsg(getApiErrorMessage(e) || "Сарын өгөгдөл уншихад алдаа гарлаа");
        setReportRows([]);
      } finally {
        if (!cancelled && gen === monthLoadGen.current) {
          setLoadingReport(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filterMode, filterMonth, compareMonth, catalog]);

  // ── Улирлаар: хадгалсан тайлан ───────────────────────────────────────────
  useEffect(() => {
    if (filterMode !== "quarter") return;
    if (!selectedReportId) {
      setReportRows([]);
      setReportManualMap({});
      setReportJudgements({});
      setReportJudgementComments({});
      setMonthAnchorDate("");
      return;
    }
    const requestId = selectedReportId;
    const pDate = historyList.find((h) => h.id === requestId)?.pDate;
    let cancelled = false;
    setLoadingReport(true);
    setErrorMsg(null);
    Promise.all([
      riskApi.getHistory(requestId),
      pDate ? riskApi.listJudgements(pDate.slice(0, 10)) : Promise.resolve([]),
      riskApi.listJudgements(),
    ])
      .then(([res, exactList, allJudge]) => {
        if (cancelled || requestId !== selectedReportIdRef.current) return;
        const manualMap = res.manualMap || {};
        const rows = res.rows || [];
        const solids = oracleSolidsFromRows(rows);
        const snapJ = judgementsFromManualSnapshot(manualMap, catalog);
        const anchor = (pDate || "").slice(0, 10);
        const exact = judgementsFromListForBranches(exactList, solids);
        const nearest = resolveNearestJudgements(allJudge, anchor, solids);
        const judgements = hasJudgementScores(snapJ)
          ? { ...nearest.scores, ...exact.scores, ...snapJ }
          : { ...nearest.scores, ...exact.scores };
        const snapComments = normalizeBranchKeyedMap(
          res.judgementComments || {},
          solids,
        );
        setReportRows(rows);
        setReportManualMap(manualMap);
        setReportJudgements(judgements);
        setReportJudgementComments({
          ...nearest.comments,
          ...exact.comments,
          ...snapComments,
        });
        setMonthAnchorDate(anchor);
      })
      .catch((e: unknown) => {
        if (cancelled || requestId !== selectedReportIdRef.current) return;
        setErrorMsg(getApiErrorMessage(e) || "Тайлан уншихад алдаа гарлаа");
      })
      .finally(() => {
        if (!cancelled && requestId === selectedReportIdRef.current) {
          setLoadingReport(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterMode, selectedReportId, historyList, catalog]);

  useEffect(() => {
    if (filterMode !== "quarter") return;
    if (!comparisonReportId) {
      setComparisonRows([]);
      setComparisonManualMap({});
      setComparisonJudgements({});
      setComparisonJudgementComments({});
      return;
    }
    const requestId = comparisonReportId;
    const pDate = historyList.find((h) => h.id === requestId)?.pDate;
    let cancelled = false;
    setLoadingComparison(true);
    Promise.all([
      riskApi.getHistory(requestId),
      pDate ? riskApi.listJudgements(pDate.slice(0, 10)) : Promise.resolve([]),
      riskApi.listJudgements(),
    ])
      .then(([res, exactList, allJudge]) => {
        if (cancelled || requestId !== comparisonReportIdRef.current) return;
        const manualMap = res.manualMap || {};
        const rows = res.rows || [];
        const solids = oracleSolidsFromRows(rows);
        const snapJ = judgementsFromManualSnapshot(manualMap, catalog);
        const anchor = (pDate || "").slice(0, 10);
        const exact = judgementsFromListForBranches(exactList, solids);
        const nearest = resolveNearestJudgements(allJudge, anchor, solids);
        const judgements = hasJudgementScores(snapJ)
          ? { ...nearest.scores, ...exact.scores, ...snapJ }
          : { ...nearest.scores, ...exact.scores };
        setComparisonRows(rows);
        setComparisonManualMap(manualMap);
        setComparisonJudgements(judgements);
        setComparisonJudgementComments({
          ...nearest.comments,
          ...exact.comments,
        });
      })
      .catch(() => {
        if (cancelled || requestId !== comparisonReportIdRef.current) return;
        setComparisonRows([]);
        setComparisonJudgements({});
      })
      .finally(() => {
        if (!cancelled && requestId === comparisonReportIdRef.current) {
          setLoadingComparison(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterMode, comparisonReportId, historyList, catalog]);

  // Улирлаар: авто өмнөх тайлан
  useEffect(() => {
    if (filterMode !== "quarter") return;
    setCompareOptOut(false);
  }, [filterMode, selectedReportId]);

  useEffect(() => {
    if (filterMode !== "quarter") return;
    if (compareMonth) return;
    const selP = historyList.find((h) => h.id === selectedReportId)?.pDate;
    if (!selectedReportId || !selP) {
      setComparisonReportId("");
      return;
    }
    if (compareOptOut) return;
    const earlier = historyList
      .filter((h) => h.id !== selectedReportId && h.pDate < selP)
      .sort((a, b) => b.pDate.localeCompare(a.pDate));
    setComparisonReportId(earlier[0]?.id ?? "");
  }, [
    filterMode,
    selectedReportId,
    historyList,
    compareOptOut,
    compareMonth,
  ]);

  const openDeleteConfirm = useCallback((id: string) => {
    setDeleteTargetId(id);
    setDeleteModalOpen(true);
  }, []);

  const doDeleteHistory = useCallback(async () => {
    if (!deleteTargetId) return;
    setDeleteModalOpen(false);
    try {
      await riskApi.deleteHistory(deleteTargetId);
      setHistoryList((prev) => prev.filter((h) => h.id !== deleteTargetId));
      if (selectedReportId === deleteTargetId) {
        setSelectedReportId("");
        setReportRows([]);
      }
    } catch (e: unknown) {
      setErrorMsg(getApiErrorMessage(e) || "Устгахад алдаа гарлаа");
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, selectedReportId]);

  const selectedReportInfo = useMemo(() => {
    return historyList.find((h) => h.id === selectedReportId) || null;
  }, [historyList, selectedReportId]);

  const comparisonReportInfo = useMemo(() => {
    return historyList.find((h) => h.id === comparisonReportId) || null;
  }, [historyList, comparisonReportId]);

  const earlierHistoryOptions = useMemo(() => {
    const selP = selectedReportInfo?.pDate;
    if (!selP) return [];
    return historyList
      .filter((h) => h.id !== selectedReportId && h.pDate < selP)
      .slice()
      .sort((a, b) => b.pDate.localeCompare(a.pDate));
  }, [historyList, selectedReportId, selectedReportInfo?.pDate]);

  const primaryScoredRows = useMemo(
    () => toScored(reportRows, catalog),
    [reportRows, catalog],
  );
  const comparisonScoredRows = useMemo(
    () => toScored(comparisonRows, catalog),
    [comparisonRows, catalog],
  );

  const showComparison =
    comparisonRows.length > 0 &&
    !loadingComparison &&
    (filterMode === "month"
      ? Boolean(compareMonth)
      : Boolean(comparisonReportId));

  const monthHasNoData =
    filterMode === "month" &&
    filterMonth &&
    !loadingReport &&
    reportRows.length === 0;

  const fieldClass =
    "h-7 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/40 cursor-pointer disabled:opacity-40";

  const filterControls = (
    <div className="flex items-center gap-x-2.5 gap-y-1.5 flex-wrap min-w-0">
      <div className="flex items-center rounded-md border border-border bg-background p-0.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            setFilterMode("month");
            setCompareMonthOptOut(false);
            if (draftFilterMonth) {
              setDraftCompareMonth(prevMonthKey(draftFilterMonth));
            }
          }}
          className={cn(
            "h-6 px-2.5 rounded text-[10px] font-semibold transition-colors",
            filterMode === "month"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Сараар
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterMode("quarter");
            setDraftCompareMonth("");
            setCompareMonth("");
            setCompareMonthOptOut(true);
            setCompareOptOut(false);
            if (historyList.length > 0 && !selectedReportId) {
              setSelectedReportId(historyList[0].id);
            }
          }}
          className={cn(
            "h-6 px-2.5 rounded text-[10px] font-semibold transition-colors",
            filterMode === "quarter"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Улирлаар
        </button>
      </div>

      {filterMode === "month" ? (
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <MonthFilter
            value={draftFilterMonth}
            onChange={(m) => {
              setDraftFilterMonth(m);
              setCompareMonthOptOut(false);
              setErrorMsg(null);
            }}
            ariaLabel="Үндсэн сар"
          />
          <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
            Өмнөх сар
          </span>
          <MonthFilter
            value={draftCompareMonth}
            maxExclusive={draftFilterMonth || undefined}
            placeholder="өмнөх сар"
            ariaLabel="Өмнөх сар"
            onChange={(m) => {
              setDraftCompareMonth(m);
              setCompareMonthOptOut(!m);
              setErrorMsg(null);
            }}
          />
          <button
            type="button"
            onClick={applyMonthFilter}
            disabled={!draftFilterMonth || !monthFilterDirty || loadingReport}
            title="Сонгосон сараар хайх"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors shrink-0",
              monthFilterDirty
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40",
              "disabled:opacity-40 disabled:pointer-events-none",
            )}
          >
            {loadingReport ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            disabled={loading || historyList.length === 0}
            className={cn(fieldClass, "min-w-[12rem] max-w-[18rem]")}
          >
            <option value="">— тайлан сонгох —</option>
            {historyList.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.pDate})
              </option>
            ))}
          </select>
          {selectedReportId && isAdmin && (
            <button
              onClick={() => openDeleteConfirm(selectedReportId)}
              title="Энэ тайланг устгах"
              className="p-1 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
            Өмнөх
          </span>
          <select
            value={comparisonReportId}
            onChange={(e) => {
              const v = e.target.value;
              setCompareMonth("");
              setCompareMonthOptOut(true);
              if (!v) {
                setCompareOptOut(true);
                setComparisonReportId("");
                return;
              }
              setCompareOptOut(false);
              setComparisonReportId(v);
            }}
            disabled={loading || !selectedReportId}
            className={cn(fieldClass, "min-w-[11rem] max-w-[16rem]")}
          >
            <option value="">— сонгох —</option>
            {earlierHistoryOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.pDate})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const waitingData =
    loading ||
    loadingReport ||
    ((filterMode === "month" ? Boolean(compareMonth) : Boolean(comparisonReportId)) &&
      loadingComparison);

  const showReportTable =
    !waitingData &&
    reportRows.length > 0 &&
    !(filterMode === "quarter" && !selectedReportId);

  return (
    <div className="min-h-0 flex-1 w-full min-w-0 max-w-full overflow-x-hidden bg-gradient-to-br from-background via-background to-emerald-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<BookmarkCheck className="w-4 h-4 text-emerald-500" />}
        title={t("riskReportPageTitle")}
      />

      <div className="container mx-auto px-4 py-6 space-y-5 flex-1 min-w-0 w-full max-w-[1800px]">
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

        {!showReportTable && (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 sm:px-4 sm:py-2.5">
            {filterControls}
          </div>
        )}

        {waitingData ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">Уншиж байна…</p>
          </div>
        ) : filterMode === "month" && riskbranchDates.length === 0 && !filterMonth ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="text-sm font-semibold text-muted-foreground">
              Riskbranch өгөгдөл одоогоор байхгүй байна
            </div>
          </div>
        ) : monthHasNoData ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="text-sm font-semibold text-muted-foreground">
              {formatMonthMn(filterMonth)}-д өгөгдөл байхгүй
            </div>
            <div className="text-xs text-muted-foreground/60 mt-1">
              Өөр сар сонгох эсвэл улирлаар горимд шилжинэ үү
            </div>
          </div>
        ) : filterMode === "quarter" && historyList.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
              <Bookmark className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              Хадгалагдсан тайлан одоогоор байхгүй байна
            </div>
            <div className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
              «Үнэлгээ хийх» хуудсаар орж хадгалснаар энд жагсаалт гарна.
            </div>
          </div>
        ) : filterMode === "quarter" && !selectedReportId ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="text-sm font-semibold text-muted-foreground">
              Дээрх цонхоор харах тайлангаа сонгоно уу
            </div>
          </div>
        ) : (
          <ReportView
            scoredRows={primaryScoredRows}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            pDate={
              filterMode === "month"
                ? monthAnchorDate
                : selectedReportInfo?.pDate
            }
            readOnly={true}
            initialManualMap={reportManualMap}
            externalJudgements={reportJudgements}
            externalJudgementComments={reportJudgementComments}
            previousScoredRows={comparisonScoredRows}
            previousHistoryName={
              filterMode === "month"
                ? compareMonth
                  ? formatMonthMn(compareMonth)
                  : null
                : (comparisonReportInfo?.name ?? null)
            }
            previousManualMap={comparisonManualMap}
            previousJudgements={comparisonJudgements}
            hideComparison={!showComparison}
            toolbarStart={filterControls}
            dataReferenceDate={
              filterMode === "month" ? monthAnchorDate : undefined
            }
          />
        )}
      </div>

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-premium-xl ring-hairline p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  Хадгалсан тайланг устгах
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Энэ үйлдлийг буцаах боломгүй.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/40 transition-colors"
              >
                Болих
              </button>
              <button
                onClick={doDeleteHistory}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Тийм устгах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
