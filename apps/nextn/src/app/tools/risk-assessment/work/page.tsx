"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { riskApi, getApiErrorMessage, type RiskCurrentRow } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  BookmarkPlus,
  Lock,
  LockOpen,
  ClipboardEdit,
  Activity,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  computeScoreDynamic,
  type ScoreResult,
  type ScoreGroup,
} from "../scoring-rules";
import { useIndicatorConfig, type DynamicCatalogIndicator } from "../use-indicator-config";
import ReportView from "../report-view";

type ScoredRow = RiskCurrentRow & {
  __score: ScoreResult;
  __scoreLabel: string | null;
  __group: ScoreGroup | null;
};

function toScored(rows: RiskCurrentRow[], catalog: DynamicCatalogIndicator[]): ScoredRow[] {
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
        grpNum === 1 ? "Score 1" :
        grpNum === 2 ? "Score 2" :
        grpNum === 3 ? "Score 3" : null;
      return { ...r, __score: score as ScoreResult, __scoreLabel: label, __group };
    });
}

interface MonitorContentProps {
  saveModalOpenHandler: (meta: { pDate: string; pDateBeg: string }) => void;
}

function MonitorContent({ saveModalOpenHandler }: MonitorContentProps) {
  const { t } = useLanguage();

  const [rows, setRows] = useState<RiskCurrentRow[]>([]);
  const [fetchedDate, setFetchedDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [lockedDate, setLockedDate] = useState<string | null>(null);
  const [judgements, setJudgements] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [loadingDate, setLoadingDate] = useState(false);
  const [lockingDate, setLockingDate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<
    "all" | "Өндөр" | "Дунд" | "Бага"
  >("all");

  const judgementTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const loadAbortRef = useRef<AbortController | null>(null);

  const dynamicConfig = useIndicatorConfig();
  const { catalog } = dynamicConfig;

  const hasData = rows.some((r) => r.rowType === "oracle");
  const isLocked = lockedDate !== null && lockedDate === fetchedDate;

  // manualMap: judgement scores -> ReportView
  const manualMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const branchIds = [
      ...new Set(
        rows.filter((r) => r.rowType === "oracle").map((r) => r.BRANCHID),
      ),
    ];
    for (const bid of branchIds) {
      if (judgements[bid]) {
        map[bid] = { "j-001": judgements[bid] };
      }
    }
    return map;
  }, [rows, judgements]);

  // Init: lock check + load locked date if exists
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { lockedDate: ld } = await riskApi.getRealtimeLock();
        if (cancelled) return;
        setLockedDate(ld);
        if (ld) {
          setSelectedDate(ld);
          const [res, judgeList] = await Promise.all([
            riskApi.getRealtime(ld),
            riskApi.listJudgements(ld),
          ]);
          if (cancelled) return;
          setRows(res.rows ?? []);
          setFetchedDate(ld);
          const jmap: Record<string, number> = {};
          for (const j of judgeList) jmap[j.branchId] = j.score;
          setJudgements(jmap);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Date function
  const loadDate = useCallback(async (date: string) => {
    if (!date) return;
    loadAbortRef.current?.abort();
    const abort = new AbortController();
    loadAbortRef.current = abort;

    setRows([]);
    setFetchedDate(date);
    setJudgements({});
    setLoadingDate(true);
    setErrorMsg(null);
    try {
      const [res, judgeList] = await Promise.all([
        riskApi.getRealtime(date),
        riskApi.listJudgements(date),
      ]);
      if (abort.signal.aborted) return;
      setRows(res.rows ?? []);
      const jmap: Record<string, number> = {};
      for (const j of judgeList) jmap[j.branchId] = j.score;
      setJudgements(jmap);
    } catch (e: unknown) {
      if (abort.signal.aborted) return;
      setErrorMsg(getApiErrorMessage(e));
    } finally {
      if (!abort.signal.aborted) setLoadingDate(false);
    }
  }, []);

  // Lock / Unlock Date
  const toggleLock = useCallback(async () => {
    if (!fetchedDate) return;
    setLockingDate(true);
    try {
      if (isLocked) {
        await riskApi.unlockRealtimeDate(fetchedDate);
        setLockedDate(null);
      } else {
        if (lockedDate) await riskApi.unlockRealtimeDate(lockedDate);
        await riskApi.lockRealtimeDate(fetchedDate);
        setLockedDate(fetchedDate);
      }
    } catch (e: unknown) {
      setErrorMsg(getApiErrorMessage(e));
    } finally {
      setLockingDate(false);
    }
  }, [fetchedDate, isLocked, lockedDate]);

  // Handle inline judgement updates
  const handleJudgementChange = useCallback(
    (branchId: string, branchName: string, score: number) => {
      setJudgements((prev) => ({ ...prev, [branchId]: score }));
      if (judgementTimers.current[branchId])
        clearTimeout(judgementTimers.current[branchId]);
      judgementTimers.current[branchId] = setTimeout(() => {
        riskApi
          .upsertJudgement({ branchId, branchName, fetchedDate, score })
          .catch(() => {});
      }, 600);
    },
    [fetchedDate],
  );

  const scoredRows = useMemo(() => toScored(rows, catalog), [rows, catalog]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-rose-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<ClipboardEdit className="w-4 h-4 text-rose-500" />}
        title={t("riskDoAssessCardTitle")}
        rightContent={
          <div className="flex items-center gap-2">
            {/* Date Picker + Refresh */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const d = e.target.value;
                  setSelectedDate(d);
                  if (d) loadDate(d);
                }}
                disabled={loadingDate}
                className="h-7 px-2 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium disabled:opacity-40 outline-none cursor-pointer"
              />
              <button
                onClick={() => selectedDate && loadDate(selectedDate)}
                disabled={loadingDate || !selectedDate}
                title="Дахин татах"
                className="flex items-center justify-center w-7 h-7 rounded-md bg-rose-600 hover:bg-rose-500 text-foreground disabled:opacity-40 transition-all"
              >
                {loadingDate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Lock / Unlock */}
            {hasData && (
              <button
                onClick={toggleLock}
                disabled={lockingDate}
                title={
                  isLocked
                    ? `${fetchedDate} lock хасах`
                    : `${fetchedDate} lock хийх`
                }
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-semibold transition-all disabled:opacity-40 ${
                  isLocked
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {lockingDate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isLocked ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <LockOpen className="w-3.5 h-3.5" />
                )}
                {isLocked ? "Locked" : "Lock"}
              </button>
            )}

            {/* Prominent Save Completed Report Button */}
            {hasData && isLocked && (
              <button
                onClick={() =>
                  saveModalOpenHandler({
                    pDate: fetchedDate,
                    pDateBeg: "",
                  })
                }
                className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-amber-600 hover:bg-amber-500 text-foreground text-xs font-semibold transition-all"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Тайлан Хадгалах
              </button>
            )}
          </div>
        }
      />
      <div className="container mx-auto px-4 py-6 space-y-4 flex-1 max-w-[1800px]">
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

        {loading || (loadingDate && !hasData) ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              {loadingDate && fetchedDate
                ? `${fetchedDate} татаж байна…`
                : t("loading")}
            </p>
          </div>
        ) : !hasData ? (
          <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-16 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              {fetchedDate
                ? `${fetchedDate} өдрийн өгөгдөл байхгүй байна`
                : "Огноо оруулж татна уу"}
            </div>
            {!fetchedDate && (
              <div className="text-xs text-muted-foreground/60 mt-1">
                Дээрх огноо талбарт өдрөө сонгоно уу
              </div>
            )}
          </div>
        ) : (
          <ReportView
            scoredRows={scoredRows}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            pDate={fetchedDate}
            initialManualMap={manualMap}
            saveIndicatorFn={handleJudgementChange}
            hideComparison={true}
          />
        )}
      </div>
    </div>
  );
}

