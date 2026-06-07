"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileSpreadsheet,
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
import { useLanguage } from "@/contexts/LanguageContext";

const DATE_ICON = {
  none: {
    Icon: Zap,
    labelKey: "reportsDateInstant" as const,
    cls: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  single: {
    Icon: Calendar,
    labelKey: "reportsDateSingle" as const,
    cls: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  range: {
    Icon: CalendarRange,
    labelKey: "reportsDateRange" as const,
    cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
};

const OUTPUT_META = {
  excel: { icon: FileSpreadsheet, color: "text-emerald-400", label: "Excel" },
  csv: { icon: FileText, color: "text-sky-400", label: "CSV" },
};

export default function ReportsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
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
        title: t("reportsLoadError"),
        description: t("reportsLoadError"),
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground/90 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {t("back")}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Code2 className="w-3.5 h-3.5 text-foreground" />
            </div>
            <span className="font-semibold text-foreground">
              {t("toolReportsTitle")}
            </span>
          </div>
          {!loading && pyTools.length > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-1.5 w-52 focus-within:border-violet-500/50 transition-colors">
              <Search className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("reportsSearchPlaceholder")}
                className="bg-transparent text-sm text-foreground/90 placeholder:text-muted-foreground/50 outline-none w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 animate-pulse"
              >
                <div className="h-3.5 w-3/4 bg-muted rounded-full" />
                <div className="h-2.5 w-full bg-muted/70 rounded-full" />
                <div className="h-5 w-24 bg-muted/60 rounded-full" />
              </div>
            ))}
          </div>
        ) : pyTools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <Code2 className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">
              {t("reportsNoAccess")}
            </p>
            <p className="text-muted-foreground/50 text-sm">
              {t("reportsContactAdmin")}
            </p>
          </div>
        ) : (
          <>
            {search && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground/50 mb-4">
                «{search}» — {t("reportsSearchNotFound")}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((tool) => {
                const dm =
                  DATE_ICON[tool.dateMode as keyof typeof DATE_ICON] ??
                  DATE_ICON.none;
                const DmIcon = dm.Icon;
                const outMeta =
                  OUTPUT_META[tool.outputFormat as keyof typeof OUTPUT_META] ??
                  OUTPUT_META.excel;
                const OutIcon = outMeta.icon;

                return (
                  <div
                    key={tool.id}
                    onClick={() =>
                      router.push(`/tools/reports/python/${tool.id}`)
                    }
                    className="group cursor-pointer rounded-xl border border-border bg-card hover:border-foreground/20 hover:bg-muted/30 transition-all p-4 flex flex-col gap-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                        {tool.name}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
                        {tool.description || "\u00a0"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      <span
                        className={`inline-flex items-center gap-1 text-xs rounded-full border px-2.5 py-0.5 ${dm.cls}`}
                      >
                        <DmIcon className="w-3 h-3" /> {t(dm.labelKey)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs rounded-full border border-border bg-muted/40 px-2.5 py-0.5 ${outMeta.color}`}
                      >
                        <OutIcon className="w-3 h-3" /> {outMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
