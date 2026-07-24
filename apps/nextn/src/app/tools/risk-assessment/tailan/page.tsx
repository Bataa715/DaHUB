"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  riskApi,
  getApiErrorMessage,
  type RiskHistoryEntry,
  type RiskCurrentRow,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
  return iso.slice(0, 7); // YYYY-MM
}

function currentMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function hasJudgementScores(map: Record<string, number>): boolean {
  return Object.values(map).some((v) => Number(v) > 0);
}

/** Тухайн огноонд judgement байхгүй бол ≤ огнооны хамгийн ойрын judgement авна */
async function listJudgementsAsOf(pDate: string) {
  const target = pDate.slice(0, 10);
  const exact = await riskApi.listJudgements(target);
  if (exact.length > 0) return exact;

  const all = await riskApi.listJudgements();
  const nearestDate = [
    ...new Set(all.map((j) => String(j.fetchedDate).slice(0, 10))),
  ]
    .filter((d) => d && d <= target)
    .sort((a, b) => b.localeCompare(a))[0];
  if (!nearestDate) return [];
  return all.filter((j) => String(j.fetchedDate).slice(0, 10) === nearestDate);
}

export default function RiskReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;
  const { catalog } = useIndicatorConfig();

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Сараар шүүх (YYYY-MM) — хайлт дарсан үед л хэрэгжинэ */
  const [filterMonth, setFilterMonth] = useState("");
  /** Харьцуулах өмнөх сар (YYYY-MM) — хайлт дарсан үед л хэрэгжинэ */
  const [compareMonth, setCompareMonth] = useState("");
  /** UI дээрх draft сонголт (хайлт хүртэл table өөрчлөгдөхгүй) */
  const [draftFilterMonth, setDraftFilterMonth] = useState("");
  const [draftCompareMonth, setDraftCompareMonth] = useState("");
  const [compareMonthOptOut, setCompareMonthOptOut] = useState(false);
  /** Шүүлтийн горим: сар | улирал */
  const [filterMode, setFilterMode] = useState<"month" | "quarter">("month");

  // Selected Primary Report
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const selectedReportIdRef = useRef(selectedReportId);
  selectedReportIdRef.current = selectedReportId;
  const [reportRows, setReportRows] = useState<RiskCurrentRow[]>([]);
  const [reportManualMap, setReportManualMap] = useState<any>({});
  const [reportJudgements, setReportJudgements] = useState<
    Record<string, number>
  >({});
  const [reportJudgementComments, setReportJudgementComments] = useState<
    Record<string, string>
  >({});
  const [loadingReport, setLoadingReport] = useState(false);

  // Selected Comparison Report (өмнөх улирал)
  const [comparisonReportId, setComparisonReportId] = useState<string>("");
  const comparisonReportIdRef = useRef(comparisonReportId);
  comparisonReportIdRef.current = comparisonReportId;
  const [comparisonRows, setComparisonRows] = useState<RiskCurrentRow[]>([]);
  const [comparisonManualMap, setComparisonManualMap] = useState<any>({});
  const [comparisonJudgements, setComparisonJudgements] = useState<
    Record<string, number>
  >({});
  const [, setComparisonJudgementComments] =
    useState<Record<string, string>>({});
  const [loadingComparison, setLoadingComparison] = useState(false);
  /** Хоосон сонгосон — харьцуулахгүй (авто өмнөх улирал цуцлагдсан) */
  const [compareOptOut, setCompareOptOut] = useState(false);

  const [riskFilter, setRiskFilter] = useState<
    "all" | "Өндөр" | "Дунд" | "Бага"
  >("all");

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Fetch saved reports list on mount
  useEffect(() => {
    let cancelled = false;
    riskApi
      .listHistory()
      .then((data) => {
        if (cancelled) return;
        const list = data || [];
        setHistoryList(list);
        if (list.length > 0) {
          const latestMonth = monthKeyFromDate(list[0].pDate);
          const month = latestMonth || currentMonthKey();
          const prev = prevMonthKey(month);
          setFilterMonth(month);
          setCompareMonth(prev);
          setDraftFilterMonth(month);
          setDraftCompareMonth(prev);
          setSelectedReportId(list[0].id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMsg("Хадгалсан тайлангуудыг уншихад алдаа гарлаа.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Сонгосон сарын тайлангууд — бүрэн жагсаалт */
  const monthFilteredHistory = useMemo(() => {
    if (!filterMonth) return historyList;
    return historyList.filter(
      (h) => monthKeyFromDate(h.pDate) === filterMonth,
    );
  }, [historyList, filterMonth]);

  /** Сараар сонголт солигдоход — тухайн сарын хамгийн сүүлийн тайланг автомат сонгоно */
  useEffect(() => {
    if (!filterMonth) return;
    if (monthFilteredHistory.length === 0) {
      setSelectedReportId("");
      return;
    }
    const stillInMonth = monthFilteredHistory.some(
      (h) => h.id === selectedReportIdRef.current,
    );
    if (!stillInMonth) {
      setSelectedReportId(monthFilteredHistory[0].id);
    }
  }, [filterMonth, monthFilteredHistory]);

  /** Draft үндсэн сар солигдоход — өмнөх сарыг draft дээр автоматаар тохируулна */
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

  /** Өмнөх сарын хамгийн сүүлийн тайлан → харьцуулалт */
  const compareMonthReportId = useMemo(() => {
    if (!compareMonth) return "";
    const inMonth = historyList
      .filter((h) => monthKeyFromDate(h.pDate) === compareMonth)
      .sort((a, b) => b.pDate.localeCompare(a.pDate));
    return inMonth[0]?.id ?? "";
  }, [historyList, compareMonth]);

  // Fetch primary report details + risk_judgement
  useEffect(() => {
    if (!selectedReportId) {
      setReportRows([]);
      setReportManualMap({});
      setReportJudgements({});
      setReportJudgementComments({});
      return;
    }
    const requestId = selectedReportId;
    const pDate = historyList.find((h) => h.id === requestId)?.pDate;
    // Хуучин table-ийг арилгахгүй — fade + шинэ өгөгдөл орж иртэл хадгална
    let cancelled = false;
    setLoadingReport(true);
    setErrorMsg(null);
    Promise.all([
      riskApi.getHistory(requestId),
      pDate ? listJudgementsAsOf(pDate) : Promise.resolve([]),
    ])
      .then(([res, jList]) => {
        if (cancelled || requestId !== selectedReportIdRef.current) return;
        const manualMap = res.manualMap || {};
        const rows = res.rows || [];
        const solids = oracleSolidsFromRows(rows);
        const snapJ = judgementsFromManualSnapshot(manualMap, catalog);
        const { scores: apiJ, comments: apiComments } =
          judgementsFromListForBranches(jList, solids);
        const snapComments = normalizeBranchKeyedMap(
          res.judgementComments || {},
          solids,
        );
        // Snapshot-д judgement байвал түүнийг давуу, үгүй бол as-of API
        const mergedJ = hasJudgementScores(snapJ)
          ? { ...apiJ, ...snapJ }
          : { ...snapJ, ...apiJ };
        setReportRows(rows);
        setReportManualMap(manualMap);
        setReportJudgements(mergedJ);
        setReportJudgementComments({ ...snapComments, ...apiComments });
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
  }, [selectedReportId, historyList, catalog]);

  // Fetch comparison (өмнөх улирал) report
  useEffect(() => {
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
      pDate ? listJudgementsAsOf(pDate) : Promise.resolve([]),
    ])
      .then(([res, jList]) => {
        if (cancelled || requestId !== comparisonReportIdRef.current) return;
        const manualMap = res.manualMap || {};
        const rows = res.rows || [];
        const solids = oracleSolidsFromRows(rows);
        const snapJ = judgementsFromManualSnapshot(manualMap, catalog);
        const { scores: apiJ, comments: apiComments } =
          judgementsFromListForBranches(jList, solids);
        const snapComments = normalizeBranchKeyedMap(
          res.judgementComments || {},
          solids,
        );
        const mergedJ = hasJudgementScores(snapJ)
          ? { ...apiJ, ...snapJ }
          : { ...snapJ, ...apiJ };
        setComparisonRows(rows);
        setComparisonManualMap(manualMap);
        setComparisonJudgements(mergedJ);
        setComparisonJudgementComments({ ...snapComments, ...apiComments });
      })
      .catch(() => {
        if (cancelled || requestId !== comparisonReportIdRef.current) return;
        setComparisonRows([]);
        setComparisonManualMap({});
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
  }, [comparisonReportId, historyList, catalog]);

  // Сонгосон тайлан солигдоход — авто өмнөх улирал дахин
  useEffect(() => {
    setCompareOptOut(false);
  }, [selectedReportId]);

  // Харьцуулалт: өмнөх сар давуу, үгүй бол өмнөх улирлын тайлан
  useEffect(() => {
    if (compareMonth) {
      setComparisonReportId(compareMonthReportId);
      return;
    }
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
    selectedReportId,
    historyList,
    compareOptOut,
    compareMonth,
    compareMonthReportId,
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
    Boolean(comparisonReportId) &&
    comparisonRows.length > 0 &&
    !loadingComparison;

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

  const showReportTable =
    !loading &&
    !(loadingReport && reportRows.length === 0) &&
    historyList.length > 0 &&
    !(
      filterMode === "month" &&
      filterMonth &&
      monthFilteredHistory.length === 0
    ) &&
    !(!selectedReportId && reportRows.length === 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<BookmarkCheck className="w-4 h-4 text-emerald-500" />}
        title="Тайлан"
      />

      <div className="container mx-auto px-4 py-6 space-y-5 flex-1 max-w-[1800px]">
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

        {/* ReportView байхгүй үед шүүлтийг тусад нь харуулна */}
        {!showReportTable && (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 sm:px-4 sm:py-2.5">
            {filterControls}
          </div>
        )}

        {loading || (loadingReport && reportRows.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">Уншиж байна…</p>
          </div>
        ) : historyList.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
              <Bookmark className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              Хадгалагдсан тайлан одоогоор байхгүй байна
            </div>
            <div className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
              «Эрсдэлийн үнэлгээ хийх» хуудсаар орж, аудиторын үнэлэмжийг
              хадгалснаар энд жагсаалт харагдах болно.
            </div>
          </div>
        ) : filterMode === "month" &&
          filterMonth &&
          monthFilteredHistory.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="text-sm font-semibold text-muted-foreground">
              {formatMonthMn(filterMonth)}-д хадгалсан тайлан байхгүй
            </div>
            <div className="text-xs text-muted-foreground/60 mt-1">
              Өөр сар сонгох эсвэл улирлаар горимд шилжэж харна уу
            </div>
          </div>
        ) : !selectedReportId && reportRows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="text-sm font-semibold text-muted-foreground">
              Дээрх цонхоор харах тайлангаа сонгоно уу
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative transition-opacity duration-300 ease-out",
              loadingReport || loadingComparison ? "opacity-45" : "opacity-100",
            )}
          >
            {(loadingReport || loadingComparison) && (
              <div className="absolute inset-x-0 top-8 z-10 flex justify-center pointer-events-none">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  <span className="text-[11px] text-muted-foreground">
                    Шинэчилж байна…
                  </span>
                </div>
              </div>
            )}
            <ReportView
              scoredRows={primaryScoredRows}
              riskFilter={riskFilter}
              setRiskFilter={setRiskFilter}
              pDate={selectedReportInfo?.pDate}
              readOnly={true}
              initialManualMap={reportManualMap}
              externalJudgements={reportJudgements}
              externalJudgementComments={reportJudgementComments}
              previousScoredRows={comparisonScoredRows}
              previousHistoryName={
                compareMonth
                  ? formatMonthMn(compareMonth)
                  : (comparisonReportInfo?.name ?? null)
              }
              previousManualMap={comparisonManualMap}
              previousJudgements={comparisonJudgements}
              hideComparison={!showComparison}
              toolbarStart={filterControls}
            />
          </div>
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