export default function RiskHyanaltPage() {
  const { t } = useLanguage();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveModalMeta, setSaveModalMeta] = useState({
    pDate: "",
    pDateBeg: "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const doSaveHistory = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await riskApi.saveHistoryFromRealtime(saveModalMeta.pDate, name);
      setSaveModalOpen(false);
      setSaveName("");
      // Success alert or router redirect if desired
      alert(
        "Тайлан амжилттай хадгалагдлаа! Тайлангууд хуудаснаас үзэх боломжтой.",
      );
    } catch (e: unknown) {
      setErrorMsg(getApiErrorMessage(e) || t("riskSaveError"));
    } finally {
      setSaving(false);
    }
  }, [saveName, saveModalMeta, t]);

  return (
    <>
      <MonitorContent
        saveModalOpenHandler={(meta) => {
          setSaveModalMeta(meta);
          setSaveName(meta.pDate);
          setSaveModalOpen(true);
        }}
      />

      {/* Save modal */}
      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSaveModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <BookmarkPlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  Эрсдэлийн тайланг хадгалах
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Сонгосон огноо: {saveModalMeta.pDate}
                </p>
              </div>
            </div>
            {errorMsg && (
              <div className="mb-3 text-xs text-red-500 border border-red-500/20 bg-red-500/10 p-2 rounded-lg">
                {errorMsg}
              </div>
            )}
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSaveHistory()}
              placeholder={t("riskSavePlaceholder")}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/40 transition-colors"
              >
                Болих
              </button>
              <button
                onClick={doSaveHistory}
                disabled={saving || !saveName.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-foreground text-xs font-semibold disabled:opacity-40 transition-all"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
