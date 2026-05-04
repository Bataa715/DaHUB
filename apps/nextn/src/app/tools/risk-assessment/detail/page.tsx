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
  Search,
  Download,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeScore,
  getGroup,
  scoreColorClass,
  scoreDisplay,
  type ScoreGroup,
} from "../scoring-rules";

// ── types ──────────────────────────────────────────────────────────────────
type RiskRow = Awaited<ReturnType<typeof riskApi.branchRiskass>>["rows"][number];

type ScoredRow = RiskRow & {
  __score: any;
  __scoreLabel: string | null;
  __group: any;
};

const GROUP_OPTIONS: { key: "all" | ScoreGroup; label: string; cls: string }[] = [
  { key: "all", label: "Бүгд", cls: "text-foreground" },
  { key: "Score 1", label: "Score 1", cls: "text-rose-600" },
  { key: "Score 2", label: "Score 2", cls: "text-amber-600" },
  { key: "Score 3", label: "Score 3", cls: "text-blue-600" },
];

// ── page ───────────────────────────────────────────────────────────────────
export default function RiskAssessmentDetailPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [failed, setFailed] = useState<{ branchId: number; error: string }[]>([]);
  const [branchCount, setBranchCount] = useState(0);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [pDate, setPDate] = useState("");
  const [pDateBeg, setPDateBeg] = useState("");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | ScoreGroup>("all");

  // Mount хийх үед ClickHouse кэшийг ачаалах
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await riskApi.branchRiskassLast();
        if (cancelled || !cached) return;
        setRows(cached.rows as RiskRow[]);
        setFailed(cached.failed);
        setBranchCount(cached.branchCount);
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
      setFailed(res.failed);
      setBranchCount(res.branchCount);
      setHasFetched(true);
      setCachedAt(new Date().toISOString());
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message ?? e.message ?? "Алдаа");
      setRows([]);
      setFailed([]);
    } finally {
      setRefreshing(false);
    }
  }, [pDate, pDateBeg, datesValid]);

  const scoredRows: ScoredRow[] = useMemo(() => {
    return rows.map((r) => {
      const sr = computeScore(r.SUBID as any, r.RESULT, r.RESULT_TYPE);
      return { ...r, __score: sr.score, __scoreLabel: sr.label, __group: getGroup(r.SUBID as any) };
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoredRows.filter((r) => {
      if (groupFilter !== "all" && r.__group !== groupFilter) return false;
      if (!q) return true;
      return [r.SOLID, r.BRANCHNAME, r.BRANCHID, r.PARENTBRANCH, r.RESULT, r.DESCRIPTION_TEXT, r.ID, r.SUBID, r.OPERATION_TYPE, r.__score]
        .map((v) => String(v ?? "").toLowerCase())
        .some((s) => s.includes(q));
    });
  }, [scoredRows, search, groupFilter]);

  const downloadCsv = useCallback(() => {
    const cols = ["SOLID","BRANCHNAME","BRANCHID","PARENTBRANCH","RESULT","RESULT_TYPE","DESCRIPTION_TEXT","P_DATEBEG","P_DATE","ID","SUBID","OPERATION_TYPE","SCORE_GROUP","SCORE","SCORE_LABEL"] as const;
    const escape = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.join(","), ...filteredRows.map((r) => cols.map((c) => {
      if (c === "SCORE_GROUP") return escape(r.__group ?? "");
      if (c === "SCORE") return escape(r.__score ?? "");
      if (c === "SCORE_LABEL") return escape(r.__scoreLabel ?? "");
      return escape((r as any)[c]);
    }).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-riskass-${pDateBeg}_${pDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, pDate, pDateBeg]);

  const grouped = useMemo(() => {
    const m = new Map<string, { branchId: string; branchName: string; solid: string; rows: ScoredRow[] }>();
    for (const r of filteredRows) {
      const key = String(r.BRANCHID ?? r.SOLID ?? "");
      if (!m.has(key)) m.set(key, { branchId: String(r.BRANCHID ?? ""), branchName: String(r.BRANCHNAME ?? ""), solid: String(r.SOLID ?? ""), rows: [] });
      m.get(key)!.rows.push(r);
    }
    return Array.from(m.values()).sort((a, b) => a.branchName.localeCompare(b.branchName, "mn"));
  }, [filteredRows]);

  const toggle = (k: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title="Үнэлгээний дэлгэрэнгүй"
        subtitle="RISKASSESSMENT.BranchRiskass — мөр бүрийн дэлгэрэнгүй"
      />
      <div className="container mx-auto px-4 py-6 space-y-5 flex-1 max-w-[1600px]">

        {/* Буцах + огноо + татах */}
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/tools/risk-assessment")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Буцах
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <Database className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground hidden sm:inline">Хугацааны муж:</span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-muted-foreground whitespace-nowrap">Эхлэх</label>
                <input type="date" value={pDateBeg} max={pDate} onChange={(e) => setPDateBeg(e.target.value)}
                  className="px-2 py-1 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/60 transition-all" />
              </div>
              <span className="text-muted-foreground/40 text-xs">→</span>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-muted-foreground whitespace-nowrap">Дуусах</label>
                <input type="date" value={pDate} min={pDateBeg} onChange={(e) => setPDate(e.target.value)}
                  className="px-2 py-1 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/60 transition-all" />
              </div>
            </div>
            <button onClick={() => loadAll()} disabled={refreshing || !datesValid}
              className="group flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title={datesValid ? "Oracle-аас татах" : "Огноог зөв оруулна уу"}>
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />}
              {hasFetched ? "Дахин татах" : "Татах"}
            </button>
            {(cacheLoading || cachedAt) && (
              <div className="flex items-center gap-2 text-[10px] border-l border-border/50 pl-2 ml-1">
                {cacheLoading && <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Сэргээж байна…</span>}
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
              <div className="font-semibold text-sm text-red-600">Oracle-аас татахад алдаа гарлаа</div>
              <div className="text-xs mt-1 text-red-600/80 leading-relaxed">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Алдаа гарсан салбар */}
        {failed.length > 0 && (
          <details className="group rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
            <summary className="cursor-pointer px-4 py-2.5 font-medium text-xs text-amber-700 dark:text-amber-500 flex items-center gap-2 hover:bg-amber-500/10 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Алдаа гарсан салбар</span>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] tabular-nums font-semibold">{failed.length}</span>
            </summary>
            <ul className="px-4 pb-3 space-y-1 text-xs text-muted-foreground border-t border-amber-500/20 pt-2">
              {failed.map((f) => (
                <li key={f.branchId} className="flex gap-2">
                  <span className="text-amber-600">·</span>
                  <b className="text-foreground tabular-nums">{f.branchId}</b>
                  <span>—</span>
                  <span>{f.error}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Үндсэн хүснэгт */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {/* Sticky toolbar */}
          <div className="px-4 sm:px-5 py-3 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <TableIcon className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <span>Үнэлгээний дэлгэрэнгүй</span>
              </h2>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 tabular-nums font-semibold">
                  {viewMode === "grouped" ? `${grouped.length} салбар` : `${filteredRows.length} мөр`}
                </span>
                {search && filteredRows.length !== rows.length && (
                  <span className="text-muted-foreground/70 tabular-nums">/ {rows.length}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Score бүлгийн filter */}
              <div className="hidden lg:flex rounded-lg border border-border overflow-hidden bg-background/60">
                {GROUP_OPTIONS.map((opt) => (
                  <button key={opt.key} onClick={() => setGroupFilter(opt.key)}
                    className={`px-3 py-1.5 text-[11px] font-semibold border-r last:border-r-0 border-border transition-all ${
                      groupFilter === opt.key ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-inner" : `hover:bg-accent/60 ${opt.cls}`
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Хайлт */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Хайх..."
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/60 transition-all" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" title="Цэвэрлэх">×</button>
                )}
              </div>
              {/* View toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden bg-background/60 p-0.5">
                {([
                  { key: "grouped" as const, icon: LayoutGrid, label: "Бүлэг" },
                  { key: "table" as const, icon: TableIcon, label: "Хүснэгт" },
                ]).map(({ key, icon: Icon, label }) => (
                  <button key={key} onClick={() => setViewMode(key)}
                    className={`px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 rounded-md transition-all ${
                      viewMode === key ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "hover:bg-accent/60 text-muted-foreground"
                    }`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              {/* CSV */}
              <button onClick={downloadCsv} disabled={filteredRows.length === 0}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="CSV файл татах">
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-muted/50 border border-border items-center justify-center mb-3">
                <Database className="w-6 h-6 text-muted-foreground/60" />
              </div>
              {!hasFetched ? (
                <>
                  <div className="text-sm font-semibold text-foreground">Татах өгөгдөл байхгүй</div>
                  <div className="text-xs mt-1.5 text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Дээрх хэсгээс эхлэх ба дуусах огноогоо сонгоод{" "}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">«Татах»</span>{" "}
                    товчийг дарж Oracle-аас үнэлгээг ачаалаарай.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-foreground">Oracle-аас өгөгдөл олдсонгүй</div>
                  <div className="text-xs mt-1.5 text-muted-foreground max-w-md mx-auto leading-relaxed">Огнооны муж эсвэл хайлтын утгаа шалгана уу.</div>
                </>
              )}
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">SOLID</th>
                    <th className="px-2 py-2 text-left">BRANCHNAME</th>
                    <th className="px-2 py-2 text-left">BRANCHID</th>
                    <th className="px-2 py-2 text-left">PARENT</th>
                    <th className="px-2 py-2 text-right">RESULT</th>
                    <th className="px-2 py-2 text-center">TYPE</th>
                    <th className="px-2 py-2 text-left">DESCRIPTION</th>
                    <th className="px-2 py-2 text-center whitespace-nowrap">P_DATEBEG</th>
                    <th className="px-2 py-2 text-center whitespace-nowrap">P_DATE</th>
                    <th className="px-2 py-2 text-left">ID</th>
                    <th className="px-2 py-2 text-center">SUBID</th>
                    <th className="px-2 py-2 text-center">Score</th>
                    <th className="px-2 py-2 text-left">OP_TYPE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={`${r.BRANCHID}-${r.SUBID}-${i}`} className="border-t border-border hover:bg-accent/30">
                      <td className="px-2 py-1.5 tabular-nums">{r.SOLID}</td>
                      <td className="px-2 py-1.5 font-medium">{r.BRANCHNAME}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.BRANCHID}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.PARENTBRANCH}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{r.RESULT}</td>
                      <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">{r.RESULT_TYPE}</td>
                      <td className="px-2 py-1.5 max-w-md truncate" title={r.DESCRIPTION_TEXT}>{r.DESCRIPTION_TEXT}</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">{r.P_DATEBEG}</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">{r.P_DATE}</td>
                      <td className="px-2 py-1.5 max-w-xs truncate" title={r.ID}>{r.ID}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.SUBID}</td>
                      <td className="px-2 py-1.5 text-center"><ScoreBadge row={r} /></td>
                      <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{r.OPERATION_TYPE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {grouped.map((g) => {
                const key = g.branchId || g.solid;
                const isOpen = expanded.has(key);
                return (
                  <div key={key}>
                    <button onClick={() => toggle(key)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/40 transition-colors text-left group/row">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isOpen ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-muted/60 text-muted-foreground group-hover/row:bg-blue-500/10 group-hover/row:text-blue-500"}`}>
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-semibold text-sm truncate">{g.branchName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">{g.branchId}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums px-2 py-0.5 rounded-full bg-muted/60 border border-border whitespace-nowrap">
                        {g.rows.length} үнэлгээ
                      </span>
                    </button>
                    {isOpen && (
                      <div className="overflow-x-auto bg-background/50">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                            <tr>
                              <th className="px-2 py-1.5 text-left">SOLID</th>
                              <th className="px-2 py-1.5 text-left">BRANCHNAME</th>
                              <th className="px-2 py-1.5 text-left">BRANCHID</th>
                              <th className="px-2 py-1.5 text-left">PARENT</th>
                              <th className="px-2 py-1.5 text-right">RESULT</th>
                              <th className="px-2 py-1.5 text-center">TYPE</th>
                              <th className="px-2 py-1.5 text-left">DESCRIPTION</th>
                              <th className="px-2 py-1.5 text-center whitespace-nowrap">P_DATEBEG</th>
                              <th className="px-2 py-1.5 text-center whitespace-nowrap">P_DATE</th>
                              <th className="px-2 py-1.5 text-left">ID</th>
                              <th className="px-2 py-1.5 text-center">SUBID</th>
                              <th className="px-2 py-1.5 text-center">Score</th>
                              <th className="px-2 py-1.5 text-left">OP_TYPE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...g.rows].sort((a, b) => Number(a.SUBID ?? 0) - Number(b.SUBID ?? 0)).map((r, i) => (
                              <tr key={`${r.SUBID}-${i}`} className="border-t border-border hover:bg-accent/30">
                                <td className="px-2 py-1.5 tabular-nums">{r.SOLID}</td>
                                <td className="px-2 py-1.5 font-medium">{r.BRANCHNAME}</td>
                                <td className="px-2 py-1.5 tabular-nums">{r.BRANCHID}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{r.PARENTBRANCH}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{r.RESULT}</td>
                                <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">{r.RESULT_TYPE}</td>
                                <td className="px-2 py-1.5 max-w-md truncate" title={r.DESCRIPTION_TEXT}>{r.DESCRIPTION_TEXT}</td>
                                <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">{r.P_DATEBEG}</td>
                                <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums whitespace-nowrap">{r.P_DATE}</td>
                                <td className="px-2 py-1.5 max-w-xs truncate" title={r.ID}>{r.ID}</td>
                                <td className="px-2 py-1.5 text-center tabular-nums">{r.SUBID}</td>
                                <td className="px-2 py-1.5 text-center"><ScoreBadge row={r} /></td>
                                <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{r.OPERATION_TYPE}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-center text-muted-foreground text-xs py-6">
          {user?.name && <><span>{user.name}</span>{" · "}</>}
          {(user as any)?.department ?? ""}
        </p>
      </div>
    </div>
  );
}

function ScoreBadge({ row }: { row: ScoredRow }) {
  if (row.__score == null) return <span className="text-muted-foreground/50 text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded border text-[11px] font-bold ${scoreColorClass(row.__score)}`}
      title={row.__scoreLabel ? `${row.__group} · ${row.__scoreLabel}` : row.__group ?? ""}
    >
      {scoreDisplay(row.__score)}
    </span>
  );
}
