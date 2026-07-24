"use client";

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  Fragment,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ChevronDown, Loader2, MessageSquare } from "lucide-react";
import Cookies from "js-cookie";
import { riskApi, HOLD_GLOBAL_PERIOD } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  aggregateBranch,
  classifyBranchTableGroup,
  riskLevelClass,
  type BranchAggregate,
  type RiskLevel,
  type OracleValue,
} from "./scoring-rules";
import { type ManualMap } from "./indicator-catalog";
import {
  resolveJudgementComment,
  pickJudgmentIndicator,
  readJudgmentScoreFromManual,
  lookupJudgementScore,
  resolveBranchJudgementScore,
} from "./branch-resolve";
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
  STATUS?: OracleValue;
  SUBID?: OracleValue;
  RESULT?: OracleValue;
  RESULT_TYPE?: OracleValue;
  sourceFetchedDate?: string;
};

type TableLayout = "unified" | "split";

const SPLIT_SECTIONS = [
  {
    group: "UB" as const,
    title: "Улаанбаатар хотын Бизнес төв, салбар, тооцооны төвүүд",
    region: "UB" as const,
  },
  {
    group: "ON" as const,
    title: "Орон нутгийн Бизнес төв, салбар, тооцооны төвүүд",
    region: "LOC" as const,
  },
] as const;

