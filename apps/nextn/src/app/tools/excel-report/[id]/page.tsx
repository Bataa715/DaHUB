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
    setCsvError("");
    setCsvLoading(true);
    try {
      const blob = await excelReportApi.runReportCsv(
        template.id,
        startDate || undefined,
        endDate || startDate || undefined,
        buildFilterObj(),
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
    }
  };

  const handlePreview = async () => {
    if (!template) return;
    if (template.dateMode === "range" && (!startDate || !endDate)) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }
    setPreview({ status: "loading", columns: [], rows: [] });
    try {
      const data = await excelReportApi.previewReport(
        template.id,
        startDate || undefined,
        endDate || startDate || undefined,
        buildFilterObj(),
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

            {/* Range */}
            {template.dateMode === "range" && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Огнооны интервал</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={csvLoading}
                    className="flex-1 min-w-[115px] bg-slate-800/80 border border-slate-700 rounded-lg px-1.5 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                  />
                  <span className="text-slate-500 text-xs flex-shrink-0">→</span>
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
                <label className="text-xs text-slate-400 font-medium">Огноо</label>
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
                <label className="text-xs text-slate-400 font-medium">{f.label} (сонголтот)</label>
                <textarea
                  value={filterValues[f.key] ?? ""}
                  onChange={(e) =>
                    setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  disabled={csvLoading}
                  placeholder={f.placeholder || `${f.label} оруулах\nТаслалаар тусгаарлана`}
                  rows={2}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-40 resize-none placeholder:text-slate-600"
                />
              </div>
            ))}

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
                  {previewLoading ? "..." : "Preview"}
                </button>
              )}
              <button
                onClick={handleDownloadCsv}
                disabled={csvLoading}
                className="flex-1 py-2 text-xs rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                {csvLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Татаж байна...
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
        <div className="flex-1 min-w-0">
          {preview.status === "idle" && (
            <div className="h-48 lg:h-64 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 text-slate-600 gap-2">
              <Eye className="w-7 h-7" />
              <p className="text-sm">Огноо сонгоод Preview дарна уу</p>
              <p className="text-xs text-slate-700">Эхний 50 мөр ClickHouse-ээс шууд харагдана</p>
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
                <span className="text-xs text-slate-600">MAX 100 мөр</span>
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
