"use client";

/**
 * Аргачлал — эрсдэлийн үнэлгээний бүх үзүүлэлтийн үнэлэх аргачлал (hint) болон
 * оноо тооцоолох дүрмийг уншиж болох баримт бичгийн хуудас.
 * Админы risk-indicators тохиргооноос удирдана; энд зөвхөн уншина.
 */

import { useMemo, useState } from "react";
import { BookOpen, Search, Printer, Info } from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  useIndicatorConfig,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import {
  parseScale,
  GROUP_LABELS,
} from "../../../admin/risk-indicators/_components/ScaleEditor";

const GROUP_ORDER: number[] = [1, 2, 3, 4, 5];

const SCORE_COLOR: Record<number, string> = {
  1: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  2: "bg-lime-500/15 text-lime-600 dark:text-lime-400 border-lime-500/30",
  3: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  4: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  5: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  0: "bg-muted/40 text-muted-foreground border-border/40",
};

type MethodRow = { range: string; score: number; label: string };

/** score_scale JSON-ийг уншигдахуйц дүрмийн жагсаалт болгоно */
function describeScale(scaleJson: string): {
  typeLabel: string;
  rows: MethodRow[];
  note?: string;
} {
  const scale = parseScale(scaleJson);

  const rangeText = (r: { min?: number | null; max?: number | null }): string => {
    if (r.min == null && r.max == null) return "бүх утга";
    if (r.min == null) return `${r.max}-аас бага`;
    if (r.max == null) return `${r.min}-аас их/тэнцүү`;
    return `${r.min} ≤ утга < ${r.max}`;
  };

  const numeric = (
    rules: {
      min?: number | null;
      max?: number | null;
      score: number;
      label: string;
    }[],
  ): MethodRow[] =>
    [...rules]
      .sort((a, b) => b.score - a.score)
      .map((r) => ({ range: rangeText(r), score: r.score, label: r.label }));

  const stringRows = (
    rules: {
      values?: string[];
      matchType?: string;
      score: number;
      label: string;
    }[],
  ): MethodRow[] =>
    rules.map((r) => ({
      range:
        (r.matchType === "contains" ? "агуулна: " : "") +
        (r.values ?? []).join(", "),
      score: r.score,
      label: r.label,
    }));

  if (scale.type === "manual")
    return {
      typeLabel: "Гараар оруулах",
      rows: [],
      note: "Аудитор өөрөө 1–5 оноог гараар өгнө.",
    };
  if (scale.type === "multi_subid") {
    const rows: MethodRow[] = [];
    for (const src of scale.sources ?? [])
      rows.push(...numeric(src.numericRules ?? []));
    return {
      typeLabel: "Олон эх үүсвэр",
      rows,
      note: `Хэд хэдэн SUBID-ийн оноог "${scale.combine ?? "max"}" аргаар нэгтгэнэ.`,
    };
  }
  if (scale.type === "string")
    return {
      typeLabel: "Мөр (текст) тааруулах",
      rows: stringRows(scale.stringRules ?? scale.rules ?? []),
    };
  if (scale.type === "both")
    return {
      typeLabel: "Тоо + текст",
      rows: [
        ...numeric(scale.numericRules ?? []),
        ...stringRows(scale.stringRules ?? []),
      ],
    };
  return {
    typeLabel: "Тоон утга",
    rows: numeric(scale.numericRules ?? scale.rules ?? []),
  };
}

function IndicatorCard({ ind }: { ind: DynamicCatalogIndicator }) {
  const method = useMemo(
    () => describeScale(ind.score_scale),
    [ind.score_scale],
  );
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 break-inside-avoid">
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5 font-mono text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
          {ind.subid}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-snug">
            {ind.name}
          </h3>
          {ind.weight > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Жин: {ind.weight}%
            </span>
          )}
        </div>
      </div>

      {ind.hint ? (
        <p className="text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
          {ind.hint}
        </p>
      ) : (
        <p className="text-[13px] italic text-muted-foreground/50">
          Аргачлал бичигдээгүй байна.
        </p>
      )}

      {method.rows.length > 0 && (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/30 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
            Оноо тооцоолол — {method.typeLabel}
          </div>
          <div className="divide-y divide-border/20">
            {method.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span
                  className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md border text-xs font-bold ${
                    SCORE_COLOR[r.score] ?? SCORE_COLOR[0]
                  }`}
                >
                  {r.score === 0 ? "Ү" : r.score}
                </span>
                <span className="text-[12px] font-mono text-foreground/80 shrink-0">
                  {r.range}
                </span>
                {r.label && (
                  <span className="text-[12px] text-muted-foreground/70 truncate">
                    — {r.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {method.rows.length === 0 && method.note && (
        <p className="text-[12px] text-muted-foreground/60">{method.note}</p>
      )}
    </div>
  );
}

export default function ArgachlalPage() {
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
      label: GROUP_LABELS[g] ?? `Бүлэг ${g}`,
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
        title="Аргачлал"
        subtitle="Үзүүлэлт бүрийн үнэлгээний аргачлал"
        rightContent={
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-muted/30 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            Хэвлэх / PDF
          </button>
        }
      />

      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3 print:hidden">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[13px] leading-relaxed text-foreground/80">
            Эрсдэлийн үнэлгээний үзүүлэлт бүрийг хэрхэн үнэлэх аргачлал, оноо
            тооцоолох дүрмийг энд нэгтгэв. Аргачлалыг администратор «Эрсдэлийн
            үзүүлэлт» тохиргооноос шинэчилнэ.
          </p>
        </div>

        <div className="relative print:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Үзүүлэлт, SUBID эсвэл аргачлалаар хайх..."
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-foreground/5 border border-border/50 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {!loaded ? (
          <div className="text-center py-16 text-muted-foreground/50 text-sm">
            Ачааллаж байна…
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/50 text-sm">
            Илэрц олдсонгүй.
          </div>
        ) : (
          grouped.map((section) => (
            <section key={section.group} className="space-y-3">
              <div className="flex items-center gap-2 sticky top-14 bg-background/90 backdrop-blur-sm py-2 z-10">
                <span className="text-sm font-bold text-foreground">
                  {section.label}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  {section.items.length} үзүүлэлт
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
