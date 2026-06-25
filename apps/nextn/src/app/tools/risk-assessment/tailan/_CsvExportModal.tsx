"use client";

import { useState, useMemo } from "react";
import type ExcelJS from "exceljs";
import {
  X,
  Download,
  FileSpreadsheet,
  LayoutList,
  Table2,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import {
  aggregateBranch,
  classifyBranchTableGroup,
  type BranchAggregate,
  type CatalogEntry,
} from "../scoring-rules";
import {
  evaluateBranchDynamic,
  type DynamicCatalogIndicator,
  type DynamicWeights,
} from "../use-indicator-config";
import type { RiskCurrentRow } from "@/lib/api";
import type { ManualMap } from "../indicator-catalog";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPLIT_SECTIONS = [
  {
    group: "UB" as const,
    title: "Улаанбаатар хотын Бизнес төв, салбар, тооцооны төвүүд",
  },
  {
    group: "ON" as const,
    title: "Орон нутгийн Бизнес төв, салбар, тооцооны төвүүд",
  },
] as const;

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

const HDR_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF374151" },
};

const SECTION_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

const LEVEL_FILL: Record<string, string> = {
  Өндөр: "FFFEE2E2",
  Дунд: "FFFEF3C7",
  Бага: "FFD1FAE5",
};

function solidSortKey(solid: string): number {
  const digits = String(solid ?? "").replace(/\D/g, "");
  if (!digits) return Number.MAX_SAFE_INTEGER;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function compareSolid(a: string, b: string): number {
  const na = solidSortKey(a);
  const nb = solidSortKey(b);
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), "mn", { numeric: true });
}

function parseSolidCell(solid: string): string | number {
  const s = String(solid ?? "").trim();
  return /^\d+$/.test(s) ? parseInt(s, 10) : s;
}

function pct(w: number): string {
  return `${(w * 100).toFixed(0)}%`;
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = BORDER;
}

