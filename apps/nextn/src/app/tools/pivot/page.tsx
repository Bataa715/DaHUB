"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import BackButton from "@/components/shared/BackButton";
import { motion, AnimatePresence } from "framer-motion";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table2,
  Upload,
  FileSpreadsheet,
  Download,
  BarChart2,
} from "lucide-react";

type AggFunc = "sum" | "count" | "avg" | "min" | "max";

const AGG_LABELS: Record<AggFunc, string> = {
  sum: "Нийлбэр (SUM)",
  count: "Тоо (COUNT)",
  avg: "Дундаж (AVG)",
  min: "Хамгийн бага (MIN)",
  max: "Хамгийн их (MAX)",
};

function agg(values: number[], fn: AggFunc): number {
  if (!values.length) return 0;
  switch (fn) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "count":
      return values.length;
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}

function fmt(v: number, fn: AggFunc) {
  if (fn === "count") return v.toString();
  return v.toLocaleString("mn-MN", { maximumFractionDigits: 2 });
}

interface PivotData {
  dataMap: Record<string, Record<string, number[]>>;
  rowList: string[];
  colList: string[];
  aggFn: AggFunc;
  rowField: string;
  colField: string;
}

function buildPivot(
  rows: unknown[][],
  headers: string[],
  rowField: string,
  colField: string,
  valueField: string,
  aggFn: AggFunc,
): PivotData {
  const ri = headers.indexOf(rowField);
  const ci = headers.indexOf(colField);
  const vi = headers.indexOf(valueField);
  const dataMap: Record<string, Record<string, number[]>> = {};
  const allCols = new Set<string>();

  for (const row of rows) {
    const r = String((row as unknown[])[ri] ?? "");
    const c = String((row as unknown[])[ci] ?? "");
    const v = parseFloat(String((row as unknown[])[vi] ?? "0")) || 0;
    if (!dataMap[r]) dataMap[r] = {};
    if (!dataMap[r][c]) dataMap[r][c] = [];
    dataMap[r][c].push(v);
    allCols.add(c);
  }

  return {
    dataMap,
    rowList: Object.keys(dataMap).sort(),
    colList: Array.from(allCols).sort(),
    aggFn,
    rowField,
    colField,
  };
}

interface FreqRow {
  val: string;
  count: number;
  pct: string;
  cumCount: number;
  cumPct: string;
}

function buildFrequency(
  rows: unknown[][],
  headers: string[],
  field: string,
): FreqRow[] {
  const idx = headers.indexOf(field);
  const freqMap: Record<string, number> = {};
  for (const row of rows) {
    const v = String((row as unknown[])[idx] ?? "");
    freqMap[v] = (freqMap[v] || 0) + 1;
  }
  const total = rows.length;
  let cum = 0;
  return Object.entries(freqMap)
    .sort(([, a], [, b]) => b - a)
    .map(([val, count]) => {
      cum += count;
      return {
        val,
        count,
        pct: ((count / total) * 100).toFixed(2) + "%",
        cumCount: cum,
        cumPct: ((cum / total) * 100).toFixed(2) + "%",
      };
    });
}

