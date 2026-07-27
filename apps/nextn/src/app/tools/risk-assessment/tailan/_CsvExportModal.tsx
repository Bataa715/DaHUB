"use client";

import { useState, useMemo, useEffect } from "react";
import type ExcelJS from "exceljs";
import { useLanguage } from "@/contexts/LanguageContext";
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
  classifyBranchTableGroup,
  type BranchAggregate,
} from "../scoring-rules";
import {
  evaluateBranchDynamic,
  computeBranchAggregates,
  pickJudgmentIndicator,
  nonJudgmentIndicators,
  type DynamicCatalogIndicator,
  type DynamicWeights,
} from "../use-indicator-config";
import {
  resolveManualBranch,
  resolveJudgementComment,
  resolveJudgementScoreFromMaps,
  mergeJudgementsIntoManualMap,
} from "../branch-resolve";
import { riskApi, HOLD_GLOBAL_PERIOD, type RiskCurrentRow } from "@/lib/api";
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

// ── Excel template theme ──────────────────────────────────────────────────────
// Веб дэх тайлангийн хүснэгттэй ЯГ ижил өнгөний логик: S1=цэнхэр(sky),
// S2=нил ягаан(violet), S3=шар(amber), S4=ногоон(emerald), J=улаан(rose),
// Total=индиго. Эрсдэлийн түвшин (Өндөр/Дунд/Бага) нь мөн веб дэх
// riskLevelClass-тай яг ижил rose/amber/emerald гэр бүлийн өнгө ашиглана.
// Ганц нэгдмэл "брэнд өнгө" байхгүй — багана бүр өөрийн өнгөтэй.

const C = {
  ink: "FF1F2933",
  muted: "FF6B7680",
  line: "FFC9CFD4",
  lineSoft: "FFDCE1E4",
  white: "FFFFFFFF",
  zebra: "FFF7F8F9",

  // Төвийг сахисан (neutral) гарчиг/банер өнгө — веб дэх header-үүд шиг цайвар цэвэр.
  headerNeutral: "FFEEF1F4",
  bannerNeutral: "FFE3E7EB",
  titleBg: "FFF5F6F8",

  ub: "FFDDE8F5", // цайвар цэнхэр — УБ бүлгийн өнгө
  ubSoft: "FFEEF4FA",
  on: "FFD8F0E8", // цайвар ногоон — ОН бүлгийн өнгө
  onSoft: "FFEEF7F3",

  // Веб дэх S1–S4 / J / Total баганын өнгөтэй яг тохирсон pastel хос
  // (header = арай тод, өгөгдлийн нүд = маш цайвар tint).
  s1Hdr: "FFB7E4F8",
  s1: "FFDDF2FC", // sky
  s2Hdr: "FFDCCEFC",
  s2: "FFEFE8FE", // violet
  s3Hdr: "FFFCE2B6",
  s3: "FFFEF1DD", // amber
  s4Hdr: "FFB7EAD9",
  s4: "FFDEF5ED", // emerald
  jHdr: "FFFCC5CF",
  j: "FFFDE4E8", // rose
  totalHdr: "FFD0D1FB",
  total: "FFE9EAFD", // indigo

  // Эрсдэлийн түвшин — riskLevelClass-тай ижил rose/amber/emerald гэр бүл
  high: "FFFDE4E8", // Өндөр — rose
  mid: "FFFEF1DD", // Дунд — amber
  low: "FFDEF5ED", // Бага — emerald

  up: "FF8B3A3A", // өсөлт
  down: "FF2F5233", // бууралт
  prevHdr: "FFE8E5F8", // цайвар нил ягаан — өмнөх үзүүлэлт
} as const;

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: C.line } },
  left: { style: "thin", color: { argb: C.line } },
  bottom: { style: "thin", color: { argb: C.line } },
  right: { style: "thin", color: { argb: C.line } },
};

// Мөр хоорондын дотоод шугам — цэгэн (dashed), Голомтын стандарт хүснэгтийн
// загвартай (docx тайлан) ижил.
const BORDER_SOFT: Partial<ExcelJS.Borders> = {
  top: { style: "dashed", color: { argb: C.lineSoft } },
  left: { style: "dashed", color: { argb: C.lineSoft } },
  bottom: { style: "dashed", color: { argb: C.lineSoft } },
  right: { style: "dashed", color: { argb: C.lineSoft } },
};

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function applyBorder(cell: ExcelJS.Cell, soft = false) {
  cell.border = soft ? BORDER_SOFT : BORDER;
}

