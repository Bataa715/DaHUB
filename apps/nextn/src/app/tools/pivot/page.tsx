"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import type ExcelJS from "exceljs";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table2,
  Upload,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ─── Inverse normal CDF (Abramowitz & Stegun) ────────────────────────────────
function getZ(cl: number): number {
  const p = 1 - (1 - cl) / 2;
  if (p >= 1) return 3.5;
  if (p <= 0) return 0;
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  const z = t - num / den;
  return p < 0.5 ? -z : z;
}

// sample_size(population, confidence, margin_error, p=0.5)
// n0 = Z² * p * (1-p) / E²
// n  = n0 / (1 + (n0-1) / population)
// return math.ceil(n)
function calcSampleSize(
  population: number,
  confidence: number,
  marginError: number,
  p = 0.5,
): number {
  if (population <= 0) return 0;
  const Z = getZ(confidence);
  const n0 = (Z * Z * p * (1 - p)) / (marginError * marginError);
  const n = n0 / (1 + (n0 - 1) / population);
  return Math.ceil(n);
}

// Extract prefix: first `len` chars of the value, uppercase. Skips empty values.
function extractCode(value: unknown, len: number): string {
  const s =
    typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!s) return "";
  return s.slice(0, len).toUpperCase();
}

// Extract 4-digit year from various date representations
function toYear(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    // Excel serial date
    try {
      const d = XLSX.SSF.parse_date_code(value);
      if (d && d.y) return d.y;
    } catch {
      // ignore
    }
  }
  const str = String(value);
  const m = str.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

interface PrefixRow {
  year: number;
  codeCounts: Record<string, number>;
  total: number;
  pct: number;
  sampleSize: number;
}

interface PrefixGroup {
  prefix: string;
  rows: PrefixRow[];
  codes: string[];
}

function buildPrefixGroups(
  data: unknown[][],
  headers: string[],
  dateCol: string,
  codeCol: string,
  confidence: number,
  marginError: number,
  prefixLen: number,
): PrefixGroup[] {
  const dateIdx = headers.indexOf(dateCol);
  const codeIdx = headers.indexOf(codeCol);
  if (dateIdx < 0 || codeIdx < 0) return [];

  // prefix → year → code → count
  const map: Record<string, Record<number, Record<string, number>>> = {};

  for (const row of data) {
    const rawCode = (row as unknown[])[codeIdx];
    const rawDate = (row as unknown[])[dateIdx];
    const prefix = extractCode(rawCode, prefixLen);
    if (!prefix) continue;
    const year = toYear(rawDate);
    if (year == null) continue;
    const code =
      typeof rawCode === "string" ? rawCode.trim() : String(rawCode ?? "");
    if (!map[prefix]) map[prefix] = {};
    if (!map[prefix][year]) map[prefix][year] = {};
    map[prefix][year][code] = (map[prefix][year][code] || 0) + 1;
  }

  return Object.keys(map)
    .sort()
    .map((prefix) => {
      const yearMap = map[prefix];
      const allCodes = Array.from(
        new Set(Object.values(yearMap).flatMap((y) => Object.keys(y))),
      ).sort();
      const rows: PrefixRow[] = Object.keys(yearMap)
        .map(Number)
        .sort()
        .map((year) => {
          const codeCounts = yearMap[year];
          const total = Object.values(codeCounts).reduce((s, v) => s + v, 0);
          return { year, codeCounts, total, pct: 0, sampleSize: 0 };
        });
      const totalAll = rows.reduce((s, r) => s + r.total, 0);
      rows.forEach((r) => {
        r.pct =
          totalAll > 0 ? Math.round((r.total / totalAll) * 10000) / 100 : 0;
        r.sampleSize = calcSampleSize(r.total, confidence, marginError);
      });
      return { prefix, rows, codes: allCodes };
    });
}

