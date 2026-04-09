"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  Code2,
} from "lucide-react";
import { excelReportApi, ReportTemplate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}с`;
  return `${Math.floor(s / 60)}м ${s % 60}с`;
}
function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function thisMonthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }
function lastMonthRange(): [string, string] {
  const d = new Date();
  const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const m = d.getMonth() === 0 ? 12 : d.getMonth();
  const last = new Date(y, m, 0).getDate();
  return [`${y}-${String(m).padStart(2,"0")}-01`, `${y}-${String(m).padStart(2,"0")}-${String(last).padStart(2,"0")}`];
}

type Stage = "idle" | "queued" | "running" | "done" | "error";
interface PreviewState { status: "idle"|"loading"|"done"|"error"; columns: string[]; rows: any[][]; error?: string; }

export default function ExcelReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<PreviewState>({ status: "idle", columns: [], rows: [] });

  const jobIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = () => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const load = useCallback(async () => {
    try {
      const all = await excelReportApi.getTemplates();
      const found = all.find((t) => t.id === id);
      if (!found) { toast({ title: "Тайлан олдсонгүй", variant: "destructive" }); router.replace("/tools/excel-report"); return; }
      setTemplate(found);
      const [lms, lme] = lastMonthRange();
      setStartDate(lms); setEndDate(lme);
    } catch {
      toast({ title: "Алдаа", description: "Мэдээлэл татахад алдаа гарлаа", variant: "destructive" });
      router.replace("/tools/excel-report");
    } finally { setLoading(false); }
  }, [id, router, toast]);

  useEffect(() => { load(); return () => stopTimers(); }, [load]);

  const rangePresets = [
    { label: "7 хоног",      fn: () => { setStartDate(daysAgo(6));       setEndDate(today()); } },
    { label: "Энэ сар",      fn: () => { setStartDate(thisMonthStart()); setEndDate(today()); } },
    { label: "Өнгөрсөн сар", fn: () => { const [s,e]=lastMonthRange();   setStartDate(s); setEndDate(e); } },
    { label: "30 хоног",     fn: () => { setStartDate(daysAgo(29));       setEndDate(today()); } },
  ];
  const singlePresets = [
    { label: "Өнөөдөр", fn: () => setStartDate(today()) },
    { label: "Өчигдөр", fn: () => setStartDate(daysAgo(1)) },
  ];

  const triggerDownload = async (jobId: string, fileName?: string) => {
    const blob = await excelReportApi.downloadJob(jobId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = fileName ?? `report_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    if (!template) return;
    if (template.dateMode === "range" && (!startDate || !endDate)) { toast({ title: "Огноо оруулна уу", variant: "destructive" }); return; }
    if (template.dateMode === "single" && !startDate) { toast({ title: "Огноо оруулна уу", variant: "destructive" }); return; }
    setStage("queued"); setElapsed(0); setErrorMsg("");
    const startTs = Date.now();
    try {
      const jobId = await excelReportApi.runReportAsync(template.id, startDate||undefined, endDate||startDate||undefined);
      jobIdRef.current = jobId; setStage("running");
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTs), 500);
      let ticks = 0;
      const doPoll = async () => {
        ticks++;
        try {
          const status = await excelReportApi.getJobStatus(jobId);
          setElapsed(status.elapsedMs);
          if (status.status === "done") {
            stopTimers(); setStage("done");
            await triggerDownload(jobId, status.fileName);
            toast({ title: "Тайлан татагдлаа ✓", description: template.name });
            setTimeout(() => setStage("idle"), 3000);
          } else if (status.status === "error") {
            stopTimers(); setStage("error"); setErrorMsg(status.error ?? "Тодорхойгүй алдаа");
          } else {
            pollRef.current = setTimeout(doPoll, ticks < 15 ? 1000 : 2000);
          }
        } catch { pollRef.current = setTimeout(doPoll, 2000); }
      };
      pollRef.current = setTimeout(doPoll, 1000);
    } catch (e: any) {
      stopTimers(); setStage("error");
      setErrorMsg(e?.response?.data?.message ?? "Тайлан эхлүүлэхэд алдаа гарлаа");
    }
  };

  const handlePreview = async () => {
    if (!template) return;
    if (template.dateMode === "range" && (!startDate || !endDate)) { toast({ title: "Огноо оруулна уу", variant: "destructive" }); return; }
    setPreview({ status: "loading", columns: [], rows: [] });
    try {
      const data = await excelReportApi.previewReport(template.id, startDate||undefined, endDate||startDate||undefined);
      setPreview({ status: "done", columns: data.columns, rows: data.rows });
    } catch (e: any) {
      setPreview({ status: "error", columns: [], rows: [], error: e?.response?.data?.message ?? "Preview татахад алдаа гарлаа" });
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#080d14]"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  if (!template) return null;

  const busy = stage === "queued" || stage === "running";
  const previewLoading = preview.status === "loading";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />Буцах
          </button>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${template.color} flex items-center justify-center shadow-md`}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground truncate">{template.name}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 flex flex-col lg:flex-row gap-5">

        {/* ── Control panel ── */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 shadow-2xl space-y-4 sticky top-20">

            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center`}>
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{template.name}</p>
                {template.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{template.description}</p>}
              </div>
            </div>

            {/* Range */}
            {template.dateMode === "range" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {rangePresets.map((p) => (
                    <button key={p.label} onClick={p.fn} disabled={busy}
                      className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-40">
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={busy}
                    className="flex-1 min-w-0 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-40" />
                  <span className="text-slate-500 text-xs">→</span>
                  <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} disabled={busy}
                    className="flex-1 min-w-0 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-40" />
                </div>
              </div>
            )}

            {/* Single */}
            {template.dateMode === "single" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {singlePresets.map((p) => (
                    <button key={p.label} onClick={p.fn} disabled={busy}
                      className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-40">
                      {p.label}
                    </button>
                  ))}
                </div>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={busy}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-40" />
              </div>
            )}

            {template.dateMode === "none" && (
              <p className="text-xs text-slate-500 text-center py-1">Огноо шаардлагагүй</p>
            )}

            {/* Progress */}
            {(busy || stage === "done" || stage === "error") && (
              <div className={`rounded-xl px-3 py-2 text-xs flex items-center gap-2 ${
                stage === "done" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                : stage === "error" ? "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"}`}>
                {stage === "done" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                 : stage === "error" ? <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                 : <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                <span className="flex-1 min-w-0 truncate">
                  {stage === "queued" && "Хүлээлтэд..."}
                  {stage === "running" && <><span>Боловсруулж байна</span><span className="font-mono ml-1">{formatElapsed(elapsed)}</span></>}
                  {stage === "done" && "Татаж байна..."}
                  {stage === "error" && errorMsg}
                </span>
                {stage === "error" && <button onClick={() => setStage("idle")} className="hover:text-white flex-shrink-0"><RotateCcw className="w-3 h-3" /></button>}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              {template.isSqlMode && (
                <button onClick={handlePreview} disabled={busy || previewLoading}
                  className="flex-1 py-2 text-xs rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                  {previewLoading ? "Уншиж байна..." : "Preview"}
                </button>
              )}
              <button onClick={handleDownload} disabled={busy || stage === "done"}
                className="flex-1 py-2 text-xs rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20">
                {busy ? <><Loader2 className="w-3 h-3 animate-spin" />Явагдаж байна...</>
                : <><Download className="w-3 h-3" />Excel татах</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Preview panel ── */}
        <div className="flex-1 min-w-0">
          {preview.status === "idle" && (
            template.isSqlMode ? (
              <div className="h-48 lg:h-64 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 text-slate-600 gap-2">
                <Eye className="w-7 h-7" />
                <p className="text-sm">Огноо сонгоод Preview дарна уу</p>
                <p className="text-xs text-slate-700">Эхний 100 мөр ClickHouse-ээс шууд харагдана</p>
              </div>
            ) : (
              <div className="h-48 lg:h-64 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 text-slate-600 gap-2">
                <Code2 className="w-7 h-7 text-amber-600/60" />
           
              </div>
            )
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
                <p className="text-sm text-rose-300 font-medium">Preview алдаа</p>
                <p className="text-xs text-rose-400/80 mt-1">{preview.error}</p>
              </div>
            </div>
          )}
          {preview.status === "done" && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-slate-300 font-medium">Preview</span>
                  <span className="text-xs text-slate-500">({preview.rows.length} мөр · {preview.columns.length} багана)</span>
                </div>
                <span className="text-xs text-slate-600">MAX 100 мөр</span>
              </div>
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-xs border-collapse min-w-max">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-800">
                      <th className="px-2 py-2 text-left text-slate-500 font-medium border-b border-slate-700/60 w-8">#</th>
                      {preview.columns.map((col) => (
                        <th key={col} className="px-3 py-2 text-left text-slate-300 font-semibold border-b border-slate-700/60 whitespace-nowrap border-r border-slate-700/30 last:border-r-0">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-transparent" : "bg-slate-800/25"}>
                        <td className="px-2 py-1.5 text-slate-600 border-b border-slate-700/20">{ri + 1}</td>
                        {row.map((cell: any, ci: number) => (
                          <td key={ci}
                            className="px-3 py-1.5 text-slate-300 border-b border-slate-700/20 border-r border-slate-700/20 last:border-r-0 whitespace-nowrap max-w-xs truncate"
                            title={cell == null ? "" : String(cell)}>
                            {cell == null
                              ? <span className="text-slate-600 italic">null</span>
                              : typeof cell === "number" ? cell.toLocaleString()
                              : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {preview.rows.length === 0 && (
                      <tr><td colSpan={preview.columns.length + 1} className="px-4 py-8 text-center text-slate-600 text-sm">Өгөгдөл олдсонгүй</td></tr>
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
