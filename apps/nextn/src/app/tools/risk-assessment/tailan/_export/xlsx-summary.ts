// Эрсдэлийн тайлангийн Excel — салбарын нэгтгэл, хураангуй хүснэгт.
import type ExcelJS from "exceljs";
import {
  classifyBranchTableGroup,
  type BranchAggregate,
} from "../../scoring-rules";
import {
  C,
  BORDER,
  solidFill,
  applyBorder,
  styleHeaderCell,
  levelFill,
  compareSolid,
} from "./xlsx-style";

export function buildAggLookup(
  agg: BranchAggregate[],
): Map<string, BranchAggregate> {
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

export function lookupAgg(
  solid: string,
  map: Map<string, BranchAggregate>,
): BranchAggregate | undefined {
  const key = String(solid ?? "").trim();
  return map.get(key) ?? map.get(key.replace(/^0+/, "") || key);
}

export function parseSolidCell(solid: string): string | number {
  const s = String(solid ?? "").trim();
  return /^\d+$/.test(s) ? parseInt(s, 10) : s;
}

export type SummaryStats = {
  cur: { Өндөр: number; Дунд: number; Бага: number; Нийт: number };
  prev: { Өндөр: number; Дунд: number; Бага: number; Нийт: number };
  upCnt: number;
  downCnt: number;
  sameCnt: number;
  newCnt: number;
  transitions: Record<string, number>;
};

export function computeSummary(
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

export function splitByGroup(agg: BranchAggregate[]) {
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

export function writeSummaryTables(
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
      headers: hasComp
        ? ["Үзүүлэлт", "Одоо", "Өмнө", "Зөрүү"]
        : ["Үзүүлэлт", "Одоо"],
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
