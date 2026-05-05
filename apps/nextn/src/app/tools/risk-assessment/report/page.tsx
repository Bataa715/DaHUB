"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { riskApi, type RiskHistoryEntry, type RiskCurrentRow } from "@/lib/api";
import {
  Loader2,
  ShieldAlert,
  ArrowLeft,
  AlertTriangle,
  Database,
  RefreshCw,
  BookmarkPlus,
  ChevronDown,
  Trash2,
  Check,
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
      return { ...r, __score: sr.score, __scoreLabel: sr.label, __group: getGroup(r.SUBID as any) };
    });
}

export default function RiskAssessmentReportPage() {
  const router = useRouter();

  const [rows, setRows] = useState<RiskCurrentRow[]>([]);
  const [oracleFetchedAt, setOracleFetchedAt] = useState<string | null>(null);
  const [pDate, setPDate] = useState("");
  const [pDateBeg, setPDateBeg] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<RiskHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<RiskCurrentRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");

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
    return () => { cancelled = true; };
  }, []);

  const loadAll = useCallback(async () => {
    if (!datesValid) {
      setErrorMsg("Эхлэх болон дуусах огноог зөв оруулна уу.");
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
      setErrorMsg(e?.response?.data?.message ?? e.message ?? "Хадгалахад алдаа");
    } finally {
      setSaving(false);
    }
  }, [saveName]);

  const selectHistory = useCallback(async (id: string) => {
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
  }, [selectedHistoryId]);

  const deleteHistory = useCallback(async (id: string) => {
    try {
      await riskApi.deleteHistory(id);
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
      if (selectedHistoryId === id) {
        setSelectedHistoryId(null);
        setSelectedHistoryRows([]);
      }
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message ?? e.message ?? "Устгахад алдаа");
    }
  }, [selectedHistoryId]);

  const scoredRows = useMemo(() => toScored(rows), [rows]);
  const previousScoredRows = useMemo(() => toScored(selectedHistoryRows), [selectedHistoryRows]);
  const selectedEntry = historyList.find((h) => h.id === selectedHistoryId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-rose-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title="Эрсдэлийн үнэлгээ — Тайлан"
        subtitle="Эрсдэлийн тайлан харах, хадгалах, харьцуулах"
      />

      <div className="container mx-auto px-4 py-6 space-y-4 flex-1 max-w-[1800px]">
        <button
          onClick={() => router.push("/tools/risk-assessment")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Үндсэн хуудас руу буцах
        </button>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-muted-foreground">Эхлэх</label>
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
              <label className="text-[10px] text-muted-foreground">Дуусах</label>
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
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />}
              {hasFetched ? "Дахин татах" : "Татах"}
            </button>

            <div className="flex-1" />

            {hasFetched && (
              <button
                onClick={() => setSaveModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold transition-all"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Өмнөх улирал болгон хадгалах
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-all ${
                  selectedHistoryId
                    ? "border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-400"
                    : "border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                {loadingHistory && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {selectedEntry ? selectedEntry.name : "Өмнөх улирал сонгох"}
                <ChevronDown className={`w-3 h-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>

              {historyOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
                  onMouseLeave={() => setHistoryOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-border bg-muted/30">
                    <p className="text-[11px] font-semibold text-muted-foreground">Хадгалсан улирлын үнэлгээнүүд</p>
                  </div>
                  {historyList.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">Хадгалсан үнэлгээ байхгүй</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {selectedHistoryId && (
                        <button
                          onClick={() => { setSelectedHistoryId(null); setSelectedHistoryRows([]); setHistoryOpen(false); }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-muted/40 text-muted-foreground flex items-center gap-2 border-b border-border/50"
                        >
                          Харьцуулалт болиулах
                        </button>
                      )}
                      {historyList.map((h) => (
                        <div key={h.id} className="flex items-center hover:bg-muted/40 border-b border-border/30 last:border-0">
                          <button onClick={() => selectHistory(h.id)} className="flex-1 px-3 py-2.5 text-left">
                            <div className="flex items-center gap-2">
                              {selectedHistoryId === h.id && <Check className="w-3 h-3 text-violet-500 flex-shrink-0" />}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate">{h.name}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {h.pDateBeg} → {h.pDate} · {h.branchCount} салбар{h.createdByName ? ` · ${h.createdByName}` : ""}
                                </div>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => deleteHistory(h.id)}
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
            <button onClick={() => setErrorMsg(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <p className="text-sm text-muted-foreground">Ачаалж байна…</p>
          </div>
        ) : !hasFetched ? (
          <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-16 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
              <Database className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div className="text-sm font-semibold">Oracle өгөгдөл байхгүй</div>
            <div className="text-xs mt-1.5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Огноогоо сонгоод <span className="font-semibold text-blue-600">«Татах»</span> товчийг дарж Oracle-аас ачаалаарай.
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
                <h3 className="text-sm font-semibold">Өмнөх улирал болгон хадгалах</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{pDateBeg} → {pDate} · Oracle + гарын үзүүлэлтүүд</p>
              </div>
            </div>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSaveHistory()}
              placeholder="Жишээ: 2025 Q4 Улирал"
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
    </div>
  );
}
