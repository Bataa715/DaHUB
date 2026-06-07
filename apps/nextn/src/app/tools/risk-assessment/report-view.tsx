"use client";

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  Fragment,
  useRef,
} from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import Cookies from "js-cookie";
import { riskApi } from "@/lib/api";
import {
  aggregateBranch,
  riskLevelClass,
  type BranchAggregate,
  type RiskLevel,
  type OracleValue,
} from "./scoring-rules";
import { type ManualMap } from "./indicator-catalog";
import {
  useIndicatorConfig,
  evaluateBranchDynamic,
  computeGroupScoresDynamic,
  type DynamicCatalogIndicator,
  type DynamicWeights,
} from "./use-indicator-config";

// localStorage key зайлсхийж — ClickHouse-д хадгалдаг болсон
// (backward-compat: localStorage-д юу байвал нэг удаа migrate хийнэ)

type AnyRow = {
  SOLID?: OracleValue;
  BRANCHID?: OracleValue;
  BRANCHNAME?: OracleValue;
  SUBID?: OracleValue;
  RESULT?: OracleValue;
  RESULT_TYPE?: OracleValue;
};

interface Props {
  scoredRows: AnyRow[];
  riskFilter: "all" | RiskLevel;
  setRiskFilter: React.Dispatch<React.SetStateAction<"all" | RiskLevel>>;
  previousScoredRows?: AnyRow[];
  previousFetchedAt?: string | null;
  previousHistoryName?: string | null;
  pDate?: string;
  /** Унших горим — аудиторын үнэлэмж засах UI харагдахгүй */
  readOnly?: boolean;
  /** Гарын утгуудыг API-аас биш гадаас дамжуулах (work session горим) */
  initialManualMap?: import("./indicator-catalog").ManualMap;
  /** Гарын үнэлэмж хадгалах custom функц (work session горим) */
  saveIndicatorFn?: (
    branchId: string,
    indicatorId: string,
    value: number,
  ) => void;
  hideComparison?: boolean;
  previousManualMap?: import("./indicator-catalog").ManualMap;
}

const MANUAL_KEY_LEGACY = "riskass_manual_indicators";

// localStorage дахь өмнөх утгуудыг ClickHouse-руу нэг удаа migrate хийх
async function migrateFromLocalStorage(legacy: ManualMap) {
  try {
    const entries: Array<{
      branchId: string;
      indicatorId: string;
      value: number;
    }> = [];
    for (const [branchId, inds] of Object.entries(legacy)) {
      for (const [indicatorId, value] of Object.entries(inds)) {
        if (value > 0) entries.push({ branchId, indicatorId, value });
      }
    }
    await Promise.all(entries.map((e) => riskApi.upsertManualIndicator(e)));
    // Амжилттай migrate хийсний дараа localStorage-ийг цэвэрлэнэ
    window.localStorage.removeItem(MANUAL_KEY_LEGACY);
  } catch {
    // Migration алдаатай бол дараа дахин оролдоно
  }
}

