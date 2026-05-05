"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  CalendarRange,
  ArrowLeft,
  Search,
  Zap,
  Code2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pythonToolApi, PythonTool } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const DATE_ICON = {
  none: {
    Icon: Zap,
    label: "Шууд татах",
    cls: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  single: {
    Icon: Calendar,
    label: "Нэг огноо",
    cls: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  range: {
    Icon: CalendarRange,
    label: "Хугацааны интервал",
    cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
};

const OUTPUT_META = {
  excel: { icon: FileSpreadsheet, color: "text-emerald-400", label: "Excel" },
  csv: { icon: FileText, color: "text-sky-400", label: "CSV" },
};

export default function ReportsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [pyTools, setPyTools] = useState<PythonTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      setPyTools(await pythonToolApi.getTools());
    } catch {
      toast({
        title: "Алдаа",
        description: "Тайлан ачаалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pyTools;
    return pyTools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q),
    );
  }, [pyTools, search]);

  return (
    <div className="min-h-screen bg-[#080d14] text-slate-100 flex flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#080d14]/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Буцах
          </Link>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Code2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-100">Тайлан татах</span>
          </div>
          {!loading && pyTools.length > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 w-52 focus-within:border-violet-500/50 transition-colors">
              <Search className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Хайх..."
                className="bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="h-1 bg-slate-800" />
                <div className="p-5 space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-800" />
                  <div className="h-3.5 w-3/4 bg-slate-800 rounded-full" />
                  <div className="h-2.5 w-full bg-slate-800/70 rounded-full" />
                  <div className="h-5 w-32 bg-slate-800/60 rounded-full mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : pyTools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <Code2 className="w-14 h-14 text-slate-700" />
            <p className="text-slate-400 font-medium text-lg">
              Эрхтэй тайлан байхгүй байна
            </p>
            <p className="text-slate-600 text-sm">
              Администратортай холбогдоно уу
            </p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 text-xs text-violet-400">
                {search
                  ? `${filtered.length} / ${pyTools.length}`
                  : pyTools.length}{" "}
                тайлан
              </div>
              {search && filtered.length === 0 && (
                <span className="text-xs text-slate-600">
                  «{search}» — олдсонгүй
                </span>
              )}
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
              <AnimatePresence>
                {filtered.map((t, i) => {
                  const dm =
                    DATE_ICON[t.dateMode as keyof typeof DATE_ICON] ??
                    DATE_ICON.none;
                  const DmIcon = dm.Icon;
                  const href = `/tools/reports/python/${t.id}`;
                  const outMeta =
                    OUTPUT_META[t.outputFormat as keyof typeof OUTPUT_META] ??
                    OUTPUT_META.excel;
                  const OutIcon = outMeta.icon;

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: i * 0.04,
                        type: "spring",
                        stiffness: 260,
                        damping: 24,
                      }}
                      whileHover={{ y: -4 }}
                      className="group cursor-pointer h-full"
                      onClick={() => router.push(href)}
                    >
                      <div className="relative h-full flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden transition-all duration-200 group-hover:border-white/[0.15] group-hover:bg-white/[0.05] group-hover:shadow-xl group-hover:shadow-black/40">
                        <div
                          className={`h-1 w-full bg-gradient-to-r ${t.color}`}
                        />
                        <div className="p-5 flex flex-col flex-1">
                          <div className="flex items-start justify-between mb-4">
                            <div
                              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shadow-lg`}
                            >
                              <Code2 className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border bg-violet-500/10 text-violet-400 border-violet-500/20">
                              Python
                            </span>
                          </div>
                          <p className="font-semibold text-slate-100 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                            {t.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed min-h-[2rem]">
                            {t.description || "\u00a0"}
                          </p>
                          <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-xs rounded-full border px-2.5 py-0.5 ${dm.cls}`}
                            >
                              <DmIcon className="w-3 h-3" /> {dm.label}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-xs rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 ${outMeta.color}`}
                            >
                              <OutIcon className="w-3 h-3" /> {outMeta.label}
                            </span>
                          </div>
                        </div>
                        <div className="absolute bottom-4 right-4 w-7 h-7 rounded-lg bg-white/0 group-hover:bg-white/[0.07] flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                          <Download className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
