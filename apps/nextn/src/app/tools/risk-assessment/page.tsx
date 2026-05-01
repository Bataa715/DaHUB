"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { riskApi } from "@/lib/api";
import {
  Loader2,
  ShieldAlert,
  RefreshCw,
  Database,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  LayoutGrid,
  Table as TableIcon,
  ClipboardList,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeScore,
  getGroup,
  scoreColorClass,
  scoreDisplay,
  aggregateBranch,
  computeTotal,
  riskLevel,
  riskLevelClass,
  WEIGHTS,
  type BranchAggregate,
  type RiskLevel,
  type ScoreGroup,
  type ScoreResult,
} from "./scoring-rules";
import ReportView from "./report-view";

// ── helpers ────────────────────────────────────────────────────────────────

type RiskRow = Awaited<ReturnType<typeof riskApi.branchRiskass>>["rows"][number];

type ScoredRow = RiskRow & {
  __score: ScoreResult;
  __scoreLabel: string | null;
  __group: ScoreGroup | null;
};

const GROUP_OPTIONS: { key: "all" | ScoreGroup; label: string; cls: string }[] = [
  { key: "all", label: "Бүгд", cls: "text-foreground" },
  { key: "Score 1", label: "Score 1", cls: "text-rose-600" },
  { key: "Score 2", label: "Score 2", cls: "text-amber-600" },
  { key: "Score 3", label: "Score 3", cls: "text-blue-600" },
];

