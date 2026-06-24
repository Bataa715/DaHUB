"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pythonToolApi, PythonTool } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const DATE_LABEL = {
  none: "reportsDateInstant" as const,
  single: "reportsDateSingle" as const,
  range: "reportsDateRange" as const,
};

const OUTPUT_LABEL = {
  excel: "Excel",
  csv: "CSV",
};

export default function ReportsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const router = useRouter();
  const [pyTools, setPyTools] = useState<PythonTool[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [toast, t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {t("back")}
          </Link>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-foreground mb-6">
          {t("toolReportsTitle")}
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : pyTools.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t("reportsNoAccess")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pyTools.map((tool) => {
              const dateKey =
                DATE_LABEL[tool.dateMode as keyof typeof DATE_LABEL] ??
                DATE_LABEL.none;
              const outputLabel =
                OUTPUT_LABEL[tool.outputFormat as keyof typeof OUTPUT_LABEL] ??
                OUTPUT_LABEL.excel;

              return (
                <li
                  key={tool.id}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/tools/reports/python/${tool.id}`)
                    }
                    className="w-full h-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {tool.name}
                    </p>
                    {tool.description ? (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {tool.description}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                      {t(dateKey)} · {outputLabel}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
