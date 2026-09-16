"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  buildWeekWindows,
  calcReadTime,
  categoryLabel,
  formatMonthDay,
  parseDate,
  type News,
} from "../../_lib/knowledge-utils";
import { CONTAINER, CoverArt, cardA11y } from "./Primitives";

const WEEK_COUNT = 4;
/** 1 том (2×2) + 8 жижиг = lg дээр 3 бүтэн мөр */
const MAX_CARDS = 9;

function BentoCard({
  news,
  large,
  onOpen,
}: {
  news: News;
  large: boolean;
  onOpen: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      {...cardA11y(onOpen)}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-3xl bg-muted shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        large && "sm:col-span-2 sm:row-span-2",
      )}
    >
      <CoverArt
        news={news}
        iconClassName={large ? "h-72 w-72 -bottom-12 -right-12" : undefined}
      />
      <div className="absolute inset-x-0 bottom-0 bg-black/35 px-5 pb-5 pt-4 backdrop-blur-xl sm:px-7 sm:pb-6">
        <span className="absolute -top-4 right-5 rounded-lg bg-violet-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
          {calcReadTime(news.content)} {t("minRead")}
        </span>
        <p className="truncate text-xs font-semibold text-white/65 sm:text-sm">
          {categoryLabel(news.category, t)}
        </p>
        <h3
          className={cn(
            "mt-1 line-clamp-2 font-bold leading-snug text-white",
            large ? "text-xl sm:text-2xl" : "text-base",
          )}
        >
          {news.title}
        </h3>
      </div>
    </div>
  );
}

/** 7 хоногоор хуваасан архив — таб бүрт тухайн цонхны нийтлэлүүд (шинэ нь эхэндээ). */
export function WeeklyArchive({
  items,
  onOpen,
}: {
  items: News[];
  onOpen: (news: News) => void;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(0);
  const windows = useMemo(() => buildWeekWindows(WEEK_COUNT), []);

  const grouped = useMemo(
    () =>
      windows.map((w) =>
        items
          .filter((n) => {
            const ts = parseDate(n.createdAt).getTime();
            return ts >= w.start && ts < w.end;
          })
          .sort(
            (a, b) =>
              parseDate(b.createdAt).getTime() -
              parseDate(a.createdAt).getTime(),
          ),
      ),
    [items, windows],
  );

  if (grouped.every((g) => g.length === 0)) return null;
  const current = grouped[tab] ?? [];

  return (
    <section className={CONTAINER}>
      <div
        role="tablist"
        aria-label={t("knowledgeWeekTabs")}
        className="flex overflow-x-auto border-b border-border scrollbar-none"
      >
        {windows.map((w, i) => {
          const active = tab === i;
          return (
            <button
              key={w.start}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(i)}
              className={cn(
                "relative min-w-[140px] flex-1 whitespace-nowrap px-4 pb-4 pt-2 text-sm transition-colors sm:text-base",
                i === 0 ? "text-left" : "text-center",
                active
                  ? "font-bold text-blue-600 dark:text-blue-400"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {i === 0
                ? t("knowledgeLastWeek")
                : `${formatMonthDay(w.from)} - ${formatMonthDay(w.to)}`}
              {active && (
                <motion.span
                  layoutId="knowledge-week-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600 dark:bg-blue-400"
                />
              )}
            </button>
          );
        })}
      </div>

      {current.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {t("knowledgeWeekEmpty")}
        </p>
      ) : (
        <div className="mt-10 grid auto-rows-[240px] grid-cols-1 gap-5 sm:auto-rows-[220px] sm:grid-cols-2 lg:grid-cols-4">
          {current.slice(0, MAX_CARDS).map((n, i) => (
            <BentoCard
              key={n.id}
              news={n}
              large={i === 0}
              onOpen={() => onOpen(n)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
