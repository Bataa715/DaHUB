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
  RefreshCw,
  ListTree,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { riskLevelClass, type BranchAggregate } from "../scoring-rules";
import { useIndicatorConfig } from "../use-indicator-config";
import {
  type RiskRow,
  fmt,
  buildScoredRows,
  aggregateFromScoredRows,
  sortByTotalDesc,
} from "../hyanalt-shared";

function ScoreTable({ rows }: { rows: BranchAggregate[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-premium ring-hairline">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-emerald-500" />
        <h3 className="text-sm font-semibold">Салбаруудын оноо</h3>
        <span className="text-[10px] text-muted-foreground">
          (Total-оор эрэмбэлсэн · Judgement оруулаагүй)
        </span>
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
              <th className="px-2 py-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                Total
              </th>
              <th className="px-2 py-2 text-center font-semibold">Түвшин</th>
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
                <td className="px-2 py-2 text-right tabular-nums font-bold text-indigo-700 dark:text-indigo-400">
                  {fmt(b.total)}
                </td>
                <td className="px-2 py-2 text-center">
                  {b.level ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${riskLevelClass(b.level)}`}
                    >
                      {b.level}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RiskAssessmentDetailPage() {
  const { t } = useLanguage();

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDate, setLoadingDate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [viewHistoryRows, setViewHistoryRows] = useState<RiskRow[]>([]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");

  const { catalog, loaded: catalogLoaded } = useIndicatorConfig();

  const loadLatestAll = useCallback(async () => {
    setLoadingDate(true);
    setErrorMsg(null);
    try {
      const res = await riskApi.getRiskbranchLatestAll();
      setRows(res.rows.filter((r) => r.rowType === "oracle") as RiskRow[]);
    } catch (e: unknown) {
      setErrorMsg(getApiErrorMessage(e));
    } finally {
      setLoadingDate(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hist, latestRes] = await Promise.all([
          riskApi.listHistory(),
          riskApi.getRiskbranchLatestAll(),
        ]);
        if (cancelled) return;
        setHistoryList(hist);
        setRows(
          latestRes.rows.filter((r) => r.rowType === "oracle") as RiskRow[],
        );
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

  const scoredRows = useMemo(
    () => buildScoredRows(activeRows, catalog),
    [activeRows, catalog],
  );

  const aggregates = useMemo(
    () => sortByTotalDesc(aggregateFromScoredRows(scoredRows)),
    [scoredRows],
  );

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
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25">
              Хамгийн сүүлийн
            </span>
            {hasData && !viewHistoryId && (
              <Link
                href="/tools/risk-assessment/hyanalt/delgerengui"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-all"
              >
                <ListTree className="w-3.5 h-3.5" />
                Дэлгэрэнгүй
              </Link>
            )}
            <button
              onClick={loadLatestAll}
              disabled={loadingDate}
              title="Дахин татах"
              className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-all"
            >
              {loadingDate ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
            {rows.length > 0 && (
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </span>
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

        {loading || !catalogLoaded ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        ) : null}

        {!loading && catalogLoaded && !hasData && !viewHistoryId && (
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
          <ScoreTable rows={aggregates} />
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