export default function PivotPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileData, setFileData] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [dateCol, setDateCol] = useState("");
  const [codeCol, setCodeCol] = useState("");
  const [confidence, setConfidence] = useState(0.9);
  const [marginError, setMarginError] = useState(0.1);
  const [prefixLen, setPrefixLen] = useState(3);

  const [prefixGroups, setPrefixGroups] = useState<PrefixGroup[] | null>(null);
  const [expandedPrefixes, setExpandedPrefixes] = useState<Set<string>>(
    new Set(),
  );

  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [exportFilename, setExportFilename] = useState("sample_result.xlsx");
  const [selectedYear, setSelectedYear] = useState<"all" | number>("all");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute unique years from fileData based on dateCol selection
  const availableYears: number[] = (() => {
    if (!fileData || !dateCol) return [];
    const idx = headers.indexOf(dateCol);
    if (idx < 0) return [];
    const years = new Set<number>();
    for (const row of fileData) {
      const y = toYear((row as unknown[])[idx]);
      if (y != null) years.add(y);
    }
    return Array.from(years).sort();
  })();

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("Зөвхөн Excel (.xlsx, .xls) эсвэл CSV файл оруулна уу");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
      });
      if (jsonRows.length < 2) {
        setError("Файлд хангалттай мэдээлэл байхгүй");
        return;
      }
      const hdrs = (jsonRows[0] as string[]).map(String);
      const rows = jsonRows.slice(1) as unknown[][];
      setHeaders(hdrs);
      setFileData(rows);
      setFileName(file.name);
      setDateCol(hdrs[0] ?? "");
      setCodeCol(hdrs[1] ?? "");
      setPrefixGroups(null);
      setExpandedPrefixes(new Set());
      setSelectedYear("all");
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleBuild = () => {
    if (!fileData || !dateCol || !codeCol) return;
    const dateIdx = headers.indexOf(dateCol);
    const filteredData =
      selectedYear === "all"
        ? fileData
        : fileData.filter(
            (row) => toYear((row as unknown[])[dateIdx]) === selectedYear,
          );
    const groups = buildPrefixGroups(
      filteredData,
      headers,
      dateCol,
      codeCol,
      confidence,
      marginError,
      prefixLen,
    );
    setPrefixGroups(groups);
    setExpandedPrefixes(new Set(groups.map((g) => g.prefix)));
    if (groups.length > 0 && !selectedPrefix)
      setSelectedPrefix(groups[0].prefix);
  };

  const toggleExpand = (prefix: string) => {
    setExpandedPrefixes((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  const handleExport = async () => {
    if (!fileData || !selectedPrefix || !prefixGroups) return;
    const group = prefixGroups.find((g) => g.prefix === selectedPrefix);
    if (!group) return;

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Internal Audit Tool";
    wb.created = new Date();

    // ── Colour palette ──────────────────────────────────────────────────────
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
    const autoWidth = (ws: ExcelJS.Worksheet, cols: string[][]) => {
      ws.columns.forEach((col, i) => {
        const max = cols.reduce(
          (m, r) => Math.max(m, String(r[i] ?? "").length),
          ((col.header as string) ?? "").length,
        );
        col.width = Math.min(Math.max(max + 3, 10), 50);
      });
    };

    // ── Summary sheet ────────────────────────────────────────────────────────
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
    autoWidth(sumSheet, bodyRows);
    sumSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

    // ── Per-year sample sheets ───────────────────────────────────────────────
    const dateIdx = headers.indexOf(dateCol);
    const codeIdx = headers.indexOf(codeCol);
    const prefixRows = fileData.filter(
      (row) =>
        extractCode((row as unknown[])[codeIdx], prefixLen) === selectedPrefix,
    );

    const RED_FILL: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFCE4E4" },
    };

    for (const pivotRow of group.rows) {
      const year = pivotRow.year;
      const n = pivotRow.sampleSize;
      const yearRows = prefixRows.filter(
        (row) => toYear((row as unknown[])[dateIdx]) === year,
      );
      const sampleCount = Math.min(n, yearRows.length);
      const sampled = [...yearRows]
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleCount);

      const ws = wb.addWorksheet(String(year));

      // Info row
      ws.mergeCells("A1:" + String.fromCharCode(65 + headers.length) + "1");
      const info = ws.getCell("A1");
      info.value = `${selectedPrefix} | ${year} он | Түүвэр: ${sampleCount} / ${yearRows.length} (итгэлцэл: ${Math.round(confidence * 100)}%, алдаа: ${Math.round(marginError * 100)}%)`;
      info.font = { bold: true, size: 11, color: { argb: "FF0F4C75" } };
      info.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(1).height = 22;

      // Extra cols
      const allCols = [...headers, "Алдаатай эсэх", "Тайлбар"];
      ws.columns = allCols.map((h) => ({ header: h, key: h }));

      const hdrRow = ws.getRow(2);
      hdrRow.values = allCols;
      applyHdr(hdrRow);

      const dataRows: string[][] = [];
      sampled.forEach((r, i) => {
        const vals = [...(r as unknown[])].map((v) => String(v ?? ""));
        vals.push("Үгүй", "");
        dataRows.push(vals);
        const row = ws.addRow(vals);
        applyBody(row, i % 2 === 0 ? ROW_ODD : ROW_EVN);
      });
      autoWidth(ws, dataRows);
      // Fix header row number vs data row index
      ws.columns.forEach((col, i) => {
        const max = dataRows.reduce(
          (m, r) => Math.max(m, String(r[i] ?? "").length),
          allCols[i]?.length ?? 0,
        );
        col.width = Math.min(Math.max(max + 3, 10), 50);
      });
      ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename || `sample_${selectedPrefix}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const prefixList = prefixGroups?.map((g) => g.prefix) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-cyan-500 flex items-center justify-center">
            <Table2 className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Pivot түүвэр тооцоолох"
        subtitle="Кодоор бүлэглэж жилээр pivot хийн, түүвэр тооцоолж Excel татах"
      />

      <div className="container mx-auto px-6 py-6 max-w-6xl space-y-4">
        {/* File Upload */}
        <Card className="border border-border shadow-sm">
          <CardContent className="pt-5 space-y-3">
            <Label className="text-sm font-medium">Excel эсвэл CSV файл оруулах</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20"
                  : fileName
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                    : "border-border hover:border-cyan-300 hover:bg-muted/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file" accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {fileName ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <span className="text-emerald-600 font-medium text-sm">{fileName}</span>
                  <span className="text-muted-foreground text-sm">({fileData?.length} мөр, {headers.length} багана)</span>
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-sm font-medium text-foreground">Файл чирж оруулах буюу дарж сонгох</p>
                  <p className="text-xs text-muted-foreground mt-0.5">XLSX, XLS, CSV</p>
                </>
              )}
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </CardContent>
        </Card>

        {/* Config — shown when file is loaded */}
        {fileData && headers.length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Table2 className="w-4 h-4 text-cyan-500" />
                Тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Year filter pills */}
              <div className="space-y-2">
                <Label className="text-sm">Жилийн шүүлтүүр</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedYear("all")}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedYear === "all"
                        ? "bg-cyan-500 border-cyan-500 text-white"
                        : "border-border bg-background text-foreground hover:border-cyan-400"
                    }`}
                  >Бүх жил</button>
                  {availableYears.map((y) => (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(y)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedYear === y
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "border-border bg-background text-foreground hover:border-cyan-400"
                      }`}
                    >{y}</button>
                  ))}
                </div>
              </div>

              {/* Column selectors + prefix + confidence + margin */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Огноон багана</Label>
                  <Select value={dateCol} onValueChange={setDateCol}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Бүлэглэх багана</Label>
                  <Select value={codeCol} onValueChange={setCodeCol}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Prefix урт</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPrefixLen(n)}
                        className={`flex-1 py-2 rounded-md text-xs font-bold border transition-colors ${
                          prefixLen === n
                            ? "bg-cyan-500 border-cyan-500 text-white"
                            : "border-border bg-background text-foreground hover:border-cyan-400"
                        }`}
                      >{n}</button>
                    ))}
                  </div>
                  {codeCol && fileData && (
                    <p className="text-xs text-muted-foreground truncate">
                      Жишээ: &quot;{String((fileData[0] as unknown[])[headers.indexOf(codeCol)] ?? "").slice(0, prefixLen).toUpperCase()}&quot;,...
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Итгэлцэл / Алдаа</Label>
                  <div className="flex gap-2">
                    <Select
                      value={String(Math.round(confidence * 100))}
                      onValueChange={(v) => setConfidence(Number(v) / 100)}
                    >
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[80, 90, 95, 99].map((v) => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(Math.round(marginError * 100))}
                      onValueChange={(v) => setMarginError(Number(v) / 100)}
                    >
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 20].map((v) => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">Итгэлцлийн % / Алдааны %</p>
                </div>
              </div>

              <Button
                onClick={handleBuild}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
              >
                <Table2 className="w-4 h-4 mr-2" />
                Pivot үүсгэх
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pivot Tables */}
        {prefixGroups && prefixGroups.length > 0 && (
          <div className="space-y-3">
            {/* Export toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3 px-1">
              <h2 className="text-base font-semibold text-foreground">Кодын бүлгээр pivot</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={selectedPrefix} onValueChange={setSelectedPrefix}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Prefix..." /></SelectTrigger>
                  <SelectContent>
                    {prefixList.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  className="w-52"
                  placeholder="sample_result.xlsx"
                />
                <Button
                  onClick={handleExport}
                  disabled={!selectedPrefix}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Excel татах
                </Button>
              </div>
            </div>

            {prefixGroups.map((group) => (
              <Card key={group.prefix} className="border border-border shadow-sm">
                <CardHeader
                  className="py-3 cursor-pointer"
                  onClick={() => toggleExpand(group.prefix)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {expandedPrefixes.has(group.prefix)
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <span className="font-mono bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded text-xs">{group.prefix}</span>
                      <span className="text-muted-foreground font-normal">бүлэг</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{group.rows.length} жил · {group.rows.reduce((s, r) => s + r.total, 0)} нийт</span>
                  </div>
                </CardHeader>
                {expandedPrefixes.has(group.prefix) && (
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-80">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-muted/60">
                              <th className="px-3 py-2 text-left text-muted-foreground border border-border font-medium">Жил</th>
                              {group.codes.map((c) => (
                                <th key={c} className="px-3 py-2 text-right text-cyan-600 dark:text-cyan-400 border border-border whitespace-nowrap font-medium">{c}</th>
                              ))}
                              <th className="px-3 py-2 text-right text-foreground border border-border font-bold">Нийт</th>
                              <th className="px-3 py-2 text-right text-muted-foreground border border-border font-medium">Хувь (%)</th>
                              <th className="px-3 py-2 text-right text-amber-600 dark:text-amber-400 border border-border whitespace-nowrap font-medium">
                                Түүвэр ({Math.round(confidence * 100)}/{Math.round(marginError * 100)})
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row, i) => (
                              <tr key={row.year} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                <td className="px-3 py-2 text-foreground border border-border font-medium">{row.year}</td>
                                {group.codes.map((c) => (
                                  <td key={c} className="px-3 py-2 text-foreground text-right border border-border">{row.codeCounts[c] ?? 0}</td>
                                ))}
                                <td className="px-3 py-2 text-foreground font-bold text-right border border-border">{row.total}</td>
                                <td className="px-3 py-2 text-muted-foreground text-right border border-border">{row.pct.toFixed(2)}%</td>
                                <td className="px-3 py-2 text-amber-600 dark:text-amber-400 font-bold text-right border border-border">{row.sampleSize}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/50 font-bold">
                              <td className="px-3 py-2 text-foreground border border-border">Нийт</td>
                              {group.codes.map((c) => (
                                <td key={c} className="px-3 py-2 text-foreground text-right border border-border">
                                  {group.rows.reduce((s, r) => s + (r.codeCounts[c] ?? 0), 0)}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-cyan-600 dark:text-cyan-400 text-right border border-border">
                                {group.rows.reduce((s, r) => s + r.total, 0)}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground text-right border border-border">100%</td>
                              <td className="px-3 py-2 text-amber-600 dark:text-amber-400 text-right border border-border">
                                {group.rows.reduce((s, r) => s + r.sampleSize, 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </ScrollArea>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Info */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Тайлбар</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2.5">
            <p><strong className="text-foreground">Огноон баганаа</strong> сонгоход жилийг автоматаар гаргаж авна.</p>
            <p>
              <strong className="text-foreground">Бүлэглэх баганаа</strong> сонгоход кодуудыг эхний <em>prefix</em> тэмдэгтээр нь бүлэглэнэ
              (жишэ: CA602 → CA6 [prefix=3]).
            </p>
            <p>
              Pivot хүснэгт бүр <strong className="text-foreground">жилээр мөр</strong>,{" "}
              <strong className="text-foreground">код баганаар</strong> тоолно. Түүврийн хэмжээг итгэлцлийн түвшин болон алдааны маржинг ашиглан тооцоолно.
            </p>
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 px-3 py-2.5 text-sm text-blue-700 dark:text-blue-400">
              <strong>Ашиглах заавар:</strong> Excel/CSV файл оруулаад огноон болон кодын багануудыг сонгоод <strong>Pivot үүсгэх</strong> дарна уу. Дараа нь prefix сонгоод Excel татна уу.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
