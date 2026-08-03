"use client";

import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { DESIGN_LABEL_KEYS, type DesignType } from "./_lib/sampling";
import { useSampling } from "./_hooks/useSampling";
import { useState } from "react";

export default function SanamsarguiTuuwerPage() {
  const s = useSampling();
  const { t } = useLanguage();
  const [filterSearch, setFilterSearch] = useState("");
  const [filterExpanded, setFilterExpanded] = useState(false);

  const confLabel = (s.confidence * 100).toFixed(0) + "%";

  return (
    <div className="min-h-screen bg-background">
      {s.exporting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-xl">
            <Loader2 className="w-9 h-9 text-violet-500 animate-spin" />
            <p className="text-foreground font-semibold text-base">
              {t("samplePreparing")}
            </p>
            <p className="text-muted-foreground text-sm">{t("sampleWait")}</p>
          </div>
        </div>
      )}

      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center">
            <Calculator className="w-3.5 h-3.5 text-foreground" />
          </div>
        }
        title={t("sampleTitle")}
      />

      <div className="w-full px-4 md:px-6 py-6 space-y-4">
        {/* Config Card */}
        <Card className="rounded-none border-0 shadow-none bg-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-violet-500" />
              {t("sampleConfigTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Design + Confidence row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("sampleDesign")}</Label>
                <Select
                  value={s.design}
                  onValueChange={(v) => s.setDesign(v as DesignType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(DESIGN_LABEL_KEYS) as [
                        DesignType,
                        (typeof DESIGN_LABEL_KEYS)[DesignType],
                      ][]
                    ).map(([k, labelKey]) => (
                      <SelectItem key={k} value={k}>
                        {t(labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t("sampleConfidence")}</Label>
                  <span className="text-violet-600 font-bold text-sm tabular-nums">
                    {confLabel}
                  </span>
                </div>
                <Slider
                  value={[s.confidence]}
                  onValueChange={([v]) => s.setConfidence(v)}
                  min={0.8}
                  max={0.99}
                  step={0.01}
                />
                <div className="flex justify-between text-xs text-muted-foreground px-0.5">
                  <span>80%</span>
                  <span>85%</span>
                  <span>90%</span>
                  <span>95%</span>
                  <span>99%</span>
                </div>
              </div>
            </div>

            {/* Margin + StdDev + Filename */}
            <div
              className={`grid grid-cols-1 gap-4 ${!s.isStratified ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              <div className="space-y-1.5">
                <Label className="text-sm">{t("sampleErrorMargin")}</Label>
                <div className="flex">
                  <button
                    onClick={() =>
                      s.setMargin((m) =>
                        Math.max(0.1, parseFloat((m - 0.5).toFixed(2))),
                      )
                    }
                    className="px-3 py-2 rounded-l-md border border-r-0 border-border bg-muted hover:bg-muted/80 text-foreground text-sm transition-colors"
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
                    className="text-center rounded-none border-x-0 z-10"
                  />
                  <button
                    onClick={() =>
                      s.setMargin((m) => parseFloat((m + 0.5).toFixed(2)))
                    }
                    className="px-3 py-2 rounded-r-md border border-l-0 border-border bg-muted hover:bg-muted/80 text-foreground text-sm transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {!s.isStratified && (
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("sampleStdDev")}</Label>
                  <div className="flex">
                    <button
                      onClick={() =>
                        s.setStdDev((d) =>
                          Math.max(0.01, parseFloat((d - 0.05).toFixed(3))),
                        )
                      }
                      className="px-3 py-2 rounded-l-md border border-r-0 border-border bg-muted hover:bg-muted/80 text-foreground text-sm transition-colors"
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
                      className="text-center rounded-none border-x-0 z-10"
                    />
                    <button
                      onClick={() =>
                        s.setStdDev((d) => parseFloat((d + 0.05).toFixed(3)))
                      }
                      className="px-3 py-2 rounded-r-md border border-l-0 border-border bg-muted hover:bg-muted/80 text-foreground text-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">{t("sampleFileName")}</Label>
                <Input
                  value={s.exportFilename}
                  onChange={(e) => s.setExportFilename(e.target.value)}
                  placeholder="sample_result.xlsx"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={s.preferSaveDialog}
                    onChange={(e) => s.setPreferSaveDialog(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
                  />
                  {t("sampleSaveDialog")}
                </label>
              </div>
            </div>

            {/* File upload — SRSWR / SRSWOR only */}
            {!s.isStratified && (
              <div className="space-y-3">
                <Label className="text-sm">{t("sampleUploadFile")}</Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    s.setIsDragging(true);
                  }}
                  onDragLeave={() => s.setIsDragging(false)}
                  onDrop={s.handleDrop}
                  onClick={() => s.fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    s.isDragging
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20"
                      : s.fileName
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                        : "border-border hover:border-violet-300 hover:bg-muted/40"
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
                      <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                      <span className="text-emerald-600 font-medium text-sm">
                        {s.fileName}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        ({s.fileData?.length} {t("alertRows")})
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-1.5" />
                      <p className="text-sm font-medium text-foreground">
                        {t("sampleDropZone")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        XLSX, XLS
                      </p>
                    </>
                  )}
                </div>
                {s.fileError && (
                  <p className="text-destructive text-sm">{s.fileError}</p>
                )}

                {/* Column filter */}
                {s.fileData && s.fileHeaders.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
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
                      <span className="text-sm font-medium">
                        {t("sampleFilterByCol")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("sampleFilterByColHint")}
                      </span>
                    </label>

                    {s.useColumnFilter && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-sm">
                            {t("sampleFilterCol")}
                            <span className="ml-1 text-xs text-muted-foreground font-normal">
                              {t("sampleAnyColHint")}
                            </span>
                          </Label>
                          <Select
                            value={s.filterCol || "__none__"}
                            onValueChange={(v) => {
                              s.setFilterCol(v === "__none__" ? "" : v);
                              s.setSelectedFilterValue("all");
                              s.setCoverAllValues(false);
                              setFilterSearch("");
                              setFilterExpanded(false);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("sampleSelectCol")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value="__none__"
                                className="text-muted-foreground"
                              >
                                {t("sampleSelectCol")}
                              </SelectItem>
                              {s.fileHeaders.map((h, hi) => (
                                <SelectItem key={`${h}-${hi}`} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {s.availableFilterValues.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm">
                              {t("sampleFilterValues")}
                              <span className="ml-1 text-xs text-muted-foreground font-normal">
                                ({s.availableFilterValues.length}{" "}
                                {t("sampleValuesUnit")})
                              </span>
                            </Label>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <input
                                type="text"
                                value={filterSearch}
                                onChange={(e) => {
                                  setFilterSearch(e.target.value);
                                  setFilterExpanded(true);
                                }}
                                placeholder={t("sampleSearchValues")}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-400"
                              />
                            </div>
                            {(() => {
                              const filtered = filterSearch
                                ? s.availableFilterValues.filter((v) =>
                                    v
                                      .toLowerCase()
                                      .includes(filterSearch.toLowerCase()),
                                  )
                                : s.availableFilterValues;
                              const LIMIT = 10;
                              const showAll = filterExpanded || filterSearch;
                              const visible = showAll
                                ? filtered
                                : filtered.slice(0, LIMIT);
                              const hiddenCount = filtered.length - LIMIT;
                              return (
                                <>
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      onClick={() => {
                                        s.setSelectedFilterValue("all");
                                        setFilterSearch("");
                                      }}
                                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                        s.selectedFilterValue === "all"
                                          ? "bg-violet-500 border-violet-500 text-foreground"
                                          : "border-border bg-background text-foreground hover:border-violet-400"
                                      }`}
                                    >
                                      {t("sampleAllValues")}
                                    </button>
                                    {visible.map((v) => (
                                      <button
                                        key={v}
                                        onClick={() =>
                                          s.setSelectedFilterValue(v)
                                        }
                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                          s.selectedFilterValue === v
                                            ? "bg-violet-500 border-violet-500 text-foreground"
                                            : "border-border bg-background text-foreground hover:border-violet-400"
                                        }`}
                                      >
                                        {v}
                                      </button>
                                    ))}
                                  </div>
                                  {!filterSearch && filtered.length > LIMIT && (
                                    <button
                                      onClick={() =>
                                        setFilterExpanded((p) => !p)
                                      }
                                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-500 transition-colors mt-0.5"
                                    >
                                      {filterExpanded ? (
                                        <>
                                          <ChevronUp className="w-3 h-3" />{" "}
                                          {t("sampleCollapse")}
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="w-3 h-3" />{" "}
                                          {t("sampleForceAll")} (+{hiddenCount})
                                        </>
                                      )}
                                    </button>
                                  )}
                                  {filterSearch && filtered.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      &ldquo;{filterSearch}&rdquo;{" "}
                                      {t("sampleNoFilter")}
                                    </p>
                                  )}
                                </>
                              );
                            })()}

                            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none mt-1">
                              <input
                                type="checkbox"
                                checked={s.coverAllValues}
                                onChange={(e) =>
                                  s.setCoverAllValues(e.target.checked)
                                }
                                disabled={s.selectedFilterValue !== "all"}
                                className="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer disabled:opacity-50"
                              />
                              {t("sampleForceAll")}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {t("sampleFilterExampleHint")}
                            </p>
                          </div>
                        )}

                        {s.filterCol &&
                          s.availableFilterValues.length === 0 && (
                            <p className="text-xs text-amber-500">
                              ⚠️ {t("sampleNoFilter")}
                            </p>
                          )}
                      </>
                    )}
                  </div>
                )}

                {s.computedN !== null && (
                  <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">
                      {t("sampleSizeLabel")} (
                      {!s.useColumnFilter || s.selectedFilterValue === "all"
                        ? t("sampleAllValues")
                        : `${s.filterCol}=${s.selectedFilterValue}`}
                      ):
                    </span>
                    <strong className="text-violet-600 text-base">
                      {s.computedN}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* Stratified inputs */}
            {s.isStratified && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("samplePopN")}</Label>
                    <Input
                      type="number"
                      min={30}
                      value={s.totalVars}
                      onChange={(e) => {
                        s.setTotalVars(parseInt(e.target.value) || 100);
                        s.setResult(null);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("sampleGroupN")}</Label>
                    <Input
                      type="number"
                      min={2}
                      value={s.numGroups}
                      onChange={(e) => {
                        s.handleNumGroupsChange(parseInt(e.target.value) || 2);
                        s.setResult(null);
                      }}
                    />
                  </div>
                </div>
                {s.computedN !== null && (
                  <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">
                      {t("sampleSizeLabel")}:
                    </span>
                    <strong className="text-violet-600 text-base">
                      {s.computedN}
                    </strong>
                  </div>
                )}
                {/* Prop + nonprop хоёуланд Ni оруулна — ялгаа нь хуваарилалтын томьёо */}
                <div>
                  <Label className="text-sm mb-2 block">
                    {t("sampleGroupVarCountLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {s.design === "prop"
                      ? t("sampleDesignProp")
                      : t("sampleDesignNonprop")}
                    :{" "}
                    {s.design === "prop"
                      ? "ni ∝ Ni"
                      : "бүлэг бүрт тэнцүү ni (Ni-ээс)"}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {s.groupSizes.map((sz, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("sampleGroupLabel")} {i + 1} (Ni):
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
                          className="text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Calculate Button */}
            <Button
              onClick={s.handleCalculate}
              disabled={!s.isStratified && !s.fileData}
              className="w-full bg-violet-600 hover:bg-violet-700 text-foreground font-semibold py-5 text-base disabled:opacity-40"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              {s.isStratified ? t("sampleStratifiedBtn") : t("sampleSizeLabel")}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {s.result &&
          (() => {
            const result = s.result!;
            return (
              <Card className="rounded-none border-0 shadow-none bg-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {t("sampleSizeLabel")}
                    </CardTitle>
                    <Button
                      onClick={s.handleExport}
                      size="sm"
                      variant="outline"
                      className="border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10/30"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      {t("pivotExportBtn")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {s.exportError && (
                    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {s.exportError}
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20 p-3 text-center">
                      <div className="text-3xl font-bold text-violet-600">
                        {result.n}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("sampleSizeLabel")} (n)
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {result.N}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("samplePopN")} (N)
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {result.Z}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Z {t("sampleStdDev")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {(result.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("sampleConfidence")}
                      </div>
                    </div>
                  </div>

                  {/* Group tables */}
                  {result.groups.map((g, gi) => (
                    <div key={gi} className={gi > 0 ? "mt-5" : ""}>
                      <p className="text-sm font-medium text-foreground mb-2">
                        {result.groups.length > 1
                          ? g.label
                          : t("sampleSizeLabel")}
                        {g.size !== undefined
                          ? ` (${t("sampleGroupSizeSuffix")}: ${g.size})`
                          : ""}
                        {" — "}
                        <span className="text-muted-foreground">
                          {g.indices.length} {t("alertRows")}{" "}
                          {t("sampleSizeLabel")}
                          {g.indices.length > 50 &&
                            ` (${t("sampleFirst50Suffix")})`}
                        </span>
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="text-xs min-w-full">
                          <thead>
                            <tr className="bg-muted/60">
                              <th className="px-3 py-2 text-muted-foreground text-center whitespace-nowrap border-r border-border font-medium">
                                {t("alertRows")} №
                              </th>
                              {s.isStratified ? (
                                <th className="px-3 py-2 text-muted-foreground text-left border-r border-border/50 font-medium">
                                  {t("sampleDesign")}
                                </th>
                              ) : (
                                result.headers.map((h, hi) => (
                                  <th
                                    key={hi}
                                    className="px-3 py-2 text-muted-foreground text-left whitespace-nowrap border-r border-border/50 font-medium"
                                  >
                                    {h}
                                  </th>
                                ))
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {g.indices.slice(0, 50).map((idx, i) => (
                              <tr
                                key={i}
                                className={
                                  i % 2 === 0 ? "bg-background" : "bg-muted/20"
                                }
                              >
                                <td className="px-3 py-1.5 text-violet-600 font-mono font-bold text-center border-r border-border">
                                  {idx}
                                </td>
                                {s.isStratified ? (
                                  <td className="px-3 py-1.5 text-foreground font-mono border-r border-border/30">
                                    {idx}
                                  </td>
                                ) : (
                                  (g.rows[i] ?? []).map((cell, ci) => (
                                    <td
                                      key={ci}
                                      className="px-3 py-1.5 text-foreground whitespace-nowrap border-r border-border/30"
                                    >
                                      {cell instanceof Date
                                        ? cell.toLocaleDateString("mn-MN")
                                        : String(cell ?? "")}
                                    </td>
                                  ))
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {g.indices.length > 50 && (
                        <p className="text-muted-foreground text-xs mt-1.5 text-center">
                          {t("sampleDownloadAllHint")} ({g.indices.length}{" "}
                          {t("alertRows")} {t("sampleDownloadAllTotalSuffix")})
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

        {/* Notes */}
        <Card className="rounded-none border-0 shadow-none bg-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {t("sampleNotesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>{t("sampleStdDevExplain")}</p>
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center font-mono text-base text-foreground">
              σ = √( Σ(x<sub>i</sub> − μ)² / N )
            </div>
            <ul className="space-y-1 text-xs">
              <li>
                <strong className="text-foreground">σ</strong> —{" "}
                {t("sampleFormulaSigma")}
              </li>
              <li>
                <strong className="text-foreground">x_i</strong> —{" "}
                {t("sampleFormulaXi")}
              </li>
              <li>
                <strong className="text-foreground">μ</strong> —{" "}
                {t("sampleFormulaMu")}
              </li>
              <li>
                <strong className="text-foreground">N</strong> —{" "}
                {t("sampleFormulaN")}
              </li>
            </ul>
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
              {t("sampleMarginWarning")}
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 px-3 py-2.5 text-sm text-blue-700 dark:text-blue-400">
              <strong>{t("sampleNoteLabel")}</strong> {t("sampleNoteText")}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