function styleHeaderCell(cell: ExcelJS.Cell, value: string | number) {
  cell.value = value;
  cell.fill = HDR_FILL;
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  cell.border = BORDER;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

function levelFill(level: string): ExcelJS.Fill | undefined {
  const argb = LEVEL_FILL[level];
  if (!argb) return undefined;
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

type SummaryStats = {
  cur: { Өндөр: number; Дунд: number; Бага: number; Нийт: number };
  prev: { Өндөр: number; Дунд: number; Бага: number; Нийт: number };
  upCnt: number;
  downCnt: number;
  sameCnt: number;
  newCnt: number;
  transitions: Record<string, number>;
};

function computeSummary(
  agg: BranchAggregate[],
  prevMap: Map<string, BranchAggregate> | null,
): SummaryStats {
  const cur = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
  const prev = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
  let upCnt = 0,
    downCnt = 0,
    sameCnt = 0,
    newCnt = 0;
  const transitions: Record<string, number> = {};

  for (const b of agg) {
    cur.Нийт++;
    if (b.level) (cur as Record<string, number>)[b.level]++;
    const p = prevMap?.get(b.branchId);
    if (p) {
      prev.Нийт++;
      if (p.level) (prev as Record<string, number>)[p.level]++;
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
}

function splitByGroup(agg: BranchAggregate[]) {
  const ub: BranchAggregate[] = [];
  const on: BranchAggregate[] = [];
  for (const b of agg) {
    if (classifyBranchTableGroup(b.status, b.rating) === "UB") ub.push(b);
    else on.push(b);
  }
  ub.sort((a, b) => compareSolid(a.solid, b.solid));
  on.sort((a, b) => compareSolid(a.solid, b.solid));
  return { ub, on };
}

function writeBranchSection(
  ws: ExcelJS.Worksheet,
  startRow: number,
  sectionTitle: string,
  region: "UB" | "ON",
  rows: BranchAggregate[],
  prevMap: Map<string, BranchAggregate> | null,
  weights: DynamicWeights,
  primaryName: string,
  prevName: string | null,
): number {
  const w = weights[region === "UB" ? "UB" : "LOC"];
  const hasComp = !!prevMap && !!prevName;
  const colCount = hasComp ? 14 : 11;

  ws.mergeCells(startRow, 1, startRow, colCount);
  const titleCell = ws.getCell(startRow, 1);
  titleCell.value = sectionTitle;
  titleCell.fill = SECTION_FILL;
  titleCell.font = { bold: true, size: 11, color: { argb: "FF111827" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.border = BORDER;
  ws.getRow(startRow).height = 22;

  const weightRow = startRow + 1;
  ws.mergeCells(weightRow, 1, weightRow, colCount);
  const weightCell = ws.getCell(weightRow, 1);
  weightCell.value = `Жин: S1 ${pct(w.s1)} · S2 ${pct(w.s2)} · S3 ${pct(w.s3)} · S4 ${pct(w.s4)} · J ${pct(w.j)}  |  ${primaryName}${hasComp ? ` ↔ ${prevName}` : ""}`;
  weightCell.font = { size: 9, color: { argb: "FF6B7280" } };
  weightCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFAFAFA" },
  };
  weightCell.border = BORDER;
  weightCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(weightRow).height = 18;

  const hdrRowNum = startRow + 2;
  const hdrRow = ws.getRow(hdrRowNum);
  const headers = [
    "№",
    "SOL",
    "Салбарын нэр",
    "Зэрэглэл",
    `Score 1 (${pct(w.s1)})`,
    `Score 2 (${pct(w.s2)})`,
    `Score 3 (${pct(w.s3)})`,
    `Score 4 (${pct(w.s4)})`,
    `Judgement (${pct(w.j)})`,
    "Total",
    "Эрсдэлийн түвшин",
    ...(hasComp ? ["Өмнөх Total", "Өмнөх түвшин", "Зөрүү"] : []),
  ];
  headers.forEach((h, i) => styleHeaderCell(hdrRow.getCell(i + 1), h));
  hdrRow.height = 24;

  let r = hdrRowNum + 1;
  rows.forEach((b, idx) => {
    const row = ws.getRow(r);
    const prev = prevMap?.get(b.branchId);
    const diff =
      prev && b.total != null && prev.total != null
        ? b.total - prev.total
        : null;

    const values: (string | number | null)[] = [
      idx + 1,
      parseSolidCell(b.solid),
      b.branchName,
      b.rating,
      b.s1,
      b.s2,
      b.s3,
      b.s4,
      b.j,
      b.total,
      b.level || "",
    ];
    if (hasComp) {
      values.push(
        prev ? (prev.total ?? null) : "—",
        prev ? prev.level || "" : "—",
        diff != null ? diff : null,
      );
    }

    const zebra =
      idx % 2 === 0
        ? {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "FFFFFFFF" },
          }
        : {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "FFF9FAFB" },
          };

    values.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val as ExcelJS.CellValue;
      cell.fill = zebra;
      cell.font = { size: 10 };
      applyBorder(cell);

      if (ci === 0 || ci === 1 || ci === 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        if (ci === 1 && typeof val === "number") cell.numFmt = "0";
      } else if (ci === 2) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
          wrapText: true,
        };
      } else if (ci === 10 && typeof val === "string" && val) {
        const lf = levelFill(val);
        if (lf) cell.fill = lf;
        cell.font = { bold: true, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (hasComp && ci === 11 && typeof val === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (hasComp && ci === 11) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (
        hasComp &&
        ci === 12 &&
        typeof val === "string" &&
        val &&
        val !== "—"
      ) {
        const lf = levelFill(val);
        if (lf) cell.fill = lf;
        cell.font = { bold: true, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (hasComp && ci === 12) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (hasComp && ci === 13 && typeof val === "number") {
        cell.numFmt = "+0.00;-0.00;0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.font = {
          bold: true,
          size: 10,
          color: {
            argb: val > 0 ? "FFDC2626" : val < 0 ? "FF059669" : "FF6B7280",
          },
        };
      } else if (typeof val === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
    });
    row.height = 18;
    r++;
  });

  if (rows.length === 0) {
    ws.mergeCells(r, 1, r, colCount);
    const empty = ws.getCell(r, 1);
    empty.value = "Салбар олдсонгүй";
    empty.font = { italic: true, color: { argb: "FF9CA3AF" }, size: 10 };
    empty.alignment = { horizontal: "center" };
    applyBorder(empty);
    r++;
  }

  ws.columns.forEach((col, i) => {
    const widths = [5, 8, 28, 10, 11, 11, 11, 11, 12, 9, 14, 10, 12, 10];
    col.width = widths[i] ?? 12;
  });

  return r + 1;
}

function writeSummaryTables(
  ws: ExcelJS.Worksheet,
  startRow: number,
  summary: SummaryStats,
  hasComp: boolean,
): number {
  const tables = [
    {
      title: "1. ҮНЭЛГЭЭ",
      headers: hasComp ? ["Үзүүлэлт", "Одоо", "Өмнө"] : ["Үзүүлэлт", "Одоо"],
      rows: [
        ["Өндөр", summary.cur.Өндөр, summary.prev.Өндөр],
        ["Дунд", summary.cur.Дунд, summary.prev.Дунд],
        ["Бага", summary.cur.Бага, summary.prev.Бага],
        ["Нийт", summary.cur.Нийт, summary.prev.Нийт],
      ],
    },
    {
      title: "2. ҮНЭЛГЭЭНИЙ ӨӨРЧЛӨЛТ",
      headers: ["Үзүүлэлт", "Тоо"],
      rows: [
        ["Үнэлгээ өссөн", summary.upCnt],
        ["Үнэлгээ буурсан", summary.downCnt],
        ["Үнэлгээ өөрчлөлтгүй", summary.sameCnt],
        ["Шинээр нэмэгдсэн", summary.newCnt],
        ["Нийт", summary.cur.Нийт],
      ],
    },
    {
      title: "3. ТҮВШИН ӨӨРЧЛӨЛТ",
      headers: ["Үзүүлэлт", "Тоо"],
      rows: [
        ...[
          "Өндөр-Өндөр",
          "Өндөр-Дунд",
          "Өндөр-Бага",
          "Дунд-Өндөр",
          "Дунд-Дунд",
          "Дунд-Бага",
          "Бага-Өндөр",
          "Бага-Дунд",
          "Бага-Бага",
        ].map((k) => [k, summary.transitions[k] || 0]),
        ["Шинээр нэмэгдсэн", summary.newCnt],
        ["Нийт", summary.cur.Нийт],
      ],
    },
  ];

  const colWidth = hasComp ? 3 : 2;
  const blockWidth = colWidth;
  const gap = 1;

  ws.mergeCells(startRow, 1, startRow, colWidth * 3 + gap * 2);
  const mainTitle = ws.getCell(startRow, 1);
  mainTitle.value = "Хураангуй статистик";
  mainTitle.font = { bold: true, size: 12, color: { argb: "FF111827" } };
  mainTitle.alignment = { horizontal: "left" };
  startRow++;

  tables.forEach((tbl, ti) => {
    const colStart = ti * (blockWidth + gap) + 1;

    ws.mergeCells(startRow, colStart, startRow, colStart + blockWidth - 1);
    const tCell = ws.getCell(startRow, colStart);
    tCell.value = tbl.title;
    tCell.fill = SECTION_FILL;
    tCell.font = { bold: true, size: 10 };
    tCell.border = BORDER;
    tCell.alignment = { horizontal: "center" };

    const hRow = ws.getRow(startRow + 1);
    tbl.headers.forEach((h, hi) => {
      styleHeaderCell(hRow.getCell(colStart + hi), h);
    });

    tbl.rows.forEach((rowData, ri) => {
      const row = ws.getRow(startRow + 2 + ri);
      rowData.forEach((val, ci) => {
        const cell = row.getCell(colStart + ci);
        cell.value = val as ExcelJS.CellValue;
        applyBorder(cell);
        cell.font = {
          size: 10,
          bold: ri === tbl.rows.length - 1,
        };
        cell.alignment = {
          horizontal: ci === 0 ? "left" : "center",
          vertical: "middle",
        };
        if (typeof val === "number") cell.numFmt = "0";
      });
    });

    ws.getColumn(colStart).width = 18;
    for (let c = colStart + 1; c < colStart + blockWidth; c++) {
      ws.getColumn(c).width = 8;
    }
  });

  const maxRows = Math.max(...tables.map((t) => t.rows.length));
  return startRow + 2 + maxRows + 2;
}

async function downloadSummaryXlsx(
  agg: BranchAggregate[],
  prevAgg: BranchAggregate[] | null,
  primaryName: string,
  primaryDate: string,
  prevName: string | null,
  weights: DynamicWeights,
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "DaHUB Risk Assessment";
  wb.created = new Date();

  const ws = wb.addWorksheet("Тайлан", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const prevMap = prevAgg ? new Map(prevAgg.map((a) => [a.branchId, a])) : null;
  const hasComp = !!prevMap && !!prevName;
  const { ub, on } = splitByGroup(agg);
  const summary = computeSummary(agg, prevMap);

  ws.mergeCells(1, 1, 1, hasComp ? 14 : 11);
  const docTitle = ws.getCell(1, 1);
  docTitle.value = `БИЗНЕС ТӨВ, САЛБАР, ТООЦООНЫ ТӨВҮҮДИЙН ЭРСДЭЛИЙН ҮНЭЛГЭЭ — ${primaryName} (${primaryDate})`;
  docTitle.font = { bold: true, size: 14, color: { argb: "FF111827" } };
  docTitle.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;

  let row = 3;
  row = writeBranchSection(
    ws,
    row,
    SPLIT_SECTIONS[0].title,
    "UB",
    ub,
    prevMap,
    weights,
    primaryName,
    prevName,
  );
  row++;
  row = writeBranchSection(
    ws,
    row,
    SPLIT_SECTIONS[1].title,
    "ON",
    on,
    prevMap,
    weights,
    primaryName,
    prevName,
  );
  row++;
  if (hasComp) {
    writeSummaryTables(ws, row, summary, true);
  }

  return wb.xlsx.writeBuffer();
}

async function downloadIndicatorXlsx(
  rows: RiskCurrentRow[],
  catalog: DynamicCatalogIndicator[],
  manualMap: ManualMap,
  filterIds: Set<string> | null,
  primaryDate: string,
  primaryName: string,
  includeRaw: boolean,
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Indicator", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const sortedInd = [...catalog]
    .filter((c) => !filterIds || filterIds.has(c.id))
    .sort((a, b) => a.group - b.group || a.id.localeCompare(b.id));

  const byBranch = new Map<string, { name: string; rows: RiskCurrentRow[] }>();
  for (const r of rows) {
    if (r.rowType !== "oracle") continue;
    const id = String(r.SOLID ?? "");
    if (!id) continue;
    if (!byBranch.has(id))
      byBranch.set(id, { name: String(r.BRANCHNAME ?? ""), rows: [] });
    byBranch.get(id)!.rows.push(r);
  }

  const headers = [
    "Салбарын нэр",
    "SOLID",
    ...sortedInd.flatMap((c) =>
      includeRaw
        ? [`[G${c.group}] ${c.name} (Оноо)`, `[G${c.group}] ${c.name} (Утга)`]
        : [`[G${c.group}] ${c.name}`],
    ),
  ];
  const colCount = headers.length;

  ws.mergeCells(1, 1, 1, Math.min(colCount, 10));
  ws.getCell(1, 1).value =
    `Эрсдэлийн үнэлгээ — Indicator (${primaryName} · ${primaryDate})`;
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, Math.min(colCount, 10));
  ws.getCell(2, 1).value = includeRaw
    ? "Дэлгэрэнгүй — indicator бүрт оноо + Oracle утга"
    : "Indicator тус бүрийн оноо";
  ws.getCell(2, 1).font = { size: 9, color: { argb: "FF6B7280" } };

  const hdrRow = ws.getRow(4);
  headers.forEach((h, i) => styleHeaderCell(hdrRow.getCell(i + 1), h));
  hdrRow.height = 36;

  const branchEntries = [...byBranch.entries()].sort((a, b) =>
    compareSolid(a[0], b[0]),
  );

  branchEntries.forEach(([solid, b], idx) => {
    const ev = evaluateBranchDynamic(catalog, b.rows, manualMap[solid]);
    const row = ws.getRow(5 + idx);
    const values: (string | number | null)[] = [b.name, parseSolidCell(solid)];
    for (const c of sortedInd) {
      const val = ev[c.id];
      values.push(val?.score != null ? val.score : null);
      if (includeRaw) values.push(val?.autoRaw ?? "");
    }

    const zebra =
      idx % 2 === 0
        ? {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "FFFFFFFF" },
          }
        : {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "FFEFF6FF" },
          };

    values.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val as ExcelJS.CellValue;
      cell.fill = zebra;
      cell.font = { size: 9 };
      applyBorder(cell);
      if (ci === 0) {
        cell.alignment = { horizontal: "left", wrapText: true };
      } else if (ci === 1) {
        cell.alignment = { horizontal: "center" };
        if (typeof val === "number") cell.numFmt = "0";
      } else if (typeof val === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { horizontal: "right" };
      } else {
        cell.alignment = { horizontal: "left", wrapText: true };
      }
    });
    row.height = 18;
  });

  ws.columns.forEach((col, i) => {
    col.width = i === 0 ? 26 : i === 1 ? 10 : includeRaw ? 16 : 14;
  });

  if (branchEntries.length > 0) {
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + branchEntries.length, column: colCount },
    };
  }

  return wb.xlsx.writeBuffer();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  primaryRows: RiskCurrentRow[];
  primaryManualMap: ManualMap;
  primaryName: string;
  primaryDate: string;
  prevRows: RiskCurrentRow[];
  prevManualMap: ManualMap;
  prevName: string | null;
  catalog: DynamicCatalogIndicator[];
  weights: DynamicWeights;
  currentComparisonId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CsvExportModal({
  open,
  onClose,
  primaryRows,
  primaryManualMap,
  primaryName,
  primaryDate,
  prevRows,
  prevManualMap,
  prevName,
  catalog,
  weights,
}: Props) {
  type ExportMode = "summary" | "indicator";

  const [mode, setMode] = useState<ExportMode>("summary");
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeRaw, setIncludeRaw] = useState(false);

  const [selectedIndIds, setSelectedIndIds] = useState<Set<string> | null>(
    null,
  );
  const [indFilterOpen, setIndFilterOpen] = useState(false);

  const indByGroup = useMemo(() => {
    const m = new Map<number, DynamicCatalogIndicator[]>();
    for (const c of [...catalog].sort(
      (a, b) => a.group - b.group || a.name.localeCompare(b.name),
    )) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    return m;
  }, [catalog]);

  const allIds = useMemo(() => new Set(catalog.map((c) => c.id)), [catalog]);
  const effectiveSelected = selectedIndIds ?? allIds;
  const allSelected =
    selectedIndIds === null || selectedIndIds.size === allIds.size;

  function toggleInd(id: string) {
    setSelectedIndIds((prev) => {
      const cur = prev ?? new Set(allIds);
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === allIds.size ? null : next;
    });
  }

  function toggleGroup(groupIds: string[]) {
    setSelectedIndIds((prev) => {
      const cur = prev ?? new Set(allIds);
      const allIn = groupIds.every((id) => cur.has(id));
      const next = new Set(cur);
      if (allIn) groupIds.forEach((id) => next.delete(id));
      else groupIds.forEach((id) => next.add(id));
      return next.size === allIds.size ? null : next;
    });
  }

  function selectAll() {
    setSelectedIndIds(null);
  }
  function clearAll() {
    setSelectedIndIds(new Set());
  }

  const hasComparison = prevRows.length > 0 && prevName != null;
  const catalogCasted = catalog as unknown as CatalogEntry[];

  const primaryJudgeMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [branchId, indMap] of Object.entries(primaryManualMap)) {
      const v = (indMap as Record<string, number>)["j-001"];
      if (v && v > 0) m[branchId] = v;
    }
    return m;
  }, [primaryManualMap]);

  const prevJudgeMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [branchId, indMap] of Object.entries(prevManualMap)) {
      const v = (indMap as Record<string, number>)["j-001"];
      if (v && v > 0) m[branchId] = v;
    }
    return m;
  }, [prevManualMap]);

  const primaryAgg = useMemo(
    () =>
      aggregateBranch(
        primaryRows.filter((r) => r.rowType === "oracle"),
        {},
        primaryJudgeMap,
        catalogCasted,
      ),
    [primaryRows, primaryJudgeMap, catalogCasted],
  );

  const prevAgg = useMemo(
    () =>
      hasComparison && includeComparison
        ? aggregateBranch(
            prevRows.filter((r) => r.rowType === "oracle"),
            {},
            prevJudgeMap,
            catalogCasted,
          )
        : null,
    [prevRows, hasComparison, includeComparison, prevJudgeMap, catalogCasted],
  );

  const doDownload = async () => {
    if (mode === "summary") {
      const buf = await downloadSummaryXlsx(
        primaryAgg,
        prevAgg,
        primaryName,
        primaryDate,
        prevName,
        weights,
      );
      triggerDownload(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `risk-tailan-${primaryDate}.xlsx`,
      );
    } else {
      const buf = await downloadIndicatorXlsx(
        primaryRows,
        catalog,
        primaryManualMap,
        selectedIndIds,
        primaryDate,
        primaryName,
        includeRaw,
      );
      triggerDownload(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `risk-indicators-${primaryDate}${includeRaw ? "-detailed" : ""}.xlsx`,
      );
    }
    onClose();
  };

  if (!open) return null;

  const ubCount = primaryAgg.filter(
    (b) => classifyBranchTableGroup(b.status, b.rating) === "UB",
  ).length;
  const onCount = primaryAgg.length - ubCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-premium-xl ring-hairline p-6 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Excel тайлан татах
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {primaryName} · {primaryDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Формат
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("summary")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "summary"
                  ? "border-emerald-500/60 bg-emerald-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <LayoutList
                  className={`w-3.5 h-3.5 ${mode === "summary" ? "text-emerald-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-semibold ${mode === "summary" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}
                >
                  Тайлан
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                УБ / ОН 2 хүснэгт + харьцуулалт + 3 статистик
              </p>
            </button>

            <button
              onClick={() => setMode("indicator")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "indicator"
                  ? "border-blue-500/60 bg-blue-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Table2
                  className={`w-3.5 h-3.5 ${mode === "indicator" ? "text-blue-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-semibold ${mode === "indicator" ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}
                >
                  Дэлгэрэнгүй
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Indicator бүр тусдаа багана (Oracle утга сонголтоор)
              </p>
            </button>
          </div>
        </div>

        {mode === "summary" && (
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Харьцуулалт
            </p>
            {hasComparison ? (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setIncludeComparison((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    includeComparison ? "bg-emerald-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      includeComparison ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-xs text-foreground/80">
                  Өмнөх тайлан хамт оруулах
                  <span className="ml-1.5 text-muted-foreground text-[10px]">
                    ({prevName})
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">
                Харьцуулах тайлан сонгогдоогүй байна — хуудасны «Өмнөх улирал»
                dropdown-с сонгоно уу.
              </p>
            )}
          </div>
        )}

        {mode === "indicator" && (
          <>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Indicator шүүлтүүр
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Бүгд
                  </button>
                  <span className="text-muted-foreground text-[10px]">/</span>
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    Цэвэрлэх
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setIndFilterOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-xs text-foreground/80">
                    {allSelected
                      ? "Бүгд indicator сонгогдсон"
                      : `${effectiveSelected.size} / ${allIds.size} indicator сонгогдсон`}
                  </span>
                  {indFilterOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>

                {indFilterOpen && (
                  <div className="max-h-52 overflow-y-auto divide-y divide-border/50">
                    {[...indByGroup.entries()].map(([grp, inds]) => {
                      const groupIds = inds.map((c) => c.id);
                      const allGroupIn = groupIds.every((id) =>
                        effectiveSelected.has(id),
                      );
                      const someGroupIn = groupIds.some((id) =>
                        effectiveSelected.has(id),
                      );
                      return (
                        <div key={grp}>
                          <button
                            onClick={() => toggleGroup(groupIds)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                                allGroupIn
                                  ? "bg-blue-500 border-blue-500"
                                  : someGroupIn
                                    ? "bg-blue-500/40 border-blue-400"
                                    : "border-border bg-background"
                              }`}
                            >
                              {(allGroupIn || someGroupIn) && (
                                <Check className="w-2.5 h-2.5 text-white" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-foreground/70">
                              Score {grp}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {
                                groupIds.filter((id) =>
                                  effectiveSelected.has(id),
                                ).length
                              }
                              /{groupIds.length}
                            </span>
                          </button>
                          {inds.map((ind) => {
                            const checked = effectiveSelected.has(ind.id);
                            return (
                              <button
                                key={ind.id}
                                onClick={() => toggleInd(ind.id)}
                                className="w-full flex items-center gap-2 pl-7 pr-3 py-1 hover:bg-muted/30 transition-colors text-left"
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                                    checked
                                      ? "bg-blue-500 border-blue-500"
                                      : "border-border bg-background"
                                  }`}
                                >
                                  {checked && (
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  )}
                                </div>
                                <span className="text-[11px] text-foreground/80 truncate">
                                  {ind.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Агуулга
              </p>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setIncludeRaw((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    includeRaw ? "bg-blue-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      includeRaw ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
                <div>
                  <span className="text-xs text-foreground/80">
                    Oracle утга хамт татах
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Indicator бүрт оноо + бодит утга (RESULT) хоёр багана
                  </p>
                </div>
              </label>
            </div>
          </>
        )}

        <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 mb-5 space-y-0.5">
          {mode === "summary" ? (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">УБ салбар</span>
                <span className="font-semibold tabular-nums">{ubCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">ОН салбар</span>
                <span className="font-semibold tabular-nums">{onCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Харьцуулалт</span>
                <span className="font-semibold">
                  {hasComparison && includeComparison ? prevName : "—"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Салбар</span>
                <span className="font-semibold tabular-nums">
                  {primaryAgg.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Indicator</span>
                <span className="font-semibold tabular-nums">
                  {allSelected ? catalog.length : effectiveSelected.size}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted/40 transition-colors"
          >
            Болих
          </button>
          <button
            onClick={doDownload}
            disabled={mode === "indicator" && effectiveSelected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-premium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Excel татах
          </button>
        </div>
      </div>
    </div>
  );
}
