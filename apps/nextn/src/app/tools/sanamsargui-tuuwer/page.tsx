"use client";

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
import { DESIGN_LABELS, type DesignType } from "./_lib/sampling";
import { useSampling } from "./_hooks/useSampling";

export default function SanamsarguiTuuwerPage() {
  const s = useSampling();

  const confLabel = (s.confidence * 100).toFixed(0) + "%";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {s.exporting && (
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
              {/* s.design */}
              <div className="space-y-2">
                <Label className="text-slate-300">Түүврийн дизайн</Label>
                <Select
                  value={s.design}
                  onValueChange={(v) => s.setDesign(v as DesignType)}
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

              {/* s.confidence Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300">Итгэлийн түвшин</Label>
                  <span className="text-violet-400 font-bold text-lg">
                    {confLabel}
                  </span>
                </div>
                <Slider
                  value={[s.confidence]}
                  onValueChange={([v]) => s.setConfidence(v)}
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

              {/* s.margin + (s.stdDev for SRSWR/SRSWOR) + s.fileName */}
              <div
                className={`grid grid-cols-1 gap-4 ${!s.isStratified ? "md:grid-cols-3" : "md:grid-cols-2"}`}
              >
                {/* s.margin */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Алдааны марж (%)</Label>
                  <div className="flex">
                    <button
                      onClick={() =>
                        s.setMargin((m) =>
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
                      value={s.margin}
                      onChange={(e) =>
                        s.setMargin(parseFloat(e.target.value) || 5)
                      }
                      className="bg-slate-800/50 border-x-0 border-slate-600 text-white text-center rounded-none"
                    />
                    <button
                      onClick={() =>
                        s.setMargin((m) => parseFloat((m + 0.5).toFixed(2)))
                      }
                      className="px-3 py-2 rounded-r-md bg-slate-700 text-white hover:bg-slate-600 transition-colors border border-slate-600"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* s.stdDev — only for SRSWR/SRSWOR */}
                {!s.isStratified && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">
                      Стандарт хазайлт (σ)
                    </Label>
                    <div className="flex">
                      <button
                        onClick={() =>
                          s.setStdDev((s) =>
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
                        value={s.stdDev}
                        onChange={(e) =>
                          s.setStdDev(parseFloat(e.target.value) || 0.5)
                        }
                        className="bg-slate-800/50 border-x-0 border-slate-600 text-white text-center rounded-none"
                      />
                      <button
                        onClick={() =>
                          s.setStdDev((s) => parseFloat((s + 0.05).toFixed(3)))
                        }
                        className="px-3 py-2 rounded-r-md bg-slate-700 text-white hover:bg-slate-600 transition-colors border border-slate-600"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* s.fileName */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Хадгалах файлын нэр</Label>
                  <Input
                    value={s.exportFilename}
                    onChange={(e) => s.setExportFilename(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="sample_result.xlsx"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={s.preferSaveDialog}
                      onChange={(e) => s.setPreferSaveDialog(e.target.checked)}
                      className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
                    />
                    Хадгалах цонх (Keep/Save dialog) ашиглах
                  </label>
                </div>
              </div>

              {/* ── SRSWR / SRSWOR: File upload ── */}
              {!s.isStratified && (
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    📎 Excel файл оруулах
                  </Label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      s.setIsDragging(true);
                    }}
                    onDragLeave={() => s.setIsDragging(false)}
                    onDrop={s.handleDrop}
                    onClick={() => s.fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      s.isDragging
                        ? "border-violet-400 bg-violet-500/10"
                        : s.fileName
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-slate-600 hover:border-violet-500/50 hover:bg-violet-500/5"
                    }`}
                  >
                    <input
                      ref={s.fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) s.processFile(f);
                      }}
                    />
                    {s.fileName ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="w-6 h-6 text-green-400" />
                        <span className="text-green-400 font-medium">
                          {s.fileName}
                        </span>
                        <span className="text-slate-400">
                          ({s.fileData?.length} мөр)
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
                  {s.fileError && (
                    <p className="text-red-400 text-sm">{s.fileError}</p>
                  )}

                  {/* Generic column + value filter */}
                  {s.fileData && s.fileHeaders.length > 0 && (
                    <div className="space-y-3 bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={s.useColumnFilter}
                          onChange={(e) => {
                            s.setUseColumnFilter(e.target.checked);
                            if (!e.target.checked) {
                              s.setFilterCol("");
                              s.setSelectedFilterValue("all");
                              s.setCoverAllValues(false);
                            }
                          }}
                          className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
                        />
                        <span className="text-slate-200 text-sm font-medium">
                          🧩 Баганаар шүүх
                        </span>
                        <span className="text-xs text-slate-500">
                          — жишээ: SOL баганаас 100/101/102/103
                        </span>
                      </label>
                      {s.useColumnFilter && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-slate-300">
                              Шүүх багана
                              <span className="ml-1 text-xs text-slate-500 font-normal">
                                (дурын багана сонгоно)
                              </span>
                            </Label>
                            <Select
                              value={s.filterCol || "__none__"}
                              onValueChange={(v) => {
                                s.setFilterCol(v === "__none__" ? "" : v);
                                s.setSelectedFilterValue("all");
                                s.setCoverAllValues(false);
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
                                {s.fileHeaders.map((h) => (
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

                          {s.availableFilterValues.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-slate-300">
                                Утгын шүүлтүүр
                              </Label>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() =>
                                    s.setSelectedFilterValue("all")
                                  }
                                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                    s.selectedFilterValue === "all"
                                      ? "bg-violet-500 border-violet-400 text-white"
                                      : "bg-slate-800 border-slate-600 text-slate-300 hover:border-violet-500/60"
                                  }`}
                                >
                                  Бүх утга
                                </button>
                                {s.availableFilterValues.map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => s.setSelectedFilterValue(v)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                      s.selectedFilterValue === v
                                        ? "bg-violet-500 border-violet-400 text-white"
                                        : "bg-slate-800 border-slate-600 text-slate-300 hover:border-violet-500/60"
                                    }`}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>

                              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none mt-2">
                                <input
                                  type="checkbox"
                                  checked={s.coverAllValues}
                                  onChange={(e) =>
                                    s.setCoverAllValues(e.target.checked)
                                  }
                                  disabled={s.selectedFilterValue !== "all"}
                                  className="w-4 h-4 rounded accent-violet-500 cursor-pointer disabled:opacity-50"
                                />
                                Бүх утгыг заавал хамруулах
                              </label>
                              <p className="text-xs text-slate-500">
                                Жишээ: <strong>SOL</strong> баганад 100, 101,
                                102, 103 бол энэ тохиргоо асаалттай үед түүвэрт
                                эдгээрийн аль аль нь дор хаяж 1 удаа орно.
                              </p>
                            </div>
                          )}

                          {s.filterCol &&
                            s.availableFilterValues.length === 0 && (
                              <p className="text-xs text-amber-400">
                                ⚠️ Сонгосон баганад илэрц олдсонгүй.
                              </p>
                            )}
                        </>
                      )}
                    </div>
                  )}

                  {s.computedN !== null && (
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-2 text-sm text-violet-300">
                      Тооцоологдсон түүврийн хэмжээ (
                      {!s.useColumnFilter || s.selectedFilterValue === "all"
                        ? "Бүх өгөгдөл"
                        : `${s.filterCol}=${s.selectedFilterValue}`}
                      ):{" "}
                      <strong className="text-violet-200 text-base">
                        {s.computedN}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* ── Stratified: N + num_groups + group_sizes ── */}
              {s.isStratified && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">
                        Эх олонлогийн тоо (N)
                      </Label>
                      <Input
                        type="number"
                        min={30}
                        value={s.totalVars}
                        onChange={(e) => {
                          s.setTotalVars(parseInt(e.target.value) || 100);
                          s.setResult(null);
                        }}
                        className="bg-slate-800/50 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Бүлгийн тоо (≥2)</Label>
                      <Input
                        type="number"
                        min={2}
                        value={s.numGroups}
                        onChange={(e) => {
                          s.handleNumGroupsChange(
                            parseInt(e.target.value) || 2,
                          );
                          s.setResult(null);
                        }}
                        className="bg-slate-800/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  {s.computedN !== null && (
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-2 text-sm text-violet-300">
                      Тооцоологдсон түүврийн хэмжээ:{" "}
                      <strong className="text-violet-200 text-base">
                        {s.computedN}
                      </strong>
                    </div>
                  )}
                  {s.design === "prop" && (
                    <div>
                      <Label className="text-slate-300 mb-3 block">
                        Бүлэг тус бүрийн хувьсагчийн тоо:
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {s.groupSizes.map((sz, i) => (
                          <div key={i} className="space-y-1">
                            <Label className="text-slate-400 text-xs">
                              Бүлэг {i + 1} хэмжээ:
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={sz}
                              onChange={(e) => {
                                const next = [...s.groupSizes];
                                next[i] = parseInt(e.target.value) || 1;
                                s.setGroupSizes(next);
                                s.setResult(null);
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
                onClick={s.handleCalculate}
                disabled={!s.isStratified && !s.fileData}
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold py-6 text-lg disabled:opacity-40"
              >
                <Shuffle className="w-5 h-5 mr-2" />
                {s.isStratified ? "Стратифик түүвэр сонгох" : "Түүвэр сонгох"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {s.result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6"
            >
              {(() => {
                const result = s.result!;
                return (
                  <Card className="bg-slate-900/80 border-violet-500/30 backdrop-blur-xl">
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="text-white flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                          ✅ Түүвэр амжилттай!
                        </CardTitle>
                        <Button
                          onClick={s.handleExport}
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
                      {s.exportError && (
                        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                          {s.exportError}
                        </div>
                      )}

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
                          <div className="text-slate-400 text-sm mt-1">
                            Z утга
                          </div>
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
                            {result.groups.length > 1
                              ? g.label
                              : "Түүврийн үр дүн"}
                            {g.size !== undefined
                              ? ` (бүлгийн хэмжээ: ${g.size})`
                              : ""}
                            {" — "}
                            {g.indices.length} мөр сонгогдлоо
                            {g.indices.length > 50 &&
                              " (эхний 50 харагдаж байна)"}
                          </p>
                          <div className="overflow-x-auto rounded-lg border border-slate-700">
                            <table className="text-xs min-w-full">
                              <thead>
                                <tr className="bg-slate-800 sticky top-0">
                                  <th className="px-3 py-2 text-slate-400 text-center whitespace-nowrap border-r border-slate-700">
                                    Мөр №
                                  </th>
                                  {s.isStratified ? (
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
                                      {s.isStratified ? (
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
                              Бүгдийг Excel-д татаж харна уу ({g.indices.length}{" "}
                              мөр нийт)
                            </p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })()}
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
