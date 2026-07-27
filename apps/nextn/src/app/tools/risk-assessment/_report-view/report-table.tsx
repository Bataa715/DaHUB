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
import { ChevronDown, MessageSquare } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { riskLevelClass, type BranchAggregate } from "../scoring-rules";
import { type ManualMap } from "../indicator-catalog";
import {
  resolveJudgementComment,
  pickJudgmentIndicator,
  readJudgmentScoreFromManual,
  lookupJudgementScore,
} from "../branch-resolve";
import {
  type DynamicCatalogIndicator,
  type DynamicWeights,
} from "../use-indicator-config";
import { type AnyRow } from "./types";
import { IndicatorDetailRow } from "./indicator-detail-row";

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
  const { t } = useLanguage();
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
      className={`inline-flex items-center justify-center gap-1 font-semibold text-foreground tabular-nums ${
        canOpen ? "hover:text-amber-500 cursor-pointer" : "cursor-default"
      }`}
      title={
        jComment
          ? t("raReportViewViewCommentTooltip")
          : hasJ
            ? t("raReportViewNoCommentTooltip")
            : undefined
      }
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
    key: "level",
    label: "Түвшин",
    align: "center",
    defaultWidth: 88,
    minWidth: 72,
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
    key: "diff",
    label: "Зөрүү",
    align: "center",
    defaultWidth: 80,
    minWidth: 64,
    compareOnly: true,
  },
];

const REPORT_COL_LABEL_KEYS: Partial<Record<ReportColKey, TranslationKey>> = {
  name: "raSharedBranchNameCol",
  rating: "raReportViewRatingCol",
  level: "admTailanTplLevelLabel",
  prev: "raReportViewPrevCol",
  diff: "raReportViewDiffCol",
};

function reportColLabel(
  col: ReportColDef,
  t: (key: TranslationKey) => string,
): string {
  const key = REPORT_COL_LABEL_KEYS[col.key];
  return key ? t(key) : col.label;
}

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

export function ReportTable({
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
  const { t } = useLanguage();
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
    <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline w-full min-w-0 max-w-full">
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
            {rows.length} {t("raCsvExportBranchWord")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">
            {t("raReportViewWeightLabel")}
          </span>
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
            {t("raReportViewJudgementFilledLabel")}: {filledJCount}/{rows.length}
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
                  title={
                    col.key === "expand"
                      ? t("raReportViewExpandTooltip")
                      : undefined
                  }
                  className={cn(
                    "relative px-2 py-2.5 text-xs font-bold text-foreground bg-background select-none border-b border-border",
                    alignClass[col.align],
                    col.key === "total" || col.key === "diff"
                      ? "font-extrabold"
                      : undefined,
                  )}
                >
                  <span className="truncate block font-bold">
                    {reportColLabel(col, t)}
                  </span>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${reportColLabel(col, t)} ${t("raReportViewResizeColSuffix")}`}
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
                        title={t("raReportViewExpandTooltip")}
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
                    <td className="px-2 py-2 text-center tabular-nums text-foreground font-semibold">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums font-semibold text-foreground">
                      {b.solid}
                    </td>
                    <td className="px-2 py-2 font-semibold text-foreground">
                      {b.branchName}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-foreground font-semibold">
                      {b.rating}
                    </td>
                    <ScoreCell value={b.s1} colBg="bg-sky-500/[0.08]" />
                    <ScoreCell value={b.s2} colBg="bg-violet-500/[0.08]" />
                    <ScoreCell value={b.s3} colBg="bg-amber-500/[0.08]" />
                    <td className="px-2 py-2 text-center tabular-nums font-semibold text-foreground bg-emerald-500/[0.08]">
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
                          className="w-14 px-1 py-0.5 text-center text-xs rounded border border-rose-500/40 bg-background focus:outline-none focus:ring-2 focus:ring-rose-500/30 tabular-nums text-foreground font-semibold"
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
                                  ? t("raReportViewViewCommentTooltip")
                                  : t("raReportViewAddCommentTooltip")
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
                            className="group/jbtn inline-flex items-center gap-1 font-semibold text-foreground hover:text-amber-500 transition-colors"
                            title={t("raReportViewEditScoreTooltip")}
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
                    <td className="px-2 py-2 text-center tabular-nums font-semibold text-foreground bg-indigo-500/[0.08]">
                      {fmt(b.total)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {b.level && (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${riskLevelClass(b.level)}`}
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
                        {prev ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="tabular-nums font-semibold text-xs text-foreground">
                              {fmt(prev.total)}
                            </span>
                            {prev.level && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0 rounded text-[9px] font-semibold border ${riskLevelClass(prev.level)}`}
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
                    {!hideComparison && (
                      <td className="px-2 py-2 text-center">
                        {diff == null ? (
                          <span className="text-muted-foreground/30 text-xs">
                            —
                          </span>
                        ) : diff === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                            ━ 0.00
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
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
                    {t("raReportViewNoMatchInRegion")}
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
                {t("raReportViewCommentModalTitle")}
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
              placeholder={t("raReportViewCommentPlaceholder")}
              className="w-full min-h-[240px] px-3 py-2.5 rounded-xl border border-border bg-background text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCommentModal(null)}
                className="px-4 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/40 transition-colors"
              >
                {readOnly ? t("close") : t("cancel")}
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
                  {t("save")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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
      className={`px-2 py-2 text-center tabular-nums font-semibold text-foreground ${colBg}`}
    >
      {value == null ? "—" : value.toFixed(2)}
    </td>
  );
}