export default function ReportView({
  scoredRows,
  riskFilter,
  setRiskFilter,
  previousScoredRows = [],
  previousFetchedAt: _previousFetchedAt,
  previousHistoryName,
  pDate,
  readOnly = false,
  initialManualMap,
  saveIndicatorFn,
  hideComparison = false,
  previousManualMap = {},
}: Props) {
  // ── Гар оруулсан үзүүлэлтийн утгууд (per-branch × per-indicator) ──
  const [manualMap, setManualMap] = useState<ManualMap>({});
  const [manualLoading, setManualLoading] = useState(false);
  const dynamicConfig = useIndicatorConfig();
  // debounce save тимер хадгалах
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // beforeunload flush-д зориулж pending payload-уудыг хянана
  const pendingSavePayloads = useRef<
    Record<string, { branchId: string; indicatorId: string; value: number }>
  >({});

  // ── Indicator hold state ──────────────────────────────────────────────────
  const holdPeriod = pDate ? pDate.slice(0, 7) : "";
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!holdPeriod) return;
    riskApi
      .listHolds(holdPeriod)
      .then((data) => setHeldIds(new Set(data.map((d) => d.indicatorId))))
      .catch(() => {
        /* intentional: hold state is UI-only; failure leaves holds unset */
      });
  }, [holdPeriod]);

  useEffect(() => {
    const handleUnload = () => {
      const payloads = Object.values(pendingSavePayloads.current);
      if (payloads.length === 0) return;
      // Pending timer-уудыг цуцлах
      Object.values(saveTimers.current).forEach(clearTimeout);
      saveTimers.current = {};
      pendingSavePayloads.current = {};
      // keepalive fetch-ээр flush хийх (axios биш — browser-ийн native fetch)
      const token = Cookies.get(
        window.location.pathname.startsWith("/admin") ? "adminToken" : "token",
      );
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!baseUrl) return;
      for (const p of payloads) {
        fetch(`${baseUrl}/risk-assessment/manual-indicators`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(p),
          keepalive: true,
        }).catch(() => {
          /* intentional: keepalive fire-and-forget on beforeunload */
        });
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // ClickHouse-аас гарын утгуудыг ачаалах (нэг удаа)
  // initialManualMap өгөгдсөн бол (work session горим) fetch хийхгүй
  useEffect(() => {
    if (initialManualMap !== undefined) {
      setManualMap(initialManualMap);
      return;
    }
    if (readOnly) return;
    setManualLoading(true);
    riskApi
      .listManualIndicators()
      .then((data) => setManualMap(data || {}))
      .catch(() => {
        // Сүлжээний алдаа: localStorage-аас нөөцлөн авах (migration)
        try {
          const raw = window.localStorage.getItem("riskass_manual_indicators");
          if (raw) {
            const legacy = JSON.parse(raw) as ManualMap;
            setManualMap(legacy);
            // Нэг удаа migrate
            migrateFromLocalStorage(legacy);
          }
        } catch {}
      })
      .finally(() => setManualLoading(false));
  }, [initialManualMap, readOnly]);

  const setManualValue = useCallback(
    (branchId: string, indicatorId: string, value: number) => {
      if (readOnly) return;
      // 1) UI-г шууд шинэчлэх
      setManualMap((prev) => {
        const next = { ...prev };
        const branch = { ...(next[branchId] || {}) };
        if (!value || value <= 0) delete branch[indicatorId];
        else branch[indicatorId] = Math.min(5, Math.max(0, value));
        if (Object.keys(branch).length === 0) delete next[branchId];
        else next[branchId] = branch;
        return next;
      });
      // 2) 600ms debounce-тайгаар backend-рүү хадгалах (saveIndicatorFn байсан ч)
      const key = `${branchId}::${indicatorId}`;
      if (!value || value <= 0) {
        delete pendingSavePayloads.current[key];
      } else {
        pendingSavePayloads.current[key] = { branchId, indicatorId, value };
      }
      clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        delete pendingSavePayloads.current[key];
        if (saveIndicatorFn) {
          saveIndicatorFn(branchId, indicatorId, value);
        } else {
          riskApi
            .upsertManualIndicator({ branchId, indicatorId, value })
            .catch(console.error);
        }
      }, 600);
    },
    [readOnly, saveIndicatorFn],
  );

  // Салбар бүрийн Oracle мөрнүүдийг branchId-аар бүлэглэх
  const rowsByBranch = useMemo(() => {
    const m = new Map<string, AnyRow[]>();
    for (const r of scoredRows) {
      const id = String(r.BRANCHID ?? "");
      if (!id) continue;
      let arr = m.get(id);
      if (!arr) {
        arr = [];
        m.set(id, arr);
      }
      arr.push(r);
    }
    return m;
  }, [scoredRows]);

  const getAggregates = useCallback(
    (rows: AnyRow[], mKeyMap: ManualMap) => {
      const base = aggregateBranch(rows);
      if (!dynamicConfig.loaded) return base;

      // Group rows by branch
      const byBranch = new Map<string, AnyRow[]>();
      for (const r of rows) {
        const id = String(r.BRANCHID ?? "");
        if (!id) continue;
        let arr = byBranch.get(id);
        if (!arr) {
          arr = [];
          byBranch.set(id, arr);
        }
        arr.push(r);
      }

      return base.map((b) => {
        const branchRows = byBranch.get(b.branchId) ?? [];
        const ev = computeGroupScoresDynamic(
          dynamicConfig.catalog,
          evaluateBranchDynamic(
            dynamicConfig.catalog,
            branchRows,
            mKeyMap[b.branchId],
          ),
          heldIds,
        );
        const w = dynamicConfig.weights[b.region];
        const s1 = ev[1] ?? b.s1;
        const s2 = ev[2] ?? b.s2;
        const s3 = ev[3] ?? b.s3;
        const s4 = ev[4] ?? b.s4 ?? 0;
        const j = ev[5] ?? b.j ?? 0;

        let vsum = 0,
          wsum = 0;
        if (s1 != null) {
          vsum += s1 * w.s1;
          wsum += w.s1;
        }
        if (s2 != null) {
          vsum += s2 * w.s2;
          wsum += w.s2;
        }
        if (s3 != null) {
          vsum += s3 * w.s3;
          wsum += w.s3;
        }
        if (s4 > 0) {
          vsum += s4 * w.s4;
          wsum += w.s4;
        }
        if (j > 0) {
          vsum += j * w.j;
          wsum += w.j;
        }
        const total: number | null = wsum > 0 ? vsum / wsum : null;
        const level: RiskLevel | "" =
          total == null
            ? ""
            : total >= 3.5
              ? "Өндөр"
              : total >= 2.5
                ? "Дунд"
                : "Бага";
        return {
          ...b,
          s1,
          s2,
          s3,
          s4: s4 ?? 0,
          j: j ?? 0,
          total,
          level,
        } as BranchAggregate;
      });
    },
    [dynamicConfig, heldIds],
  );

  const aggregates = useMemo<BranchAggregate[]>(() => {
    return getAggregates(scoredRows, manualMap);
  }, [scoredRows, manualMap, getAggregates]);

  // Эрсдэлийн түвшний filter
  const filtered = useMemo(
    () =>
      riskFilter === "all"
        ? aggregates
        : aggregates.filter((b) => b.level === riskFilter),
    [aggregates, riskFilter],
  );

  // Өмнөх Oracle таталтын aggregate map (харьцуулалтад ашиглана)
  const previousAggMap = useMemo<Map<string, BranchAggregate>>(() => {
    const prevAggs = getAggregates(previousScoredRows, previousManualMap);
    return new Map(prevAggs.map((b) => [b.branchId, b]));
  }, [previousScoredRows, previousManualMap, getAggregates]);

  // Summary
  const summary = useMemo(() => {
    const cur = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
    const prev = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
    let upCnt = 0,
      downCnt = 0,
      sameCnt = 0,
      newCnt = 0;
    const transitions: Record<string, number> = {};

    for (const b of aggregates) {
      cur.Нийт++;
      if (b.level) (cur as any)[b.level]++;
      const p = previousAggMap.get(b.branchId);
      if (p) {
        prev.Нийт++;
        if (p.level) (prev as any)[p.level]++;
        if (b.total != null && p.total != null) {
          const diff = b.total - p.total;
          if (Math.abs(diff) < 0.005) sameCnt++;
          else if (diff > 0) upCnt++;
          else downCnt++;
        }
        const k = `${p.level}-${b.level}`;
        transitions[k] = (transitions[k] || 0) + 1;
      } else {
        newCnt++;
      }
    }
    return { cur, prev, upCnt, downCnt, sameCnt, newCnt, transitions };
  }, [aggregates, previousAggMap]);

  const downloadCsv = () => {
    const cols = [
      "№",
      "SOL",
      "Салбарын нэр",
      "Зэрэглэл",
      "Бүс",
      "Score 1",
      "Score 2",
      "Score 3",
      "Score 4",
      "Judgement",
      "Total",
      "Эрсдэлийн түвшин",
      "Өмнөх Total",
      "Зөрүү",
    ];
    const fmt = (n: number | null) => (n == null ? "" : n.toFixed(2));
    const lines = [cols.join(",")];
    aggregates.forEach((b, i) => {
      const p = previousAggMap.get(b.branchId);
      const diff =
        p && b.total != null && p.total != null ? b.total - p.total : null;
      lines.push(
        [
          i + 1,
          b.solid,
          `"${b.branchName.replace(/"/g, '""')}"`,
          b.rating,
          b.region,
          fmt(b.s1),
          fmt(b.s2),
          fmt(b.s3),
          fmt(b.s4 || null),
          fmt(b.j || null),
          fmt(b.total),
          b.level,
          p ? fmt(p.total) : "",
          fmt(diff),
        ].join(","),
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-riskass-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (scoredRows.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-muted border border-border items-center justify-center mb-3">
          <Download className="w-5 h-5 text-muted-foreground/60" />
        </div>
        <div className="text-sm font-semibold">Тайлан гаргах өгөгдөл алга</div>
        <div className="text-xs mt-1 text-muted-foreground">
          Эхлээд Oracle-аас үнэлгээг татна уу.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-5">
      {/* ── Fallback config анхааруулга ── */}
      {dynamicConfig.isFallback && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-[12px] text-amber-400">
          <span className="text-base">⚠</span>
          <span>
            <b>Offline горим:</b> Үзүүлэлтийн тохиргоог серверээс авч чадаагүй —
            суурилагдсан анхдагч тохиргоог ашиглаж байна. Сүлжээний холболт
            болон backend-ийг шалгана уу.
          </span>
        </div>
      )}
      {/* ── Toolbar ── */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-[11px] text-muted-foreground max-w-2xl space-y-1.5 leading-relaxed">
            {!hideComparison ? (
              <p className="flex items-start gap-1.5">
                <span>
                  <b className="text-foreground">Өмнөх харьцуулалт</b>:{" "}
                  {previousScoredRows.length > 0 ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {previousHistoryName ? (
                        <>
                          <b className="text-violet-600 dark:text-violet-400">
                            «{previousHistoryName}»
                          </b>{" "}
                          улирлын өгөгдөл ({previousScoredRows.length} мөр).
                        </>
                      ) : (
                        <>
                          Өмнөх Oracle таталтын өгөгдөл (
                          {previousScoredRows.length} мөр).
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">
                      Өмнөх улирал сонгогдоогүй — дээрх «Өмнөх улирал сонгох»
                      товчоор сонгоно уу.
                    </span>
                  )}
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-1.5">
                <span className="text-muted-foreground/80">
                  Салбарын эрсдэлийн үнэлгээ болон аудиторын үнэлэмж оруулах
                  хэсэг.
                </span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
          {/* Risk filter */}
          <div className="flex rounded-lg border border-border overflow-hidden bg-background/60">
            {(["all", "Өндөр", "Дунд", "Бага"] as const).map((opt) => {
              const colors: Record<string, string> = {
                all: "text-foreground",
                Өндөр: "text-rose-600 dark:text-rose-400",
                Дунд: "text-amber-600 dark:text-amber-400",
                Бага: "text-emerald-600 dark:text-emerald-400",
              };
              const dot: Record<string, string> = {
                all: "bg-muted-foreground",
                Өндөр: "bg-rose-500",
                Дунд: "bg-amber-500",
                Бага: "bg-emerald-500",
              };
              return (
                <button
                  key={opt}
                  onClick={() => setRiskFilter(opt)}
                  className={`px-3 py-1.5 text-[11px] font-semibold border-r last:border-r-0 border-border flex items-center gap-1.5 transition-all ${
                    riskFilter === opt
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      : `hover:bg-accent/60 ${colors[opt]}`
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dot[opt]}`} />
                  {opt === "all" ? "Бүгд" : opt}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-[11px]">
            {!readOnly && manualLoading && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Гарын утга ачаалж байна…
              </span>
            )}
          </div>
        </div>
      </div>

      <ReportTable
        title="Бүх салбар, тооцооны төвүүд"
        rows={filtered}
        previousAggMap={previousAggMap}
        manualMap={manualMap}
        weights={dynamicConfig.weights}
        setManualValue={setManualValue}
        catalog={dynamicConfig.catalog}
        readOnly={readOnly}
        rawRowsByBranch={rowsByBranch}
        hideComparison={hideComparison}
      />
      {/* Summary */}
      {!hideComparison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryBlock title="1. ҮНЭЛГЭЭ" cols={["Үзүүлэлт", "Одоо", "Өмнө"]}>
            <SRow
              label="Өндөр"
              v={summary.cur.Өндөр}
              prev={summary.prev.Өндөр}
            />
            <SRow label="Дунд" v={summary.cur.Дунд} prev={summary.prev.Дунд} />
            <SRow label="Бага" v={summary.cur.Бага} prev={summary.prev.Бага} />
            <SRow
              label="Нийт"
              v={summary.cur.Нийт}
              prev={summary.prev.Нийт}
              bold
            />
          </SummaryBlock>
          <SummaryBlock
            title="2. ҮНЭЛГЭЭНИЙ ӨӨРЧЛӨЛТ"
            cols={["Үзүүлэлт", "Тоо"]}
          >
            <SRow label="Үнэлгээ өссөн" v={summary.upCnt} />
            <SRow label="Үнэлгээ буурсан" v={summary.downCnt} />
            <SRow label="Үнэлгээ өөрчлөлтгүй" v={summary.sameCnt} />
            <SRow label="Шинээр нэмэгдсэн" v={summary.newCnt} />
            <SRow label="Нийт" v={summary.cur.Нийт} bold />
          </SummaryBlock>
          <SummaryBlock title="3. ТҮВШИН ӨӨРЧЛӨЛТ" cols={["Үзүүлэлт", "Тоо"]}>
            {[
              "Өндөр-Өндөр",
              "Өндөр-Дунд",
              "Өндөр-Бага",
              "Дунд-Өндөр",
              "Дунд-Дунд",
              "Дунд-Бага",
              "Бага-Өндөр",
              "Бага-Дунд",
              "Бага-Бага",
            ].map((k) => (
              <SRow key={k} label={k} v={summary.transitions[k] || 0} />
            ))}
            <SRow label="Шинээр нэмэгдсэн" v={summary.newCnt} />
            <SRow label="Нийт" v={summary.cur.Нийт} bold />
          </SummaryBlock>
        </div>
      )}
    </div>
  );
}

// ── Тайлангийн хүснэгт ────────────────────────────────────────────────────
function ReportTable({
  title,
  region,
  rows,
  previousAggMap,
  manualMap,
  weights,
  setManualValue,
  catalog,
  readOnly = false,
  rawRowsByBranch,
  hideComparison = false,
}: {
  title: string;
  region?: "UB" | "LOC";
  rows: BranchAggregate[];
  previousAggMap: Map<string, BranchAggregate>;
  manualMap: ManualMap;
  weights: DynamicWeights;
  setManualValue: (
    branchId: string,
    indicatorId: string,
    value: number,
  ) => void;
  catalog: DynamicCatalogIndicator[];
  readOnly?: boolean;
  rawRowsByBranch: Map<string, AnyRow[]>;
  hideComparison?: boolean;
}) {
  const w = region ? weights[region] : weights["UB"];
  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(2));
  const [editingJBranch, setEditingJBranch] = useState<string | null>(null);
  const [editJValue, setEditJValue] = useState<string>("");
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const judgmentInd = catalog.find((ind) => ind.is_judgment);
  const commitJ = (branchId: string) => {
    if (judgmentInd) {
      const v = parseFloat(editJValue);
      setManualValue(
        branchId,
        judgmentInd.id,
        isNaN(v) ? 0 : Math.min(5, Math.max(0, v)),
      );
    }
    setEditingJBranch(null);
  };
  const filledJCount = rows.filter(
    (b) => judgmentInd && (manualMap[b.branchId]?.[judgmentInd.id] ?? 0) > 0,
  ).length;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20">
        <div className="flex items-center gap-2 mb-1.5">
          {region && (
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold ${
                region === "UB"
                  ? "bg-blue-500/15 text-blue-600 border border-blue-500/25"
                  : "bg-violet-500/15 text-violet-600 border border-violet-500/25"
              }`}
            >
              {region === "UB" ? "УБ" : "Хөдөө"}
            </span>
          )}
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground px-2 py-0.5 rounded-full bg-background border border-border">
            {rows.length} салбар
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">Жин:</span>
          <span>
            S1{" "}
            <b className="text-foreground tabular-nums">
              {(w.s1 * 100).toFixed(0)}%
            </b>
          </span>
          <span>
            S2{" "}
            <b className="text-foreground tabular-nums">
              {(w.s2 * 100).toFixed(0)}%
            </b>
          </span>
          <span>
            S3{" "}
            <b className="text-foreground tabular-nums">
              {(w.s3 * 100).toFixed(0)}%
            </b>
          </span>
          <span>
            S4{" "}
            <b className="text-foreground tabular-nums">
              {(w.s4 * 100).toFixed(0)}%
            </b>
          </span>
          <span>
            J{" "}
            <b className="text-foreground tabular-nums">
              {(w.j * 100).toFixed(0)}%
            </b>
          </span>
          <span
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${
              filledJCount > 0
                ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "border-border text-muted-foreground/50"
            }`}
          >
            Үнэлэмж: {filledJCount}/{rows.length}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground sticky top-0 z-10">
            <tr>
              <th
                className="px-2 py-2 text-center font-semibold w-8 text-sky-500/70"
                title="Дэлгэрэнгүй харах"
              >
                ⊕
              </th>
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
              <th className="px-2 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">
                <div className="flex flex-col items-end gap-0.5">
                  {!readOnly && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      title="Гараар оруулах боломжтой"
                    />
                  )}
                  Judgement
                </div>
              </th>
              <th className="px-2 py-2 text-right font-semibold">Total</th>
              {!hideComparison && (
                <th className="px-2 py-2 text-right font-semibold text-muted-foreground/70">
                  Өмнөх
                </th>
              )}
              <th className="px-2 py-2 text-center font-semibold">Түвшин</th>
              {!hideComparison && (
                <th className="px-2 py-2 text-right font-semibold">Зөрүү</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => {
              const prev = previousAggMap.get(b.branchId);
              const diff =
                prev && b.total != null && prev.total != null
                  ? b.total - prev.total
                  : null;
              const isExpanded = expandedBranchId === b.branchId;
              return (
                <Fragment key={b.branchId}>
                  <tr
                    className={`border-t border-border hover:bg-accent/30 cursor-pointer select-none ${isExpanded ? "bg-sky-500/5" : ""}`}
                    onClick={() =>
                      setExpandedBranchId(isExpanded ? null : b.branchId)
                    }
                  >
                    <td
                      className="px-1 py-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setExpandedBranchId(isExpanded ? null : b.branchId)
                        }
                        title="Дэлгэрэнгүй харах"
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md border transition-all ${
                          isExpanded
                            ? "border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-400"
                            : "border-border bg-muted/40 text-muted-foreground hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-500"
                        }`}
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground font-semibold">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2 tabular-nums font-bold">
                      {b.solid}
                    </td>
                    <td className="px-2 py-2 font-bold">{b.branchName}</td>
                    <td className="px-2 py-2 text-center text-xs text-muted-foreground font-semibold">
                      {b.rating}
                    </td>
                    <ScoreCell value={b.s1} color="sky" />
                    <ScoreCell value={b.s2} color="violet" />
                    <ScoreCell value={b.s3} color="amber" />
                    <td className="px-2 py-2 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                      {fmt(b.s4 ?? null)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {readOnly ? (
                        <span className="font-bold text-rose-700 dark:text-rose-400">
                          {b.j != null && b.j > 0 ? b.j.toFixed(2) : "—"}
                        </span>
                      ) : editingJBranch === b.branchId ? (
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          max={5}
                          autoFocus
                          value={editJValue}
                          onChange={(e) => setEditJValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitJ(b.branchId);
                            if (e.key === "Escape") setEditingJBranch(null);
                          }}
                          onBlur={() => commitJ(b.branchId)}
                          className="w-16 px-2 py-1 text-right text-xs rounded-lg border border-rose-500/40 bg-background focus:outline-none focus:ring-2 focus:ring-rose-500/30 tabular-nums text-rose-600 dark:text-rose-400 font-bold"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingJBranch(b.branchId);
                            setEditJValue(
                              judgmentInd
                                ? String(
                                    manualMap[b.branchId]?.[judgmentInd.id] ||
                                      "",
                                  )
                                : String(b.j || ""),
                            );
                          }}
                          className="group/jbtn flex flex-col items-end w-full gap-0.5 font-bold text-rose-700 dark:text-rose-400 hover:text-amber-500 transition-colors"
                          title="Клик — засах"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 group-hover/jbtn:bg-emerald-400" />
                          <span className="inline-flex items-center gap-1">
                            {b.j != null && b.j > 0 ? b.j.toFixed(2) : "—"}
                            <span className="opacity-0 group-hover/jbtn:opacity-100 transition-opacity text-[10px] leading-none">
                              ✎
                            </span>
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-bold">
                      <span
                        className={
                          b.total != null && b.total >= 3.5
                            ? "text-rose-600 dark:text-rose-400"
                            : b.total != null && b.total >= 2.5
                              ? "text-amber-600 dark:text-amber-400"
                              : b.total != null
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                        }
                      >
                        {fmt(b.total)}
                      </span>
                    </td>
                    {!hideComparison && (
                      <td className="px-2 py-2 text-right">
                        {prev ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="tabular-nums font-bold text-xs text-muted-foreground">
                              {fmt(prev.total)}
                            </span>
                            {prev.level && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0 rounded text-[9px] font-bold border ${riskLevelClass(prev.level)}`}
                              >
                                <span
                                  className={`w-1 h-1 rounded-full ${prev.level === "Өндөр" ? "bg-red-500" : prev.level === "Дунд" ? "bg-amber-500" : "bg-emerald-500"}`}
                                />
                                {prev.level}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">
                            —
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2 text-center">
                      {b.level && (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${riskLevelClass(b.level)}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${b.level === "Өндөр" ? "bg-red-500" : b.level === "Дунд" ? "bg-amber-500" : "bg-emerald-500"}`}
                            />
                            {b.level}
                          </span>
                          {!hideComparison &&
                            prev?.level &&
                            prev.level !== b.level && (
                              <span
                                className={`text-[9px] font-semibold ${
                                  (prev.level === "Бага" &&
                                    b.level !== "Бага") ||
                                  (prev.level === "Дунд" && b.level === "Өндөр")
                                    ? "text-rose-500"
                                    : "text-emerald-500"
                                }`}
                              >
                                {prev.level} → {b.level}
                              </span>
                            )}
                        </div>
                      )}
                    </td>
                    {!hideComparison && (
                      <td className="px-2 py-2 text-right">
                        {diff == null ? (
                          <span className="text-muted-foreground/30 text-xs">
                            —
                          </span>
                        ) : diff === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-muted text-[10px] font-bold text-muted-foreground">
                            ━ 0.00
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                              diff > 0
                                ? "bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400"
                                : "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {diff > 0 ? "▲" : "▼"} {diff > 0 ? "+" : ""}
                            {diff.toFixed(2)}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                  {/* ── Дэлгэрэнгүй мөр ── */}
                  {isExpanded && (
                    <IndicatorDetailRow
                      branchId={b.branchId}
                      branchName={b.branchName}
                      catalog={catalog}
                      rawRows={rawRowsByBranch.get(b.branchId) ?? []}
                      manualValues={manualMap[b.branchId]}
                      colSpan={hideComparison ? 12 : 14}
                      currentAgg={b}
                      previousAgg={prev}
                      hideComparison={hideComparison}
                    />
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={hideComparison ? 12 : 14}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <div className="text-xs">
                    Энэ бүсэд тохирох салбар олдсонгүй
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Дэлгэрэнгүй: нэг салбарын бүх үзүүлэлтийн утга + score ─────────────────
const GROUP_LABELS: Record<number, { label: string; color: string }> = {
  1: {
    label: "S1",
    color: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25",
  },
  2: {
    label: "S2",
    color:
      "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25",
  },
  3: {
    label: "S3",
    color:
      "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
  },
  4: {
    label: "S4",
    color:
      "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  },
  5: {
    label: "J",
    color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25",
  },
};

const SCORE_COMPARISON_COLS = [
  {
    label: "S1",
    key: "s1" as const,
    cls: "text-sky-600 dark:text-sky-400 bg-sky-500/5 border-sky-500/20",
  },
  {
    label: "S2",
    key: "s2" as const,
    cls: "text-violet-600 dark:text-violet-400 bg-violet-500/5 border-violet-500/20",
  },
  {
    label: "S3",
    key: "s3" as const,
    cls: "text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/20",
  },
  {
    label: "S4",
    key: "s4" as const,
    cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/20",
  },
  {
    label: "J",
    key: "j" as const,
    cls: "text-rose-600 dark:text-rose-400 bg-rose-500/5 border-rose-500/20",
  },
  {
    label: "Нийт",
    key: "total" as const,
    cls: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/20",
  },
] as const;

function IndicatorDetailRow({
  branchId,
  branchName,
  catalog,
  rawRows,
  manualValues,
  colSpan,
  currentAgg,
  previousAgg,
  hideComparison = false,
}: {
  branchId: string;
  branchName: string;
  catalog: DynamicCatalogIndicator[];
  rawRows: AnyRow[];
  manualValues: Record<string, number> | undefined;
  colSpan: number;
  currentAgg?: BranchAggregate;
  previousAgg?: BranchAggregate;
  hideComparison?: boolean;
}) {
  const evals = useMemo(
    () => evaluateBranchDynamic(catalog, rawRows, manualValues),
    [catalog, rawRows, manualValues],
  );

  const grouped = useMemo(() => {
    const g: Record<
      number,
      {
        ind: DynamicCatalogIndicator;
        ev: {
          score: number | null;
          source: string;
          autoRaw?: string;
          autoLabel?: string | null;
        };
      }[]
    > = {};
    for (const ind of catalog) {
      const ev = evals[ind.id] ?? { score: null, source: "none" };
      const grp = ind.group;
      if (!g[grp]) g[grp] = [];
      g[grp].push({ ind, ev });
    }
    return g;
  }, [catalog, evals]);

  return (
    <tr className="border-t border-sky-500/20 bg-sky-500/3">
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              {branchName} — үзүүлэлтийн дэлгэрэнгүй
            </div>
            {currentAgg?.level && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${riskLevelClass(currentAgg.level)}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${currentAgg.level === "Өндөр" ? "bg-red-500" : currentAgg.level === "Дунд" ? "bg-amber-500" : "bg-emerald-500"}`}
                />
                {currentAgg.level}
              </span>
            )}
          </div>

          {/* ── Харьцуулалтын score карт ── */}
          {!hideComparison && currentAgg && previousAgg && (
            <div className="rounded-xl border border-dashed border-border bg-gradient-to-br from-muted/30 to-muted/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <span className="w-3 h-px bg-muted-foreground/40" />
                Өмнөх улиралтай харьцуулалт
                <span className="w-3 h-px bg-muted-foreground/40" />
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SCORE_COMPARISON_COLS.map(({ label, key, cls }) => {
                  const cur =
                    key === "s4" || key === "j"
                      ? (currentAgg[key] ?? 0) > 0
                        ? (currentAgg[key] as number)
                        : null
                      : (currentAgg[key] as number | null);
                  const pv =
                    key === "s4" || key === "j"
                      ? (previousAgg[key] ?? 0) > 0
                        ? (previousAgg[key] as number)
                        : null
                      : (previousAgg[key] as number | null);
                  const d = cur != null && pv != null ? cur - pv : null;
                  return (
                    <div
                      key={label}
                      className={`rounded-lg border p-2.5 ${cls}`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        {label}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold tabular-nums leading-none">
                          {cur != null ? cur.toFixed(2) : "—"}
                        </span>
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                          ← {pv != null ? pv.toFixed(2) : "—"}
                        </span>
                      </div>
                      {d != null ? (
                        <p
                          className={`text-[10px] font-bold tabular-nums mt-1 ${
                            d > 0.005
                              ? "text-rose-500"
                              : d < -0.005
                                ? "text-emerald-500"
                                : "text-muted-foreground/50"
                          }`}
                        >
                          {d > 0.005
                            ? `▲ +${d.toFixed(2)}`
                            : d < -0.005
                              ? `▼ ${d.toFixed(2)}`
                              : "━ 0.00"}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/30 mt-1">
                          шинэ
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {([1, 2, 3, 4, 5] as const).map((grp) => {
            const items = grouped[grp];
            if (!items || items.length === 0) return null;
            const gl = GROUP_LABELS[grp];
            return (
              <div key={grp}>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold mb-1.5 ${gl.color}`}
                >
                  {gl.label}
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-muted-foreground/60 uppercase text-[10px]">
                      <th className="text-left py-0.5 pr-3 font-semibold w-8">
                        ID
                      </th>
                      <th className="text-left py-0.5 pr-3 font-semibold">
                        Үзүүлэлтийн нэр
                      </th>
                      <th className="text-right py-0.5 pr-3 font-semibold">
                        Утга (RESULT)
                      </th>
                      <th className="text-center py-0.5 font-semibold w-16">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ ind, ev }) => (
                      <tr
                        key={ind.id}
                        className="border-t border-border/30 hover:bg-accent/20"
                      >
                        <td className="py-1 pr-3 text-muted-foreground/50 font-mono tabular-nums">
                          {ind.subid || ind.id}
                        </td>
                        <td className="py-1 pr-3 font-medium text-foreground/90">
                          {ind.name}
                        </td>
                        <td className="py-1 pr-3 tabular-nums font-semibold text-right text-foreground">
                          {ev.autoRaw !== undefined ? (
                            ev.autoRaw || "—"
                          ) : ind.is_manual ? (
                            <span className="text-muted-foreground/40 italic">
                              гараар
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1 text-center tabular-nums font-bold">
                          {ev.score != null && ev.score > 0 ? (
                            <span
                              className={
                                ev.score <= 1.5
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : ev.score <= 2.5
                                    ? "text-lime-600 dark:text-lime-400"
                                    : ev.score <= 3.5
                                      ? "text-amber-600 dark:text-amber-400"
                                      : ev.score <= 4.5
                                        ? "text-orange-600 dark:text-orange-400"
                                        : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {ev.score.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

function ScoreCell({
  value,
  color,
}: {
  value: number | null;
  color: "sky" | "violet" | "amber";
}) {
  const cls =
    color === "sky"
      ? "text-sky-700 dark:text-sky-400"
      : color === "violet"
        ? "text-violet-700 dark:text-violet-400"
        : "text-amber-700 dark:text-amber-400";
  return (
    <td className={`px-2 py-2 text-right tabular-nums font-bold ${cls}`}>
      {value == null ? "—" : value.toFixed(2)}
    </td>
  );
}

function SummaryBlock({
  title,
  cols,
  children,
}: {
  title: string;
  cols: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-3.5 py-2.5 border-b border-border bg-gradient-to-r from-blue-500/5 to-transparent text-xs font-bold uppercase tracking-wider text-foreground">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
          <tr>
            {cols.map((c, i) => (
              <th
                key={c}
                className={`px-3 py-1.5 font-semibold ${i === 0 ? "text-left" : "text-right"}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function SRow({
  label,
  v,
  prev,
  bold,
}: {
  label: string;
  v: number;
  prev?: number;
  bold?: boolean;
}) {
  const diff = prev !== undefined ? v - prev : null;
  return (
    <tr
      className={`border-t border-border transition-colors ${bold ? "font-bold bg-muted/30" : "hover:bg-accent/30"}`}
    >
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{v}</td>
      {prev !== undefined && (
        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
          <span>{prev}</span>
          {diff !== null && diff !== 0 && (
            <span
              className={`ml-1.5 text-[10px] font-semibold ${diff > 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {diff > 0 ? `+${diff}` : diff}
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
