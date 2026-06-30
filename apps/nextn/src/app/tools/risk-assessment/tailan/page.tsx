"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  riskApi,
  getApiErrorMessage,
  type RiskHistoryEntry,
  type RiskCurrentRow,
} from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2,
  AlertTriangle,
  Bookmark,
  Trash2,
  BookmarkCheck,
  GitCompare,
  FileSpreadsheet,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  computeScoreDynamic,
  type ScoreResult,
  type ScoreGroup,
} from "../scoring-rules";
import {
  useIndicatorConfig,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import {
  judgementsFromManualSnapshot,
  judgementsFromList,
  judgementCommentsFromList,
} from "../branch-resolve";
import ReportView from "../report-view";
import ComparePanel from "./_ComparePanel";
import CsvExportModal from "./_CsvExportModal";

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
      const ind = catalog.find((c) => c.subid === String(r.SUBID ?? ""));
      const { score, label } =
        ind && !ind.is_manual
          ? computeScoreDynamic(ind.score_scale, r.RESULT, r.RESULT_TYPE)
          : { score: null, label: null };
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
  const { t } = useLanguage();
  const { user } = useAuth();
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
  const [comparisonJudgementComments, setComparisonJudgementComments] =
    useState<Record<string, string>>({});
  const [loadingComparison, setLoadingComparison] = useState(false);

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
      .catch((e) => {
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
        const snapJ = judgementsFromManualSnapshot(manualMap, catalog);
        const apiJ = judgementsFromList(jList);
        setReportRows(res.rows || []);
        setReportManualMap(manualMap);
        setReportJudgements({ ...snapJ, ...apiJ });
        setReportJudgementComments({
          ...(res.judgementComments || {}),
          ...judgementCommentsFromList(jList),
        });
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
        const snapJ = judgementsFromManualSnapshot(manualMap, catalog);
        const apiJ = judgementsFromList(jList);
        setComparisonRows(res.rows || []);
        setComparisonManualMap(manualMap);
        setComparisonJudgements({ ...snapJ, ...apiJ });
        setComparisonJudgementComments({
          ...(res.judgementComments || {}),
          ...judgementCommentsFromList(jList),
        });
      })
      .catch((e) => console.error("getHistory амжилтгүй:", e))
      .finally(() => {
        if (!cancelled) setLoadingComparison(false);
      });
    return () => {
      cancelled = true;
    };
  }, [comparisonReportId, historyList, catalog]);

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

  const primaryScoredRows = useMemo(
    () => toScored(reportRows, catalog),
    [reportRows, catalog],
  );
  const comparisonScoredRows = useMemo(
    () => toScored(comparisonRows, catalog),
    [comparisonRows, catalog],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<BookmarkCheck className="w-4 h-4 text-emerald-500" />}
        title="Эрсдэлийн Тайлан"
        rightContent={
          <div className="flex items-center gap-2">
            {selectedReportId &&
              !loadingReport &&
              primaryScoredRows.length > 0 && (
                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
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
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Өмнөх улирал
                </span>
                <select
                  value={comparisonReportId}
                  onChange={(e) => setComparisonReportId(e.target.value)}
                  disabled={loading || historyList.length <= 1}
                  className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer min-w-[220px]"
                >
                  <option value="">— Харьцуулалтгүй —</option>
                  {historyList
                    .filter((h) => h.id !== selectedReportId)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.pDate})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading || loadingReport || loadingComparison ? (
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
            key={`${selectedReportId}:${comparisonReportId}`}
            scoredRows={primaryScoredRows}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            pDate={selectedReportInfo?.pDate}
            readOnly={true}
            initialManualMap={reportManualMap}
            externalJudgements={reportJudgements}
            externalJudgementComments={reportJudgementComments}
            previousScoredRows={comparisonScoredRows}
            previousHistoryName={comparisonReportInfo?.name ?? null}
            previousManualMap={comparisonManualMap}
            previousJudgements={comparisonJudgements}
            hideComparison={!comparisonReportId}
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
        prevRows={comparisonRows}
        prevManualMap={comparisonManualMap}
        prevJudgements={comparisonJudgements}
        prevName={comparisonReportInfo?.name ?? null}
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
