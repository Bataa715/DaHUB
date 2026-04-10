import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

interface PivotRow {
  year: number;
  codeCounts: Record<string, number>;
  total: number;
  pct: number;
  sampleSize: number;
}

interface ExportPayload {
  selectedPrefix: string;
  confidence: number;
  marginError: number;
  group: { rows: PivotRow[]; codes: string[] };
  headers: string[];
  sampledByYear: Record<number, string[][]>;
  exportFilename?: string;
}

export async function POST(req: NextRequest) {
  const body: ExportPayload = await req.json();
  const {
    selectedPrefix,
    confidence,
    marginError,
    group,
    headers,
    sampledByYear,
    exportFilename,
  } = body;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Internal Audit Tool";
  wb.created = new Date();

  // ── Colour palette ──────────────────────────────────────────────────────────
  const HDR_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F4C75" },
  };
  const ROW_ODD: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F7FF" },
  };
  const ROW_EVN: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
  };
  const TOTAL_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F4FD" },
  };
  const BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCCD6DD" } },
    left: { style: "thin", color: { argb: "FFCCD6DD" } },
    bottom: { style: "thin", color: { argb: "FFCCD6DD" } },
    right: { style: "thin", color: { argb: "FFCCD6DD" } },
  };
  const HDR_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 10,
  };
  const BODY_FONT: Partial<ExcelJS.Font> = { size: 10 };

  const applyHdr = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.fill = HDR_FILL;
      cell.font = HDR_FONT;
      cell.border = BORDER;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    row.height = 20;
  };
  const applyBody = (row: ExcelJS.Row, fill: ExcelJS.Fill) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill;
      cell.font = BODY_FONT;
      cell.border = BORDER;
    });
    row.height = 18;
  };

  // ── Summary sheet ───────────────────────────────────────────────────────────
  const sumSheet = wb.addWorksheet("Дэгдэлхүүн");
  sumSheet.mergeCells("A1:G1");
  const title = sumSheet.getCell("A1");
  title.value = `Pivot дүн: ${selectedPrefix} — итгэлцэл: ${Math.round(confidence * 100)}%, алдаа: ${Math.round(marginError * 100)}%`;
  title.font = { bold: true, size: 13, color: { argb: "FF0F4C75" } };
  title.alignment = { horizontal: "left", vertical: "middle" };
  sumSheet.getRow(1).height = 26;
  sumSheet.addRow([]);

  const sumHdrs = [
    "Жил",
    ...group.codes,
    "Нийт",
    "Хувь (%)",
    `Түүвэр (${Math.round(confidence * 100)}/${Math.round(marginError * 100)})`,
  ];
  const sumHdrRow = sumSheet.addRow(sumHdrs);
  applyHdr(sumHdrRow);

  const bodyRows: string[][] = [];
  group.rows.forEach((r, idx) => {
    const vals = [
      String(r.year),
      ...group.codes.map((c) => String(r.codeCounts[c] ?? 0)),
      String(r.total),
      r.pct.toFixed(2) + "%",
      String(r.sampleSize),
    ];
    bodyRows.push(vals);
    const row = sumSheet.addRow(vals);
    applyBody(row, idx % 2 === 0 ? ROW_ODD : ROW_EVN);
    row.getCell(1).font = { bold: true, size: 10 };
  });

  const totalVals = [
    "Нийт",
    ...group.codes.map((c) =>
      String(group.rows.reduce((s, r) => s + (r.codeCounts[c] ?? 0), 0)),
    ),
    String(group.rows.reduce((s, r) => s + r.total, 0)),
    "100%",
    String(group.rows.reduce((s, r) => s + r.sampleSize, 0)),
  ];
  const totalRow = sumSheet.addRow(totalVals);
  totalRow.eachCell((cell) => {
    cell.fill = TOTAL_FILL;
    cell.font = { bold: true, size: 10, color: { argb: "FF0F4C75" } };
    cell.border = BORDER;
    cell.alignment = { vertical: "middle" };
  });
  totalRow.height = 20;

  // Auto widths for summary
  sumSheet.columns = sumHdrs.map((h, i) => ({
    width: Math.min(
      Math.max(
        bodyRows.reduce(
          (m, r) => Math.max(m, String(r[i] ?? "").length),
          h.length,
        ) + 3,
        10,
      ),
      50,
    ),
  }));
  sumSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

  // ── Per-year sample sheets ──────────────────────────────────────────────────
  const RED_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCE4E4" },
  };

  for (const pivotRow of group.rows) {
    const year = pivotRow.year;
    const sampled = sampledByYear[year] ?? [];
    const allCols = [...headers, "Алдаатай эсэх", "Тайлбар"];

    const ws = wb.addWorksheet(String(year));
    ws.mergeCells("A1:" + String.fromCharCode(65 + headers.length) + "1");
    const info = ws.getCell("A1");
    info.value = `${selectedPrefix} | ${year} он | Түүвэр: ${sampled.length} (итгэлцэл: ${Math.round(confidence * 100)}%, алдаа: ${Math.round(marginError * 100)}%)`;
    info.font = { bold: true, size: 11, color: { argb: "FF0F4C75" } };
    info.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(1).height = 22;

    const hdrRow = ws.getRow(2);
    hdrRow.values = allCols;
    applyHdr(hdrRow);

    const dataRows: string[][] = [];
    sampled.forEach((r, i) => {
      const vals = [...r, "Үгүй", ""];
      dataRows.push(vals);
      const row = ws.addRow(vals);
      applyBody(row, i % 2 === 0 ? ROW_ODD : ROW_EVN);
    });

    ws.columns = allCols.map((h, i) => ({
      width: Math.min(
        Math.max(
          dataRows.reduce(
            (m, r) => Math.max(m, String(r[i] ?? "").length),
            h.length,
          ) + 3,
          10,
        ),
        50,
      ),
    }));
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFilename || `sample_${selectedPrefix}.xlsx`}"`,
    },
  });
}
