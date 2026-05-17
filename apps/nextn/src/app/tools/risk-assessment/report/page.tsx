"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { riskApi, type RiskHistoryEntry, type RiskCurrentRow } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  ShieldAlert,
  ArrowLeft,
  AlertTriangle,
  Database,
  RefreshCw,
  BookmarkPlus,
  MoreHorizontal,
  Trash2,
  Check,
  Eye,
  X,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { computeScore, getGroup, type RiskLevel } from "../scoring-rules";
import ReportView from "../report-view";

type ScoredRow = RiskCurrentRow & {
  __score: any;
  __scoreLabel: string | null;
  __group: any;
};

function toScored(rows: RiskCurrentRow[]): ScoredRow[] {
  return rows
    .filter((r) => r.rowType === "oracle")
    .map((r) => {
      const sr = computeScore(r.SUBID as any, r.RESULT, r.RESULT_TYPE);
      return {
        ...r,
        __score: sr.score,
        __scoreLabel: sr.label,
        __group: getGroup(r.SUBID as any),
      };
    });
}

export default function RiskAssessmentReportPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [rows, setRows] = useState<RiskCurrentRow[]>([]);
  const [oracleFetchedAt, setOracleFetchedAt] = useState<string | null>(null);
  const [pDate, setPDate] = useState("");
  const [pDateBeg, setPDateBeg] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<
    RiskCurrentRow[]
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");

  // Хадгалсан тайлан бүтнээр харах
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [viewHistoryRows, setViewHistoryRows] = useState<RiskCurrentRow[]>([]);
  const [viewHistoryLoading, setViewHistoryLoading] = useState(false);
  const [historyViewRiskFilter, setHistoryViewRiskFilter] = useState<"all" | RiskLevel>("all");

  // Устгах нууц үг modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");

  const datesValid =
    /^\d{4}-\d{2}-\d{2}$/.test(pDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(pDateBeg) &&
    pDateBeg <= pDate;

  const hasFetched = rows.some((r) => r.rowType === "oracle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cur, hist] = await Promise.all([
          riskApi.getCurrent(),
          riskApi.listHistory(),
        ]);
        if (cancelled) return;
        setRows(cur.rows);
        setOracleFetchedAt(cur.oracleFetchedAt);
        setPDate(cur.pDate || "");
        setPDateBeg(cur.pDateBeg || "");
        setHistoryList(hist);
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

  const loadAll = useCallback(async () => {
    if (!datesValid) {
      setErrorMsg(t("riskDateError"));
      return;
    }
    setRefreshing(true);
    setErrorMsg(null);
    try {
      await riskApi.branchRiskass({ pDate, pDateBeg });
      const cur = await riskApi.getCurrent();
      setRows(cur.rows);
      setOracleFetchedAt(cur.oracleFetchedAt);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message ?? e.message ?? "Алдаа");
    } finally {
      setRefreshing(false);
    }
  }, [pDate, pDateBeg, datesValid]);

  const doSaveHistory = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const entry = await riskApi.saveHistory(name);
      setHistoryList((prev) => [entry, ...prev]);
      setSaveModalOpen(false);
      setSaveName("");
    } catch (e: any) {
      setErrorMsg(
        e?.response?.data?.message ?? e.message ?? t("riskSaveError"),
      );
    } finally {
      setSaving(false);
    }
  }, [saveName, t]);

  const selectHistory = useCallback(
    async (id: string) => {
      if (id === selectedHistoryId) {
        setSelectedHistoryId(null);
        setSelectedHistoryRows([]);
        setHistoryOpen(false);
        return;
      }
      setLoadingHistory(true);
      try {
        const data = await riskApi.getHistory(id);
        setSelectedHistoryId(id);
        setSelectedHistoryRows(data.rows);
        setHistoryOpen(false);
      } catch (e: any) {
        setErrorMsg(e?.response?.data?.message ?? e.message ?? "Алдаа");
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
      } catch (e: any) {
        setErrorMsg(e?.response?.data?.message ?? e.message ?? "Алдаа");
      } finally {
        setViewHistoryLoading(false);
      }
    },
    [viewHistoryId],
  );

  const deleteHistory = useCallback(
    async (id: string) => {
      try {
        await riskApi.deleteHistory(id);
        setHistoryList((prev) => prev.filter((h) => h.id !== id));
        if (selectedHistoryId === id) {
          setSelectedHistoryId(null);
          setSelectedHistoryRows([]);
        }
        if (viewHistoryId === id) {
          setViewHistoryId(null);
          setViewHistoryRows([]);
        }
      } catch (e: any) {
        setErrorMsg(
          e?.response?.data?.message ?? e.message ?? t("riskDeleteError"),
        );
      }
    },
    [selectedHistoryId, viewHistoryId],
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
    await deleteHistory(deleteTargetId);
    setDeleteTargetId(null);
    setDeletePassword("");
  }, [deletePassword, deleteTargetId, deleteHistory]);

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-rose-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title={t("riskReportTitle")}
        subtitle={t("riskReportSubtitle")}
      />

      <div className="container mx-auto px-4 py-6 space-y-4 flex-1 max-w-[1800px]">
        <button
          onClick={() => router.push("/tools/risk-assessment")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("backToMain")}
        </button>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-muted-foreground">
                {t("riskDateFrom")}
              </label>
              <input
                type="date"
                value={pDateBeg}
                max={pDate}
                onChange={(e) => setPDateBeg(e.target.value)}
                className="px-2 py-1 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <span className="text-muted-foreground/40 text-xs">→</span>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-muted-foreground">
                {t("riskDateTo")}
              </label>
              <input
                type="date"
                value={pDate}
                min={pDateBeg}
                onChange={(e) => setPDate(e.target.value)}
                className="px-2 py-1 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button
              onClick={loadAll}
              disabled={refreshing || !datesValid}
              className="group flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 transition-all"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
              )}
              {hasFetched ? t("riskRefetch") : t("riskFetch")}
            </button>

            <div className="flex-1" />

            {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
            {/* 3-dot click menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`p-1.5 rounded-md border transition-all text-xs ${
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
                  {/* Save action */}
                  {hasFetched && (
                    <button
                      onClick={() => {
                        setSaveModalOpen(true);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs hover:bg-amber-500/10 border-b border-border/50 transition-colors"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="font-medium">
                        {t("riskSaveQuarter")}
                      </span>
                    </button>
                  )}

                  {/* History section */}
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
                                  {h.createdByName
                                    ? ` · ${h.createdByName}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => openHistoryView(h.id)}
                            title="Бүтнээр харах"
                            className={`p-2 transition-colors flex-shrink-0 ${
                              viewHistoryId === h.id
                                ? "text-blue-500"
                                : "text-muted-foreground/40 hover:text-blue-500"
                            }`}
                          >
                            {viewHistoryLoading && viewHistoryId !== h.id ? null : (
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

            {oracleFetchedAt && (
              <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </span>
                {new Date(oracleFetchedAt).toLocaleString("mn-MN")}
              </span>
            )}
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-rose-500/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-red-600">Алдаа</div>
              <div className="text-xs mt-1 text-red-600/80">{errorMsg}</div>
            </div>
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
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                <Eye className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{viewHistoryEntry.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {viewHistoryEntry.pDateBeg} → {viewHistoryEntry.pDate} · {viewHistoryEntry.branchCount} салбар
                </div>
              </div>
              <button
                onClick={() => {
                  setViewHistoryId(null);
                  setViewHistoryRows([]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/40 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                Хаах
              </button>
            </div>
            <ReportView
              scoredRows={viewHistoryScoredRows}
              riskFilter={historyViewRiskFilter}
              setRiskFilter={setHistoryViewRiskFilter}
            />
          </>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        ) : !hasFetched ? (
          <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-16 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
              <Database className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div className="text-sm font-semibold">{t("riskNoOracleData")}</div>
            <div className="text-xs mt-1.5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              {t("riskNoOracleHint")}
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
          />
        )}
      </div>

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
                  {pDateBeg} → {pDate} · Oracle + гарын үзүүлэлтүүд
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
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-40 transition-all"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Устгах нууц үг modal */}
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
                <p className="text-[11px] text-muted-foreground mt-0.5">Үргэлжлүүлэхийн түлд нууц үг оруулна уу</p>
              </div>
            </div>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && doDeleteHistory()}
              placeholder="Нууц үг"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
            {deletePasswordError && (
              <p className="text-xs text-red-500 mt-1.5">{deletePasswordError}</p>
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
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all"
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
