"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  calcReadTime,
  categoryLabel,
  formatShortDate,
  getCat,
  isCyberCategory,
  stripHtml,
  type News,
} from "../../_lib/knowledge-utils";
import {
  AuthorAvatar,
  CONTAINER,
  CoverArt,
  SectionTitle,
  cardA11y,
} from "./Primitives";

const PAGE_SIZE = 8;

function TimelineItem({
  news,
  alignRight,
  onOpen,
}: {
  news: News;
  alignRight: boolean;
  onOpen: () => void;
}) {
  const { t, language } = useLanguage();
  const author = news.authorName || t("knowledgePageEmployeeFallback");
  const cat = getCat(news.category);
  const cyber = isCyberCategory(news.category);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col"
    >
      {/* Чат шиг — баруун баганынх нь баруун тийш эгнэнэ */}
      <div
        className={cn(
          "mb-2 flex items-center gap-2.5",
          alignRight && "flex-row-reverse text-right",
        )}
      >
        <AuthorAvatar name={author} className="h-8 w-8 text-[11px]" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">
            {author}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatShortDate(news.createdAt, language)}
            <span className="mx-1.5">•</span>
            {calcReadTime(news.content)} {t("minRead")}
          </p>
        </div>
      </div>

      <div
        {...cardA11y(onOpen)}
        className={cn(
          "group flex flex-1 cursor-pointer items-center gap-4 rounded-3xl p-4 ring-1 transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          cyber
            ? "bg-emerald-500/5 ring-emerald-500/30 hover:ring-emerald-500/50"
            : "bg-card ring-border/60 hover:ring-border",
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "flex items-center gap-2 text-xs font-bold",
              cat.text,
              cyber && "font-mono tracking-wide",
            )}
          >
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 rounded-full", cat.dot)}
            />
            {categoryLabel(news.category, t)}
          </p>
          <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-foreground">
            {news.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {stripHtml(news.content).slice(0, 140)}
          </p>
        </div>
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl">
          <CoverArt news={news} iconClassName="h-12 w-12 -bottom-2 -right-2" />
        </div>
      </div>
    </motion.article>
  );
}

/**
 * Сүүлийн нийтлэлүүд — хоёр баганаар нягт байрлана (чат шиг зүүн/баруун
 * ээлжилсэн). Урьд нь нэг мөрөнд нэг карт, хооронд нь их зайтай байсан тул
 * олон нийтлэл харахад хэт их гүйлгэдэг байв.
 */
export function LatestTimeline({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: News[];
  onOpen: (news: News) => void;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (items.length === 0) return null;

  return (
    <section className={CONTAINER}>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        {items.slice(0, visible).map((n, i) => (
          <TimelineItem
            key={n.id}
            news={n}
            alignRight={i % 2 === 1}
            onOpen={() => onOpen(n)}
          />
        ))}
      </div>
      {visible < items.length && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full bg-card px-6 py-2.5 text-sm font-bold text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
          >
            {t("knowledgeLoadMore")}
          </button>
        </div>
      )}
    </section>
  );
}
