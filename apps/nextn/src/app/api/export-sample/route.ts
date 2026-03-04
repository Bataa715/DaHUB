import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

// ── Types (mirror from page) ──────────────────────────────────────────────────
interface SampleGroup {
  label: string;
  indices: number[];
  rows: (string | number)[][];
  size?: number;
}

interface SampleResult {
  n: number;
  N: number;
  Z: number;
  design: string;
  confidence: number;
  margin: number;
  stdDev?: number;
  headers: string[];
  groups: SampleGroup[];
}

interface ExportPayload {
  result: SampleResult;
  isStratified: boolean;
  filename?: string;
}

export async function POST(req: NextRequest) {
  const body: ExportPayload = await req.json();
  const { result, isStratified, filename } = body;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Internal Audit Tool";
  wb.created = new Date();

  // ── Colour palette ──────────────────────────────────────────────────────────
  const HDR_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B1F7A" },
  };
  const ROW_ODD: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F0FF" },
  };
  const ROW_EVN: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
  };
  const INFO_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEDE5FF" },
  };
  const BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCCC2E0" } },
    left: { style: "thin", color: { argb: "FFCCC2E0" } },
    bottom: { style: "thin", color: { argb: "FFCCC2E0" } },
    right: { style: "thin", color: { argb: "FFCCC2E0" } },
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
      cell.alignment = { vertical: "middle", wrapText: false };
    });
    row.height = 20;
  };
  const applyBody = (row: ExcelJS.Row, fill: ExcelJS.Fill) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill;
      cell.font = BODY_FONT;
      cell.border = BORDER;
      cell.alignment = { vertical: "middle" };
    });
    row.height = 18;
  };

  for (const [gi, g] of result.groups.entries()) {
    const ws = wb.addWorksheet(g.label.slice(0, 31));

    if (isStratified) {
      // Info row
      ws.mergeCells("A1:D1");
      const info = ws.getCell("A1");
      info.value = `${g.label} — N=${result.N}, n=${g.indices.length}, Z=${result.Z}, итгэлцэл: ${(result.confidence * 100).toFixed(0)}%`;
      info.font = { bold: true, size: 11, color: { argb: "FF3B1F7A" } };
      info.fill = INFO_FILL;
      info.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(1).height = 22;

      const hdrRow = ws.addRow(["№", "Дугаар"]);
      applyHdr(hdrRow);
      ws.columns = [
        { key: "n", width: 8 },
        { key: "d", width: 14 },
      ];
      g.indices.forEach((idx, i) => {
        const row = ws.addRow([i + 1, idx]);
        applyBody(row, i % 2 === 0 ? ROW_ODD : ROW_EVN);
      });
      ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
    } else {
      const infoCols = result.headers.length + 1;
      ws.mergeCells(`A1:${String.fromCharCode(64 + infoCols)}1`);
      const info = ws.getCell("A1");
      info.value = `${g.label} — N=${result.N}, n=${g.indices.length}, Z=${result.Z}, итгэлцэл: ${(result.confidence * 100).toFixed(0)}%`;
      info.font = { bold: true, size: 11, color: { argb: "FF3B1F7A" } };
      info.fill = INFO_FILL;
      info.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(1).height = 22;

      const allCols = ["Мөрийн дугаар", ...result.headers];
      const hdrRow = ws.addRow(allCols);
      applyHdr(hdrRow);

      const dataRows: string[][] = [];
      g.indices.forEach((idx, i) => {
        const rowData = g.rows[i] ?? [];
        const vals = [
          String(idx),
          ...result.headers.map((_, ci) => String(rowData[ci] ?? "")),
        ];
        dataRows.push(vals);
        const row = ws.addRow(vals);
        applyBody(row, i % 2 === 0 ? ROW_ODD : ROW_EVN);
      });

      // Auto column widths
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
  }

  // Summary sheet if multi-group stratified
  if (isStratified && result.groups.length > 1) {
    const sumWs = wb.addWorksheet("Дэгдэлхүүн");
    const hdr = sumWs.addRow(["Бүлэг", "N бүлэг", "n түүвэр"]);
    applyHdr(hdr);
    result.groups.forEach((g, gi) => {
      const row = sumWs.addRow([g.label, g.size ?? "—", g.indices.length]);
      applyBody(row, gi % 2 === 0 ? ROW_ODD : ROW_EVN);
    });
    sumWs.columns = [{ width: 16 }, { width: 12 }, { width: 14 }];
    sumWs.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename || "sample_result.xlsx"}"`,
    },
  });
}
