"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Eye,
  XCircle,
  Database,
  Code2,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { excelReportApi, ReportTemplate, FilterDef } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function currentMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Convert comma/newline/space-separated text to SQL IN-clause values: 'v1','v2','v3' */
function toSqlInValues(raw: string): string {
  const items = raw
    .split(/[,\n\r\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  return items.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
}

interface PreviewState {
  status: "idle" | "loading" | "done" | "error";
  columns: string[];
  rows: any[][];
  error?: string;
}

export default function ExcelReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    columns: [],
    rows: [],
  });

  const load = useCallback(async () => {
    try {
      const all = await excelReportApi.getTemplates();
      const found = all.find((t) => t.id === id);
      if (!found) {
        toast({ title: "Тайлан олдсонгүй", variant: "destructive" });
        router.replace("/tools/excel-report");
        return;
      }
      setTemplate(found);
      setStartDate(currentMonthStart());
      setEndDate(today());
    } catch {
      toast({
        title: "Алдаа",
        description: "Мэдээлэл татахад алдаа гарлаа",
        variant: "destructive",
      });
      router.replace("/tools/excel-report");
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const parsedFilters: FilterDef[] = (() => {
    try {
      return template ? JSON.parse(template.filters || "[]") : [];
    } catch {
      return [];
    }
  })();

  /** Build the filters object with SQL IN values for the API call */
  const buildFilterObj = (): Record<string, string> | undefined => {
    const obj: Record<string, string> = {};
    let hasAny = false;
    for (const f of parsedFilters) {
      const raw = filterValues[f.key] ?? "";
      const sqlVal = toSqlInValues(raw);
      if (sqlVal) {
        obj[f.key] = sqlVal;
        hasAny = true;
      }
    }
    return hasAny ? obj : undefined;
  };

  const handleDownloadCsv = async () => {
    if (!template) return;
    if (template.dateMode === "range" && (!startDate || !endDate)) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }
    if (template.dateMode === "single" && !startDate) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }
    // Validate required filters
    const requiredMissing = parsedFilters.filter(
      (f) => f.required && !toSqlInValues(filterValues[f.key] ?? ""),
    );
    if (requiredMissing.length > 0) {
      toast({
        title: "Заавал шүүлтүүр бөглөнө үү",
        description: requiredMissing.map((f) => f.label).join(", "),
        variant: "destructive",
      });
      return;
    }
    setCsvError("");
    setCsvLoading(true);
    setDownloadProgress(0);
    try {
      const blob = await excelReportApi.runReportCsv(
        template.id,
        startDate || undefined,
        endDate || startDate || undefined,
        buildFilterObj(),
        undefined,
        (pct) => setDownloadProgress(pct),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `${template.name}_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV татагдлаа ✓", description: template.name });
    } catch (e: any) {
      setCsvError(e?.response?.data?.message ?? "CSV татахад алдаа гарлаа");
    } finally {
      setCsvLoading(false);
      setDownloadProgress(null);
    }
  };

  const handlePreview = async () => {
    if (!template) return;
    if (template.dateMode === "range" && (!startDate || !endDate)) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }
    if (template.dateMode === "single" && !startDate) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }
    // Validate required filters
    const requiredMissing = parsedFilters.filter(
      (f) => f.required && !toSqlInValues(filterValues[f.key] ?? ""),
    );
    if (requiredMissing.length > 0) {
      toast({
        title: "Заавал шүүлтүүр бөглөнө үү",
        description: requiredMissing.map((f) => f.label).join(", "),
        variant: "destructive",
      });
      return;
    }
    setPreview({ status: "loading", columns: [], rows: [] });
    try {
      const data = await excelReportApi.previewReport(
        template.id,
        startDate || undefined,
        endDate || startDate || undefined,
        buildFilterObj(),
        undefined,
      );
      setPreview({ status: "done", columns: data.columns, rows: data.rows });
    } catch (e: any) {
      setPreview({
        status: "error",
        columns: [],
        rows: [],
        error: e?.response?.data?.message ?? "Preview татахад алдаа гарлаа",
      });
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#080d14]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  if (!template) return null;

  const previewLoading = preview.status === "loading";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Буцах
          </button>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-md bg-gradient-to-br ${template.color} flex items-center justify-center shadow-md`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground truncate">
              {template.name}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 flex flex-col lg:flex-row gap-5">
        {/* ── Control panel ── */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 shadow-2xl space-y-4 sticky top-20">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center`}
              >
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">
                  {template.name}
                </p>
                {template.description && (
                  <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">
                    {template.description}
                  </p>
                )}
              </div>
            </div>

            {/* Staging mode badge */}
            {template.isStaging && (
              <div className="flex items-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-2">
                <Database className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-violet-300">
                    Staging горим
                  </p>
                  <p className="text-[10px] text-violet-500 leading-tight mt-0.5">
                    INSERT → Export → TRUNCATE
                  </p>
                </div>
              </div>
            )}

            {/* Range */}
            {template.dateMode === "range" && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">
                  Огнооны интервал
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={csvLoading}
                    className="flex-1 min-w-[115px] bg-slate-800/80 border border-slate-700 rounded-lg px-1.5 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                  />
                  <span className="text-slate-500 text-xs flex-shrink-0">
                    →
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={csvLoading}
                    className="flex-1 min-w-[115px] bg-slate-800/80 border border-slate-700 rounded-lg px-1.5 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                  />
                </div>
              </div>
            )}

            {/* Single */}
            {template.dateMode === "single" && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">
                  Огноо
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={csvLoading}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                />
              </div>
            )}

            {template.dateMode === "none" && (
              <p className="text-xs text-slate-500 text-center py-1">
                Огноо шаардлагагүй
              </p>
            )}

            {/* Dynamic filters from template config */}
            {parsedFilters.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  {f.label}
                  {f.required && <span className="text-rose-400">*</span>}
                </label>
                <textarea
                  value={filterValues[f.key] ?? ""}
                  onChange={(e) =>
                    setFilterValues((prev) => ({
                      ...prev,
                      [f.key]: e.target.value,
                    }))
                  }
                  disabled={csvLoading}
                  placeholder={
                    f.placeholder || `${f.label} оруулах\nТаслалаар тусгаарлана`
                  }
                  rows={2}
                  className={`w-full bg-slate-800/80 border rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none disabled:opacity-40 resize-none placeholder:text-slate-600 ${
                    f.required && !toSqlInValues(filterValues[f.key] ?? "")
                      ? "border-rose-500/50 focus:border-rose-500"
                      : "border-slate-700 focus:border-emerald-500"
                  }`}
                />
              </div>
            ))}

            {/* Download progress bar */}
            {downloadProgress !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">
                    {downloadProgress < 100 ? "Татаж байна..." : "Дууслаң ✓"}
                  </span>
                  <span className="text-xs font-mono font-semibold text-emerald-400">
                    {downloadProgress}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                {downloadProgress > 0 && downloadProgress < 100 && (
                  <div className="flex gap-1 justify-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {csvError && (
              <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{csvError}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              {template.isSqlMode && (
                <button
                  onClick={handlePreview}
                  disabled={csvLoading || previewLoading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-40"
                >
                  {previewLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                  {previewLoading
                    ? template.isStaging
                      ? "INSERT..."
                      : "..."
                    : "Preview"}
                </button>
              )}
              <button
                onClick={handleDownloadCsv}
                disabled={csvLoading}
                className="flex-1 py-2 text-xs rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                {csvLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {downloadProgress !== null && downloadProgress > 0
                      ? `${downloadProgress}%`
                      : "Тооцоолж байна..."}
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    CSV татах
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Preview panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* SQL code viewer */}
          {template.sqlCode && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <button
                onClick={() => setShowSql((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs font-medium text-slate-300">
                    {template.isStaging ? "Staging INSERT SQL" : "SQL Query"}
                  </span>
                </div>
                {showSql ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
              {showSql && (
                <div className="border-t border-slate-700/50">
                  <pre className="overflow-auto max-h-72 p-4 text-[11px] leading-relaxed font-mono text-sky-300/90 bg-slate-950/60 whitespace-pre-wrap break-words">
                    <code>{template.sqlCode}</code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* stats strip — shown after preview */}
          {preview.status === "done" && (
            <div className="flex flex-wrap items-center gap-2 px-1">
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-1.5">
                <BarChart3 className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-slate-300 font-medium">
                  {preview.rows.length.toLocaleString()} мөр
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-1.5">
                <span className="text-xs text-slate-400">
                  {preview.columns.length} багана
                </span>
              </div>
              {preview.rows.length >= 50 && (
                <span className="text-[10px] text-amber-500/80 italic">
                  50 мөр харагдана
                </span>
              )}
            </div>
          )}

          {preview.status === "idle" && (
            <div className="h-48 lg:h-64 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 text-slate-600 gap-2">
              <Eye className="w-7 h-7" />
              <p className="text-sm">
                {template.isStaging
                  ? "Шүүлтүүр бөглөөд Preview дарна уу"
                  : "Огноо сонгоод Preview дарна уу"}
              </p>
              <p className="text-xs text-slate-700">
                {template.isStaging
                  ? "INSERT → эхний 50 мөр харагдана → TRUNCATE"
                  : "Эхний 50 мөр ClickHouse-ээс шууд харагдана"}
              </p>
            </div>
          )}
          {preview.status === "loading" && (
            <div className="h-48 flex items-center justify-center rounded-2xl border border-slate-700/40 bg-slate-900/30">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <p className="text-sm">ClickHouse-с татаж байна...</p>
              </div>
            </div>
          )}
          {preview.status === "error" && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-rose-300 font-medium">
                  Preview алдаа
                </p>
                <p className="text-xs text-rose-400/80 mt-1">{preview.error}</p>
              </div>
            </div>
          )}
          {preview.status === "done" && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-slate-300 font-medium">
                    Preview
                  </span>
                  <span className="text-xs text-slate-500">
                    ({preview.rows.length} мөр · {preview.columns.length}{" "}
                    багана)
                  </span>
                </div>
                {preview.rows.length >= 50 && (
                  <span className="text-[10px] text-amber-500/60">50 мөр</span>
                )}
              </div>
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-xs border-collapse min-w-max">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-800">
                      <th className="px-2 py-2 text-left text-slate-500 font-medium border-b border-slate-700/60 w-8">
                        #
                      </th>
                      {preview.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left text-slate-300 font-semibold border-b border-slate-700/60 whitespace-nowrap border-r border-slate-700/30 last:border-r-0"
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
                        className={
                          ri % 2 === 0 ? "bg-transparent" : "bg-slate-800/25"
                        }
                      >
                        <td className="px-2 py-1.5 text-slate-600 border-b border-slate-700/20">
                          {ri + 1}
                        </td>
                        {row.map((cell: any, ci: number) => (
                          <td
                            key={ci}
                            className="px-3 py-1.5 text-slate-300 border-b border-slate-700/20 border-r border-slate-700/20 last:border-r-0 whitespace-nowrap max-w-xs truncate"
                            title={cell == null ? "" : String(cell)}
                          >
                            {cell == null ? (
                              <span className="text-slate-600 italic">
                                null
                              </span>
                            ) : typeof cell === "number" ? (
                              cell.toLocaleString()
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
                          className="px-4 py-8 text-center text-slate-600 text-sm"
                        >
                          Өгөгдөл олдсонгүй
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