export default function PivotPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileData, setFileData] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState("pivot_result.xlsx");

  // Pivot config
  const [rowField, setRowField] = useState("");
  const [colField, setColField] = useState("");
  const [valueField, setValueField] = useState("");
  const [aggFn, setAggFn] = useState<AggFunc>("sum");
  const [pivotResult, setPivotResult] = useState<PivotData | null>(null);

  // Frequency config
  const [freqField, setFreqField] = useState("");
  const [freqResult, setFreqResult] = useState<FreqRow[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("Зөвхөн Excel (.xlsx, .xls) эсвэл CSV файл оруулна уу");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      if (jsonRows.length < 2) {
        setError("Файлд хангалттай мэдээлэл байхгүй");
        return;
      }
      const hdrs = (jsonRows[0] as string[]).map(String);
      const rows = jsonRows.slice(1) as unknown[][];
      setHeaders(hdrs);
      setFileData(rows);
      setFileName(file.name);
      if (hdrs.length >= 1) setRowField(hdrs[0]);
      if (hdrs.length >= 2) setColField(hdrs[1]);
      if (hdrs.length >= 3) setValueField(hdrs[2]);
      setFreqField(hdrs[0]);
      setPivotResult(null);
      setFreqResult(null);
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

  const handleBuildPivot = () => {
    if (!fileData || !rowField || !colField || !valueField) return;
    setPivotResult(
      buildPivot(fileData, headers, rowField, colField, valueField, aggFn),
    );
  };

  const handleBuildFreq = () => {
    if (!fileData || !freqField) return;
    setFreqResult(buildFrequency(fileData, headers, freqField));
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    if (pivotResult) {
      const { dataMap, colList, rowList, aggFn } = pivotResult;
      const sheet: unknown[][] = [
        [
          pivotResult.rowField + " \\ " + pivotResult.colField,
          ...colList,
          "Нийт",
        ],
      ];
      for (const r of rowList) {
        const total = colList.reduce(
          (s, c) => s + agg(dataMap[r]?.[c] || [], aggFn),
          0,
        );
        sheet.push([
          r,
          ...colList.map((c) => agg(dataMap[r]?.[c] || [], aggFn)),
          total,
        ]);
      }
      const totals = colList.map((c) =>
        rowList.reduce((s, r) => s + agg(dataMap[r]?.[c] || [], aggFn), 0),
      );
      const grand = totals.reduce((a, b) => a + b, 0);
      sheet.push(["Нийт", ...totals, grand]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet), "Pivot");
    }

    if (freqResult) {
      const freqSheet = [
        ["Утга", "Давтамж", "%", "Хуримтлагдсан тоо", "Хуримтлагдсан %"],
        ...freqResult.map((r) => [r.val, r.count, r.pct, r.cumCount, r.cumPct]),
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(freqSheet),
        "Давтамж",
      );
    }

    if (fileData && headers.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([headers, ...fileData]),
        "Өгөгдөл",
      );
    }

    if (wb.SheetNames.length > 0) {
      XLSX.writeFile(wb, exportFilename || "pivot_result.xlsx");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-cyan-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-teal-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -80, 0], y: [0, -40, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <BackButton href="/tools" />

      <div className="relative z-10 container mx-auto px-6 py-8 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 pt-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/30">
              <Table2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              Pivot хийх болон түгвэр тооцох
            </h1>
          </div>
          <p className="text-slate-400">
            Excel файлаас pivot хүснэгт болон давтамжийн хүснэгт үүсгэх хэрэгсэл
          </p>
        </motion.div>

        {/* File Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-xl">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                <Label className="text-slate-300 text-base">
                  📎 Excel хэлбэр CSV файл оруулах
                </Label>
                {fileData && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={exportFilename}
                      onChange={(e) => setExportFilename(e.target.value)}
                      className="bg-slate-800/50 border-slate-600 text-white w-52 text-sm"
                      placeholder="pivot_result.xlsx"
                    />
                    <Button
                      onClick={handleExport}
                      size="sm"
                      variant="outline"
                      className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 whitespace-nowrap"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Excel татах
                    </Button>
                  </div>
                )}
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-cyan-400 bg-cyan-500/10"
                    : fileName
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-slate-600 hover:border-cyan-500/50 hover:bg-cyan-500/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="w-6 h-6 text-green-400" />
                    <span className="text-green-400 font-medium">
                      {fileName}
                    </span>
                    <span className="text-slate-400">
                      ({fileData?.length} мөр, {headers.length} багана)
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-300 font-medium">
                      Drag and drop file here
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      Limit 200MB per file • XLSX, CSV
                    </p>
                  </>
                )}
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </CardContent>
          </Card>
        </motion.div>

        {/* Analysis — only shown after file load */}
        <AnimatePresence>
          {fileData && headers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <Tabs defaultValue="pivot">
                <TabsList className="bg-slate-800/50 border border-slate-700/50 mb-6">
                  <TabsTrigger
                    value="pivot"
                    className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400"
                  >
                    <Table2 className="w-4 h-4 mr-2" />
                    Pivot хүснэгт
                  </TabsTrigger>
                  <TabsTrigger
                    value="freq"
                    className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-slate-400"
                  >
                    <BarChart2 className="w-4 h-4 mr-2" />
                    Давтамжийн хүснэгт
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-400"
                  >
                    Өгөгдөл харах
                  </TabsTrigger>
                </TabsList>

                {/* ─── Pivot Tab ─── */}
                <TabsContent value="pivot">
                  <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Pivot тохиргоо
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          {
                            label: "Мөрийн талбар",
                            value: rowField,
                            set: setRowField,
                          },
                          {
                            label: "Баганын талбар",
                            value: colField,
                            set: setColField,
                          },
                          {
                            label: "Утгын талбар",
                            value: valueField,
                            set: setValueField,
                          },
                        ].map(({ label, value, set }) => (
                          <div key={label} className="space-y-2">
                            <Label className="text-slate-300">{label}</Label>
                            <Select value={value} onValueChange={set}>
                              <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-600">
                                {headers.map((h) => (
                                  <SelectItem
                                    key={h}
                                    value={h}
                                    className="text-white focus:bg-slate-700"
                                  >
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        <div className="space-y-2">
                          <Label className="text-slate-300">Нэгтгэх арга</Label>
                          <Select
                            value={aggFn}
                            onValueChange={(v) => setAggFn(v as AggFunc)}
                          >
                            <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                              {(
                                Object.entries(AGG_LABELS) as [
                                  AggFunc,
                                  string,
                                ][]
                              ).map(([k, v]) => (
                                <SelectItem
                                  key={k}
                                  value={k}
                                  className="text-white focus:bg-slate-700"
                                >
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button
                        onClick={handleBuildPivot}
                        className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white"
                      >
                        <Table2 className="w-4 h-4 mr-2" />
                        Pivot үүсгэх
                      </Button>

                      <AnimatePresence>
                        {pivotResult && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2"
                          >
                            <ScrollArea className="max-h-96">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                  <thead>
                                    <tr className="bg-slate-800">
                                      <th className="px-3 py-2 text-left text-slate-300 border border-slate-700 font-semibold">
                                        {pivotResult.rowField} \{" "}
                                        {pivotResult.colField}
                                      </th>
                                      {pivotResult.colList.map((c) => (
                                        <th
                                          key={c}
                                          className="px-3 py-2 text-right text-cyan-400 border border-slate-700 whitespace-nowrap"
                                        >
                                          {c}
                                        </th>
                                      ))}
                                      <th className="px-3 py-2 text-right text-white border border-slate-700 font-bold">
                                        Нийт
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pivotResult.rowList.map((r, i) => {
                                      const total = pivotResult.colList.reduce(
                                        (s, c) =>
                                          s +
                                          agg(
                                            pivotResult.dataMap[r]?.[c] || [],
                                            pivotResult.aggFn,
                                          ),
                                        0,
                                      );
                                      return (
                                        <tr
                                          key={r}
                                          className={
                                            i % 2 === 0
                                              ? "bg-slate-900"
                                              : "bg-slate-800/30"
                                          }
                                        >
                                          <td className="px-3 py-2 text-slate-200 border border-slate-700 font-medium whitespace-nowrap">
                                            {r}
                                          </td>
                                          {pivotResult.colList.map((c) => (
                                            <td
                                              key={c}
                                              className="px-3 py-2 text-white text-right border border-slate-700"
                                            >
                                              {fmt(
                                                agg(
                                                  pivotResult.dataMap[r]?.[c] ||
                                                    [],
                                                  pivotResult.aggFn,
                                                ),
                                                pivotResult.aggFn,
                                              )}
                                            </td>
                                          ))}
                                          <td className="px-3 py-2 text-cyan-400 font-bold text-right border border-slate-700">
                                            {fmt(total, pivotResult.aggFn)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    <tr className="bg-slate-700/60 font-bold">
                                      <td className="px-3 py-2 text-white border border-slate-700">
                                        Нийт
                                      </td>
                                      {pivotResult.colList.map((c) => {
                                        const cv = pivotResult.rowList.reduce(
                                          (s, r) =>
                                            s +
                                            agg(
                                              pivotResult.dataMap[r]?.[c] || [],
                                              pivotResult.aggFn,
                                            ),
                                          0,
                                        );
                                        return (
                                          <td
                                            key={c}
                                            className="px-3 py-2 text-white text-right border border-slate-700"
                                          >
                                            {fmt(cv, pivotResult.aggFn)}
                                          </td>
                                        );
                                      })}
                                      <td className="px-3 py-2 text-cyan-400 font-bold text-right border border-slate-700">
                                        {fmt(
                                          pivotResult.rowList.reduce(
                                            (s, r) =>
                                              s +
                                              pivotResult.colList.reduce(
                                                (ss, c) =>
                                                  ss +
                                                  agg(
                                                    pivotResult.dataMap[r]?.[
                                                      c
                                                    ] || [],
                                                    pivotResult.aggFn,
                                                  ),
                                                0,
                                              ),
                                            0,
                                          ),
                                          pivotResult.aggFn,
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </ScrollArea>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ─── Frequency Tab ─── */}
                <TabsContent value="freq">
                  <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Давтамжийн тооцоо
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-end gap-4 flex-wrap">
                        <div className="space-y-2">
                          <Label className="text-slate-300">
                            Талбар сонгох
                          </Label>
                          <Select
                            value={freqField}
                            onValueChange={setFreqField}
                          >
                            <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white w-52">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                              {headers.map((h) => (
                                <SelectItem
                                  key={h}
                                  value={h}
                                  className="text-white focus:bg-slate-700"
                                >
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleBuildFreq}
                          className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white"
                        >
                          <BarChart2 className="w-4 h-4 mr-2" />
                          Тооцоолох
                        </Button>
                      </div>

                      <AnimatePresence>
                        {freqResult && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <div className="overflow-x-auto rounded-lg border border-slate-700">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-800">
                                    <th className="px-4 py-2 text-slate-300 text-left">
                                      {freqField}
                                    </th>
                                    <th className="px-4 py-2 text-slate-300 text-right">
                                      Давтамж
                                    </th>
                                    <th className="px-4 py-2 text-slate-300 text-right">
                                      %
                                    </th>
                                    <th className="px-4 py-2 text-slate-300 text-right">
                                      Хуримт. тоо
                                    </th>
                                    <th className="px-4 py-2 text-slate-300 text-right">
                                      Хуримт. %
                                    </th>
                                    <th className="px-4 py-2 text-slate-300 text-left">
                                      График
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {freqResult.map((row, i) => {
                                    const pctNum = parseFloat(row.pct);
                                    return (
                                      <tr
                                        key={i}
                                        className={
                                          i % 2 === 0
                                            ? "bg-slate-900"
                                            : "bg-slate-800/30"
                                        }
                                      >
                                        <td className="px-4 py-2 text-white whitespace-nowrap">
                                          {row.val}
                                        </td>
                                        <td className="px-4 py-2 text-white text-right">
                                          {row.count}
                                        </td>
                                        <td className="px-4 py-2 text-teal-400 text-right">
                                          {row.pct}
                                        </td>
                                        <td className="px-4 py-2 text-slate-300 text-right">
                                          {row.cumCount}
                                        </td>
                                        <td className="px-4 py-2 text-slate-300 text-right">
                                          {row.cumPct}
                                        </td>
                                        <td className="px-4 py-2">
                                          <div className="w-28 bg-slate-700 rounded-full h-2">
                                            <div
                                              className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full transition-all"
                                              style={{
                                                width: `${Math.min(pctNum, 100)}%`,
                                              }}
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-700/60 font-bold">
                                    <td className="px-4 py-2 text-white">
                                      Нийт
                                    </td>
                                    <td className="px-4 py-2 text-white text-right">
                                      {fileData?.length}
                                    </td>
                                    <td className="px-4 py-2 text-teal-400 text-right">
                                      100%
                                    </td>
                                    <td className="px-4 py-2 text-slate-300 text-right">
                                      {fileData?.length}
                                    </td>
                                    <td className="px-4 py-2 text-slate-300 text-right">
                                      100%
                                    </td>
                                    <td className="px-4 py-2" />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ─── Preview Tab ─── */}
                <TabsContent value="preview">
                  <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Өгөгдлийн урдчилсан харагдац (эхний 20 мөр)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-96">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-800">
                                <th className="px-3 py-2 text-slate-400 text-left">
                                  #
                                </th>
                                {headers.map((h) => (
                                  <th
                                    key={h}
                                    className="px-3 py-2 text-slate-400 text-left whitespace-nowrap"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fileData?.slice(0, 20).map((row, i) => (
                                <tr
                                  key={i}
                                  className={
                                    i % 2 === 0
                                      ? "bg-slate-900"
                                      : "bg-slate-800/30"
                                  }
                                >
                                  <td className="px-3 py-2 text-slate-500">
                                    {i + 1}
                                  </td>
                                  {headers.map((_, j) => (
                                    <td
                                      key={j}
                                      className="px-3 py-2 text-slate-300 whitespace-nowrap"
                                    >
                                      {String((row as unknown[])[j] ?? "")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Тайлбар */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-900/60 border-slate-700/30 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span>📋</span> Тайлбар:
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                <strong>Pivot хүснэгт</strong> нь олон мөртэй өгөгдлийг хоёр
                талбарын хоорондын нэгтгэсэн хүснэгт хэлбэрт оруулна. Мөрийн
                болон баганын талбар сонгоод утгыг нэгтгэх аргаа (нийлбэр,
                дундаж, тоо гэх мэт) сонгон pivot үүсгэнэ.
              </p>
              <p>
                <strong>Давтамжийн хүснэгт</strong> нь сонгосон багананы утга
                бүр хэдэн удаа давтагдсаныг, харьцааг болон хуримтлагдсан утгыг
                харуулна.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                🔵 <strong className="text-blue-400">Ашиглах заавар:</strong>{" "}
                Excel (.xlsx, .xls) эсвэл CSV файл оруулаад анализ хийх аргаа
                сонгоно уу. Үр дүнг Excel хэлбэрт татаж авах боломжтой.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
