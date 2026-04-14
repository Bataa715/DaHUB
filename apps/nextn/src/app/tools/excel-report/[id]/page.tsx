"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { excelReportApi, ReportTemplate, FilterDef } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function currentMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

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
  totalCount: number;
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
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    columns: [],
    rows: [],
    totalCount: 0,
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

    // If staging mode: fire INSERT in background simultaneously (no await)
    // CSV download starts immediately in parallel.
    if (template.isStaging) {
      excelReportApi
        .runInsert(
          template.id,
          startDate || undefined,
          endDate || startDate || undefined,
          buildFilterObj(),
        )
        .catch(() => {}); // fire-and-forget, ignore errors on client side
    }

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
    setPreview({ status: "loading", columns: [], rows: [], totalCount: 0 });
    try {
      const data = await excelReportApi.previewReport(
        template.id,
        startDate || undefined,
        endDate || startDate || undefined,
        buildFilterObj(),
        undefined,
      );
      setPreview({
        status: "done",
        columns: data.columns,
        rows: data.rows,
        totalCount: data.totalCount,
      });
    } catch (e: any) {
      setPreview({
        status: "error",
        columns: [],
        rows: [],
        totalCount: 0,
        error: e?.response?.data?.message ?? "Preview татахад алдаа гарлаа",
      });
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#080d14]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
          <p className="text-slate-500 text-sm">Уншиж байна...</p>
        </div>
      </div>
    );
  if (!template) return null;

  const previewLoading = preview.status === "loading";

  return (
    <div className="min-h-screen bg-[#080d14] text-slate-100 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/5 bg-[#080d14]/90 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-slate-500 hover:text-slate-200 transition-colors text-sm"
            >
              ← Буцах
            </button>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${template.color}`} />
              <span className="font-semibold text-slate-100 text-sm">
                {template.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-[1440px] mx-auto w-full px-6 py-6 flex flex-col lg:flex-row gap-6">

        {/* Left panel */}
        <aside className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-20 rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
            <div className={`h-0.5 w-full bg-gradient-to-r ${template.color}`} />

            <div className="p-5 space-y-5">
              {/* Title */}
              <div>
                <p className="font-bold text-slate-100">{template.name}</p>
                {template.description && (
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    {template.description}
                  </p>
                )}
              </div>

              <div className="border-t border-white/[0.06]" />

              {/* Date — range */}
              {template.dateMode === "range" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Огнооны интервал
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-600">Эхлэх</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={csvLoading}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.06] disabled:opacity-40 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-600">Дуусах</label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={csvLoading}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.06] disabled:opacity-40 transition"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Date — single */}
              {template.dateMode === "single" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Огноо
                  </p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={csvLoading}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.06] disabled:opacity-40 transition"
                  />
                </div>
              )}

              {template.dateMode === "none" && (
                <p className="text-xs text-slate-600 text-center py-0.5">
                  Огноо шаардлагагүй
                </p>
              )}

              {/* Dynamic filters */}
              {parsedFilters.length > 0 && (
                <>
                  <div className="border-t border-white/[0.06]" />
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Шүүлтүүрүүд
                    </p>
                    {parsedFilters.map((f) => {
                      const raw = filterValues[f.key] ?? "";
                      const filled = !!toSqlInValues(raw);
                      const missing = f.required && !filled;
                      const count = raw.split(/[,\n\r\t]+/).filter((s) => s.trim()).length;
                      return (
                        <div key={f.key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-300">
                              {f.label}
                              {f.required && (
                                <span className="text-rose-400 ml-0.5">*</span>
                              )}
                            </label>
                            {filled && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                                {count} утга
                              </span>
                            )}
                          </div>
                          <textarea
                            value={raw}
                            onChange={(e) =>
                              setFilterValues((prev) => ({
                                ...prev,
                                [f.key]: e.target.value,
                              }))
                            }
                            disabled={csvLoading}
                            placeholder={
                              f.placeholder ||
                              `${f.label} оруулах\nТаслал эсвэл мөрөөр тусгаарлана`
                            }
                            rows={3}
                            className={`w-full rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none disabled:opacity-40 resize-none placeholder:text-slate-600 transition font-mono leading-relaxed ${
                              missing
                                ? "bg-rose-950/60 border border-rose-500/40 focus:border-rose-400"
                                : filled
                                  ? "bg-emerald-950/40 border border-emerald-500/30 focus:border-emerald-400"
                                  : "bg-[#0d1520] border border-white/[0.08] focus:border-white/20 focus:bg-[#111a27]"
                            }`}
                          />
                          {missing && (
                            <p className="text-[10px] text-rose-400">
                              Энэ талбар заавал шаардлагатай
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Progress bar */}
              {downloadProgress !== null && (
                <>
                  <div className="border-t border-white/[0.06]" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">
                        {downloadProgress === 100 ? "Дууслаа ✓" : "Татаж байна..."}
                      </span>
                      {downloadProgress > 0 && downloadProgress < 100 && (
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {downloadProgress}%
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      {downloadProgress > 0 ? (
                        <div
                          className={`h-1.5 rounded-full bg-gradient-to-r ${template.color} transition-all duration-300 ease-out`}
                          style={{ width: `${downloadProgress}%` }}
                        />
                      ) : (
                        <div
                          className={`h-1.5 rounded-full bg-gradient-to-r ${template.color} animate-pulse w-full opacity-60`}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {csvError && (
                <div className="rounded-xl px-3 py-2.5 text-xs bg-rose-500/8 border border-rose-500/25 text-rose-300 leading-relaxed">
                  {csvError}
                </div>
              )}

              {/* Action buttons */}
              <div className="border-t border-white/[0.06]" />
              <div className="flex gap-2">
                {template.isSqlMode && (
                  <button
                    onClick={handlePreview}
                    disabled={csvLoading || previewLoading}
                    className="px-4 py-2.5 text-xs rounded-xl border border-white/[0.1] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 hover:border-white/20 transition-all disabled:opacity-40 font-medium"
                  >
                    {previewLoading ? "..." : "Preview"}
                  </button>
                )}
                <button
                  onClick={handleDownloadCsv}
                  disabled={csvLoading}
                  className={`flex-1 py-2.5 text-xs rounded-xl bg-gradient-to-r ${template.color} hover:opacity-90 text-white font-bold transition-all disabled:opacity-50 shadow-lg`}
                >
                  {csvLoading
                    ? downloadProgress !== null && downloadProgress > 0
                      ? `${downloadProgress}%`
                      : "Тооцоолж байна..."
                    : "CSV татах"}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right panel — preview */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Stats strip */}
          {preview.status === "done" && (() => {
            const sampleAvgBytes =
              preview.rows.length > 0
                ? preview.rows
                    .slice(0, 10)
                    .reduce((s, r) => s + r.join(",").length + 2, 0) /
                  Math.min(10, preview.rows.length)
                : 200;
            const estBytes = preview.totalCount * sampleAvgBytes;
            const estMB = estBytes / 1024 / 1024;
            const estSec = estBytes / (600 * 1024);
            const sizeLabel =
              estMB < 0.1
                ? `~${(estMB * 1024).toFixed(0)} KB`
                : estMB < 100
                  ? `~${estMB.toFixed(1)} MB`
                  : `~${(estMB / 1024).toFixed(2)} GB`;
            const timeLabel =
              estSec < 5 ? "< 5с" : estSec < 60 ? `~${Math.ceil(estSec)}с` : `~${(estSec / 60).toFixed(1)} мин`;
            return (
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                  <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold">Нийт мөр</p>
                  <p className="text-sm font-bold text-emerald-300 mt-0.5">
                    {preview.totalCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Preview</p>
                  <p className="text-sm font-bold text-slate-300 mt-0.5">{preview.rows.length} мөр</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Багана</p>
                  <p className="text-sm font-bold text-slate-300 mt-0.5">{preview.columns.length}</p>
                </div>
                {preview.totalCount > 0 && (
                  <>
                    <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2">
                      <p className="text-[10px] text-sky-500 uppercase tracking-wider font-semibold">Хэмжээ</p>
                      <p className="text-sm font-bold text-sky-300 mt-0.5">{sizeLabel}</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                      <p className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold">Татах хугацаа</p>
                      <p className="text-sm font-bold text-amber-300 mt-0.5">{timeLabel}</p>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Idle */}
          {preview.status === "idle" && (
            <div className="flex-1 h-80 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] text-slate-700 gap-3">
              <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
                <span className="text-xl text-slate-600">◈</span>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Preview хоосон байна</p>
                <p className="text-xs text-slate-700 mt-1">
                  {template.dateMode !== "none"
                    ? "Огноо сонгоод Preview дарна уу"
                    : "Preview товч дарна уу"}
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {preview.status === "loading" && (
            <div className="h-80 flex items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                <p className="text-sm">ClickHouse-с татаж байна...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {preview.status === "error" && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
              <p className="text-sm text-rose-300 font-semibold">Preview алдаа</p>
              <p className="text-xs text-rose-400/70 mt-1 leading-relaxed font-mono">
                {preview.error}
              </p>
            </div>
          )}

          {/* Table */}
          {preview.status === "done" && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-xs text-slate-400 font-medium">
                  Preview — эхний {preview.rows.length} мөр
                </span>
                <span className="text-[10px] text-slate-600">
                  {preview.columns.length} багана · нийт {preview.totalCount.toLocaleString()} мөр
                </span>
              </div>
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-xs border-collapse min-w-max">
                  <thead className="sticky top-0 z-10 bg-[#0d1520]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-slate-600 font-medium border-b border-white/[0.06] w-8 text-[10px]">
                        №
                      </th>
                      {preview.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2.5 text-left text-slate-300 font-semibold border-b border-white/[0.06] whitespace-nowrap border-r border-white/[0.04] last:border-r-0 text-[11px] tracking-wide"
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
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-3 py-1.5 text-slate-700 border-b border-white/[0.04] text-[10px]">
                          {ri + 1}
                        </td>
                        {row.map((cell: any, ci: number) => (
                          <td
                            key={ci}
                            className="px-3 py-1.5 text-slate-300 border-b border-white/[0.04] border-r border-white/[0.03] last:border-r-0 whitespace-nowrap max-w-xs truncate"
                            title={cell == null ? "" : String(cell)}
                          >
                            {cell == null ? (
                              <span className="text-slate-700 italic text-[10px]">null</span>
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
                          className="px-4 py-10 text-center text-slate-600 text-sm"
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