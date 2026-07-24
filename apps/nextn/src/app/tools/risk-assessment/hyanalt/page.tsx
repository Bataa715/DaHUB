"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { riskApi, getApiErrorMessage, type RiskHistoryEntry } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  X,
  Eye,
  Trash2,
  AlertTriangle,
  Activity,
  ListTree,
  ArrowRight,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { type BranchAggregate } from "../scoring-rules";
import { useIndicatorConfig } from "../use-indicator-config";
import {
  oracleSolidsFromRows,
  resolveNearestJudgements,
} from "../branch-resolve";
import {
  type RiskRow,
  buildScoredRows,
  aggregateFromScoredRows,
  sortByTotalDesc,
} from "../hyanalt-shared";
import HyanaltScoreTable from "./_ScoreTable";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthsBefore(iso: string, months: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  d.setMonth(d.getMonth() - months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadBranchAggregates(
  date: string,
  catalog: Parameters<typeof buildScoredRows>[1],
): Promise<{
  actualDate: string;
  rows: RiskRow[];
  judgements: Record<string, number>;
  aggregates: BranchAggregate[];
}> {
  const res = await riskApi.getRiskbranch(date);
  const actualDate = (res.fetchedDate || date).slice(0, 10);
  const oracleRows = res.rows.filter(
    (r) => r.rowType === "oracle" || !r.rowType,
  ) as RiskRow[];
  const allJudge = await riskApi.listJudgements();
  const solids = oracleSolidsFromRows(oracleRows);
  const resolved = resolveNearestJudgements(allJudge, actualDate, solids);
  const scored = buildScoredRows(oracleRows, catalog);
  const aggregates = sortByTotalDesc(
    aggregateFromScoredRows(scored, resolved.scores),
  );
  return {
    actualDate,
    rows: oracleRows,
    judgements: resolved.scores,
    aggregates,
  };
}

export default function RiskAssessmentDetailPage() {
  const { t } = useLanguage();

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [judgements, setJudgements] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [viewHistoryRows, setViewHistoryRows] = useState<RiskRow[]>([]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  /** Зүүн — өмнөх (default: 3 сарын өмнө) */
  const [fromDate, setFromDate] = useState("");
  /** Баруун — одоогийн (default: өнөөдөр) */
  const [toDate, setToDate] = useState("");

  const [comparePrevMap, setComparePrevMap] = useState<Map<
    string,
    BranchAggregate
  > | null>(null);
  const [loadingTo, setLoadingTo] = useState(false);
  const [loadingFrom, setLoadingFrom] = useState(false);

  const { catalog, loaded: catalogLoaded } = useIndicatorConfig();

  // Анхны ачаалал: баруун = өнөөдөр, зүүн = 3 сарын өмнө
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hist = await riskApi.listHistory();
        if (cancelled) return;
        setHistoryList(hist);
        const today = todayIso();
        setToDate(today);
        setFromDate(monthsBefore(today, 3));
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Баруун огноо → одоогийн хүснэгт
  useEffect(() => {
    if (!toDate || catalog.length === 0 || viewHistoryId) return;
    let cancelled = false;
    setLoadingTo(true);
    (async () => {
      try {
        const data = await loadBranchAggregates(toDate, catalog);
        if (cancelled) return;
        setRows(data.rows);
        setJudgements(data.judgements);
      } catch (e: unknown) {
        if (!cancelled) {
          setRows([]);
          setJudgements({});
          setErrorMsg(getApiErrorMessage(e) || "Огнооны өгөгдөл олдсонгүй");
        }
      } finally {
        if (!cancelled) setLoadingTo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toDate, catalog, viewHistoryId]);

  // Зүүн огноо → өмнөх харьцуулалт
  useEffect(() => {
    if (!fromDate || catalog.length === 0 || viewHistoryId) {
      if (!fromDate) setComparePrevMap(null);
      return;
    }
    let cancelled = false;
    setLoadingFrom(true);
    (async () => {
      try {
        const data = await loadBranchAggregates(fromDate, catalog);
        if (cancelled) return;
        setComparePrevMap(
          new Map(data.aggregates.map((b) => [b.branchId, b])),
        );
      } catch (e: unknown) {
        if (!cancelled) {
          setComparePrevMap(null);
          setErrorMsg(
            getApiErrorMessage(e) || "Харьцуулах огнооны өгөгдөл олдсонгүй",
          );
        }
      } finally {
        if (!cancelled) setLoadingFrom(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromDate, catalog, viewHistoryId]);

  const doDeleteHistory = useCallback(async () => {
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
  }, [deleteTargetId, viewHistoryId]);

  const activeRows = viewHistoryId ? viewHistoryRows : rows;
  const activeJudgements = viewHistoryId ? {} : judgements;

  const scoredRows = useMemo(
    () => buildScoredRows(activeRows, catalog),
    [activeRows, catalog],
  );

  const aggregates = useMemo(
    () =>
      sortByTotalDesc(aggregateFromScoredRows(scoredRows, activeJudgements)),
    [scoredRows, activeJudgements],
  );

  const viewHistoryEntry = historyList.find((h) => h.id === viewHistoryId);
  const hasData = rows.length > 0 || !!viewHistoryId;
  const showCompareUi = !viewHistoryId;
  const loadingCompare = loadingFrom || loadingTo;
  const showPrev =
    showCompareUi &&
    !!fromDate &&
    !!comparePrevMap &&
    !loadingFrom &&
    comparePrevMap.size > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment/tailan"
        icon={<Activity className="w-4 h-4 text-emerald-500" />}
        title={t("riskMonitorCardTitle")}
        rightContent={
          <div className="flex items-center gap-2">
            {showCompareUi && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setErrorMsg(null);
                  }}
                  disabled={loadingFrom}
                  title="Өмнөх огноо"
                  aria-label="Өмнөх огноо"
                  className="h-8 px-2 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer disabled:opacity-40"
                />
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setErrorMsg(null);
                  }}
                  disabled={loadingTo}
                  title="Одоогийн огноо"
                  aria-label="Одоогийн огноо"
                  className="h-8 px-2 rounded-lg border border-emerald-500/40 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer disabled:opacity-40"
                />
                {loadingCompare && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                )}
              </div>
            )}
            {(hasData || rows.length > 0) && !viewHistoryId && (
              <Link
                href="/tools/risk-assessment/hyanalt/delgerengui"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-all"
              >
                <ListTree className="w-3.5 h-3.5" />
                Дэлгэрэнгүй
              </Link>
            )}
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

        {loading || !catalogLoaded || (loadingTo && rows.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        ) : null}

        {!loading &&
          catalogLoaded &&
          !loadingTo &&
          !hasData &&
          !viewHistoryId && (
            <div className="rounded-2xl border border-border bg-card shadow-premium ring-hairline px-6 py-16 text-center">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
                <Activity className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <div className="text-sm font-semibold text-muted-foreground">
                Өгөгдөл байхгүй байна
              </div>
              <div className="text-xs text-muted-foreground/60 mt-1">
                Airflow-с өгөгдөл ирсний дараа хамгийн сүүлийн утга автоматаар
                харагдана
              </div>
            </div>
          )}

        {!loading && catalogLoaded && scoredRows.length > 0 && (
          <HyanaltScoreTable
            rows={aggregates}
            prevMap={showPrev ? comparePrevMap : null}
            compareDate={showPrev ? fromDate : null}
            fromDateLabel={fromDate || null}
            toDateLabel={toDate || null}
          />
        )}
      </div>

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
