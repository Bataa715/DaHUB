"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  calcReadTime,
  categoryLabel,
  formatShortDate,
  type News,
} from "../../_lib/knowledge-utils";
import { AuthorAvatar, CoverArt, cardA11y } from "./Primitives";

/** Онцлох нийтлэлийн зургийг бүдгэрүүлж hero-ийн арын дэвсгэр болгоно. */
export function HeroBackdrop({ news }: { news: News }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 scale-125 opacity-50 blur-3xl saturate-150">
        <CoverArt news={news} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#07070c]/50 via-[#07070c]/80 to-[#07070c]/50" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#07070c]" />
    </div>
  );
}

export function HeroFeature({
  news,
  onOpen,
}: {
  news: News;
  onOpen: () => void;
}) {
  const { t, language } = useLanguage();
  const author = news.authorName || t("knowledgePageEmployeeFallback");

  return (
    <motion.div
      {...cardA11y(onOpen)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="group relative z-10 grid cursor-pointer grid-cols-1 items-center gap-8 rounded-[28px] py-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:py-16"
    >
      <div className="relative aspect-square w-full max-w-[520px] overflow-hidden rounded-[28px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
        <CoverArt news={news} iconClassName="h-72 w-72 -bottom-12 -right-12" />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-blue-400">
          {t("knowledgeHeroLabel")}
        </p>
        {/* [AUDIT] text-transparent + -webkit-text-stroke нь кирилл А/Д-ийн
            дотоод нүхийг идэж Д-г латин A шиг харагдуулдаг. Дүүргэлт нь
            hero-ийн фонтой ижил тул outline харагдана, үсэг зөв үлдэнэ.
            CSS uppercase-ийг бүү хэрэглэ — д/Д-г буруу glyph руу солино. */}
        <p
          className="mt-5 text-4xl font-black leading-none text-[#07070c] sm:text-5xl"
          style={{
            WebkitTextStroke: "1.4px rgba(255,255,255,0.88)",
            paintOrder: "stroke fill",
          }}
        >
          {categoryLabel(news.category, t).toLocaleUpperCase(
            language === "en" ? "en-US" : "mn-MN",
          )}
        </p>
        <h2 className="mt-3 line-clamp-5 text-3xl font-black uppercase leading-[1.06] tracking-tight text-white transition-opacity group-hover:opacity-90 sm:text-4xl xl:text-[3.25rem]">
          {news.title}
        </h2>

        <div className="mt-10 flex items-center gap-3">
          <AuthorAvatar
            name={author}
            className="h-12 w-12 text-sm ring-2 ring-white/30"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/60">
              {author}
            </p>
            <p className="text-sm font-bold text-white">
              {formatShortDate(news.createdAt, language)}
              <span className="mx-1.5 text-white/40">•</span>
              {calcReadTime(news.content)} {t("minRead")}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function HeroSkeleton() {
  return (
    <div
      aria-hidden
      className="grid animate-pulse grid-cols-1 items-center gap-8 py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:py-16"
    >
      <div className="aspect-square w-full max-w-[520px] rounded-[28px] bg-white/10" />
      <div className="space-y-4">
        <div className="h-4 w-28 rounded bg-white/15" />
        <div className="h-11 w-52 rounded bg-white/10" />
        <div className="h-11 w-full rounded bg-white/15" />
        <div className="h-11 w-4/5 rounded bg-white/15" />
        <div className="mt-10 h-12 w-60 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
