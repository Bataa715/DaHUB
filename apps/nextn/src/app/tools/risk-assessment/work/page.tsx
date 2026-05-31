"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { riskApi, getApiErrorMessage, type RiskHistoryEntry, type RiskCurrentRow } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  BookmarkPlus,
  MoreHorizontal,
  Trash2,
  Check,
  Eye,
  X,
  Activity,
  ClipboardEdit,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { computeScore, getGroup, type RiskLevel, type ScoreResult, type ScoreGroup } from "../scoring-rules";
import ReportView from "../report-view";

type ScoredRow = RiskCurrentRow & {
  __score: ScoreResult;
  __scoreLabel: string | null;
  __group: ScoreGroup | null;
};

function toScored(rows: RiskCurrentRow[]): ScoredRow[] {
  return rows
    .filter((r) => r.rowType === "oracle")
    .map((r) => {
      const sr = computeScore(r.SUBID, r.RESULT, r.RESULT_TYPE);
      return {
        ...r,
        __score: sr.score,
        __scoreLabel: sr.label,
        __group: getGroup(r.SUBID),
      };
    });
}

// ── Хянах (realtime monitoring) ───────────────────────────────────────────────
function MonitorContent({
  historyList,
  saveModalOpenHandler,
  openDeleteConfirm,
}: {
  historyList: RiskHistoryEntry[];
  saveModalOpenHandler: (meta: { pDate: string; pDateBeg: string }) => void;
  openDeleteConfirm: (id: string) => void;
}) {
  const { t } = useLanguage();

  const [rows, setRows] = useState<RiskCurrentRow[]>([]);
  const [fetchedDate, setFetchedDate] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDate, setLoadingDate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<
    RiskCurrentRow[]
  >([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");

  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [viewHistoryRows, setViewHistoryRows] = useState<RiskCurrentRow[]>([]);
  const [viewHistoryLoading, setViewHistoryLoading] = useState(false);
  const [historyViewRiskFilter, setHistoryViewRiskFilter] = useState<
    "all" | RiskLevel
  >("all");

  const hasData = rows.some((r) => r.rowType === "oracle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, dates] = await Promise.all([
          riskApi.getCurrent(),
          riskApi.listRealtimeDates(),
        ]);
        if (cancelled) return;
        setRows(res.rows);
        setFetchedDate(res.pDate || "");
        setSelectedDate(res.pDate || dates[0] || "");
        setAvailableDates(dates);
      } catch {
        /* чимээгүй */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDate = useCallback(
    async (date: string) => {
      if (!date) return;
      setLoadingDate(true);
      setErrorMsg(null);
      try {
        await riskApi.loadRealtimeToCurrent(date);
        const cur = await riskApi.getCurrent();
        if (!cur.rows || cur.rows.length === 0) {
          const hint =
            availableDates.length > 0
              ? ` Боломжтой огнооны жагсаалт: ${availableDates.join(", ")}`
              : "";
          setErrorMsg(`"${date}" огноонд өгөгдөл олдсонгүй.${hint}`);
        } else {
          setRows(cur.rows);
          setFetchedDate(cur.pDate || "");
          setSelectedDate(cur.pDate || date);
        }
      } catch (e: unknown) {
        setErrorMsg(getApiErrorMessage(e));
      } finally {
        setLoadingDate(false);
      }
    },
    [availableDates],
  );

  const selectHistory = useCallback(
    async (id: string) => {
      if (id === selectedHistoryId) {
        setSelectedHistoryId(null);
        setSelectedHistoryRows([]);
        return;
      }
      setLoadingHistory(true);
      try {
        const data = await riskApi.getHistory(id);
        setSelectedHistoryId(id);
        setSelectedHistoryRows(data.rows);
        setMenuOpen(false);
      } catch (e: unknown) {
        setErrorMsg(getApiErrorMessage(e));
      } finally {
        setLoadingHistory(false);
      }
    },
    [selectedHistoryId],
  );

  const openHistoryView = useCallback(
    async (id: string) => {
      if (id === viewHistoryId) {
        setViewHistoryId(null);
        setViewHistoryRows([]);
        return;
      }
      setViewHistoryLoading(true);
      setMenuOpen(false);
      try {
        const data = await riskApi.getHistory(id);
        setViewHistoryId(id);
        setViewHistoryRows(data.rows);
        setHistoryViewRiskFilter("all");
      } catch (e: unknown) {
        setErrorMsg(getApiErrorMessage(e));
      } finally {
        setViewHistoryLoading(false);
      }
    },
    [viewHistoryId],
  );

  useEffect(() => {
    if (
      selectedHistoryId &&
      !historyList.some((h) => h.id === selectedHistoryId)
    ) {
      setSelectedHistoryId(null);
      setSelectedHistoryRows([]);
    }
    if (viewHistoryId && !historyList.some((h) => h.id === viewHistoryId)) {
      setViewHistoryId(null);
      setViewHistoryRows([]);
    }
  }, [historyList, selectedHistoryId, viewHistoryId]);

  const scoredRows = useMemo(() => toScored(rows), [rows]);
  const previousScoredRows = useMemo(
    () => toScored(selectedHistoryRows),
    [selectedHistoryRows],
  );
  const selectedEntry = historyList.find((h) => h.id === selectedHistoryId);
  const viewHistoryScoredRows = useMemo(
    () => toScored(viewHistoryRows),
    [viewHistoryRows],
  );
  const viewHistoryEntry = historyList.find((h) => h.id === viewHistoryId);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <section className="rounded-xl border border-rose-500/20 bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/60 bg-gradient-to-r from-rose-500/5 to-transparent flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-xs font-semibold">Огноо сонгох</span>
          <span className="text-[11px] text-muted-foreground hidden sm:block">
            — реалтайм датаг current руу оруулна
          </span>
        </div>
        <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <input
              type="date"
              list="realtime-dates-list"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && selectedDate) loadDate(selectedDate);
              }}
              disabled={loadingDate}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-rose-500/40"
            />
            {availableDates.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60 leading-none">
                Боломжтой: {availableDates.join(", ")}
              </span>
            )}
          </div>
          <datalist id="realtime-dates-list">
            {availableDates.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <button
            onClick={() => loadDate(selectedDate)}
            disabled={loadingDate || !selectedDate}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-foreground text-xs font-semibold disabled:opacity-40 transition-all"
          >
            {loadingDate ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Татах
          </button>
          <div className="flex-1" />
          {menuOpen && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
          )}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`p-1.5 rounded-md border transition-all ${
                selectedHistoryId || menuOpen
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {loadingHistory ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MoreHorizontal className="w-4 h-4" />
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                {hasData && (
                  <button
                    onClick={() => {
                      saveModalOpenHandler({
                        pDate: fetchedDate,
                        pDateBeg: "",
                      });
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs hover:bg-amber-500/10 border-b border-border/50 transition-colors"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="font-medium">{t("riskSaveQuarter")}</span>
                  </button>
                )}
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("riskSavedQuarters")}
                  </p>
                </div>
                {historyList.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs text-muted-foreground">
                    {t("riskNoSaved")}
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {selectedHistoryId && (
                      <button
                        onClick={() => {
                          setSelectedHistoryId(null);
                          setSelectedHistoryRows([]);
                          setMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-muted/40 text-muted-foreground flex items-center gap-2 border-b border-border/50"
                      >
                        {t("riskStopCompare")}
                      </button>
                    )}
                    {historyList.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center hover:bg-muted/40 border-b border-border/30 last:border-0"
                      >
                        <button
                          onClick={() => {
                            selectHistory(h.id);
                            setMenuOpen(false);
                          }}
                          className="flex-1 px-3 py-2.5 text-left"
                        >
                          <div className="flex items-center gap-2">
                            {selectedHistoryId === h.id && (
                              <Check className="w-3 h-3 text-violet-500 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">
                                {h.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {h.pDateBeg} → {h.pDate} · {h.branchCount}{" "}
                                салбар
                                {h.createdByName ? ` · ${h.createdByName}` : ""}
                              </div>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => openHistoryView(h.id)}
                          className={`p-2 transition-colors flex-shrink-0 ${viewHistoryId === h.id ? "text-blue-500" : "text-muted-foreground/40 hover:text-blue-500"}`}
                        >
                          {!(viewHistoryLoading && viewHistoryId !== h.id) && (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(h.id)}
                          className="p-2 text-muted-foreground/40 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

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

      {viewHistoryId && viewHistoryEntry ? (
        <>
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 flex items-center gap-3">
            <Eye className="w-4 h-4 text-blue-500" />
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
          <ReportView
            scoredRows={viewHistoryScoredRows}
            riskFilter={historyViewRiskFilter}
            setRiskFilter={setHistoryViewRiskFilter}
            readOnly
          />
        </>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      ) : !hasData ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-16 text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
            <Activity className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <div className="text-sm font-semibold">
            Realtime өгөгдөл байхгүй байна
          </div>
          <div className="text-xs mt-1.5 text-muted-foreground max-w-md mx-auto leading-relaxed">
            Oracle процедур ажиллаад risk_realtime хүснэгтэд өгөгдөл оруулсны
            дараа «Шинэчлэх» дарна уу.
          </div>
        </div>
      ) : (
        <ReportView
          scoredRows={scoredRows}
          riskFilter={riskFilter}
          setRiskFilter={setRiskFilter}
          previousScoredRows={previousScoredRows}
          previousHistoryName={selectedEntry?.name ?? null}
          previousFetchedAt={selectedEntry?.oracleFetchedAt ?? null}
          pDate={fetchedDate}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RiskHyanaltPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveModalMeta, setSaveModalMeta] = useState({
    pDate: "",
    pDateBeg: "",
  });

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    riskApi
      .listHistory()
      .then(setHistoryList)
      .catch(() => { /* intentional: history panel stays empty on failure */ });
  }, []);

  const doSaveHistory = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const entry = await riskApi.saveHistory(name);
      setHistoryList((prev) => [entry, ...prev]);
      setSaveModalOpen(false);
      setSaveName("");
    } catch (e: unknown) {
      setErrorMsg(
        getApiErrorMessage(e) || t("riskSaveError"),
      );
    } finally {
      setSaving(false);
    }
  }, [saveName, t]);

  const openDeleteConfirm = useCallback((id: string) => {
    setDeleteTargetId(id);
    setDeletePassword("");
    setDeletePasswordError("");
    setDeleteModalOpen(true);
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
    } catch (e: unknown) {
      setErrorMsg(
        getApiErrorMessage(e) || t("riskDeleteError"),
      );
    }
    setDeleteTargetId(null);
    setDeletePassword("");
  }, [deletePassword, deleteTargetId, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-rose-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<ClipboardEdit className="w-4 h-4 text-rose-500" />}
        title={t("riskDoAssessCardTitle")}
        subtitle={t("riskBranchSubtitle")}
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

        <MonitorContent
          historyList={historyList}
          saveModalOpenHandler={(meta) => {
            setSaveModalMeta(meta);
            setSaveName(meta.pDate);
            setSaveModalOpen(true);
          }}
          openDeleteConfirm={openDeleteConfirm}
        />
      </div>

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
                  {t("riskSaveQuarter")}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {saveModalMeta.pDateBeg} → {saveModalMeta.pDate}
                </p>
              </div>
            </div>
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

      {/* Delete modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6"
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
