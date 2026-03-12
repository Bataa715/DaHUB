"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Calculator,
  Shuffle,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type DesignType = "srswr" | "srswor" | "prop" | "nonprop";

const DESIGN_LABELS: Record<DesignType, string> = {
  srswr: "1. Буцаалттай энгийн санамсаргүй (SRSWR)",
  srswor: "2. Буцаалтгүй энгийн санамсаргүй (SRSWOR)",
  prop: "3. Пропорциональ",
  nonprop: "4. Пропорциональ биш",
};

// ── Z-score from confidence level (like scipy.stats.norm.ppf) ─────────────────
function getZ(cl: number): number {
  const p = 1 - (1 - cl) / 2;
  if (p >= 1) return 3.5;
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  return parseFloat((t - num / den).toFixed(4));
}

// ── Formulas matching Python ──────────────────────────────────────────────────
function calcSampleSize(
  N: number,
  Z: number,
  E: number,
  stdDev: number,
): number {
  const e = E / 100;
  const n0 = Math.pow((Z * stdDev) / e, 2);
  return Math.round(n0 / (1 + (n0 - 1) / N));
}

function calcStratifiedSampleSize(N: number, Z: number, E: number): number {
  const e = E / 100;
  const p = 0.05;
  const n0 = (Z * Z * p * (1 - p)) / (e * e);
  return Math.round(n0 / (1 + (n0 - 1) / N));
}

// ── Year extraction from Excel date values ───────────────────────────────────
function toYear(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(value);
      if (d && d.y) return d.y;
    } catch {
      /* ignore */
    }
  }
  const str = String(value);
  const m = str.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

// ── Sampling helpers ──────────────────────────────────────────────────────────
function sampleWithReplacement(total: number, k: number): number[] {
  return Array.from({ length: k }, () => Math.floor(Math.random() * total) + 1);
}

function sampleWithoutReplacement(total: number, k: number): number[] {
  k = Math.min(k, total);
  const arr = Array.from({ length: total }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k).sort((a, b) => a - b);
}

// ── Result type ───────────────────────────────────────────────────────────────
interface GroupResult {
  label: string;
  indices: number[]; // 1-based row numbers
  rows: unknown[][]; // actual data rows from the file
  size?: number;
}

interface SamplingResult {
  n: number;
  N: number;
  Z: number;
  design: DesignType;
  confidence: number;
  margin: number;
  stdDev: number;
  groups: GroupResult[];
  headers: string[]; // column headers from the file
}