// ── main page ──────────────────────────────────────────────────────────────
export default function RiskAssessmentPage() {
  const { user } = useAuth();
  const [pDate, setPDate] = useState<string>("");
  const [pDateBeg, setPDateBeg] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [failed, setFailed] = useState<{ branchId: number; error: string }[]>([]);
  const [branchCount, setBranchCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grouped" | "table" | "report">(
    "grouped",
  );
  const [search, setSearch] = useState("");
  const [cacheLoading, setCacheLoading] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<"all" | ScoreGroup>("all");
  // Judgement Score (гараар оруулах) — localStorage-д salbar bvr-eer
  const [judgement, setJudgement] = useState<Record<string, number>>({});
  // Score 4 (одоохондоо 0)
  const [score4, setScore4] = useState<Record<string, number>>({});
  // Эрсдэлийн түвшний filter
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");

  // localStorage-аас judgement/score4 сэргээх
  useEffect(() => {
    try {
      const j = localStorage.getItem("riskass_judgement");
      if (j) setJudgement(JSON.parse(j));
      const s4 = localStorage.getItem("riskass_score4");
      if (s4) setScore4(JSON.parse(s4));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("riskass_judgement", JSON.stringify(judgement));
    } catch {}
  }, [judgement]);
  useEffect(() => {
    try {
      localStorage.setItem("riskass_score4", JSON.stringify(score4));
    } catch {}
  }, [score4]);

  // Mount хийх үед сүүлд хадгалсан үр дүнг ClickHouse-аас сэргээнэ
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
        setHasFetched(true);
        setCachedAt(cached.fetchedAt);
      } catch {
        // кэш байхгүй бол чимээгүй өнгөрнө
      } finally {
        if (!cancelled) setCacheLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const datesValid =
    /^\d{4}-\d{2}-\d{2}$/.test(pDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(pDateBeg) &&
    pDateBeg <= pDate;

  const loadAll = useCallback(async () => {
    if (!datesValid) {
      setErrorMsg(
        "Эхлэх болон дуусах огноог зөв оруулна уу (YYYY-MM-DD, эхлэх ≤ дуусах).",
      );
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

  // Эхлээд бүх мөрд оноо тооцоолно
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

  // Score бүлгийн filter + хайлт
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoredRows.filter((r) => {
      if (groupFilter !== "all" && r.__group !== groupFilter) return false;
      if (!q) return true;
      return [
        r.SOLID,
        r.BRANCHNAME,
        r.BRANCHID,
        r.PARENTBRANCH,
        r.RESULT,
        r.DESCRIPTION_TEXT,
        r.ID,
        r.SUBID,
        r.OPERATION_TYPE,
        r.__score,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .some((s) => s.includes(q));
    });
  }, [scoredRows, search, groupFilter]);

  // CSV татах
  const downloadCsv = useCallback(() => {
    const cols = [
      "SOLID",
      "BRANCHNAME",
      "BRANCHID",
      "PARENTBRANCH",
      "RESULT",
      "RESULT_TYPE",
      "DESCRIPTION_TEXT",
      "P_DATEBEG",
      "P_DATE",
      "ID",
      "SUBID",
      "OPERATION_TYPE",
      "SCORE_GROUP",
      "SCORE",
      "SCORE_LABEL",
    ] as const;
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      cols.join(","),
      ...filteredRows.map((r) =>
        cols
          .map((c) => {
            if (c === "SCORE_GROUP") return escape(r.__group ?? "");
            if (c === "SCORE") return escape(r.__score ?? "");
            if (c === "SCORE_LABEL") return escape(r.__scoreLabel ?? "");
            return escape((r as any)[c]);
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-riskass-${pDateBeg}_${pDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, pDate, pDateBeg]);

  // Салбараар бүлэглэх
  const grouped = useMemo(() => {
    const m = new Map<
      string,
      { branchId: string; branchName: string; solid: string; rows: ScoredRow[] }
    >();
    for (const r of filteredRows) {
      const key = String(r.BRANCHID ?? r.SOLID ?? "");
      if (!m.has(key)) {
        m.set(key, {
          branchId: String(r.BRANCHID ?? ""),
          branchName: String(r.BRANCHNAME ?? ""),
          solid: String(r.SOLID ?? ""),
          rows: [],
        });
      }
      m.get(key)!.rows.push(r);
    }
    return Array.from(m.values()).sort((a, b) =>
      a.branchName.localeCompare(b.branchName, "mn"),
    );
  }, [filteredRows]);

  const toggle = (k: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title="Эрсдэлийн үнэлгээ"
        subtitle="RISKASSESSMENT.BranchRiskass — салбарын үнэлгээ"
      />
      <div className="container mx-auto px-4 py-5 space-y-5 flex-1">
        {/* Хугацааны муж сонгогч */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              Хугацааны муж
            </h2>
            <button
              onClick={() => loadAll()}
              disabled={refreshing || !datesValid}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={datesValid ? "Oracle-аас татаж рендерлэх" : "Эхлэх ба дуусах огноог оруулна уу"}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {hasFetched ? "Дахин татах" : "Татах"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Эхлэх огноо (p_DATEBEG)
              </label>
              <input
                type="date"
                value={pDateBeg}
                max={pDate}
                onChange={(e) => setPDateBeg(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Дуусах огноо (p_DATE)
              </label>
              <input
                type="date"
                value={pDate}
                min={pDateBeg}
                onChange={(e) => setPDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Эхлэх ба дуусах огноог оруулаад «Татах» товчийг дарж Oracle-аас үнэлгээг ачаална уу.
            {cachedAt && (
              <span className="ml-2 text-emerald-600">
                · Сүүлд татсан: {new Date(cachedAt).toLocaleString("mn-MN")}
              </span>
            )}
            {cacheLoading && (
              <span className="ml-2">· Сүүлийн үр дүнг сэргээж байна…</span>
            )}
          </div>
        </div>
        {/* Алдааны banner */}
        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Oracle-аас татахад алдаа гарлаа</div>
              <div className="text-xs mt-1">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Тоон үзүүлэлт */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="Хамрагдсан салбар"
            value={`${grouped.length} / ${branchCount}`}
            cls="from-blue-500/10 to-cyan-500/10 border-blue-500/20"
          />
          <Stat
            label="Нийт мөр"
            value={`${filteredRows.length}${
              search && filteredRows.length !== rows.length
                ? ` / ${rows.length}`
                : ""
            }`}
            cls="from-violet-500/10 to-indigo-500/10 border-violet-500/20"
          />
          <Stat
            label="Алдаа гарсан салбар"
            value={failed.length.toString()}
            cls="from-amber-500/10 to-orange-500/10 border-amber-500/20"
          />
          <Stat
            label="Огнооны муж"
            value={`${pDateBeg} → ${pDate}`}
            cls="from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
            small
          />
        </div>

        {/* Алдаа гарсан салбарын жагсаалт */}
        {failed.length > 0 && (
          <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-amber-600">
              Алдаа гарсан салбар ({failed.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs">
              {failed.map((f) => (
                <li key={f.branchId}>
                  · <b>{f.branchId}</b> — {f.error}
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Салбар бүлэг */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              Үнэлгээний дэлгэрэнгүй (
              {viewMode === "grouped"
                ? `${grouped.length} салбар`
                : `${filteredRows.length} мөр`}
              )
            </h2>
            <div className="flex items-center gap-2">
              {/* Score бүлгийн filter */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setGroupFilter(opt.key)}
                    className={`px-2 py-1.5 text-xs border-r last:border-r-0 border-border ${
                      groupFilter === opt.key
                        ? "bg-blue-500/10 text-blue-600 font-semibold"
                        : `hover:bg-accent/40 ${opt.cls}`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Хайлт */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Хайх..."
                  className="pl-7 pr-2 py-1.5 rounded-lg border border-border bg-background text-xs w-44"
                />
              </div>
              {/* View toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("grouped")}
                  className={`px-2 py-1.5 text-xs flex items-center gap-1 ${
                    viewMode === "grouped"
                      ? "bg-blue-500/10 text-blue-600"
                      : "hover:bg-accent/40"
                  }`}
                  title="Салбараар бүлэглэх"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Бүлэг
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-2 py-1.5 text-xs flex items-center gap-1 border-l border-border ${
                    viewMode === "table"
                      ? "bg-blue-500/10 text-blue-600"
                      : "hover:bg-accent/40"
                  }`}
                  title="Бүх багана"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  Хүснэгт
                </button>
                <button
                  onClick={() => setViewMode("report")}
                  className={`px-2 py-1.5 text-xs flex items-center gap-1 border-l border-border ${
                    viewMode === "report"
                      ? "bg-blue-500/10 text-blue-600"
                      : "hover:bg-accent/40"
                  }`}
                  title="Final тайлан"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Тайлан
                </button>
              </div>
              {/* CSV */}
              <button
                onClick={downloadCsv}
                disabled={filteredRows.length === 0}
                className="px-2 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title="CSV файл татах"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>
          {filteredRows.length === 0 && viewMode !== "report" ? (
            <div className="px-4 py-12 text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {!hasFetched ? (
                <>
                  <div>Огноогоо оруулаад «Татах» товчийг дарна уу</div>
                  <div className="text-xs mt-1 opacity-60">
                    Эхлэх ба дуусах огноо (YYYY-MM-DD) оруулсны дараа Oracle-аас
                    үнэлгээг ачаална
                  </div>
                </>
              ) : (
                <>
                  <div>Oracle-аас өгөгдөл олдсонгүй</div>
                  <div className="text-xs mt-1 opacity-60">
                    Огнооны муж эсвэл салбарын ID-г шалгана уу
                  </div>
                </>
              )}
            </div>
          ) : viewMode === "table" ? (
            // ── Бүх 12 баганатай хүснэгт ──────────────────────────────────
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground sticky top-0">
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
                    <tr
                      key={`${r.BRANCHID}-${r.SUBID}-${i}`}
                      className="border-t border-border hover:bg-accent/30"
                    >
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
          ) : viewMode === "grouped" ? (
            <div className="divide-y divide-border">
              {grouped.map((g) => {
                const key = g.branchId || g.solid;
                const isOpen = expanded.has(key);
                return (
                  <div key={key}>
                    <button
                      onClick={() => toggle(key)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{g.branchName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          ID {g.branchId}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
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
                            {[...g.rows]
                              .sort(
                                (a, b) =>
                                  Number(a.SUBID ?? 0) - Number(b.SUBID ?? 0),
                              )
                              .map((r, i) => (
                                <tr
                                  key={`${r.SUBID}-${i}`}
                                  className="border-t border-border hover:bg-accent/30"
                                >
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
          ) : (
            <ReportView
              scoredRows={scoredRows}
              judgement={judgement}
              setJudgement={setJudgement}
              score4={score4}
              setScore4={setScore4}
              riskFilter={riskFilter}
              setRiskFilter={setRiskFilter}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs py-6">
          {user?.name && (
            <>
              <span>{user.name}</span>
              {" · "}
            </>
          )}
          {(user as any)?.department ?? ""}
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  cls,
  small,
}: {
  label: string;
  value: string;
  cls: string;
  small?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${cls}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`${small ? "text-sm" : "text-2xl"} font-bold mt-1 tabular-nums`}
      >
        {value}
      </div>
    </div>
  );
}

function ScoreBadge({ row }: { row: ScoredRow }) {
  if (row.__score == null) {
    return <span className="text-muted-foreground/50 text-xs">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded border text-[11px] font-bold ${scoreColorClass(
        row.__score,
      )}`}
      title={row.__scoreLabel ? `${row.__group} · ${row.__scoreLabel}` : row.__group ?? ""}
    >
      {scoreDisplay(row.__score)}
    </span>
  );
}
