"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  pythonToolApi,
  getApiErrorMessage,
  PythonTool,
  FilterDef,
} from "@/lib/api";
import { isAxiosError } from "axios";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileSpreadsheet, FileText, Code2, Download, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ── helpers ────────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}
function currentMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const OUTPUT_META = {
  excel: {
    icon: FileSpreadsheet,
    labelKey: "reportsOutputExcel" as const,
    ext: ".xlsx",
    color: "from-emerald-600 to-teal-600",
  },
  csv: {
    icon: FileText,
    labelKey: "reportsOutputCsv" as const,
    ext: ".csv",
    color: "from-sky-600 to-blue-600",
  },
};

interface PreviewState {
  status: "idle" | "loading" | "done" | "error";
  columns: string[];
  rows: unknown[][];
  totalCount: number;
  error?: string;
}

// ── page ───────────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const { id } = useParams<{ type: string; id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [item, setItem] = useState<PythonTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(currentMonthStart());
  const [endDate, setEndDate] = useState(today());
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const downloadAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    columns: [],
    rows: [],
    totalCount: 0,
  });

  const load = useCallback(async () => {
    try {
      const all = await pythonToolApi.getTools();
      const found = all.find((t) => t.id === id);
      if (!found) {
        toast({ title: t("reportsToolNotFound"), variant: "destructive" });
        router.replace("/tools/reports");
        return;
      }
      setItem(found);
    } catch {
      toast({ title: t("reportsToolLoadError"), variant: "destructive" });
      router.replace("/tools/reports");
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const parsedFilters: FilterDef[] = (() => {
    try {
      return JSON.parse(item?.filters || "[]") as FilterDef[];
    } catch {
      return [];
    }
  })();

  const dateMode = item?.dateMode ?? "none";

  const handleDownload = async () => {
    if (!item) return;
    if (dateMode === "range" && (!startDate || !endDate))
      return toast({ title: t("reportsDateRequired"), variant: "destructive" });
    if (dateMode === "single" && !startDate)
      return toast({ title: t("reportsDateRequired"), variant: "destructive" });
    const missing = parsedFilters.filter(
      (f) => f.required && !filterValues[f.key],
    );
    if (missing.length)
      return toast({
        title: t("reportsFilterRequired"),
        description: missing.map((f) => f.label).join(", "),
        variant: "destructive",
      });

    setDownloadError("");
    setDownloading(true);
    setDownloadProgress(0);
    const controller = new AbortController();
    downloadAbortRef.current = controller;

    try {
      const blob = await pythonToolApi.runTool(
        item.id,
        dateMode !== "none" ? startDate : undefined,
        dateMode === "range" ? endDate : undefined,
        filterValues,
        (pct) => setDownloadProgress(pct),
        controller.signal,
      );
      const outMeta = OUTPUT_META[item.outputFormat ?? "excel"];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.name}_${today()}${outMeta.ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("reportsDownloadSuccess") });
    } catch (e: unknown) {
      // Кэнсэлэхд алдаа биш
      if (
        controller.signal.aborted ||
        (isAxiosError(e) &&
          (e.code === "ERR_CANCELED" || e.name === "CanceledError"))
      ) {
        toast({ title: t("reportsDownloadCanceled") });
      } else if (isAxiosError(e) && e.response?.data instanceof Blob) {
        const text = await (e.response.data as Blob)
          .text()
          .catch(() => e.message);
        setDownloadError(text.slice(0, 300));
      } else {
        setDownloadError(getApiErrorMessage(e).slice(0, 300));
      }
    } finally {
      downloadAbortRef.current = null;
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleCancelDownload = () => {
    downloadAbortRef.current?.abort();
  };

  const handleCancelPreview = () => {
    previewAbortRef.current?.abort();
  };

  const handlePreview = async () => {
    if (!item) return;
    if (dateMode === "range" && (!startDate || !endDate))
      return toast({ title: t("reportsDateRequired"), variant: "destructive" });
    if (dateMode === "single" && !startDate)
      return toast({ title: t("reportsDateRequired"), variant: "destructive" });

    // Өмнөх preview ажиллаж байвал болиулна
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;

    setPreview({ status: "loading", columns: [], rows: [], totalCount: 0 });
    try {
      const data = await pythonToolApi.previewTool(
        item.id,
        dateMode !== "none" ? startDate : undefined,
        dateMode === "range" ? endDate : undefined,
        filterValues,
        controller.signal,
      );
      setPreview({ status: "done", ...data });
    } catch (e: unknown) {
      if (
        controller.signal.aborted ||
        (isAxiosError(e) &&
          (e.code === "ERR_CANCELED" || e.name === "CanceledError"))
      ) {
        setPreview({ status: "idle", columns: [], rows: [], totalCount: 0 });
        toast({ title: t("reportsPreviewCanceled") });
        return;
      }
      setPreview({
        status: "error",
        columns: [],
        rows: [],
        totalCount: 0,
        error: getApiErrorMessage(e) || "Preview алдаа",
      });
    } finally {
      if (previewAbortRef.current === controller)
        previewAbortRef.current = null;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
          <p className="text-muted-foreground/70 text-sm">{t("loading")}</p>
        </div>
      </div>
    );
  }
  if (!item) return null;

  const color = item.color ?? "from-violet-500 to-indigo-500";
  const outMeta =
    OUTPUT_META[item.outputFormat as keyof typeof OUTPUT_META] ??
    OUTPUT_META.excel;
  const previewLoading = preview.status === "loading";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/tools/reports"
            className="text-muted-foreground/70 hover:text-foreground/90 transition-colors text-sm flex items-center gap-1"
          >
            ← {t("back")}
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-2 h-2 rounded-full bg-gradient-to-br ${color}`}
            />
            <span className="font-semibold text-foreground text-sm">
              {item.name}
            </span>
          </div>
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded font-mono border bg-violet-500/10 text-violet-400 border-violet-500/20">
            Python
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-[1440px] mx-auto w-full px-6 py-6 flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-20 rounded-2xl bg-muted/30 border border-border overflow-hidden">
            <div className={`h-0.5 w-full bg-gradient-to-r ${color}`} />
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow`}
                  >
                    <Code2 className="w-4 h-4 text-foreground" />
                  </div>
                  <p className="font-bold text-foreground">{item.name}</p>
                </div>
                {item.description && (
                  <p className="text-muted-foreground/70 text-xs mt-1 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="border-t border-border" />

              {dateMode === "range" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("reportsDateRangeLabel")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground/50">
                        {t("reportsDateStart")}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={downloading}
                        className="w-full bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-foreground/90 text-xs focus:outline-none focus:border-violet-500/60 disabled:opacity-40 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground/50">
                        {t("reportsDateEnd")}
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={downloading}
                        className="w-full bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-foreground/90 text-xs focus:outline-none focus:border-violet-500/60 disabled:opacity-40 transition"
                      />
                    </div>
                  </div>
                </div>
              )}

              {dateMode === "single" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("reportsDateSingleLabel")}
                  </p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={downloading}
                    className="w-full bg-muted/40 border border-border rounded-lg px-2 py-2 text-foreground/90 text-sm focus:outline-none focus:border-violet-500/60 disabled:opacity-40 transition"
                  />
                </div>
              )}

              {dateMode === "none" && (
                <p className="text-xs text-muted-foreground/50 text-center py-0.5">
                  {t("reportsDateNone")}
                </p>
              )}

              {parsedFilters.length > 0 && (
                <>
                  <div className="border-t border-border" />
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("reportsFiltersLabel")}
                    </p>
                    {parsedFilters.map((f) => {
                      const raw = filterValues[f.key] ?? "";
                      const filled = !!raw.trim();
                      const missing = f.required && !filled;
                      return (
                        <div key={f.key} className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground/80">
                            {f.label}
                            {f.required && (
                              <span className="text-rose-400 ml-0.5">*</span>
                            )}
                          </label>
                          <input
                            value={raw}
                            onChange={(e) =>
                              setFilterValues((p) => ({
                                ...p,
                                [f.key]: e.target.value,
                              }))
                            }
                            disabled={downloading}
                            placeholder={f.placeholder ?? ""}
                            className={`w-full rounded-xl px-3 py-2 text-foreground/90 text-xs focus:outline-none disabled:opacity-40 placeholder:text-muted-foreground/50 transition ${missing ? "bg-rose-950/60 border border-rose-500/40" : filled ? "bg-emerald-950/40 border border-emerald-500/30" : "bg-card border border-border focus:border-border/60"}`}
                          />
                          {missing && (
                            <p className="text-[10px] text-rose-400">
                              {t("reportsFilterRequiredMsg")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {downloadProgress !== null && (
                <>
                  <div className="border-t border-border" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {downloadProgress === 100
                          ? t("reportsDownloadDone")
                          : t("reportsDownloading")}
                      </span>
                      {downloadProgress > 0 && downloadProgress < 100 && (
                        <span className="text-xs font-mono font-bold text-violet-400">
                          {downloadProgress}%
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-foreground/5 rounded-full h-1.5 overflow-hidden">
                      {downloadProgress > 0 ? (
                        <div
                          className={`h-1.5 rounded-full bg-gradient-to-r ${color} transition-all duration-300`}
                          style={{ width: `${downloadProgress}%` }}
                        />
                      ) : (
                        <div
                          className={`h-1.5 rounded-full bg-gradient-to-r ${color} animate-pulse w-full opacity-60`}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {downloadError && (
                <div className="rounded-xl px-3 py-2.5 text-xs bg-rose-500/8 border border-rose-500/25 text-rose-300 leading-relaxed">
                  {downloadError}
                </div>
              )}

              <div className="border-t border-border" />
              <div className="flex gap-2">
                {previewLoading ? (
                  <button
                    type="button"
                    onClick={handleCancelPreview}
                    className="px-4 py-2.5 text-xs rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold transition-all flex items-center gap-1.5"
                    title={t("reportsStopBtn")}
                  >
                    <X className="w-3.5 h-3.5" />
                    {t("reportsStopBtn")}
                  </button>
                ) : (
                  <button
                    onClick={handlePreview}
                    disabled={downloading}
                    className="px-4 py-2.5 text-xs rounded-xl border border-border/50 text-muted-foreground hover:bg-foreground/5 hover:text-foreground/90 hover:border-border/60 transition-all disabled:opacity-40 font-medium"
                  >
                    Preview
                  </button>
                )}
                {downloading ? (
                  <button
                    type="button"
                    onClick={handleCancelDownload}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold transition-all"
                    title={t("reportsStopBtn")}
                  >
                    <X className="w-3.5 h-3.5" />
                    {downloadProgress !== null && downloadProgress > 0
                      ? `${t("reportsStopBtn")} (${downloadProgress}%)`
                      : t("reportsStopBtn")}
                  </button>
                ) : (
                  <button
                    onClick={handleDownload}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs rounded-xl bg-gradient-to-r ${outMeta.color} hover:opacity-90 text-foreground font-bold transition-all disabled:opacity-50 shadow-lg`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t(outMeta.labelKey)}
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {preview.status === "done" &&
            (() => {
              const sampleAvg =
                preview.rows.length > 0
                  ? preview.rows
                      .slice(0, 10)
                      .reduce((s, r) => s + r.join(",").length + 2, 0) /
                    Math.min(10, preview.rows.length)
                  : 200;
              const estBytes = preview.totalCount * sampleAvg;
              const estMB = estBytes / 1024 / 1024;
              const sizeLabel =
                estMB < 0.1
                  ? `~${(estMB * 1024).toFixed(0)} KB`
                  : estMB < 100
                    ? `~${estMB.toFixed(1)} MB`
                    : `~${(estMB / 1024).toFixed(2)} GB`;
              return (
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: t("reportsStatTotal"),
                      value: preview.totalCount.toLocaleString(),
                      cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
                      lCls: "text-emerald-500",
                    },
                    {
                      label: "Preview",
                      value: `${preview.rows.length} ${t("reportsStatRows")}`,
                      cls: "bg-muted/30 border-border text-foreground/80",
                      lCls: "text-muted-foreground/70",
                    },
                    {
                      label: t("reportsStatColumns"),
                      value: String(preview.columns.length),
                      cls: "bg-muted/30 border-border text-foreground/80",
                      lCls: "text-muted-foreground/70",
                    },
                    ...(preview.totalCount > 0
                      ? [
                          {
                            label: t("reportsStatSize"),
                            value: sizeLabel,
                            cls: "bg-sky-500/10 border-sky-500/20 text-sky-300",
                            lCls: "text-sky-500",
                          },
                        ]
                      : []),
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`rounded-xl border px-3 py-2 ${s.cls}`}
                    >
                      <p
                        className={`text-[10px] uppercase tracking-wider font-semibold ${s.lCls}`}
                      >
                        {s.label}
                      </p>
                      <p className="text-sm font-bold mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

          {preview.status === "idle" && (
            <div className="flex-1 h-80 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground/60 gap-3">
              <div className="w-12 h-12 rounded-full bg-muted/30 border border-border flex items-center justify-center">
                <span className="text-xl text-muted-foreground/50">◈</span>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground/70">
                  {t("reportsPreviewEmpty")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {dateMode !== "none"
                    ? t("reportsPreviewEmptyHint")
                    : t("reportsPreviewEmptyHintNoDate")}
                </p>
              </div>
            </div>
          )}

          {preview.status === "loading" && (
            <div className="h-80 flex items-center justify-center rounded-2xl border border-border bg-muted/20">
              <div className="flex flex-col items-center gap-3 text-muted-foreground/70">
                <div className="w-6 h-6 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
                <p className="text-sm">{t("reportsDownloading")}</p>
              </div>
            </div>
          )}

          {preview.status === "error" && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
              <p className="text-sm text-rose-300 font-semibold">
                {t("reportsPreviewError")}
              </p>
              <p className="text-xs text-rose-400/70 mt-1 leading-relaxed font-mono">
                {preview.error}
              </p>
            </div>
          )}

          <AnimatePresence>
            {preview.status === "done" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-border bg-muted/20 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <span className="text-xs text-muted-foreground font-medium">
                    Preview — {t("reportsPreviewFirst")} {preview.rows.length}{" "}
                    {t("reportsStatRows")}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {preview.columns.length} {t("reportsPreviewColumns")} ·{" "}
                    {t("reportsPreviewTotal")}{" "}
                    {preview.totalCount.toLocaleString()} {t("reportsStatRows")}
                  </span>
                </div>
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-xs border-collapse min-w-max">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-muted-foreground/50 font-medium border-b border-border w-8 text-[10px]">
                          №
                        </th>
                        {preview.columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2.5 text-left text-foreground/80 font-semibold border-b border-border whitespace-nowrap border-r border-border/20 last:border-r-0 text-[11px] tracking-wide"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, ri) => (
                        <tr
                          key={ri}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-1.5 text-muted-foreground/60 border-b border-border/20 text-[10px]">
                            {ri + 1}
                          </td>
                          {row.map((cell: unknown, ci: number) => (
                            <td
                              key={ci}
                              className="px-3 py-1.5 text-foreground/80 border-b border-border/20 border-r border-border/15 last:border-r-0 whitespace-nowrap max-w-xs truncate"
                              title={cell == null ? "" : String(cell)}
                            >
                              {cell == null ? (
                                <span className="text-muted-foreground/60 italic text-[10px]">
                                  null
                                </span>
                              ) : typeof cell === "number" ? (
                                <span className="font-mono text-sky-300/80">
                                  {cell.toLocaleString()}
                                </span>
                              ) : (
                                String(cell)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {preview.rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={preview.columns.length + 1}
                            className="px-4 py-8 text-center text-muted-foreground/50 text-xs"
                          >
                            {t("reportsNoAccess")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
