"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { riskApi } from "@/lib/api";
import {
  Loader2,
  ShieldAlert,
  ArrowLeft,
  AlertTriangle,
  Database,
  RefreshCw,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { computeScore, getGroup, type RiskLevel } from "../scoring-rules";
import ReportView from "../report-view";

type RiskRow = Awaited<ReturnType<typeof riskApi.branchRiskass>>["rows"][number];

type ScoredRow = RiskRow & {
  __score: any;
  __scoreLabel: string | null;
  __group: any;
};

export default function RiskAssessmentReportPage() {
  const router = useRouter();

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [pDate, setPDate] = useState("");
  const [pDateBeg, setPDateBeg] = useState("");

  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");

  // Mount хийх үед ClickHouse кэшийг ачаалах
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await riskApi.branchRiskassLast();
        if (cancelled || !cached) return;
        setRows(cached.rows as RiskRow[]);
        setPDate(cached.pDate);
        setPDateBeg(cached.pDateBeg);
        setCachedAt(cached.fetchedAt);
        setHasFetched(true);
      } catch {
        // кэш байхгүй бол чимээгүй өнгөрнө
      } finally {
        if (!cancelled) setCacheLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const datesValid =
    /^\d{4}-\d{2}-\d{2}$/.test(pDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(pDateBeg) &&
    pDateBeg <= pDate;

  // Oracle-аас шинээр татах
  const loadAll = useCallback(async () => {
    if (!datesValid) {
      setErrorMsg("Эхлэх болон дуусах огноог зөв оруулна уу (YYYY-MM-DD, эхлэх ≤ дуусах).");
      return;
    }
    setRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await riskApi.branchRiskass({ pDate, pDateBeg });
      setRows(res.rows);
      setHasFetched(true);
      setCachedAt(new Date().toISOString());
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message ?? e.message ?? "Алдаа");
    } finally {
      setRefreshing(false);
    }
  }, [pDate, pDateBeg, datesValid]);

  const scoredRows: ScoredRow[] = useMemo(() => {
    return rows.map((r) => {
      const sr = computeScore(r.SUBID as any, r.RESULT, r.RESULT_TYPE);
      return {
        ...r,
        __score: sr.score,
        __scoreLabel: sr.label,
        __group: getGroup(r.SUBID as any),
      };
    });
  }, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-rose-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools/risk-assessment"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title="Эрсдэлийн үнэлгээ — Тайлан"
        subtitle="Эрсдэлийн тайлан харах, хадгалах, харьцуулах"
      />

      <div className="container mx-auto px-4 py-6 space-y-5 flex-1 max-w-[1800px]">
        {/* Back */}
        <button
          onClick={() => router.push("/tools/risk-assessment")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Үндсэн хуудас руу буцах
        </button>

        {/* ── Огноо + Татах toolbar ── */}
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground hidden sm:inline">
              Хугацааны муж:
            </span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-muted-foreground whitespace-nowrap">Эхлэх</label>
                <input
                  type="date"
                  value={pDateBeg}
                  max={pDate}
                  onChange={(e) => setPDateBeg(e.target.value)}
                  className="px-2 py-1 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/60 transition-all"
                />
              </div>
              <span className="text-muted-foreground/40 text-xs">→</span>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-muted-foreground whitespace-nowrap">Дуусах</label>
                <input
                  type="date"
                  value={pDate}
                  min={pDateBeg}
                  onChange={(e) => setPDate(e.target.value)}
                  className="px-2 py-1 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/60 transition-all"
                />
              </div>
            </div>
            <button
              onClick={loadAll}
              disabled={refreshing || !datesValid}
              className="group flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title={datesValid ? "Oracle-аас татах" : "Огноог зөв оруулна уу"}
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
              )}
              {hasFetched ? "Дахин татах" : "Татах"}
            </button>
            {(cacheLoading || cachedAt) && (
              <div className="flex items-center gap-2 text-[10px] border-l border-border/50 pl-2 ml-1">
                {cacheLoading && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Сэргээж байна…
                  </span>
                )}
                {cachedAt && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                      <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                    {new Date(cachedAt).toLocaleString("mn-MN")}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Алдааны banner */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-rose-500/5 p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <div className="font-semibold text-sm text-red-600">Алдаа гарлаа</div>
              <div className="text-xs mt-1 text-red-600/80 leading-relaxed">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* ReportView эсвэл хоосон байдал */}
        {cacheLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <p className="text-sm text-muted-foreground">Кэш ачаалж байна…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-16 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
              <Database className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div className="text-sm font-semibold text-foreground">Татах өгөгдөл байхгүй</div>
            <div className="text-xs mt-1.5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Дээрх хэсгээс эхлэх ба дуусах огноогоо сонгоод{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">«Татах»</span>{" "}
              товчийг дарж Oracle-аас үнэлгээг ачаалаарай.
            </div>
          </div>
        ) : (
          <ReportView
            scoredRows={scoredRows}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
          />
        )}


      </div>
    </div>
  );
}