export default function SanamsarguiTuuwerPage() {
  const [design, setDesign] = useState<DesignType>("srswr");
  const [confidence, setConfidence] = useState(0.95);
  const [margin, setMargin] = useState(5.0);
  const [stdDev, setStdDev] = useState(0.5);
  const [exportFilename, setExportFilename] = useState("sample_result.xlsx");
  const [exporting, setExporting] = useState(false);

  // SRSWR / SRSWOR
  const [isDragging, setIsDragging] = useState(false);
  const [fileData, setFileData] = useState<unknown[][] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [yearCol, setYearCol] = useState<string>("");
  const [useYearFilter, setUseYearFilter] = useState(false);
  const [selectedYear, setSelectedYear] = useState<"all" | number>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute unique years from fileData based on yearCol selection
  const availableYears: number[] = (() => {
    if (!useYearFilter || !fileData || !yearCol) return [];
    const idx = fileHeaders.indexOf(yearCol);
    if (idx < 0) return [];
    const years = new Set<number>();
    for (const row of fileData) {
      const y = toYear((row as unknown[])[idx]);
      if (y != null) years.add(y);
    }
    return Array.from(years).sort();
  })();

  // Stratified
  const [totalVars, setTotalVars] = useState(100);
  const [numGroups, setNumGroups] = useState(2);
  const [groupSizes, setGroupSizes] = useState<number[]>([50, 50]);

  // Result
  const [result, setResult] = useState<SamplingResult | null>(null);

  const isStratified = design === "prop" || design === "nonprop";

  // ── File handling ────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setFileError("Зөвхөн Excel (.xlsx, .xls) файл оруулна уу");
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      if (rows.length < 2) {
        setFileError("Файлд хангалттай мэдээлэл байхгүй");
        return;
      }
      const hdrs = (rows[0] as unknown[]).map((h) => String(h ?? ""));
      setFileHeaders(hdrs);
      setFileData(rows.slice(1) as unknown[][]);
      setFileName(file.name);
      setResult(null);
      setYearCol("");
      setUseYearFilter(false);
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

  const handleNumGroupsChange = (val: number) => {
    const n = Math.max(2, val);
    setNumGroups(n);
    setGroupSizes((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(50);
      return next.slice(0, n);
    });
  };

  // ── Preview computed n ───────────────────────────────────────────────────
  const computedN = (() => {
    const Z = getZ(confidence);
    if (isStratified) return calcStratifiedSampleSize(totalVars, Z, margin);
    const yearIdx = yearCol ? fileHeaders.indexOf(yearCol) : -1;
    const filteredLen =
      selectedYear === "all" || yearIdx < 0
        ? (fileData?.length ?? 0)
        : (fileData ?? []).filter(
            (row) => toYear((row as unknown[])[yearIdx]) === selectedYear,
          ).length;
    if (!filteredLen) return null;
    return calcSampleSize(filteredLen, Z, margin, stdDev);
  })();

  // ── Calculate ────────────────────────────────────────────────────────────
  const handleCalculate = () => {
    const Z = getZ(confidence);

    if (isStratified) {
      const N = totalVars;
      let sampleSize = calcStratifiedSampleSize(N, Z, margin);
      const groups: GroupResult[] = [];

      if (design === "prop") {
        const totalGroupSize = groupSizes.reduce((a, b) => a + b, 0);
        for (let i = 0; i < numGroups; i++) {
          const ni = Math.round(sampleSize * (groupSizes[i] / totalGroupSize));
          groups.push({
            label: `Бүлэг ${i + 1}`,
            indices: sampleWithoutReplacement(N, ni),
            size: groupSizes[i],
            rows: [],
          });
        }
      } else {
        if (sampleSize % numGroups !== 0)
          sampleSize += numGroups - (sampleSize % numGroups);
        const ni = Math.floor(sampleSize / numGroups);
        for (let i = 0; i < numGroups; i++) {
          groups.push({
            label: `Бүлэг ${i + 1}`,
            indices: sampleWithoutReplacement(N, ni),
            rows: [],
          });
        }
      }
      setResult({
        n: sampleSize,
        N,
        Z,
        design,
        confidence,
        margin,
        stdDev,
        headers: [],
        groups: groups.map((g) => ({ ...g, rows: [] })),
      });
    } else {
      const baseData = fileData ?? [];
      const yearIdx = yearCol ? fileHeaders.indexOf(yearCol) : -1;
      const filteredData =
        selectedYear === "all" || yearIdx < 0
          ? baseData
          : baseData.filter(
              (row) => toYear((row as unknown[])[yearIdx]) === selectedYear,
            );
      const N = filteredData.length;
      if (!N) return;
      const n = calcSampleSize(N, Z, margin, stdDev);
      const indices =
        design === "srswr"
          ? sampleWithReplacement(N, n)
          : sampleWithoutReplacement(N, n);
      const rows = indices.map((idx) => filteredData[idx - 1] ?? []);
      setResult({
        n,
        N,
        Z,
        design,
        confidence,
        margin,
        stdDev,
        headers: fileHeaders,
        groups: [
          {
            label: selectedYear === "all" ? "Түүвэр" : `Түүвэр ${selectedYear}`,
            indices,
            rows,
          },
        ],
      });
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          isStratified,
          filename: exportFilename || "sample_result.xlsx",
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFilename || "sample_result.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const confLabel = (confidence * 100).toFixed(0) + "%";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {exporting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
            <p className="text-white font-semibold text-lg">
              Excel бэлтгэж байна...
            </p>
            <p className="text-slate-400 text-sm">Түр хүлээнэ үү</p>
          </div>
        </div>
      )}
      {/* Background */}
      <div className="absolute inset-0 bg-background">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -80, 0], y: [0, -40, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-md">
            <Calculator className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Санамсаргүй түүвэр"
        subtitle="Аудитын түүврийн хэмжээ тооцоолох, санамсаргүй сонгон авах хэрэгсэл"
      />

      <div className="relative z-10 container mx-auto px-6 py-8 max-w-4xl">

        {/* Config Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-xl mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-violet-400" />
                Тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Design */}
              <div className="space-y-2">
                <Label className="text-slate-300">Түүврийн дизайн</Label>
                <Select
                  value={design}
                  onValueChange={(v) => setDesign(v as DesignType)}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {(
                      Object.entries(DESIGN_LABELS) as [DesignType, string][]
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

              {/* Confidence Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300">Итгэлийн түвшин</Label>
                  <span className="text-violet-400 font-bold text-lg">
                    {confLabel}
                  </span>
                </div>
                <Slider
                  value={[confidence]}
                  onValueChange={([v]) => setConfidence(v)}
                  min={0.8}
                  max={0.99}
                  step={0.01}
                  className="[&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-violet-400"
                />
                <div className="flex justify-between text-xs text-slate-500 px-1">
                  <span>80%</span>
                  <span>85%</span>
                  <span>90%</span>
                  <span>95%</span>
                  <span>99%</span>
                </div>
              </div>

              {/* Margin + (StdDev for SRSWR/SRSWOR) + Filename */}
              <div
                className={`grid grid-cols-1 gap-4 ${!isStratified ? "md:grid-cols-3" : "md:grid-cols-2"}`}
              >
                {/* Margin */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Алдааны марж (%)</Label>
                  <div className="flex">
                    <button
                      onClick={() =>
                        setMargin((m) =>
                          Math.max(0.1, parseFloat((m - 0.5).toFixed(2))),
                        )
                      }
                      className="px-3 py-2 rounded-l-md bg-slate-700 text-white hover:bg-slate-600 transition-colors border border-slate-600"
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.5}
                      value={margin}
                      onChange={(e) =>
                        setMargin(parseFloat(e.target.value) || 5)
                      }
                      className="bg-slate-800/50 border-x-0 border-slate-600 text-white text-center rounded-none"
                    />
                    <button
                      onClick={() =>
                        setMargin((m) => parseFloat((m + 0.5).toFixed(2)))
                      }
                      className="px-3 py-2 rounded-r-md bg-slate-700 text-white hover:bg-slate-600 transition-colors border border-slate-600"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* StdDev — only for SRSWR/SRSWOR */}
                {!isStratified && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">
                      Стандарт хазайлт (σ)
                    </Label>
                    <div className="flex">
                      <button
                        onClick={() =>
                          setStdDev((s) =>
                            Math.max(0.01, parseFloat((s - 0.05).toFixed(3))),
                          )
                        }
                        className="px-3 py-2 rounded-l-md bg-slate-700 text-white hover:bg-slate-600 transition-colors border border-slate-600"
                      >
                        −
                      </button>
                      <Input
                        type="number"
                        min={0.01}
                        max={1}
                        step={0.05}
                        value={stdDev}
                        onChange={(e) =>
                          setStdDev(parseFloat(e.target.value) || 0.5)
                        }
                        className="bg-slate-800/50 border-x-0 border-slate-600 text-white text-center rounded-none"
                      />
                      <button
                        onClick={() =>
                          setStdDev((s) => parseFloat((s + 0.05).toFixed(3)))
                        }
                        className="px-3 py-2 rounded-r-md bg-slate-700 text-white hover:bg-slate-600 transition-colors border border-slate-600"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Filename */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Хадгалах файлын нэр</Label>
                  <Input
                    value={exportFilename}
                    onChange={(e) => setExportFilename(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="sample_result.xlsx"
                  />
                </div>
              </div>

              {/* ── SRSWR / SRSWOR: File upload ── */}
              {!isStratified && (
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    📎 Excel файл оруулах
                  </Label>
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
                        ? "border-violet-400 bg-violet-500/10"
                        : fileName
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-slate-600 hover:border-violet-500/50 hover:bg-violet-500/5"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) processFile(f);
                      }}
                    />
                    {fileName ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="w-6 h-6 text-green-400" />
                        <span className="text-green-400 font-medium">
                          {fileName}
                        </span>
                        <span className="text-slate-400">
                          ({fileData?.length} мөр)
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-300 font-medium">
                          Drag and drop файл оруулах
                        </p>
                        <p className="text-slate-500 text-sm mt-1">XLSX, XLS</p>
                      </>
                    )}
                  </div>
                  {fileError && (
                    <p className="text-red-400 text-sm">{fileError}</p>
                  )}

                  {/* Year column + year filter */}
                  {fileData && fileHeaders.length > 0 && (
                    <div className="space-y-3 bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useYearFilter}
                          onChange={(e) => {
                            setUseYearFilter(e.target.checked);
                            if (!e.target.checked) {
                              setYearCol("");
                              setSelectedYear("all");
                            }
                          }}
                          className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
                        />
                        <span className="text-slate-200 text-sm font-medium">
                          📅 Огноон баганаар жил шүүх
                        </span>
                        <span className="text-xs text-slate-500">
                          — онгоцгүй бол бүх мәдээллээр ашиглана
                        </span>
                      </label>
                      {useYearFilter && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-slate-300">
                              Огноон багана
                              <span className="ml-1 text-xs text-slate-500 font-normal">
                                (жил агуулсан баганаа сонгоно уу)
                              </span>
                            </Label>
                            <Select
                              value={yearCol || "__none__"}
                              onValueChange={(v) => {
                                setYearCol(v === "__none__" ? "" : v);
                                setSelectedYear("all");
                              }}
                            >
                              <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                                <SelectValue placeholder="— Багана сонгоно —" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem
                                  value="__none__"
                                  className="text-slate-400 focus:bg-slate-700"
                                >
                                  — Багана сонгоно —
                                </SelectItem>
                                {fileHeaders.map((h) => (
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
                          {availableYears.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-slate-300">
                                Жилийн шүүлтүүр
                              </Label>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setSelectedYear("all")}
                                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                    selectedYear === "all"
                                      ? "bg-violet-500 border-violet-400 text-white"
                                      : "bg-slate-800 border-slate-600 text-slate-300 hover:border-violet-500/60"
                                  }`}
                                >
                                  Бүх жил
                                </button>
                                {availableYears.map((y) => (
                                  <button
                                    key={y}
                                    onClick={() => setSelectedYear(y)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                      selectedYear === y
                                        ? "bg-violet-500 border-violet-400 text-white"
                                        : "bg-slate-800 border-slate-600 text-slate-300 hover:border-violet-500/60"
                                    }`}
                                  >
                                    {y}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {yearCol && availableYears.length === 0 && (
                            <p className="text-xs text-amber-400">
                              ⚠️ Сонгосон баганаас огноо илэрсэнгүй. Зөв огноон
                              баганаа сонгоно уу.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {computedN !== null && (
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-2 text-sm text-violet-300">
                      Тооцоологдсон түүврийн хэмжээ (
                      {selectedYear === "all"
                        ? "Бүх жил"
                        : `${selectedYear} оны жил`}
                      ):{" "}
                      <strong className="text-violet-200 text-base">
                        {computedN}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* ── Stratified: N + num_groups + group_sizes ── */}
              {isStratified && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">
                        Эх олонлогийн тоо (N)
                      </Label>
                      <Input
                        type="number"
                        min={30}
                        value={totalVars}
                        onChange={(e) => {
                          setTotalVars(parseInt(e.target.value) || 100);
                          setResult(null);
                        }}
                        className="bg-slate-800/50 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Бүлгийн тоо (≥2)</Label>
                      <Input
                        type="number"
                        min={2}
                        value={numGroups}
                        onChange={(e) => {
                          handleNumGroupsChange(parseInt(e.target.value) || 2);
                          setResult(null);
                        }}
                        className="bg-slate-800/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  {computedN !== null && (
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-2 text-sm text-violet-300">
                      Тооцоологдсон түүврийн хэмжээ:{" "}
                      <strong className="text-violet-200 text-base">
                        {computedN}
                      </strong>
                    </div>
                  )}
                  {design === "prop" && (
                    <div>
                      <Label className="text-slate-300 mb-3 block">
                        Бүлэг тус бүрийн хувьсагчийн тоо:
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {groupSizes.map((sz, i) => (
                          <div key={i} className="space-y-1">
                            <Label className="text-slate-400 text-xs">
                              Бүлэг {i + 1} хэмжээ:
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={sz}
                              onChange={(e) => {
                                const next = [...groupSizes];
                                next[i] = parseInt(e.target.value) || 1;
                                setGroupSizes(next);
                                setResult(null);
                              }}
                              className="bg-slate-800/50 border-slate-600 text-white text-center"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Calculate Button */}
              <Button
                onClick={handleCalculate}
                disabled={!isStratified && !fileData}
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold py-6 text-lg disabled:opacity-40"
              >
                <Shuffle className="w-5 h-5 mr-2" />
                {isStratified ? "Стратифик түүвэр сонгох" : "Түүвэр сонгох"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6"
            >
              <Card className="bg-slate-900/80 border-violet-500/30 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-white flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                      ✅ Түүвэр амжилттай!
                    </CardTitle>
                    <Button
                      onClick={handleExport}
                      size="sm"
                      variant="outline"
                      className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      📥 Excel татах
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-violet-500/10 rounded-xl p-4 text-center border border-violet-500/20">
                      <div className="text-4xl font-bold text-violet-400">
                        {result.n}
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        Түүврийн хэмжээ (n)
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-white">
                        {result.N}
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        Хүн ам (N)
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-white">
                        {result.Z}
                      </div>
                      <div className="text-slate-400 text-sm mt-1">Z утга</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-white">
                        {(result.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        Итгэлийн түвшин
                      </div>
                    </div>
                  </div>

                  {result.groups.map((g, gi) => (
                    <div key={gi} className={gi > 0 ? "mt-6" : ""}>
                      <p className="text-slate-300 text-sm font-semibold mb-2">
                        {result.groups.length > 1 ? g.label : "Түүврийн үр дүн"}
                        {g.size !== undefined
                          ? ` (бүлгийн хэмжээ: ${g.size})`
                          : ""}
                        {" — "}
                        {g.indices.length} мөр сонгогдлоо
                        {g.indices.length > 50 && " (эхний 50 харагдаж байна)"}
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="text-xs min-w-full">
                          <thead>
                            <tr className="bg-slate-800 sticky top-0">
                              <th className="px-3 py-2 text-slate-400 text-center whitespace-nowrap border-r border-slate-700">
                                Мөр №
                              </th>
                              {isStratified ? (
                                <th className="px-3 py-2 text-slate-400 text-left border-r border-slate-700/50">
                                  Санамсаргүй хувьсагч
                                </th>
                              ) : (
                                result.headers.map((h, hi) => (
                                  <th
                                    key={hi}
                                    className="px-3 py-2 text-slate-400 text-left whitespace-nowrap border-r border-slate-700/50"
                                  >
                                    {h}
                                  </th>
                                ))
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {g.indices.slice(0, 50).map((idx, i) => {
                              return (
                                <tr
                                  key={i}
                                  className={
                                    i % 2 === 0
                                      ? "bg-slate-900"
                                      : "bg-slate-800/40"
                                  }
                                >
                                  <td className="px-3 py-1.5 text-violet-400 font-mono font-bold text-center border-r border-slate-700">
                                    {idx}
                                  </td>
                                  {isStratified ? (
                                    <td className="px-3 py-1.5 text-slate-200 font-mono border-r border-slate-700/30">
                                      {idx}
                                    </td>
                                  ) : (
                                    (g.rows[i] ?? []).map((cell, ci) => (
                                      <td
                                        key={ci}
                                        className="px-3 py-1.5 text-slate-200 whitespace-nowrap border-r border-slate-700/30"
                                      >
                                        {cell instanceof Date
                                          ? cell.toLocaleDateString("mn-MN")
                                          : String(cell ?? "")}
                                      </td>
                                    ))
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {g.indices.length > 50 && (
                        <p className="text-slate-500 text-xs mt-2 text-center">
                          Бүгдийг Excel-д татаж харна уу ({g.indices.length} мөр
                          нийт)
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
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
                <span></span> Тайлбар:
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                <strong>Стандарт хазайлт</strong> нь өгөгдлийн хэлбэлзэлийг
                илэрхийлнэ. Хэрэв түүврийн стандарт хазайлтыг мэдэхгүй бол{" "}
                <strong>0.5</strong> гэж үндэсний утга болгон ашиглаж болно.
              </p>
              <p>Стандарт хазайлтыг дараах томьёогоор тооцдог:</p>
              <div className="bg-slate-800/50 rounded-xl p-6 text-center">
                <div className="text-2xl text-white font-mono tracking-wide">
                  σ = √( Σ(x<sub>i</sub> − μ)² / N )
                </div>
              </div>
              <ul className="space-y-1 list-none text-sm">
                <li>
                  • <strong className="text-slate-200">(σ)</strong> — стандарт
                  хазайлт
                </li>
                <li>
                  • <strong className="text-slate-200">(x_i)</strong> —
                  олонлогийн утга
                </li>
                <li>
                  • <strong className="text-slate-200">(μ)</strong> — дундаж
                  утга
                </li>
                <li>
                  • <strong className="text-slate-200">(N)</strong> — эх
                  олонлогийн хэмжээ
                </li>
              </ul>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
                🔴 <strong className="text-red-400">Алдааны марж</strong> бага
                байх тусам түүврээс гарах үр дүн эх олонлогоос илүү сайн
                төлөөлнө.
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                🔵 <strong className="text-blue-400">Санамж:</strong> Аудитын
                ажил илүүтэй 95%-ийн итгэлцлийн түвшний түвшинг ашиглах ба
                алдааны маржийг &quot;Аудитын түүврийн хэм хэмжээ&quot;-ийн
                3.2.4 хэсгээр тооцоогүй тохиолдолд 5%-иас ихгүй байхаар сонгох
                нь зүйтэй.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
