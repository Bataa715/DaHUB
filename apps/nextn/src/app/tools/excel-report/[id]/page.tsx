"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { excelReportApi, ReportTemplate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}с`;
  return `${Math.floor(s / 60)}м ${s % 60}с`;
}

type Stage = "idle" | "queued" | "running" | "done" | "error";

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

  const jobIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

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
    return () => stopTimers();
  }, [load]);

  const triggerDownload = async (jobId: string, fileName?: string) => {
    const blob = await excelReportApi.downloadJob(jobId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      fileName ?? `report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    if (!template) return;
    if (template.dateMode === "range" && (!startDate || !endDate)) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }
    if (template.dateMode === "single" && !startDate) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }

    setStage("queued");
    setElapsed(0);
    setErrorMsg("");
    const startTs = Date.now();

    try {
      const jobId = await excelReportApi.runReportAsync(
        template.id,
        startDate || undefined,
        endDate || startDate || undefined,
      );
      jobIdRef.current = jobId;
      setStage("running");

      // Elapsed timer — tick every second
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTs);
      }, 1000);

      // Poll status every 2 seconds
      pollRef.current = setInterval(async () => {
        try {
          const status = await excelReportApi.getJobStatus(jobId);
          setElapsed(status.elapsedMs);

          if (status.status === "done") {
            stopTimers();
            setStage("done");
            await triggerDownload(jobId, status.fileName);
            toast({ title: "Тайлан татагдлаа ✓", description: template.name });
            setTimeout(() => setStage("idle"), 3000);
          } else if (status.status === "error") {
            stopTimers();
            setStage("error");
            setErrorMsg(status.error ?? "Тодорхойгүй алдаа");
          }
        } catch {
          // network blip — keep polling
        }
      }, 2000);
    } catch (e: any) {
      stopTimers();
      setStage("error");
      setErrorMsg(
        e?.response?.data?.message ?? "Тайлан эхлүүлэхэд алдаа гарлаа",
      );
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080d14]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!template) return null;

  const busy = stage === "queued" || stage === "running";

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
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card top icon */}
          <div className="flex flex-col items-center gap-3 mb-8 text-center">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${template.color} flex items-center justify-center shadow-xl`}
            >
              <FileSpreadsheet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{template.name}</h1>
              {template.description && (
                <p className="text-sm text-slate-400 mt-1">
                  {template.description}
                </p>
              )}
            </div>
          </div>

          {/* Form card */}
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 shadow-2xl space-y-5">
            {template.dateMode === "range" && (
              <>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Хугацааны интервал сонгоно уу</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Эхлэх огноо</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={busy}
                    className="bg-slate-800/60 border-slate-700 text-slate-100 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Дуусах огноо</Label>
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={busy}
                    className="bg-slate-800/60 border-slate-700 text-slate-100 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
              </>
            )}

            {template.dateMode === "single" && (
              <>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Огноо сонгоно уу</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Огноо</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={busy}
                    className="bg-slate-800/60 border-slate-700 text-slate-100 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
              </>
            )}

            {template.dateMode === "none" && (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-300">
                  Тайлан шууд татахад бэлэн байна
                </p>
                <p className="text-xs text-slate-500">
                  Огноо оруулах шаардлагагүй
                </p>
              </div>
            )}

            {/* Progress indicator */}
            {(busy || stage === "done" || stage === "error") && (
              <div
                className={`rounded-xl px-4 py-3 text-sm flex items-center gap-3 ${
                  stage === "done"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : stage === "error"
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                      : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                }`}
              >
                {stage === "done" ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : stage === "error" ? (
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {stage === "queued" && <span>Дарааллын хүлээлтэд...</span>}
                  {stage === "running" && (
                    <span>
                      Боловсруулж байна
                      <span className="ml-2 text-indigo-400 font-mono text-xs">
                        {formatElapsed(elapsed)}
                      </span>
                    </span>
                  )}
                  {stage === "done" && <span>Татаж байна...</span>}
                  {stage === "error" && (
                    <span className="truncate">{errorMsg}</span>
                  )}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => router.back()}
                disabled={busy}
                className="flex-1 py-2.5 text-sm rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Болих
              </button>
              <button
                onClick={handleDownload}
                disabled={busy || stage === "done"}
                className="flex-1 py-2.5 text-sm rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Боловсруулж байна...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Татах
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
