// Эрсдэлийн тайлангийн Excel — ном үүсгэж татах.
import type ExcelJS from "exceljs";
import { type BranchAggregate } from "../../scoring-rules";
import {
  evaluateBranchDynamic,
  pickJudgmentIndicator,
  nonJudgmentIndicators,
  type DynamicCatalogIndicator,
  type DynamicWeights,
} from "../../use-indicator-config";
import {
  resolveManualBranch,
  resolveJudgementComment,
  resolveJudgementScoreFromMaps,
} from "../../branch-resolve";
import { type RiskCurrentRow } from "@/lib/api";
import type { ManualMap } from "../../indicator-catalog";
import {
  C,
  solidFill,
  applyBorder,
  styleHeaderCell,
  compareSolid,
} from "./xlsx-style";
import {
  buildAggLookup,
  lookupAgg,
  parseSolidCell,
  computeSummary,
  splitByGroup,
  writeSummaryTables,
} from "./xlsx-summary";
import {
  writeDocHeader,
  writeBranchSection,
  setColumnWidths,
} from "./xlsx-branch";

export const SPLIT_SECTIONS = [
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

export async function downloadSummaryXlsx(
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

export async function downloadIndicatorXlsx(
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

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Props ─────────────────────────────────────────────────────────────────────
