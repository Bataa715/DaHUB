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
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Download, Calculator } from "lucide-react";

// Z values for common confidence levels
const Z_VALUES: Record<string, number> = {
  "0.80": 1.282,
  "0.85": 1.44,
  "0.90": 1.645,
  "0.95": 1.96,
  "0.99": 2.576,
};

type DesignType = "srswr" | "srswor" | "prop" | "nonprop";

const DESIGN_LABELS: Record<DesignType, string> = {
  srswr: "1. Буцаалттай энгийн санамсаргүй (SRSWR)",
  srswor: "2. Буцаалтгүй энгийн санамсаргүй (SRSWOR)",
  prop: "3. Пропорциональ",
  nonprop: "4. Пропорциональ биш",
};

interface SamplingResult {
  n0: number;
  n: number;
  N: number | null;
  z: number;
  design: DesignType;
  confidence: number;
  margin: number;
  stdDev: number;
}

function getZ(confidence: number): number {
  const key = Object.keys(Z_VALUES).reduce((prev, curr) =>
    Math.abs(parseFloat(curr) - confidence) <
    Math.abs(parseFloat(prev) - confidence)
      ? curr
      : prev,
  );
  return Z_VALUES[key];
}

function calcSampleSize(
  design: DesignType,
  confidence: number,
  marginPct: number,
  stdDev: number,
  N: number | null,
): SamplingResult {
  const e = marginPct / 100;
  const z = getZ(confidence);
  const n0 = Math.ceil(Math.pow((z * stdDev) / e, 2));
  let n = n0;
  if (N && design !== "srswr") {
    n = Math.ceil(n0 / (1 + (n0 - 1) / N));
  }
  return { n0, n, N, z, design, confidence, margin: marginPct, stdDev };
}

export default function SanamsarguiTuuwerPage() {
  const [design, setDesign] = useState<DesignType>("srswr");
  const [confidence, setConfidence] = useState(0.95);
  const [margin, setMargin] = useState(5.0);
  const [stdDev, setStdDev] = useState(0.5);
  const [exportFilename, setExportFilename] = useState("sample_result.xlsx");
  const [isDragging, setIsDragging] = useState(false);
  const [fileData, setFileData] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<SamplingResult | null>(null);
  const [sampledRows, setSampledRows] = useState<unknown[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      if (rows.length < 2) {
        setError("Файлд хангалттай мэдээлэл байхгүй");
        return;
      }
      const hdrs = (rows[0] as string[]).map(String);
      setHeaders(hdrs);
      setFileData(rows.slice(1) as unknown[][]);
      setFileName(file.name);
      setResult(null);
      setSampledRows(null);
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

  const handleCalculate = () => {
    const N = fileData ? fileData.length : null;
    const res = calcSampleSize(design, confidence, margin, stdDev, N);
    setResult(res);

    if (fileData && fileData.length > 0) {
      const n = Math.min(res.n, fileData.length);
      if (design === "srswr") {
        const sampled: unknown[][] = [];
        for (let i = 0; i < n; i++) {
          sampled.push(fileData[Math.floor(Math.random() * fileData.length)]);
        }
        setSampledRows(sampled);
      } else {
        const indices = new Set<number>();
        while (indices.size < n) {
          indices.add(Math.floor(Math.random() * fileData.length));
        }
        setSampledRows(Array.from(indices).map((i) => fileData[i]));
      }
    }
  };

  const handleExport = () => {
    if (!result) return;
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ["Санамсаргүй түүврийн тооцоо"],
      [""],
      ["Параметр", "Утга"],
      ["Түүврийн дизайн", DESIGN_LABELS[design]],
      ["Итгэлийн түвшин", result.confidence],
      ["Алдааны марж (%)", result.margin],
      ["Стандарт хазайлт (σ)", result.stdDev],
      ["Z утга", result.z],
      ["Анхны тооцоо (n₀)", result.n0],
      ["Эцсийн түүврийн хэмжээ (n)", result.n],
      ...(result.N ? [["Нийт хүн ам (N)", result.N]] : []),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(summaryData),
      "Дүн",
    );

    if (sampledRows && headers.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([headers, ...sampledRows]),
        "Түүвэр",
      );
    }

    XLSX.writeFile(wb, exportFilename || "sample_result.xlsx");
  };

  const confLabel = (confidence * 100).toFixed(0) + "%";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
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

      <BackButton href="/tools" />

      <div className="relative z-10 container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 pt-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🎲</span>
            <h1 className="text-3xl font-bold text-white">
              Санамсаргүй түүвэр
            </h1>
          </div>
          <p className="text-slate-400">
            Аудитын түүврийн хэмжээ тооцоолох, санамсаргүй сонгон авах хэрэгсэл
          </p>
        </motion.div>

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

              {/* Numeric inputs row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      max={50}
                      step={0.1}
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

                {/* Std Dev */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Стандарт хазайлт (σ)</Label>
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
                      step={0.01}
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

                {/* Filename */}
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    🗂 Хадгалах файлын нэр
                  </Label>
                  <Input
                    value={exportFilename}
                    onChange={(e) => setExportFilename(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="sample_result.xlsx"
                  />
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-slate-300">📎 Excel файл оруулах</Label>
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
                        ({fileData?.length} мөр)
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
              </div>

              {/* Calculate Button */}
              <Button
                onClick={handleCalculate}
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold py-6 text-lg"
              >
                <Calculator className="w-5 h-5 mr-2" />
                Тооцоолох
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
                      Тооцооны дүн
                    </CardTitle>
                    <Button
                      onClick={handleExport}
                      size="sm"
                      variant="outline"
                      className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Excel татах
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
                        {result.n0}
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        Анхны тооцоо (n₀)
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-white">
                        {result.N ?? "∞"}
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        Хүн ам (N)
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-white">
                        {result.z}
                      </div>
                      <div className="text-slate-400 text-sm mt-1">Z утга</div>
                    </div>
                  </div>

                  {sampledRows && sampledRows.length > 0 && (
                    <div>
                      <p className="text-slate-300 text-sm mb-3 font-medium">
                        Санамсаргүй сонгогдсон мөрүүд (эхний 10):
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-800">
                              <th className="px-3 py-2 text-slate-400 text-left">
                                #
                              </th>
                              {headers.slice(0, 6).map((h, i) => (
                                <th
                                  key={i}
                                  className="px-3 py-2 text-slate-400 text-left whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                              {headers.length > 6 && (
                                <th className="px-3 py-2 text-slate-500 text-left">
                                  ...
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {sampledRows.slice(0, 10).map((row, i) => (
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
                                {headers.slice(0, 6).map((_, j) => (
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
                      {sampledRows.length > 10 && (
                        <p className="text-slate-500 text-xs mt-2 text-center">
                          Бүгдийг Excel-д татаж харна уу ({sampledRows.length}{" "}
                          мөр нийт)
                        </p>
                      )}
                    </div>
                  )}
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
                <span>📋</span> Тайлбар:
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                <strong>Стандарт хазайлт</strong> нь өгөгдлийн хэлбэлзлийг
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
                байх тусам түүврээс гарах үр дүм эх олонлогоос илүү сайн
                төлөөлнэ.
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                🔵 <strong className="text-blue-400">Санамж:</strong> Аудитын
                ажил илүүтэй 95%-ийн итгэлцлийн түвшний тушинг ашиглагч ба
                алдааны маржийг &quot;Аудитын түүврийн хэм хэмжээ&quot;-ийн
                3.2.4 хэсгээр тооцоогүй тохиолдолд 5%-иас өгүй байхаар сонгох нь
                зүйтэй.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