interface Props {
  scoredRows: AnyRow[];
  riskFilter: "all" | RiskLevel;
  setRiskFilter: React.Dispatch<React.SetStateAction<"all" | RiskLevel>>;
  previousScoredRows?: AnyRow[];
  previousHistoryName?: string | null;
  pDate?: string;
  readOnly?: boolean;
  initialManualMap?: import("./indicator-catalog").ManualMap;
  saveIndicatorFn?: (
    branchId: string,
    indicatorId: string,
    value: number,
  ) => void;
  hideComparison?: boolean;
  /** Дэлгэрэнгүй мөрөнд оноогүй (үнэлэгдээгүй) indicator-уудыг харуулахгүй */
  hideUnevaluatedInDetail?: boolean;
  previousManualMap?: import("./indicator-catalog").ManualMap;
  /**
   * Гадаас дамжуулах аудиторын үнэлэмж (work session горим).
   * Indicator ID-тай холбоогүйгээр шууд branchId → score map.
   */
  externalJudgements?: Record<string, number>;
  /** Аудиторын үнэлэмжийн тайлбар (branchId → comment) */
  externalJudgementComments?: Record<string, string>;
  /** Аудиторын үнэлэмж хадгалах callback (externalJudgements-тэй хамт ашиглана) */
  onJudgementChange?: (branchId: string, score: number) => void;
  /** Judgement тайлбар хадгалах */
  onJudgementCommentSave?: (branchId: string, comment: string) => void;
  /** Өмнөх огноогийн judgement — авто бөглөх товчинд ашиглана */
  previousJudgements?: Record<string, number>;
  /** Сонгосон огноо — fill-forward хуучин өгөгдөл тэмдэглэхэд */
  dataReferenceDate?: string;
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
  pDate,
  readOnly = false,
  initialManualMap,
  saveIndicatorFn,
  externalJudgements,
  externalJudgementComments,
  onJudgementChange,
  onJudgementCommentSave,
  previousJudgements,
  hideComparison = false,
  hideUnevaluatedInDetail = false,
  previousManualMap = {},
  dataReferenceDate,
}: Props) {
  // ── Гар оруулсан үзүүлэлтийн утгууд (per-branch × per-indicator) ──
  const [manualMap, setManualMap] = useState<ManualMap>({});
  const [manualLoading, setManualLoading] = useState(false);
  const dynamicConfig = useIndicatorConfig();
  const judgmentInd = useMemo(
    () =>
      dynamicConfig.loaded
        ? pickJudgmentIndicator(dynamicConfig.catalog)
        : null,
    [dynamicConfig.catalog, dynamicConfig.loaded],
  );
  const judgmentIndId = judgmentInd?.id ?? "";
  // debounce save тимер хадгалах
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // beforeunload flush-д зориулж pending payload-уудыг хянана
  const pendingSavePayloads = useRef<
    Record<string, { branchId: string; indicatorId: string; value: number }>
  >({});
  // initialManualMap sync: pDate өөрчлөгдсөн үед л apply хийнэ
  // (judgements update бүрт ref өөрчлөгдөхөд useEffect давтагдахаас сэргийлнэ)
  const lastAppliedKey = useRef<string>("__unset__");

  // ── Indicator hold state ──────────────────────────────────────────────────
  // Hold нь огноо/улирлаас үл хамаарч БҮХ тооцоонд нэгэн зэрэг үйлчилнэ (global).
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());
  // holds fetch дууссан эсэх — дуусаагүй үед scoring хийхгүй
  const [holdsLoaded, setHoldsLoaded] = useState<boolean>(false);

  useEffect(() => {
    setHoldsLoaded(false);
    riskApi
      .listHolds(HOLD_GLOBAL_PERIOD)
      .then((data) => {
        setHeldIds(new Set(data.map((d) => d.indicatorId)));
        setHoldsLoaded(true);
      })
      .catch(() => {
        setHoldsLoaded(true); // алдаа гарвал holds хоосон гэж үзэж үргэлжлэнэ
      });
  }, []);

  // Hold хийгдсэн indicator-уудыг catalog-аас хасна —
  // score тооцоо болон дэлгэрэнгүй харагдахгүй болно
  const activeCatalog = useMemo(
    () =>
      heldIds.size > 0
        ? dynamicConfig.catalog.filter((c) => !heldIds.has(c.id))
        : dynamicConfig.catalog,
    [dynamicConfig.catalog, heldIds],
  );

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
  // initialManualMap өгөгдсөн бол (work session горим) fetch хийхгүй.
  // Key = pDate + judgmentIndId: pDate өөрчлөгдвөл (шинэ огноо) эсвэл catalog
  // ачааллагдаж judgment id өөрчлөгдвөл дахин apply хийнэ.
  // (зүгээр л judgements update болж ref өөрчлөгдсөн бол skip хийнэ)
  // readOnly tailan: initialManualMap өөрчлөгдөх бүрт синк хийнэ
  useEffect(() => {
    if (initialManualMap !== undefined) {
      if (readOnly) {
        setManualMap(initialManualMap);
        return;
      }
      const key = `${pDate ?? ""}::${judgmentIndId}`;
      if (lastAppliedKey.current === key) return;
      lastAppliedKey.current = key;
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
  }, [initialManualMap, pDate, judgmentIndId, readOnly]);

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
      // 2) saveIndicatorFn байвал шууд дуудна — work/page дотроо өөрийн debounce-тай
      //    Энэ нь judgements state-г яг тэр даруй шинэчилж initialManualMap-г синк байлгана
      if (saveIndicatorFn) {
        saveIndicatorFn(branchId, indicatorId, value);
        return;
      }
      // 3) saveIndicatorFn байхгүй бол 600ms debounce-тайгаар API дуудна
      const key = `${branchId}::${indicatorId}`;
      if (!value || value <= 0) {
        delete pendingSavePayloads.current[key];
      } else {
        pendingSavePayloads.current[key] = { branchId, indicatorId, value };
      }
      clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        delete pendingSavePayloads.current[key];
        riskApi
          .upsertManualIndicator({ branchId, indicatorId, value })
          .catch((e) =>
            console.error("upsertManualIndicator хадгалахад алдаа:", e),
          );
      }, 600);
    },
    [readOnly, saveIndicatorFn],
  );

  // Салбар бүрийн Oracle мөрнүүдийг branchId-аар бүлэглэх
  const rowsByBranch = useMemo(() => {
    const m = new Map<string, AnyRow[]>();
    for (const r of scoredRows) {
      const id = String(r.SOLID || "");
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
    (
      rows: AnyRow[],
      mKeyMap: ManualMap,
      judgementsOverride?: Record<string, number>,
    ) => {
      const base = aggregateBranch(rows, {}, {}, activeCatalog);
      if (!dynamicConfig.loaded || !holdsLoaded) return base;

      // Group rows by branch
      const byBranch = new Map<string, AnyRow[]>();
      for (const r of rows) {
        const id = String((r as any).SOLID || "");
        if (!id) continue;
        let arr = byBranch.get(id);
        if (!arr) {
          arr = [];
          byBranch.set(id, arr);
        }
        arr.push(r);
      }

      const judgementsForAgg = judgementsOverride ?? externalJudgements;

      return base.map((b) => {
        const branchRows = byBranch.get(b.branchId) ?? [];
        const ev = computeGroupScoresDynamic(
          activeCatalog,
          evaluateBranchDynamic(activeCatalog, branchRows, mKeyMap[b.branchId]),
          heldIds,
        );
        const w = dynamicConfig.weights[b.region];
        const s1 = ev[1] ?? b.s1;
        const s2 = ev[2] ?? b.s2;
        const s3 = ev[3] ?? b.s3;
        const s4 = ev[4] ?? b.s4 ?? null;
        // tailan: manualJson snapshot (catalog judgment id)
        const j = resolveBranchJudgementScore(
          b.branchId,
          judgementsForAgg,
          mKeyMap,
          judgmentIndId,
        );

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
        if (s4 != null) {
          vsum += s4 * w.s4;
          wsum += w.s4;
        }
        if (j != null) {
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
          s4,
          j,
          total,
          level,
        } as BranchAggregate;
      });
    },
    [
      dynamicConfig,
      activeCatalog,
      heldIds,
      holdsLoaded,
      externalJudgements,
      judgmentIndId,
    ],
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

  // Гараар Sort дарахад л эрэмбэлнэ — judgement оруулах үед автоматаар sort хийхгүй
  // Анхны байдал (sortKey=0): SOLID-аар тоон дарааллаар эрэмбэлнэ
  const [sortKey, setSortKey] = useState<number>(0);
  const [tableLayout, setTableLayout] = useState<TableLayout>("unified");
  const sortedFiltered = useMemo(() => {
    const bySolid = (a: BranchAggregate, b: BranchAggregate) => {
      const na = parseFloat(a.solid) || 0;
      const nb = parseFloat(b.solid) || 0;
      if (na !== nb) return na - nb;
      return a.solid.localeCompare(b.solid);
    };
    if (sortKey === 0) return [...filtered].sort(bySolid);
    return [...filtered].sort((a, b) => {
      const aHasJ = externalJudgements
        ? (lookupJudgementScore(externalJudgements, a.branchId) ?? 0) > 0
        : judgmentIndId
          ? (manualMap[a.branchId]?.[judgmentIndId] ?? 0) > 0
          : false;
      const bHasJ = externalJudgements
        ? (lookupJudgementScore(externalJudgements, b.branchId) ?? 0) > 0
        : judgmentIndId
          ? (manualMap[b.branchId]?.[judgmentIndId] ?? 0) > 0
          : false;
      if (aHasJ !== bHasJ) return aHasJ ? -1 : 1;
      return (b.total ?? 0) - (a.total ?? 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, readOnly, sortKey]);

  const ubRows = useMemo(
    () =>
      sortedFiltered.filter(
        (b) => classifyBranchTableGroup(b.status, b.rating) === "UB",
      ),
    [sortedFiltered],
  );
  const onRows = useMemo(
    () =>
      sortedFiltered.filter(
        (b) => classifyBranchTableGroup(b.status, b.rating) === "ON",
      ),
    [sortedFiltered],
  );

  // Өмнөх Oracle таталтын aggregate map (харьцуулалтад ашиглана)
  const previousAggMap = useMemo<Map<string, BranchAggregate>>(() => {
    const prevAggs = getAggregates(
      previousScoredRows,
      previousManualMap,
      previousJudgements,
    );
    return new Map(prevAggs.map((b) => [b.branchId, b]));
  }, [
    previousScoredRows,
    previousManualMap,
    previousJudgements,
    getAggregates,
  ]);

  const reportTableProps = {
    previousAggMap,
    manualMap,
    weights: dynamicConfig.weights,
    setManualValue,
    catalog: activeCatalog,
    readOnly,
    rawRowsByBranch: rowsByBranch,
    hideComparison,
    hideUnevaluatedInDetail,
    externalJudgements,
    externalJudgementComments,
    onJudgementChange,
    onJudgementCommentSave,
    previousJudgements,
    dataReferenceDate,
  } as const;

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

  if (scoredRows.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTableLayout((m) => (m === "unified" ? "split" : "unified"))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                tableLayout === "split"
                  ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                  : "border-border bg-background/60 hover:bg-muted/40 text-foreground/80"
              }`}
              title={
                tableLayout === "unified"
                  ? "УБ / ОН салбарыг тусад нь харах"
                  : "Бүх салбарыг нэг хүснэгтээр харах"
              }
            >
              {tableLayout === "unified" ? "Салгаж харах" : "Нэгдсэнээр харах"}
            </button>
            {!readOnly && manualLoading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
            <button
              onClick={() => setSortKey((k) => (k === 0 ? 1 : 0))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                sortKey > 0
                  ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                  : "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
              }`}
              title={
                sortKey > 0
                  ? "SOLID дарааллаар буцах"
                  : readOnly
                    ? "Total-аар эрэмбэлэх (judgement оруулсан салбар дээр)"
                    : "Judgement оруулсан салбарыг дээрт, Total-аар эрэмбэлэх"
              }
            >
              {sortKey > 0 ? "↕ SOLID↑" : "↕ Эрэмбэлэх"}
            </button>
          </div>
        </div>
      </div>

      {tableLayout === "unified" ? (
        <ReportTable
          title="Бүх салбар, тооцооны төвүүд"
          rows={sortedFiltered}
          {...reportTableProps}
        />
      ) : (
        <div className="space-y-6">
          {SPLIT_SECTIONS.map((section) => {
            const sectionRows = section.group === "UB" ? ubRows : onRows;
            return (
              <ReportTable
                key={section.group}
                title={section.title}
                region={section.region}
                rows={sectionRows}
                {...reportTableProps}
              />
            );
          })}
        </div>
      )}
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

function ReadOnlyJudgementCell({
  branchId,
  branchName,
  score,
  comments,
  onOpenComment,
}: {
  branchId: string;
  branchName: string;
  score: number | null;
  comments?: Record<string, string>;
  onOpenComment: (payload: {
    branchId: string;
    branchName: string;
    draft: string;
  }) => void;
}) {
  const jComment = resolveJudgementComment(branchId, comments);
  const hasJ = score != null && score > 0;
  const canOpen = hasJ || Boolean(jComment);

  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={(e) => {
        e.stopPropagation();
        if (!canOpen) return;
        onOpenComment({ branchId, branchName, draft: jComment });
      }}
      className={`inline-flex items-center justify-center gap-1 font-normal text-foreground tabular-nums ${
        canOpen ? "hover:text-amber-500 cursor-pointer" : "cursor-default"
      }`}
      title={jComment ? "Тайлбар харах" : hasJ ? "Тайлбар байхгүй" : undefined}
    >
      {hasJ ? (score! % 1 === 0 ? score!.toFixed(0) : score!.toFixed(1)) : "—"}
      {jComment ? (
        <MessageSquare className="w-2.5 h-2.5 shrink-0 text-muted-foreground fill-muted/40" />
      ) : null}
    </button>
  );
}

// ── Тайлангийн хүснэгт ────────────────────────────────────────────────────

type ReportColKey =
  | "expand"
  | "num"
  | "solid"
  | "name"
  | "rating"
  | "s1"
  | "s2"
  | "s3"
  | "s4"
  | "j"
  | "total"
  | "prev"
  | "level"
  | "diff";

type ReportColDef = {
  key: ReportColKey;
  label: string;
  align: "left" | "center" | "right";
  defaultWidth: number;
  minWidth: number;
  compareOnly?: boolean;
};

const REPORT_COLS: ReportColDef[] = [
  { key: "expand", label: "⊕", align: "center", defaultWidth: 36, minWidth: 32 },
  { key: "num", label: "№", align: "center", defaultWidth: 44, minWidth: 36 },
  { key: "solid", label: "SOL", align: "center", defaultWidth: 64, minWidth: 48 },
  {
    key: "name",
    label: "Салбарын нэр",
    align: "left",
    defaultWidth: 200,
    minWidth: 100,
  },
  {
    key: "rating",
    label: "Зэрэглэл",
    align: "center",
    defaultWidth: 72,
    minWidth: 56,
  },
  {
    key: "s1",
    label: "Score 1",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
  },
  {
    key: "s2",
    label: "Score 2",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
  },
  {
    key: "s3",
    label: "Score 3",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
  },
  {
    key: "s4",
    label: "Score 4",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
  },
  {
    key: "j",
    label: "Judgement",
    align: "center",
    defaultWidth: 88,
    minWidth: 64,
  },
  {
    key: "total",
    label: "Total",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
  },
  {
    key: "prev",
    label: "Өмнөх",
    align: "center",
    defaultWidth: 80,
    minWidth: 64,
    compareOnly: true,
  },
  {
    key: "level",
    label: "Түвшин",
    align: "center",
    defaultWidth: 88,
    minWidth: 72,
  },
  {
    key: "diff",
    label: "Зөрүү",
    align: "center",
    defaultWidth: 80,
    minWidth: 64,
    compareOnly: true,
  },
];

const REPORT_WIDTHS_KEY = "dahub-report-col-widths";

function readReportStoredWidths(): Partial<Record<ReportColKey, number>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(REPORT_WIDTHS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<ReportColKey, number>>;
  } catch {
    return {};
  }
}

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
  hideUnevaluatedInDetail = false,
  externalJudgements,
  externalJudgementComments,
  onJudgementChange,
  onJudgementCommentSave,
  dataReferenceDate,
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
  hideUnevaluatedInDetail?: boolean;
  externalJudgements?: Record<string, number>;
  externalJudgementComments?: Record<string, string>;
  onJudgementChange?: (branchId: string, score: number) => void;
  onJudgementCommentSave?: (branchId: string, comment: string) => void;
  previousJudgements?: Record<string, number>;
  dataReferenceDate?: string;
}) {
  const w = region ? weights[region] : weights["UB"];
  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(2));
  const [editingJBranch, setEditingJBranch] = useState<string | null>(null);
  const [editJValue, setEditJValue] = useState<string>("");
  const [commentModal, setCommentModal] = useState<{
    branchId: string;
    branchName: string;
    draft: string;
  } | null>(null);
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const committingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const visibleCols = useMemo(
    () =>
      REPORT_COLS.filter((c) => (c.compareOnly ? !hideComparison : true)),
    [hideComparison],
  );
  const [widths, setWidths] = useState<Partial<Record<ReportColKey, number>>>(
    {},
  );

  useEffect(() => {
    setWidths(readReportStoredWidths());
  }, []);

  const widthOf = useCallback(
    (col: ReportColDef) => widths[col.key] ?? col.defaultWidth,
    [widths],
  );

  const onResizeStart = useCallback(
    (e: ReactMouseEvent, col: ReportColDef) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widthOf(col);

      const onMove = (ev: MouseEvent) => {
        const next = Math.max(col.minWidth, startW + (ev.clientX - startX));
        setWidths((prev) => ({ ...prev, [col.key]: next }));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setWidths((prev) => {
          const merged = { ...prev };
          try {
            localStorage.setItem(REPORT_WIDTHS_KEY, JSON.stringify(merged));
          } catch {
            /* ignore */
          }
          return merged;
        });
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [widthOf],
  );

  useEffect(() => {
    if (editingJBranch && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingJBranch]);
  const judgmentInd = useMemo(() => pickJudgmentIndicator(catalog), [catalog]);
  const commitJ = (branchId: string) => {
    if (committingRef.current) return;
    committingRef.current = true;
    requestAnimationFrame(() => {
      committingRef.current = false;
    });
    const raw = editJValue.trim();
    if (raw === "") {
      // Хоосн оруулбал: үнэлэмж цэвэрлэх (score=0)
      if (onJudgementChange) {
        onJudgementChange(branchId, 0);
      } else if (judgmentInd) {
        setManualValue(branchId, judgmentInd.id, 0);
      }
    } else {
      const v = parseFloat(raw);
      if (!isNaN(v) && v > 0) {
        const clamped = Math.min(5, Math.max(1, v));
        if (onJudgementChange) {
          onJudgementChange(branchId, clamped);
        } else if (judgmentInd) {
          setManualValue(branchId, judgmentInd.id, clamped);
        }
      }
    }
    setEditingJBranch(null);
  };
  const filledJCount = externalJudgements
    ? rows.filter(
        (b) => (lookupJudgementScore(externalJudgements, b.branchId) ?? 0) > 0,
      ).length
    : rows.filter(
        (b) =>
          judgmentInd != null &&
          (readJudgmentScoreFromManual(manualMap[b.branchId], judgmentInd.id) ??
            0) > 0,
      ).length;

  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  } as const;

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
      <div
        className={`px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20 ${
          region === "UB"
            ? "border-l-[3px] border-l-blue-500/40"
            : region === "LOC"
              ? "border-l-[3px] border-l-violet-500/40"
              : ""
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {region && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold bg-muted text-foreground border border-border">
              {region === "UB" ? "УБ" : "ОН"}
            </span>
          )}
          <h3
            className={`text-sm font-semibold text-foreground ${region ? "flex-1 text-center" : ""}`}
          >
            {title}
          </h3>
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
        <table
          className="text-sm border-collapse"
          style={{
            tableLayout: "fixed",
            width: "max-content",
            minWidth: "100%",
          }}
        >
          <colgroup>
            {visibleCols.map((col) => (
              <col key={col.key} style={{ width: widthOf(col) }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  title={col.key === "expand" ? "Дэлгэрэнгүй харах" : undefined}
                  className={cn(
                    "relative px-2 py-2.5 text-xs font-bold text-foreground bg-background select-none border-b border-border",
                    alignClass[col.align],
                    col.key === "total" || col.key === "diff"
                      ? "font-extrabold"
                      : undefined,
                  )}
                >
                  <span className="truncate block font-bold">{col.label}</span>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${col.label} өргөн өөрчлөх`}
                    onMouseDown={(e) => onResizeStart(e, col)}
                    className="absolute top-0 -right-0.5 w-2 h-full cursor-col-resize z-10 group flex justify-center"
                  >
                    <span className="w-px h-full bg-transparent group-hover:bg-foreground/30" />
                  </span>
                </th>
              ))}
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
                    className={`border-t border-border hover:bg-accent/10 ${isExpanded ? "bg-sky-500/5" : ""}`}
                  >
                    <td className="px-1 py-2 text-center">
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
                    <td className="px-2 py-2 text-center tabular-nums text-foreground font-normal">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums font-normal text-foreground">
                      {b.solid}
                    </td>
                    <td className="px-2 py-2 font-normal text-foreground">
                      {b.branchName}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-foreground font-normal">
                      {b.rating}
                    </td>
                    <ScoreCell value={b.s1} colBg="bg-sky-500/[0.08]" />
                    <ScoreCell value={b.s2} colBg="bg-violet-500/[0.08]" />
                    <ScoreCell value={b.s3} colBg="bg-amber-500/[0.08]" />
                    <td className="px-2 py-2 text-center tabular-nums font-normal text-foreground bg-emerald-500/[0.08]">
                      {fmt(b.s4 ?? null)}
                    </td>
                    <td
                      className="px-2 py-2 text-center tabular-nums bg-rose-500/[0.08]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {readOnly ? (
                        <ReadOnlyJudgementCell
                          branchId={b.branchId}
                          branchName={b.branchName}
                          score={b.j}
                          comments={externalJudgementComments}
                          onOpenComment={setCommentModal}
                        />
                      ) : editingJBranch === b.branchId ? (
                        <input
                          ref={inputRef}
                          type="text"
                          inputMode="decimal"
                          value={editJValue}
                          onChange={(e) => setEditJValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitJ(b.branchId);
                            }
                            if (e.key === "Escape") setEditingJBranch(null);
                          }}
                          onBlur={() => commitJ(b.branchId)}
                          className="w-14 px-1 py-0.5 text-center text-xs rounded border border-rose-500/40 bg-background focus:outline-none focus:ring-2 focus:ring-rose-500/30 tabular-nums text-foreground font-normal"
                        />
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1">
                          {(readOnly
                            ? Boolean(
                                resolveJudgementComment(
                                  b.branchId,
                                  externalJudgementComments,
                                ),
                              )
                            : (b.j != null && b.j > 0) ||
                              Boolean(
                                resolveJudgementComment(
                                  b.branchId,
                                  externalJudgementComments,
                                ),
                              )) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCommentModal({
                                  branchId: b.branchId,
                                  branchName: b.branchName,
                                  draft:
                                    resolveJudgementComment(
                                      b.branchId,
                                      externalJudgementComments,
                                    ) ?? "",
                                });
                              }}
                              className={`p-0 leading-none transition-colors ${
                                resolveJudgementComment(
                                  b.branchId,
                                  externalJudgementComments,
                                )
                                  ? "text-rose-500 hover:text-rose-400"
                                  : "text-muted-foreground/50 hover:text-rose-500"
                              }`}
                              title={
                                resolveJudgementComment(
                                  b.branchId,
                                  externalJudgementComments,
                                )
                                  ? "Тайлбар харах"
                                  : "Тайлбар нэмэх"
                              }
                            >
                              <MessageSquare
                                className={`w-2.5 h-2.5 ${
                                  resolveJudgementComment(
                                    b.branchId,
                                    externalJudgementComments,
                                  )
                                    ? "fill-rose-500/25"
                                    : ""
                                }`}
                              />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingJBranch(b.branchId);
                              setEditJValue(
                                externalJudgements
                                  ? String(
                                      lookupJudgementScore(
                                        externalJudgements,
                                        b.branchId,
                                      ) || "",
                                    )
                                  : judgmentInd
                                    ? String(
                                        manualMap[b.branchId]?.[
                                          judgmentInd.id
                                        ] || "",
                                      )
                                    : String(b.j || ""),
                              );
                            }}
                            className="group/jbtn inline-flex items-center gap-1 font-normal text-foreground hover:text-amber-500 transition-colors"
                            title="Клик — оноо засах"
                          >
                            {b.j != null && b.j > 0
                              ? b.j % 1 === 0
                                ? b.j.toFixed(0)
                                : b.j.toFixed(1)
                              : "—"}
                            <span className="opacity-0 group-hover/jbtn:opacity-100 transition-opacity text-[10px] leading-none">
                              ✎
                            </span>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums font-bold text-foreground bg-indigo-500/[0.08]">
                      {fmt(b.total)}
                    </td>
                    {!hideComparison && (
                      <td className="px-2 py-2 text-center">
                        {prev ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="tabular-nums font-normal text-xs text-foreground">
                              {fmt(prev.total)}
                            </span>
                            {prev.level && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0 rounded text-[9px] font-normal border ${riskLevelClass(prev.level)}`}
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-normal ${riskLevelClass(b.level)}`}
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
                      <td className="px-2 py-2 text-center">
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
                      colSpan={visibleCols.length}
                      currentAgg={b}
                      previousAgg={prev}
                      hideComparison={hideComparison}
                      hideUnevaluatedInDetail={hideUnevaluatedInDetail}
                      dataReferenceDate={dataReferenceDate}
                      judgementScore={b.j}
                      judgementComment={resolveJudgementComment(
                        b.branchId,
                        externalJudgementComments,
                      )}
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

      {commentModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setCommentModal(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-premium-xl ring-hairline p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h3 className="text-sm font-semibold">
                Аудиторын үнэлэмжийн тайлбар
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                {commentModal.branchName} · SOLID {commentModal.branchId}
              </p>
            </div>
            <textarea
              value={commentModal.draft}
              onChange={(e) =>
                setCommentModal((m) =>
                  m ? { ...m, draft: e.target.value } : m,
                )
              }
              readOnly={readOnly}
              rows={12}
              placeholder="Тайлбар бичнэ үү..."
              className="w-full min-h-[240px] px-3 py-2.5 rounded-xl border border-border bg-background text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCommentModal(null)}
                className="px-4 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/40 transition-colors"
              >
                {readOnly ? "Хаах" : "Болих"}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    onJudgementCommentSave?.(
                      commentModal.branchId,
                      commentModal.draft,
                    );
                    setCommentModal(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all"
                >
                  Хадгалах
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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

function normDate(d: string | undefined): string {
  return d ? String(d).slice(0, 10) : "";
}

function isStaleIndicatorData(
  sourceDate: string | undefined,
  referenceDate: string | undefined,
): boolean {
  const ref = normDate(referenceDate);
  const src = normDate(sourceDate);
  if (!ref || !src) return false;
  return src !== ref;
}

function hasEvaluatedScore(score: number | null | undefined): boolean {
  return score != null && score > 0;
}

function IndicatorDetailRow({
  branchName,
  catalog,
  rawRows,
  manualValues,
  colSpan,
  currentAgg,
  previousAgg,
  hideComparison = false,
  hideUnevaluatedInDetail = false,
  dataReferenceDate,
  judgementScore,
  judgementComment,
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
  hideUnevaluatedInDetail?: boolean;
  dataReferenceDate?: string;
  judgementScore?: number | null;
  judgementComment?: string;
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
          sourceFetchedDate?: string;
        };
      }[]
    > = {};
    for (const ind of catalog) {
      if (ind.is_judgment || ind.group === 5) continue; // Judgement дэлгэрэнгүйд харуулахгүй
      const ev = evals[ind.id] ?? { score: null, source: "none" };
      if (hideUnevaluatedInDetail && !hasEvaluatedScore(ev.score)) continue;
      const grp = ind.group;
      if (!g[grp]) g[grp] = [];
      g[grp].push({ ind, ev });
    }
    for (const grp of Object.keys(g)) {
      g[Number(grp)].sort((a, b) => {
        if (!hideUnevaluatedInDetail) {
          const aNo = !hasEvaluatedScore(a.ev.score);
          const bNo = !hasEvaluatedScore(b.ev.score);
          if (aNo !== bNo) return aNo ? 1 : -1;
        }
        const na = parseFloat(a.ind.subid ?? "") || 0;
        const nb = parseFloat(b.ind.subid ?? "") || 0;
        if (na !== nb) return na - nb;
        return (a.ind.subid ?? "").localeCompare(b.ind.subid ?? "");
      });
    }
    return g;
  }, [catalog, evals, hideUnevaluatedInDetail]);

  return (
    <tr className="border-t border-sky-500/20 bg-sky-500/3">
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              {branchName} — үзүүлэлтийн дэлгэрэнгүй
            </div>
            <div className="flex items-center gap-2">
              {currentAgg?.total != null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-muted/40 text-[10px] font-bold tabular-nums text-foreground/80">
                  Эцсийн дүн: {currentAgg.total.toFixed(2)} / 5
                  <span className="text-sky-600 dark:text-sky-400">
                    ({Math.round((currentAgg.total / 5) * 100)}%)
                  </span>
                </span>
              )}
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
          </div>

          {(judgementScore != null && judgementScore > 0) ||
          judgementComment ? (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Аудиторын үнэлэмж
              </p>
              {judgementScore != null && judgementScore > 0 && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Оноо: </span>
                  <span className="font-bold tabular-nums text-rose-700 dark:text-rose-400">
                    {judgementScore % 1 === 0
                      ? judgementScore.toFixed(0)
                      : judgementScore.toFixed(1)}
                  </span>
                </p>
              )}
              {judgementComment ? (
                <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {judgementComment}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  Тайлбар байхгүй
                </p>
              )}
            </div>
          ) : null}

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
                        <td className="py-1 pr-3 tabular-nums font-normal text-right text-foreground">
                          {ev.autoRaw !== undefined ? (
                            <span className="inline-flex items-center justify-end gap-1.5 w-full">
                              <span>{ev.autoRaw || "—"}</span>
                              {isStaleIndicatorData(
                                ev.sourceFetchedDate,
                                dataReferenceDate,
                              ) && (
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                                  title={`Хуучин өгөгдөл (${normDate(ev.sourceFetchedDate)})`}
                                />
                              )}
                            </span>
                          ) : ind.is_manual ? (
                            <span className="text-muted-foreground/40 italic">
                              гараар
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1 text-center tabular-nums font-normal">
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
  colBg,
}: {
  value: number | null;
  colBg: string;
}) {
  return (
    <td
      className={`px-2 py-2 text-center tabular-nums font-normal text-foreground ${colBg}`}
    >
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
    <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
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