function styleHeaderCell(
  cell: ExcelJS.Cell,
  value: string | number,
  fillArgb: string = C.headerNeutral,
) {
  cell.value = value;
  cell.fill = solidFill(fillArgb);
  // Дэвсгэр нь цайвар (гэгээлгэн) тул текст бараан бичигтэй байна.
  cell.font = { bold: true, color: { argb: C.ink }, size: 9, name: "Calibri" };
  cell.border = BORDER;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

function levelFill(level: string): ExcelJS.Fill | undefined {
  const map: Record<string, string> = {
    Өндөр: C.high,
    Дунд: C.mid,
    Бага: C.low,
  };
  const argb = map[level];
  return argb ? solidFill(argb) : undefined;
}

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

function buildAggLookup(agg: BranchAggregate[]): Map<string, BranchAggregate> {
  const m = new Map<string, BranchAggregate>();
  for (const b of agg) {
    m.set(b.branchId, b);
    if (b.solid) {
      m.set(String(b.solid), b);
      const sn = String(b.solid).replace(/^0+/, "") || String(b.solid);
      m.set(sn, b);
    }
    const bn = String(b.branchId).replace(/^0+/, "") || b.branchId;
    m.set(bn, b);
  }
  return m;
}

function lookupAgg(
  solid: string,
  map: Map<string, BranchAggregate>,
): BranchAggregate | undefined {
  const key = String(solid ?? "").trim();
  return map.get(key) ?? map.get(key.replace(/^0+/, "") || key);
}

function parseSolidCell(solid: string): string | number {
  const s = String(solid ?? "").trim();
  return /^\d+$/.test(s) ? parseInt(s, 10) : s;
}

function pct(w: number): string {
  return `${(w * 100).toFixed(0)}%`;
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

  if (prevMap) {
    for (const p of prevMap.values()) {
      prev.Нийт++;
      if (p.level === "Өндөр" || p.level === "Дунд" || p.level === "Бага") {
        prev[p.level]++;
      }
    }
  }

  for (const b of agg) {
    cur.Нийт++;
    if (b.level === "Өндөр" || b.level === "Дунд" || b.level === "Бага") {
      cur[b.level]++;
    }
    const p = prevMap?.get(b.branchId);
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
    } else if (prevMap) {
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

function writeDocHeader(ws: ExcelJS.Worksheet, colCount: number): number {
  // Гарчиг
  ws.mergeCells(1, 1, 1, colCount);
  const title = ws.getCell(1, 1);
  title.value =
    "БИЗНЕС ТӨВ, САЛБАР, ТООЦООНЫ ТӨВҮҮДИЙН ЭРСДЭЛИЙН ҮНЭЛГЭЭНИЙ ТАЙЛАН";
  title.fill = solidFill(C.titleBg);
  title.font = {
    bold: true,
    size: 13,
    color: { argb: C.ink },
    name: "Calibri",
  };
  title.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(1).height = 30;

  return 3;
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
  const accent = region === "UB" ? C.ub : C.on;
  const accentSoft = region === "UB" ? C.ubSoft : C.onSoft;

  // Section banner
  ws.mergeCells(startRow, 1, startRow, colCount);
  const titleCell = ws.getCell(startRow, 1);
  titleCell.value = `${sectionTitle}  (${rows.length})`;
  titleCell.fill = solidFill(accent);
  titleCell.font = {
    bold: true,
    size: 11,
    color: { argb: C.ink },
    name: "Calibri",
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(startRow).height = 24;

  // Weights / period note
  const weightRow = startRow + 1;
  ws.mergeCells(weightRow, 1, weightRow, colCount);
  const weightCell = ws.getCell(weightRow, 1);
  weightCell.value = `Жин · S1 ${pct(w.s1)}  S2 ${pct(w.s2)}  S3 ${pct(w.s3)}  S4 ${pct(w.s4)}  J ${pct(w.j)}     ${primaryName}${hasComp ? `  ↔  ${prevName}` : ""}`;
  weightCell.font = { size: 8, color: { argb: C.muted }, name: "Calibri" };
  weightCell.fill = solidFill(accentSoft);
  weightCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(weightRow).height = 16;

  let hdrRowNum = startRow + 2;

  if (hasComp) {
    // Group header row
    const gRow = ws.getRow(hdrRowNum);
    const groups: Array<{
      label: string;
      from: number;
      to: number;
      fill: string;
    }> = [
      { label: "Салбар", from: 1, to: 4, fill: C.bannerNeutral },
      {
        label: `Одоо — ${primaryName}`,
        from: 5,
        to: 11,
        fill: C.bannerNeutral,
      },
      {
        label: `Өмнө — ${prevName}`,
        from: 12,
        to: 13,
        fill: C.prevHdr,
      },
      { label: "Зөрүү", from: 14, to: 14, fill: C.on },
    ];
    for (const g of groups) {
      if (g.to > g.from) ws.mergeCells(hdrRowNum, g.from, hdrRowNum, g.to);
      const cell = ws.getCell(hdrRowNum, g.from);
      cell.value = g.label;
      cell.fill = solidFill(g.fill);
      cell.font = {
        bold: true,
        size: 9,
        color: { argb: C.ink },
        name: "Calibri",
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      for (let c = g.from; c <= g.to; c++) {
        ws.getCell(hdrRowNum, c).border = BORDER;
        ws.getCell(hdrRowNum, c).fill = solidFill(g.fill);
      }
    }
    ws.getRow(hdrRowNum).height = 18;
    hdrRowNum++;
  }

  const hdrRow = ws.getRow(hdrRowNum);
  const headers = [
    "№",
    "SOL",
    "Салбарын нэр",
    "Зэрэглэл",
    `S1\n${pct(w.s1)}`,
    `S2\n${pct(w.s2)}`,
    `S3\n${pct(w.s3)}`,
    `S4\n${pct(w.s4)}`,
    `J\n${pct(w.j)}`,
    "Total",
    "Түвшин",
    ...(hasComp ? ["Өмнөх Total", "Өмнөх түвшин", "Зөрүү"] : []),
  ];
  const headerFillFor = (i: number): string => {
    if (hasComp && i >= 11) return i === 13 ? C.on : C.prevHdr;
    if (i === 4) return C.s1Hdr;
    if (i === 5) return C.s2Hdr;
    if (i === 6) return C.s3Hdr;
    if (i === 7) return C.s4Hdr;
    if (i === 8) return C.jHdr;
    if (i === 9) return C.totalHdr;
    return C.headerNeutral;
  };
  headers.forEach((h, i) => {
    styleHeaderCell(hdrRow.getCell(i + 1), h, headerFillFor(i));
  });
  hdrRow.height = 28;

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
      b.j != null && b.j > 0 ? b.j : null,
      b.total,
      b.level || "",
    ];
    if (hasComp) {
      values.push(
        prev ? (prev.total ?? null) : null,
        prev ? prev.level || "" : "",
        diff != null ? diff : null,
      );
    }

    const zebra = idx % 2 === 0 ? solidFill(C.white) : solidFill(C.zebra);

    values.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val as ExcelJS.CellValue;
      cell.fill = zebra;
      cell.font = { size: 9, name: "Calibri", color: { argb: C.ink } };
      applyBorder(cell, true);

      if (ci === 0 || ci === 1 || ci === 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        if (ci === 1 && typeof val === "number") cell.numFmt = "0";
      } else if (ci === 2) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
          wrapText: true,
        };
      } else if (ci === 4 || ci === 5 || ci === 6 || ci === 7 || ci === 8) {
        // S1–S4 / J — веб дэх баганын өнгөтэй тохирсон pastel tint
        const colFill =
          ci === 4
            ? C.s1
            : ci === 5
              ? C.s2
              : ci === 6
                ? C.s3
                : ci === 7
                  ? C.s4
                  : C.j;
        cell.fill = solidFill(colFill);
        cell.numFmt = "0.00";
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (ci === 9) {
        // Total
        cell.fill = solidFill(C.total);
        cell.font = {
          bold: true,
          size: 9,
          name: "Calibri",
          color: { argb: C.ink },
        };
        cell.numFmt = "0.00";
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (ci === 10 && typeof val === "string" && val) {
        const lf = levelFill(val);
        if (lf) cell.fill = lf;
        cell.font = { bold: true, size: 9, name: "Calibri", color: { argb: C.ink } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (hasComp && ci === 11 && typeof val === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { size: 9, name: "Calibri", color: { argb: C.muted } };
      } else if (hasComp && ci === 12 && typeof val === "string" && val) {
        const lf = levelFill(val);
        if (lf) cell.fill = lf;
        cell.font = { bold: true, size: 9, name: "Calibri", color: { argb: C.ink } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (hasComp && ci === 13 && typeof val === "number") {
        cell.numFmt = '+0.00;-0.00;"—"';
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = {
          bold: true,
          size: 9,
          name: "Calibri",
          color: {
            argb: val > 0.005 ? C.up : val < -0.005 ? C.down : C.muted,
          },
        };
      } else if (typeof val === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
    row.height = 17;
    r++;
  });

  if (rows.length === 0) {
    ws.mergeCells(r, 1, r, colCount);
    const empty = ws.getCell(r, 1);
    empty.value = "Салбар олдсонгүй";
    empty.font = {
      italic: true,
      color: { argb: "FF9CA3AF" },
      size: 9,
      name: "Calibri",
    };
    empty.alignment = { horizontal: "center", vertical: "middle" };
    applyBorder(empty, true);
    r++;
  }

  return r + 1;
}

function writeSummaryTables(
  ws: ExcelJS.Worksheet,
  startRow: number,
  summary: SummaryStats,
  hasComp: boolean,
): number {
  const tables: Array<{
    title: string;
    accent: string;
    headers: string[];
    rows: (string | number)[][];
    levelColors?: boolean;
  }> = [
    {
      title: "1. ҮНЭЛГЭЭ",
      accent: C.bannerNeutral,
      headers: hasComp ? ["Үзүүлэлт", "Одоо", "Өмнө", "Зөрүү"] : ["Үзүүлэлт", "Одоо"],
      rows: hasComp
        ? [
            [
              "Өндөр",
              summary.cur.Өндөр,
              summary.prev.Өндөр,
              summary.cur.Өндөр - summary.prev.Өндөр,
            ],
            [
              "Дунд",
              summary.cur.Дунд,
              summary.prev.Дунд,
              summary.cur.Дунд - summary.prev.Дунд,
            ],
            [
              "Бага",
              summary.cur.Бага,
              summary.prev.Бага,
              summary.cur.Бага - summary.prev.Бага,
            ],
            [
              "Нийт",
              summary.cur.Нийт,
              summary.prev.Нийт,
              summary.cur.Нийт - summary.prev.Нийт,
            ],
          ]
        : [
            ["Өндөр", summary.cur.Өндөр],
            ["Дунд", summary.cur.Дунд],
            ["Бага", summary.cur.Бага],
            ["Нийт", summary.cur.Нийт],
          ],
      levelColors: true,
    },
  ];

  if (hasComp) {
    tables.push(
      {
        title: "2. ҮНЭЛГЭЭНИЙ ӨӨРЧЛӨЛТ",
        accent: C.on,
        headers: ["Үзүүлэлт", "Тоо"],
        rows: [
          ["Үнэлгээ өссөн ↑", summary.upCnt],
          ["Үнэлгээ буурсан ↓", summary.downCnt],
          ["Өөрчлөлтгүй", summary.sameCnt],
          ["Шинээр нэмэгдсэн", summary.newCnt],
          ["Нийт", summary.cur.Нийт],
        ],
      },
      {
        title: "3. ТҮВШИН ӨӨРЧЛӨЛТ",
        accent: C.ub,
        headers: ["Шилжилт", "Тоо"],
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
          ].map((k) => [k, summary.transitions[k] || 0] as (string | number)[]),
          ["Шинээр нэмэгдсэн", summary.newCnt],
          ["Нийт", summary.cur.Нийт],
        ],
      },
    );
  }

  const blockWidths = tables.map((t) => t.headers.length);
  const totalCols =
    blockWidths.reduce((a, b) => a + b, 0) + (blockWidths.length - 1);

  ws.mergeCells(startRow, 1, startRow, totalCols);
  const mainTitle = ws.getCell(startRow, 1);
  mainTitle.value = "ХУРААНГУЙ СТАТИСТИК";
  mainTitle.fill = solidFill(C.bannerNeutral);
  mainTitle.font = {
    bold: true,
    size: 11,
    color: { argb: C.ink },
    name: "Calibri",
  };
  mainTitle.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(startRow).height = 22;
  startRow += 2;

  let colCursor = 1;

  tables.forEach((tbl, ti) => {
    const colStart = colCursor;
    const blockWidth = blockWidths[ti];

    ws.mergeCells(startRow, colStart, startRow, colStart + blockWidth - 1);
    const tCell = ws.getCell(startRow, colStart);
    tCell.value = tbl.title;
    tCell.fill = solidFill(tbl.accent);
    tCell.font = {
      bold: true,
      size: 9,
      color: { argb: C.ink },
      name: "Calibri",
    };
    tCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = colStart; c < colStart + blockWidth; c++) {
      ws.getCell(startRow, c).fill = solidFill(tbl.accent);
      ws.getCell(startRow, c).border = BORDER;
    }

    const hRow = ws.getRow(startRow + 1);
    tbl.headers.forEach((h, hi) => {
      styleHeaderCell(hRow.getCell(colStart + hi), h, C.headerNeutral);
    });

    tbl.rows.forEach((rowData, ri) => {
      const row = ws.getRow(startRow + 2 + ri);
      const isTotal = ri === tbl.rows.length - 1;
      const label = String(rowData[0] ?? "");
      rowData.forEach((val, ci) => {
        const cell = row.getCell(colStart + ci);
        cell.value = val as ExcelJS.CellValue;
        applyBorder(cell, true);
        cell.font = {
          size: 9,
          bold: isTotal,
          name: "Calibri",
          color: { argb: C.ink },
        };
        cell.alignment = {
          horizontal: ci === 0 ? "left" : "center",
          vertical: "middle",
        };
        if (typeof val === "number") {
          cell.numFmt = ci === 3 && hasComp && ti === 0 ? "+0;-0;0" : "0";
          if (ci === 3 && ti === 0 && typeof val === "number" && val !== 0) {
            cell.font = {
              size: 9,
              bold: true,
              name: "Calibri",
              color: { argb: val > 0 ? C.up : C.down },
            };
          }
        }
        if (isTotal) cell.fill = solidFill(C.headerNeutral);
        else if (
          tbl.levelColors &&
          ci === 0 &&
          (label === "Өндөр" || label === "Дунд" || label === "Бага")
        ) {
          const lf = levelFill(label);
          if (lf) cell.fill = lf;
        } else if (ri % 2 === 1) {
          cell.fill = solidFill(C.zebra);
        }
      });
    });

    // Эдгээр 3 хүснэгт нь дээрх том салбарын хүснэгттэй ижил баганыг
    // ашигладаг тул өргөнийг ЗААВАЛ шууд (Math.max биш) тохируулна —
    // эс тэгвэл том хүснэгтийн багана өргөн (жишээ нь Салбарын нэр = 30-32)
    // энд шууд дамжиж хэт өргөн/нарийн болно.
    ws.getColumn(colStart).width = 22; // Үзүүлэлт/Шилжилт багана — стандарт
    for (let c = colStart + 1; c < colStart + blockWidth; c++) {
      ws.getColumn(c).width = 11; // утга/тооны багана — стандарт
    }

    colCursor += blockWidth + 1;
  });

  const maxRows = Math.max(...tables.map((t) => t.rows.length));
  return startRow + 2 + maxRows + 2;
}

function setColumnWidths(ws: ExcelJS.Worksheet, hasComp: boolean) {
  const widths = hasComp
    ? [5, 8, 30, 10, 8, 8, 8, 8, 8, 9, 10, 11, 11, 9]
    : [5, 8, 32, 10, 9, 9, 9, 9, 9, 10, 11];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
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
  wb.creator = "Голомт Банк — Дотоод аудит";
  wb.created = new Date();
  wb.modified = new Date();
  wb.company = "Голомт Банк — Дотоод аудит";

  const prevMap = prevAgg ? new Map(prevAgg.map((a) => [a.branchId, a])) : null;
  const hasComp = !!prevMap && !!prevName;
  const colCount = hasComp ? 14 : 11;
  const { ub, on } = splitByGroup(agg);
  const summary = computeSummary(agg, prevMap);

  const ws = wb.addWorksheet("Тайлан", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 16 },
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
      printTitlesRow: "1:1",
    },
    headerFooter: {
      oddFooter: `&CХуудас &P / &N`,
    },
  });

  let row = writeDocHeader(ws, colCount);

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
  row += 1;
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
  row += 1;
  // Том хүснэгтийн (салбарын) багана өргөнийг эхлээд тохируулна, дараа нь
  // ХУРААНГУЙ СТАТИСТИК-ийн 3 хүснэгт өөрийн стандарт өргөнөө шууд
  // тохируулна (writeSummaryTables дотор) — ингэснээр аль аль нь
  // зөрчилдөхгүй, том хүснэгтийн өргөн доод жижиг хүснэгтэд дамжихгүй.
  setColumnWidths(ws, hasComp);
  writeSummaryTables(ws, row, summary, hasComp);

  return wb.xlsx.writeBuffer();
}

async function downloadIndicatorXlsx(
  rows: RiskCurrentRow[],
  catalog: DynamicCatalogIndicator[],
  scoringCatalog: DynamicCatalogIndicator[],
  manualMap: ManualMap,
  judgements: Record<string, number>,
  judgementComments: Record<string, string>,
  primaryAgg: BranchAggregate[],
  filterIds: Set<string> | null,
  primaryDate: string,
  primaryName: string,
  includeRaw: boolean,
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Голомт Банк — Дотоод аудит";
  wb.created = new Date();

  const ws = wb.addWorksheet("Indicator", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const selected = nonJudgmentIndicators(catalog).filter(
    (c) => !filterIds || filterIds.has(c.id),
  );
  const judgmentInd = pickJudgmentIndicator(catalog);
  const judgmentIndId = judgmentInd?.id ?? "";
  const includeJudgment =
    judgmentInd != null && (!filterIds || filterIds.has(judgmentIndId));
  const sortedInd = [
    ...selected,
    ...(includeJudgment ? [judgmentInd] : []),
  ].sort((a, b) => a.group - b.group || a.id.localeCompare(b.id));
  const aggLookup = buildAggLookup(primaryAgg);

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
    ...sortedInd.flatMap((c) => {
      if (c.is_judgment) {
        return [
          `[G${c.group}] ${c.name} (Оноо)`,
          `[G${c.group}] ${c.name} (Тайлбар)`,
        ];
      }
      return includeRaw
        ? [`[G${c.group}] ${c.name} (Оноо)`, `[G${c.group}] ${c.name} (Утга)`]
        : [`[G${c.group}] ${c.name}`];
    }),
  ];
  const colCount = Math.max(headers.length, 2);

  ws.mergeCells(1, 1, 1, Math.min(colCount, 12));
  ws.getCell(1, 1).value =
    `Эрсдэлийн үнэлгээ — ${primaryName} · ${primaryDate}`;
  ws.getCell(1, 1).font = {
    bold: true,
    size: 12,
    color: { argb: C.ink },
    name: "Calibri",
  };
  ws.getCell(1, 1).fill = solidFill(C.titleBg);
  ws.getCell(1, 1).alignment = {
    vertical: "middle",
    horizontal: "left",
    indent: 1,
  };
  ws.getRow(1).height = 24;

  const hdrRow = ws.getRow(2);
  headers.forEach((h, i) => styleHeaderCell(hdrRow.getCell(i + 1), h));
  hdrRow.height = 40;

  const branchEntries = [...byBranch.entries()].sort((a, b) =>
    compareSolid(a[0], b[0]),
  );

  branchEntries.forEach(([solid, b], idx) => {
    const branchManual = resolveManualBranch(solid, manualMap);
    const ev = evaluateBranchDynamic(scoringCatalog, b.rows, branchManual);
    const row = ws.getRow(3 + idx);
    const values: (string | number | null)[] = [b.name, parseSolidCell(solid)];
    const agg = lookupAgg(solid, aggLookup);
    for (const c of sortedInd) {
      if (c.is_judgment) {
        const jScore = resolveJudgementScoreFromMaps(
          solid,
          manualMap,
          judgmentIndId,
          agg?.j,
          judgements,
        );
        values.push(jScore);
        values.push(resolveJudgementComment(solid, judgementComments));
      } else {
        const val = ev[c.id];
        values.push(val?.score != null ? val.score : null);
        if (includeRaw) values.push(val?.autoRaw ?? "");
      }
    }

    const zebra = idx % 2 === 0 ? solidFill(C.white) : solidFill(C.zebra);

    values.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val as ExcelJS.CellValue;
      cell.fill = zebra;
      cell.font = { size: 9, name: "Calibri" };
      applyBorder(cell, true);
      if (ci === 0) {
        cell.alignment = { horizontal: "left", wrapText: true };
      } else if (ci === 1) {
        cell.alignment = { horizontal: "center" };
        if (typeof val === "number") cell.numFmt = "0";
      } else if (typeof val === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { horizontal: "center" };
      } else {
        cell.alignment = { horizontal: "left", wrapText: true };
      }
    });
    row.height = 17;
  });

  ws.columns.forEach((col, i) => {
    if (i === 0) col.width = 28;
    else if (i === 1) col.width = 10;
    else col.width = includeRaw ? 14 : 12;
  });

  if (branchEntries.length > 0) {
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2 + branchEntries.length, column: headers.length },
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
  primaryJudgements?: Record<string, number>;
  primaryJudgementComments?: Record<string, string>;
  primaryName: string;
  primaryDate: string;
  prevRows: RiskCurrentRow[];
  prevManualMap: ManualMap;
  prevJudgements?: Record<string, number>;
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
  primaryJudgements = {},
  primaryJudgementComments = {},
  primaryName,
  primaryDate,
  prevRows,
  prevManualMap,
  prevJudgements = {},
  prevName,
  catalog,
  weights,
}: Props) {
  type ExportMode = "summary" | "indicator";

  const { t } = useLanguage();
  const [mode, setMode] = useState<ExportMode>("summary");
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeRaw, setIncludeRaw] = useState(false);

  const [selectedIndIds, setSelectedIndIds] = useState<Set<string> | null>(
    null,
  );
  const [indFilterOpen, setIndFilterOpen] = useState(false);
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    riskApi
      .listHolds(HOLD_GLOBAL_PERIOD)
      .then((data) => setHeldIds(new Set(data.map((d) => d.indicatorId))))
      .catch(() => setHeldIds(new Set()));
  }, [open]);

  const activeCatalog = useMemo(
    () =>
      heldIds.size > 0 ? catalog.filter((c) => !heldIds.has(c.id)) : catalog,
    [catalog, heldIds],
  );

  const judgmentInd = useMemo(() => pickJudgmentIndicator(catalog), [catalog]);

  const indByGroup = useMemo(() => {
    const m = new Map<number, DynamicCatalogIndicator[]>();
    for (const c of nonJudgmentIndicators(catalog).sort(
      (a, b) => a.group - b.group || a.name.localeCompare(b.name),
    )) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    if (!m.has(5)) m.set(5, []);
    if (judgmentInd && !m.get(5)!.some((c) => c.id === judgmentInd.id)) {
      m.get(5)!.push(judgmentInd);
    }
    return m;
  }, [catalog, judgmentInd]);

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

  const oraclePrimary = useMemo(
    () => primaryRows.filter((r) => r.rowType === "oracle"),
    [primaryRows],
  );
  const oraclePrev = useMemo(
    () => prevRows.filter((r) => r.rowType === "oracle"),
    [prevRows],
  );

  const primaryManualForAgg = useMemo(
    () =>
      mergeJudgementsIntoManualMap(
        primaryManualMap,
        primaryJudgements,
        catalog,
      ),
    [primaryManualMap, primaryJudgements, catalog],
  );

  const prevManualForAgg = useMemo(
    () => mergeJudgementsIntoManualMap(prevManualMap, prevJudgements, catalog),
    [prevManualMap, prevJudgements, catalog],
  );

  const primaryAgg = useMemo(
    () =>
      computeBranchAggregates(
        oraclePrimary,
        primaryManualForAgg,
        catalog,
        weights,
        heldIds,
      ),
    [oraclePrimary, primaryManualForAgg, catalog, weights, heldIds],
  );

  const prevAgg = useMemo(
    () =>
      hasComparison && includeComparison
        ? computeBranchAggregates(
            oraclePrev,
            prevManualForAgg,
            catalog,
            weights,
            heldIds,
          )
        : null,
    [
      oraclePrev,
      prevManualForAgg,
      hasComparison,
      includeComparison,
      catalog,
      weights,
      heldIds,
    ],
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
        `Эрсдэлийн_үнэлгээ_${primaryDate || "tailan"}.xlsx`,
      );
    } else {
      const buf = await downloadIndicatorXlsx(
        primaryRows,
        catalog,
        activeCatalog,
        primaryManualMap,
        primaryJudgements,
        primaryJudgementComments,
        primaryAgg,
        selectedIndIds,
        primaryDate,
        primaryName,
        includeRaw,
      );
      triggerDownload(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Эрсдэлийн_indicator_${primaryDate || "detail"}${includeRaw ? "_дэлгэрэнгүй" : ""}.xlsx`,
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
            <div className="w-8 h-8 rounded-lg bg-slate-500/15 border border-slate-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                {t("raCsvExportModalTitle")}
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
            {t("raCsvExportFormatLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("summary")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "summary"
                  ? "border-slate-500/60 bg-slate-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <LayoutList
                  className={`w-3.5 h-3.5 ${mode === "summary" ? "text-slate-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-semibold ${mode === "summary" ? "text-slate-700 dark:text-slate-300" : "text-foreground"}`}
                >
                  {t("riskReportCardTitle")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {t("raCsvExportSummaryDesc")}
              </p>
            </button>

            <button
              onClick={() => setMode("indicator")}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                mode === "indicator"
                  ? "border-slate-500/60 bg-slate-500/8 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Table2
                  className={`w-3.5 h-3.5 ${mode === "indicator" ? "text-slate-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-semibold ${mode === "indicator" ? "text-slate-700 dark:text-slate-300" : "text-foreground"}`}
                >
                  {t("raCsvExportDetailModeLabel")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {t("raCsvExportDetailDesc")}
              </p>
            </button>
          </div>
        </div>

        {mode === "summary" && (
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {t("raCsvExportComparisonLabel")}
            </p>
            {hasComparison ? (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setIncludeComparison((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    includeComparison ? "bg-slate-600" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      includeComparison ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-xs text-foreground/80">
                  {t("raCsvExportIncludePrevToggle")}
                  <span className="ml-1.5 text-muted-foreground text-[10px]">
                    ({prevName})
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">
                {t("raCsvExportNoComparisonHint")}
              </p>
            )}
          </div>
        )}

        {mode === "indicator" && (
          <>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("raCsvExportIndFilterLabel")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-[10px] text-slate-600 dark:text-slate-300 hover:underline"
                  >
                    {t("admRegAllTab")}
                  </button>
                  <span className="text-muted-foreground text-[10px]">/</span>
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    {t("admReportsClearBtn")}
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
                      ? t("raCsvExportAllIndSelected")
                      : `${effectiveSelected.size} / ${allIds.size} ${t("raCsvExportIndSelectedSuffix")}`}
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
                                  ? "bg-slate-600 border-slate-600"
                                  : someGroupIn
                                    ? "bg-slate-500/40 border-slate-400"
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
                                      ? "bg-slate-600 border-slate-600"
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
                {t("raCsvExportContentLabel")}
              </p>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setIncludeRaw((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    includeRaw ? "bg-slate-600" : "bg-muted"
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
                    {t("raCsvExportIncludeRawToggle")}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t("raCsvExportRawDesc")}
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
                <span className="text-muted-foreground">{t("raCsvExportUbBranchLabel")}</span>
                <span className="font-semibold tabular-nums">{ubCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{t("raCsvExportOnBranchLabel")}</span>
                <span className="font-semibold tabular-nums">{onCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{t("raCsvExportComparisonLabel")}</span>
                <span className="font-semibold">
                  {hasComparison && includeComparison ? prevName : "—"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{t("raCsvExportBranchWord")}</span>
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
            {t("cancel")}
          </button>
          <button
            onClick={doDownload}
            disabled={mode === "indicator" && effectiveSelected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-premium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {t("reportsOutputExcel")}
          </button>
        </div>
      </div>
    </div>
  );
}