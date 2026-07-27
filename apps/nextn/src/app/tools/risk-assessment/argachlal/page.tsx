"use client";

/**
 * Аргачлал — эрсдэлийн үнэлгээний үзүүлэлт бүрийн тайлбар/аргачлал (hint).
 * Админы risk-indicators тохиргооноос удирдана; энд зөвхөн уншина.
 */

import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useIndicatorConfig,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import { GROUP_LABELS } from "../../../admin/risk-indicators/_components/ScaleEditor";

const GROUP_ORDER: number[] = [1, 2, 3, 4, 5];

function IndicatorCard({ ind }: { ind: DynamicCatalogIndicator }) {
  const { t } = useLanguage();
  return (
    <div className="p-4 space-y-2 break-inside-avoid border-b border-border/40 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5 font-mono text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
          {ind.subid}
        </span>
        <h3 className="text-sm font-semibold text-foreground leading-snug min-w-0">
          {ind.name}
        </h3>
      </div>

      {ind.hint ? (
        <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {ind.hint}
        </p>
      ) : (
        <p className="text-[13px] italic text-muted-foreground/50">
          {t("raArgachlalNoHint")}
        </p>
      )}
    </div>
  );
}

export default function ArgachlalPage() {
  const { t } = useLanguage();
  const { catalog, loaded } = useIndicatorConfig();
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? catalog.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.subid.toLowerCase().includes(q) ||
            (c.hint ?? "").toLowerCase().includes(q),
        )
      : catalog;
    return GROUP_ORDER.map((g) => ({
      group: g,
      label: GROUP_LABELS[g] ?? `${t("raArgachlalGroupFallback")} ${g}`,
      items: filtered
        .filter((c) => c.group === g)
        .sort((a, b) =>
          a.subid.localeCompare(b.subid, undefined, { numeric: true }),
        ),
    })).filter((s) => s.items.length > 0);
  }, [catalog, query]);

  return (
    <div className="min-h-screen bg-background">
      <ToolPageHeader
        href="/tools/risk-assessment/work"
        icon={<BookOpen className="w-4 h-4 text-primary" />}
        title={t("admRiskIndMethodologyLabel")}
      />

      <div className="w-full px-4 md:px-6 py-6 space-y-5">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("monRptSearchBtn")}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-foreground/5 border border-border/50 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {!loaded ? (
          <div className="text-center py-16 text-muted-foreground/50 text-sm">
            {t("loading")}
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/50 text-sm">
            {t("redflagNoResult")}
          </div>
        ) : (
          grouped.map((section) => (
            <section key={section.group} className="space-y-3">
              <div className="flex items-center gap-2 sticky top-14 bg-background/90 backdrop-blur-sm py-2 z-10">
                <span className="text-sm font-bold text-foreground">
                  {section.label}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  {section.items.length} {t("raArgachlalIndicatorSuffix")}
                </span>
                <div className="flex-1 h-px bg-border/40" />
              </div>
              <div className="grid gap-3">
                {section.items.map((ind) => (
                  <IndicatorCard key={ind.id} ind={ind} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
