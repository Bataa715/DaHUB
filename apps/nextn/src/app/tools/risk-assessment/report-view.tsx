"use client";

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import Cookies from "js-cookie";
import { useLanguage } from "@/contexts/LanguageContext";
import { riskApi, HOLD_GLOBAL_PERIOD } from "@/lib/api";
import {
  aggregateBranch,
  classifyBranchTableGroup,
  type BranchAggregate,
  type RiskLevel,
} from "./scoring-rules";
import { type ManualMap } from "./indicator-catalog";
import {
  pickJudgmentIndicator,
  resolveBranchJudgementScore,
} from "./branch-resolve";
import {
  useIndicatorConfig,
  evaluateBranchDynamic,
  computeGroupScoresDynamic,
} from "./use-indicator-config";
import { type AnyRow } from "./_report-view/types";
import { ReportTable } from "./_report-view/report-table";
import { SummaryBlock, SRow } from "./_report-view/summary-blocks";

// localStorage key зайлсхийж — ClickHouse-д хадгалдаг болсон
// (backward-compat: localStorage-д юу байвал нэг удаа migrate хийнэ)

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
  /** Toolbar-ийн зүүн талд нэмэлт шүүлт (жишээ: сар/улирал) */
  toolbarStart?: ReactNode;
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
  toolbarStart,
}: Props) {
  const { t } = useLanguage();
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

  // Анхнаасаа Total буурахаар эрэмбэ (sortKey=1). SOLID дараалал руу товчоор буцна.
  const [sortKey, setSortKey] = useState<number>(1);
  const [tableLayout, setTableLayout] = useState<TableLayout>("unified");

  /** Holds/catalog хүлээлгүй хүснэгтийг харуулна — сар солиход бүү нуу. */
  const scoringReady = holdsLoaded && dynamicConfig.loaded;
  const scoringReadyOnce = useRef(false);
  if (scoringReady) scoringReadyOnce.current = true;
  const showScoredTable =
    scoredRows.length > 0 && (scoringReady || scoringReadyOnce.current);

  const sortedFiltered = useMemo(() => {
    const bySolid = (a: BranchAggregate, b: BranchAggregate) => {
      const na = parseFloat(a.solid) || 0;
      const nb = parseFloat(b.solid) || 0;
      if (na !== nb) return na - nb;
      return a.solid.localeCompare(b.solid);
    };
    if (sortKey === 0) return [...filtered].sort(bySolid);
    // Зөвхөн Total-аар (том → жижиг) — judgement-first биш, дахин эрэмбэлэх хөдөлгөөн гаргахгүй
    return [...filtered].sort((a, b) => {
      const dt = (b.total ?? 0) - (a.total ?? 0);
      if (dt !== 0) return dt;
      return a.solid.localeCompare(b.solid, undefined, { numeric: true });
    });
  }, [filtered, sortKey]);

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
  const previousAggs = useMemo<BranchAggregate[]>(
    () =>
      getAggregates(
        previousScoredRows,
        previousManualMap,
        previousJudgements ?? {},
      ),
    [
      previousScoredRows,
      previousManualMap,
      previousJudgements,
      getAggregates,
    ],
  );

  const previousAggMap = useMemo<Map<string, BranchAggregate>>(
    () => new Map(previousAggs.map((b) => [b.branchId, b])),
    [previousAggs],
  );

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

  // Summary — cur/prev/transitions; сар+улирлын аль алинд previousAggs-аас шууд тооцно
  const summary = useMemo(() => {
    const cur = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
    const prev = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
    let upCnt = 0,
      downCnt = 0,
      sameCnt = 0,
      newCnt = 0;
    const transitions: Record<string, number> = {};

    for (const p of previousAggs) {
      prev.Нийт++;
      if (p.level === "Өндөр" || p.level === "Дунд" || p.level === "Бага") {
        prev[p.level]++;
      }
    }

    for (const b of aggregates) {
      cur.Нийт++;
      if (b.level === "Өндөр" || b.level === "Дунд" || b.level === "Бага") {
        cur[b.level]++;
      }
      const p = previousAggMap.get(b.branchId);
      if (p) {
        if (b.total != null && p.total != null) {
          const diff = b.total - p.total;
          if (Math.abs(diff) < 0.005) sameCnt++;
          else if (diff > 0) upCnt++;
          else downCnt++;
        }
        if (p.level && b.level) {
          const k = `${p.level}-${b.level}`;
          transitions[k] = (transitions[k] || 0) + 1;
        }
      } else {
        newCnt++;
      }
    }
    return { cur, prev, upCnt, downCnt, sameCnt, newCnt, transitions };
  }, [aggregates, previousAggs, previousAggMap]);

  if (scoredRows.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="text-sm font-semibold">
          {t("raReportViewNoDataTitle")}
        </div>
        <div className="text-xs mt-1 text-muted-foreground">
          {t("raReportViewNoDataSubtitle")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-5 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* ── Fallback config анхааруулга ── */}
      {dynamicConfig.isFallback && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-[12px] text-amber-400">
          <span className="text-base">⚠</span>
          <span>
            <b>{t("raReportViewOfflineBadge")}</b> {t("raReportViewOfflineMsg")}
          </span>
        </div>
      )}
      {/* ── Toolbar ── */}
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap">
          <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap min-w-0">
            {toolbarStart}
            {toolbarStart ? (
              <div className="w-px h-4 bg-border/80 shrink-0 hidden sm:block" />
            ) : null}
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
                    {opt === "all" ? t("admRegAllTab") : opt}
                  </button>
                );
              })}
            </div>
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
                  ? t("raReportViewSplitViewTooltip")
                  : t("raReportViewUnifiedViewTooltip")
              }
            >
              {tableLayout === "unified"
                ? t("raReportViewSplitViewBtn")
                : t("raReportViewUnifiedViewBtn")}
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
                  ? t("raReportViewSortBySolidTooltip")
                  : t("raReportViewSortByTotalTooltip")
              }
            >
              {sortKey > 0
                ? t("raReportViewSortBySolidBtn")
                : t("raReportViewSortByTotalBtn")}
            </button>
          </div>
        </div>
      </div>

      {!showScoredTable ? null : tableLayout === "unified" ? (
        <ReportTable
          title={t("raReportViewUnifiedTitle")}
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
                title={
                  section.group === "UB"
                    ? t("raReportViewUbSectionTitle")
                    : t("raReportViewOnSectionTitle")
                }
                region={section.region}
                rows={sectionRows}
                {...reportTableProps}
              />
            );
          })}
        </div>
      )}
      {/* Summary */}
      {showScoredTable && !hideComparison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryBlock
            title={t("raReportViewEval1Title")}
            cols={[t("raReportViewColIndicator"), t("raReportViewColNow"), t("raReportViewColPrev")]}
          >
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
            title={t("raReportViewEval2Title")}
            cols={[t("raReportViewColIndicator"), t("raReportViewColCount")]}
          >
            <SRow label={t("raReportViewScoreUp")} v={summary.upCnt} />
            <SRow label={t("raReportViewScoreDown")} v={summary.downCnt} />
            <SRow label={t("raReportViewScoreNoChange")} v={summary.sameCnt} />
            <SRow label={t("raReportViewNewlyAdded")} v={summary.newCnt} />
            <SRow label="Нийт" v={summary.cur.Нийт} bold />
          </SummaryBlock>
          <SummaryBlock
            title={t("raReportViewEval3Title")}
            cols={[t("raReportViewColIndicator"), t("raReportViewColCount")]}
          >
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
            <SRow label={t("raReportViewNewlyAdded")} v={summary.newCnt} />
            <SRow label="Нийт" v={summary.cur.Нийт} bold />
          </SummaryBlock>
        </div>
      )}
    </div>
  );
}
