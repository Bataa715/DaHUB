"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  Calendar,
  CalendarRange,
  ArrowLeft,
  TableProperties,
  Code2,
  Database,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { excelReportApi, ReportTemplate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ExcelReportPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // SQL → Excel state
  const [sql, setSql] = useState("");
  const [sqlFileName, setSqlFileName] = useState("");
  const [sqlRunning, setSqlRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await excelReportApi.getTemplates();
      setTemplates(data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Тайлангийн жагсаалт татахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCard = (t: ReportTemplate) => {
    router.push(`/tools/excel-report/${t.id}`);
  };

  const handleSqlDownload = async () => {
    if (!sql.trim()) {
      toast({ title: "SQL оруулна уу", variant: "destructive" });
      return;
    }
    setSqlRunning(true);
    try {
      const blob = await excelReportApi.queryToExcel(
        sql.trim(),
        sqlFileName.trim() || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const baseName = sqlFileName.trim() || "query_result";
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${baseName}_${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Excel татагдлаа", description: `${a.download}` });
    } catch (err: any) {
      const msg =
        err?.response?.data instanceof Blob
          ? await err.response.data.text()
          : err?.message ?? "Алдаа гарлаа";
      toast({ title: "Алдаа", description: msg, variant: "destructive" });
    } finally {
      setSqlRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Буцах
          </Link>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground">Excel тайлан</span>
          </div>
          <span className="ml-2 text-xs text-slate-500 hidden sm:block">
            Системийн мэдээллээс Excel тайлан татах
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-8 space-y-10">

        {/* ── SQL → Excel panel ── */}
        <div className="rounded-2xl border border-violet-500/20 bg-slate-900/70 backdrop-blur-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-700/50 bg-slate-800/40">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow">
              <Database className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">SQL → Excel шууд татах</p>
              <p className="text-xs text-slate-500">ClickHouse SQL SELECT query оруулаад Excel файл татна</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* SQL editor */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Code2 className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs text-slate-400 font-medium">SQL Query</span>
                <span className="text-xs text-slate-600">(зөвхөн SELECT)</span>
              </div>
              <textarea
                className="w-full h-40 rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 text-sm font-mono text-slate-100 placeholder:text-slate-600 resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-colors"
                placeholder={"SELECT *\nFROM your_table\nWHERE date >= '2024-01-01'\nLIMIT 1000"}
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                spellCheck={false}
              />
            </div>

            {/* Filename + button row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-slate-400 mb-1.5 block">Файлын нэр (заавал биш)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-colors"
                  placeholder="report_name"
                  value={sqlFileName}
                  onChange={(e) => setSqlFileName(e.target.value)}
                />
              </div>
              <button
                onClick={handleSqlDownload}
                disabled={sqlRunning || !sql.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-violet-900/30 transition-all duration-150 whitespace-nowrap"
              >
                {sqlRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Боловсруулж байна...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Excel татах
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Templates section ── */}
        <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-4 border-slate-800" />
              <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-slate-500">
              Тайлангуудыг ачаалж байна...
            </p>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <TableProperties className="w-10 h-10 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium text-lg">
                Тайлан байхгүй байна
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Удахгүй тайлангуудыг нэмэх болно
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Intro badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mb-7"
            >
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 text-xs text-emerald-400">
                {templates.length} тайлан боломжтой
              </div>
            </motion.div>

            {/* Cards grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence>
                {templates.map((t, i) => (
                  <ReportCard
                    key={t.id}
                    template={t}
                    index={i}
                    onClick={() => openCard(t)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Report card component ─────────────────────────────────────────────────────
function ReportCard({
  template,
  index,
  onClick,
}: {
  template: ReportTemplate;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        type: "spring",
        stiffness: 260,
        damping: 24,
      }}
      whileHover={{ y: -4 }}
      className="group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-200 group-hover:border-slate-500/60 group-hover:shadow-xl group-hover:shadow-black/40 group-hover:bg-slate-800/60">
        {/* Gradient top strip */}
        <div className={`h-1 w-full bg-gradient-to-r ${template.color}`} />

        <div className="p-5">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center shadow-lg mb-4`}
          >
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>

          {/* Name */}
          <p className="font-semibold text-slate-100 text-sm leading-snug group-hover:text-white transition-colors">
            {template.name}
          </p>

          {/* Description */}
          {template.description && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
              {template.description}
            </p>
          )}

          {/* Date mode badge */}
          <div className="mt-4 flex items-center gap-1.5">
            {template.dateMode === "range" ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                <CalendarRange className="w-3 h-3" />
                Хугацааны интервал
              </span>
            ) : template.dateMode === "single" ? (
              <span className="inline-flex items-center gap-1 text-xs text-sky-400/80 bg-sky-500/10 border border-sky-500/20 rounded-full px-2.5 py-0.5">
                <Calendar className="w-3 h-3" />
                Нэг огноо
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-violet-400/80 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-0.5">
                <Download className="w-3 h-3" />
                Шууд татах
              </span>
            )}
          </div>
        </div>

        {/* Hover arrow */}
        <div className="absolute bottom-4 right-4 w-7 h-7 rounded-lg bg-slate-700/0 group-hover:bg-slate-700/60 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
          <Download className="w-3.5 h-3.5 text-slate-300" />
        </div>
      </div>
    </motion.div>
  );
}
