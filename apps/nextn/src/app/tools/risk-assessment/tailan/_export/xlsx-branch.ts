// Эрсдэлийн тайлангийн Excel — баримтын толгой, салбарын хэсэг, баганын өргөн.
import type ExcelJS from "exceljs";
import { type BranchAggregate } from "../../scoring-rules";
import { type DynamicWeights } from "../../use-indicator-config";
import {
  C,
  BORDER,
  solidFill,
  applyBorder,
  styleHeaderCell,
  levelFill,
  pct,
} from "./xlsx-style";
import { parseSolidCell } from "./xlsx-summary";

export function writeDocHeader(
  ws: ExcelJS.Worksheet,
  colCount: number,
): number {
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
  title.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  ws.getRow(1).height = 30;

  return 3;
}

export function writeBranchSection(
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
        cell.font = {
          bold: true,
          size: 9,
          name: "Calibri",
          color: { argb: C.ink },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (hasComp && ci === 11 && typeof val === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { size: 9, name: "Calibri", color: { argb: C.muted } };
      } else if (hasComp && ci === 12 && typeof val === "string" && val) {
        const lf = levelFill(val);
        if (lf) cell.fill = lf;
        cell.font = {
          bold: true,
          size: 9,
          name: "Calibri",
          color: { argb: C.ink },
        };
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

export function setColumnWidths(ws: ExcelJS.Worksheet, hasComp: boolean) {
  const widths = hasComp
    ? [5, 8, 30, 10, 8, 8, 8, 8, 8, 9, 10, 11, 11, 9]
    : [5, 8, 32, 10, 9, 9, 9, 9, 9, 10, 11];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}
