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
import Link from "next/link";
import {
  Loader2,
  AlertTriangle,
  Bookmark,
  Trash2,
  BookmarkCheck,
  GitCompare,
  FileSpreadsheet,
  Activity,
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
import ComparePanel from "./_ComparePanel";
import CsvExportModal from "./_CsvExportModal";
import type { ManualMap } from "../indicator-catalog";

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

export default function RiskReportsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.isAdmin === true;
  const { catalog, weights } = useIndicatorConfig();

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Selected Comparison Report
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

  // Огноогоор харьцуулах (хяналттай адил — riskbranch-аас)
  const [compareDate, setCompareDate] = useState("");
  const compareDateRef = useRef(compareDate);
  compareDateRef.current = compareDate;
  const [dateCompareRows, setDateCompareRows] = useState<RiskCurrentRow[]>([]);
  const [dateCompareManualMap, setDateCompareManualMap] = useState<ManualMap>(
    {},
  );
  const [dateCompareJudgements, setDateCompareJudgements] = useState<
    Record<string, number>
  >({});
  const [dateCompareActual, setDateCompareActual] = useState<string | null>(
    null,
  );
  const [loadingDateCompare, setLoadingDateCompare] = useState(false);
  /** Хоосон сонгосон — харьцуулахгүй (авто өмнөх улирал цуцлагдсан) */
  const [compareOptOut, setCompareOptOut] = useState(false);

  const [riskFilter, setRiskFilter] = useState<
    "all" | "Өндөр" | "Дунд" | "Бага"
  >("all");

  const [compareOpen, setCompareOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

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
        setHistoryList(data || []);
        // Automatically select the most recent saved report if any
        if (data && data.length > 0) {
          setSelectedReportId(data[0].id);
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

  // Fetch primary report details + risk_judgement (эх сурвалж)
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
    setReportRows([]);
    setReportManualMap({});
    setReportJudgements({});
    setReportJudgementComments({});
    let cancelled = false;
    setLoadingReport(true);
    setErrorMsg(null);
    Promise.all([
      riskApi.getHistory(requestId),
      pDate ? riskApi.listJudgements(pDate) : Promise.resolve([]),
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
        setReportRows(rows);
        setReportManualMap(manualMap);
        setReportJudgements({ ...snapJ, ...apiJ });
        setReportJudgementComments({ ...snapComments, ...apiComments });
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMsg("Сонгосон тайлангийн өгөгдлийг уншихад алдаа гарлаа.");
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedReportId, historyList, catalog]);

  // Fetch comparison report details + risk_judgement
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
    setComparisonRows([]);
    setComparisonManualMap({});
    setComparisonJudgements({});
    setComparisonJudgementComments({});
    let cancelled = false;
    setLoadingComparison(true);
    Promise.all([
      riskApi.getHistory(requestId),
      pDate ? riskApi.listJudgements(pDate) : Promise.resolve([]),
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
        setComparisonRows(rows);
        setComparisonManualMap(manualMap);
        setComparisonJudgements({ ...snapJ, ...apiJ });
        setComparisonJudgementComments({ ...snapComments, ...apiComments });
      })
      .catch((e) => console.error("getHistory амжилтгүй:", e))
      .finally(() => {
        if (!cancelled) setLoadingComparison(false);
      });
    return () => {
      cancelled = true;
    };
  }, [comparisonReportId, historyList, catalog]);

  // Сонгосон тайлан солигдоход — огноо харьцуулалт цэвэрлээд авто өмнөх улирал
  useEffect(() => {
    setCompareOptOut(false);
    setCompareDate("");
    setDateCompareRows([]);
    setDateCompareManualMap({});
    setDateCompareJudgements({});
    setDateCompareActual(null);
  }, [selectedReportId]);

  // Авто: хамгийн ойрын өмнөх улирлын тайлан (огноо/opt-out үед биш)
  useEffect(() => {
    const selP = historyList.find((h) => h.id === selectedReportId)?.pDate;
    if (!selectedReportId || !selP) {
      setComparisonReportId("");
      return;
    }
    if (compareDate || compareOptOut) return;
    const earlier = historyList
      .filter((h) => h.id !== selectedReportId && h.pDate < selP)
      .sort((a, b) => b.pDate.localeCompare(a.pDate));
    setComparisonReportId(earlier[0]?.id ?? "");
  }, [selectedReportId, historyList, compareOptOut, compareDate]);

  // Огноогоор харьцуулах — riskbranch-аас тухайн (эсвэл ойр) өдрийн үр дүн
  useEffect(() => {
    if (!compareDate || catalog.length === 0) {
      if (!compareDate) {
        setDateCompareRows([]);
        setDateCompareManualMap({});
        setDateCompareJudgements({});
        setDateCompareActual(null);
      }
      return;
    }
    const requestDate = compareDate.slice(0, 10);
    let cancelled = false;
    setLoadingDateCompare(true);
    (async () => {
      try {
        const [res, allJudge] = await Promise.all([
          riskApi.getRiskbranch(requestDate),
          riskApi.listJudgements(),
        ]);
        if (cancelled || requestDate !== compareDateRef.current.slice(0, 10))
          return;
        const actualDate = (res.fetchedDate || requestDate).slice(0, 10);
        const rows = (res.rows || []).filter(
          (r) => r.rowType === "oracle" || !r.rowType,
        );
        const manualMap = (res.manualMap || {}) as ManualMap;
        const solids = oracleSolidsFromRows(rows);
        const resolved = resolveNearestJudgements(allJudge, actualDate, solids);
        setDateCompareRows(rows);
        setDateCompareManualMap(manualMap);
        setDateCompareJudgements(resolved.scores);
        setDateCompareActual(actualDate);
        if (rows.length === 0) {
          setErrorMsg(
            `${requestDate} өдөр (эсвэл өмнөх)-ийн эрсдэлийн өгөгдөл олдсонгүй`,
          );
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setDateCompareRows([]);
          setDateCompareManualMap({});
          setDateCompareJudgements({});
          setDateCompareActual(null);
          setErrorMsg(
            getApiErrorMessage(e) || "Харьцуулах огнооны өгөгдөл олдсонгүй",
          );
        }
      } finally {
        if (!cancelled) setLoadingDateCompare(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compareDate, catalog]);

  // Delete handler
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

  /** Сонгосон тайланаас өмнөх pDate-тай хадгалсан тайлангууд */
  const earlierHistoryOptions = useMemo(() => {
    const selP = selectedReportInfo?.pDate;
    if (!selP) return [];
    return historyList
      .filter((h) => h.id !== selectedReportId && h.pDate < selP)
      .slice()
      .sort((a, b) => b.pDate.localeCompare(a.pDate));
  }, [historyList, selectedReportId, selectedReportInfo?.pDate]);

  /** Огноо сонгосон бол тэр үргэлж давуу — хадгалсан өмнөх улирлаас түрүүлж */
  const useDateCompare = Boolean(compareDate);

  const primaryScoredRows = useMemo(
    () => toScored(reportRows, catalog),
    [reportRows, catalog],
  );
  const comparisonScoredRows = useMemo(
    () =>
      toScored(useDateCompare ? dateCompareRows : comparisonRows, catalog),
    [useDateCompare, dateCompareRows, comparisonRows, catalog],
  );

  const activePrevManualMap = useDateCompare
    ? dateCompareManualMap
    : comparisonManualMap;
  const activePrevJudgements = useDateCompare
    ? dateCompareJudgements
    : comparisonJudgements;
  const activePrevName = useDateCompare
    ? compareDate
      ? `Огноо ${compareDate}`
      : null
    : (comparisonReportInfo?.name ?? null);
  const showComparison = useDateCompare
    ? dateCompareRows.length > 0 && !loadingDateCompare
    : Boolean(comparisonReportId) && comparisonRows.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<BookmarkCheck className="w-4 h-4 text-emerald-500" />}
        title="Тайлан"
        rightContent={
          <div className="flex items-center gap-2">
            <Link
              href="/tools/risk-assessment/hyanalt"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              {t("riskMonitorCardTitle")}
            </Link>
            {selectedReportId &&
              !loadingReport &&
              primaryScoredRows.length > 0 && (
                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-500/20 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Татах
                </button>
              )}
            <button
              onClick={() => setCompareOpen(true)}
              disabled={historyList.length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Харьцуулалт
            </button>
          </div>
        }
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

        {/* Toolbar with Select Dropdowns */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                Тайлан сонгох
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedReportId}
                  onChange={(e) => setSelectedReportId(e.target.value)}
                  disabled={loading || historyList.length === 0}
                  className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer min-w-[220px]"
                >
                  <option value="">-- Тайлан сонгох --</option>
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
                    className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {selectedReportId && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Өмнөх улирал
                  </span>
                  <select
                    value={comparisonReportId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setCompareOptOut(true);
                        setComparisonReportId("");
                        return;
                      }
                      setCompareOptOut(false);
                      setComparisonReportId(v);
                      setCompareDate("");
                    }}
                    disabled={loading}
                    className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer min-w-[220px]"
                  >
                    <option value=""> </option>
                    {earlierHistoryOptions.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.pDate})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Огноогоор харьцуулах
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={compareDate}
                      max={selectedReportInfo?.pDate || undefined}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCompareDate(v);
                        if (v) {
                          setComparisonReportId("");
                          setCompareOptOut(true);
                          setErrorMsg(null);
                        } else {
                          setCompareOptOut(false);
                        }
                      }}
                      disabled={!selectedReportInfo?.pDate}
                      title="Сонгосон огнооны эрсдэлийн Total/түвшинг тайлантай харьцуулах"
                      aria-label="Харьцуулах огноо"
                      className="h-8 px-2 rounded-lg border border-emerald-500/40 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer disabled:opacity-40"
                    />
                    {loadingDateCompare && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    )}
                    {compareDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompareDate("");
                          setCompareOptOut(false);
                          setDateCompareRows([]);
                          setDateCompareActual(null);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 h-7 rounded-md border border-border"
                        title="Огноо харьцуулалт цуцлах"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Loading Spinner — огноо/өмнөх улирал ачаалахад хүснэгтийг нуухгүй */}
        {loading || loadingReport ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">Уншиж байна…</p>
          </div>
        ) : historyList.length === 0 ? (
          /* Empty State */
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
        ) : !selectedReportId ? (
          <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
            <div className="text-sm font-semibold text-muted-foreground">
              Дээрх цонхоор харах тайлангаа сонгоно уу
            </div>
          </div>
        ) : (
          /* Report view (ReadOnly) */
          <ReportView
            key={`${selectedReportId}:${comparisonReportId}:${compareDate}:${dateCompareActual ?? ""}`}
            scoredRows={primaryScoredRows}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            pDate={selectedReportInfo?.pDate}
            readOnly={true}
            initialManualMap={reportManualMap}
            externalJudgements={reportJudgements}
            externalJudgementComments={reportJudgementComments}
            previousScoredRows={comparisonScoredRows}
            previousHistoryName={activePrevName}
            previousManualMap={activePrevManualMap}
            previousJudgements={activePrevJudgements}
            hideComparison={!showComparison}
          />
        )}
      </div>

      <ComparePanel
        open={compareOpen}
        onCloseAction={() => setCompareOpen(false)}
        historyList={historyList}
      />

      <CsvExportModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        primaryRows={reportRows}
        primaryManualMap={reportManualMap}
        primaryJudgements={reportJudgements}
        primaryJudgementComments={reportJudgementComments}
        primaryName={selectedReportInfo?.name ?? ""}
        primaryDate={selectedReportInfo?.pDate ?? ""}
        prevRows={useDateCompare ? dateCompareRows : comparisonRows}
        prevManualMap={
          useDateCompare ? dateCompareManualMap : comparisonManualMap
        }
        prevJudgements={
          useDateCompare ? dateCompareJudgements : comparisonJudgements
        }
        prevName={activePrevName}
        catalog={catalog}
        weights={weights}
        currentComparisonId={comparisonReportId}
      />

      {/* Delete Confirmation Modal */}
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
