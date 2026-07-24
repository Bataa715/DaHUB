"use client";

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { riskLevelClass, type BranchAggregate } from "../scoring-rules";
import { fmt } from "../hyanalt-shared";
import { cn } from "@/lib/utils";

type ColKey =
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

type ColDef = {
  key: ColKey;
  label: string;
  align: "left" | "center" | "right";
  defaultWidth: number;
  minWidth: number;
  /** Soft column background — Score / J / Total body cells only */
  colBg?: string;
  compareOnly?: boolean;
};

const COLS: ColDef[] = [
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
    colBg: "bg-sky-500/[0.08]",
  },
  {
    key: "s2",
    label: "Score 2",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
    colBg: "bg-violet-500/[0.08]",
  },
  {
    key: "s3",
    label: "Score 3",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
    colBg: "bg-amber-500/[0.08]",
  },
  {
    key: "s4",
    label: "Score 4",
    align: "center",
    defaultWidth: 72,
    minWidth: 52,
    colBg: "bg-emerald-500/[0.08]",
  },
  {
    key: "j",
    label: "J",
    align: "center",
    defaultWidth: 56,
    minWidth: 44,
    colBg: "bg-rose-500/[0.08]",
  },
  {
    key: "total",
    label: "Total",
    align: "center",
    defaultWidth: 96,
    minWidth: 72,
    colBg: "bg-indigo-500/[0.08]",
  },
  {
    key: "prev",
    label: "Өмнөх",
    align: "center",
    defaultWidth: 96,
    minWidth: 72,
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

const WIDTHS_KEY = "dahub-hyanalt-col-widths";

function readStoredWidths(): Partial<Record<ColKey, number>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WIDTHS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<ColKey, number>>;
  } catch {
    return {};
  }
}

export default function HyanaltScoreTable({
  rows,
  prevMap,
  compareDate,
  fromDateLabel = null,
  toDateLabel = null,
}: {
  rows: BranchAggregate[];
  prevMap: Map<string, BranchAggregate> | null;
  compareDate: string | null;
  /** Өмнөх баганын гарчигт харуулах огноо */
  fromDateLabel?: string | null;
  /** Total баганын гарчигт харуулах огноо */
  toDateLabel?: string | null;
}) {
  const showCompare = !!prevMap && !!compareDate;
  const visibleCols = useMemo(() => {
    const cols = COLS.filter((c) => (c.compareOnly ? showCompare : true));
    return cols.map((c) => {
      if (c.key === "prev" && fromDateLabel) {
        return { ...c, label: fromDateLabel };
      }
      if (c.key === "total" && toDateLabel && showCompare) {
        return { ...c, label: toDateLabel };
      }
      return c;
    });
  }, [showCompare, fromDateLabel, toDateLabel]);

  const [widths, setWidths] = useState<Partial<Record<ColKey, number>>>({});

  useEffect(() => {
    setWidths(readStoredWidths());
  }, []);

  const widthOf = useCallback(
    (col: ColDef) => widths[col.key] ?? col.defaultWidth,
    [widths],
  );

  const onResizeStart = useCallback(
    (e: ReactMouseEvent, col: ColDef) => {
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
            localStorage.setItem(WIDTHS_KEY, JSON.stringify(merged));
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

  if (rows.length === 0) return null;

  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  } as const;

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
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
          <thead>
            <tr>
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "relative px-2 py-2.5 text-xs font-bold text-foreground bg-background select-none border-b border-border",
                    alignClass[col.align],
                  )}
                >
                  <span className="truncate block">{col.label}</span>
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
              const prev = prevMap?.get(b.branchId);
              const diff =
                showCompare && prev && b.total != null && prev.total != null
                  ? b.total - prev.total
                  : null;

              const cell = (key: ColKey) => {
                switch (key) {
                  case "num":
                    return (
                      <span className="tabular-nums text-foreground font-bold">
                        {i + 1}
                      </span>
                    );
                  case "solid":
                    return (
                      <span className="tabular-nums font-bold text-foreground">
                        {b.solid}
                      </span>
                    );
                  case "name":
                    return (
                      <span className="font-bold text-foreground truncate block">
                        {b.branchName}
                      </span>
                    );
                  case "rating":
                    return (
                      <span className="text-xs text-foreground font-bold">
                        {b.rating}
                      </span>
                    );
                  case "s1":
                    return (
                      <span className="tabular-nums font-bold text-foreground">
                        {fmt(b.s1)}
                      </span>
                    );
                  case "s2":
                    return (
                      <span className="tabular-nums font-bold text-foreground">
                        {fmt(b.s2)}
                      </span>
                    );
                  case "s3":
                    return (
                      <span className="tabular-nums font-bold text-foreground">
                        {fmt(b.s3)}
                      </span>
                    );
                  case "s4":
                    return (
                      <span className="tabular-nums font-bold text-foreground">
                        {(b.s4 ?? 0) > 0 ? fmt(b.s4) : "—"}
                      </span>
                    );
                  case "j":
                    return (
                      <span className="tabular-nums font-bold text-foreground">
                        {(b.j ?? 0) > 0 ? fmt(b.j) : "—"}
                      </span>
                    );
                  case "total":
                    return (
                      <span className="tabular-nums font-bold text-foreground">
                        {fmt(b.total)}
                      </span>
                    );
                  case "prev":
                    return prev ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="tabular-nums font-bold text-xs text-foreground">
                          {fmt(prev.total)}
                        </span>
                        {prev.level && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0 rounded text-[9px] font-bold border ${riskLevelClass(prev.level)}`}
                          >
                            {prev.level}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    );
                  case "level":
                    return b.level ? (
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${riskLevelClass(b.level)}`}
                        >
                          {b.level}
                        </span>
                        {showCompare &&
                          prev?.level &&
                          prev.level !== b.level && (
                            <span
                              className={`text-[9px] font-semibold ${
                                (prev.level === "Бага" && b.level !== "Бага") ||
                                (prev.level === "Дунд" && b.level === "Өндөр")
                                  ? "text-muted-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {prev.level} → {b.level}
                            </span>
                          )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    );
                  case "diff":
                    return diff == null ? (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    ) : diff === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-muted text-[10px] font-medium text-muted-foreground">
                        ━ 0.00
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-muted/50 text-[10px] font-medium text-foreground">
                        {diff > 0 ? "▲" : "▼"} {diff > 0 ? "+" : ""}
                        {diff.toFixed(2)}
                      </span>
                    );
                  default:
                    return null;
                }
              };

              return (
                <tr
                  key={b.branchId}
                  className="border-t border-border hover:bg-muted/20"
                >
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-2 py-2 border-r border-border/40 last:border-r-0 overflow-hidden",
                        alignClass[col.align],
                        col.colBg,
                      )}
                    >
                      {cell(col.key)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
