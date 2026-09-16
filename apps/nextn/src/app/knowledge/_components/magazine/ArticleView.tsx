"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { KnowledgeCoverImage } from "../KnowledgeCoverImage";
import {
  calcReadTime,
  categoryLabel,
  formatShortDate,
  type News,
} from "../../_lib/knowledge-utils";
import { HeroBackdrop } from "./HeroFeature";
import { AuthorAvatar, CONTAINER, HERO_BG } from "./Primitives";

// Нийтлэлийн биеийн typography — typography plugin-гүй тул тэмдэглэгээ бүрийг
// шууд загварчилна. HTML нь page.tsx-д DOMPurify-гаар (backend-д sanitize-html-ээр)
// цэвэрлэгдсэн байна.
const ARTICLE_BODY = cn(
  "text-[17px] leading-8 text-foreground/90",
  "[&_p]:my-5 [&_li]:my-1.5 [&_strong]:font-bold [&_strong]:text-foreground",
  "[&_h1]:mb-4 [&_h1]:mt-12 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:text-foreground",
  "[&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground",
  "[&_h3]:mb-3 [&_h3]:mt-10 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-foreground",
  "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-5 [&_blockquote]:italic",
  "[&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400",
  "[&_img]:my-8 [&_img]:rounded-2xl [&_hr]:my-10 [&_hr]:border-border",
  "[&_table]:my-6 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
  "[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left",
);

const glassBtn =
  "grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25";

/**
 * Нийтлэлийг DAG news-ийн загвараар бүтэн дэлгэцэд харуулна.
 * Нийтлэл солигдоход parent `key={news.id}` өгдөг тул зургийн индекс өөрөө эхэлнэ.
 */
export function ArticleView({
  news,
  imageUrls,
  sanitizedHtml,
  canDelete,
  onClose,
  onDelete,
}: {
  news: News;
  imageUrls: string[];
  sanitizedHtml: string;
  canDelete: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t, language } = useLanguage();
  const [index, setIndex] = useState(0);

  const author = news.authorName || t("knowledgePageEmployeeFallback");
  const count = imageUrls.length;
  const step = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);
  // Textarea-аар бичсэн энгийн текстэд мөр шилжилтийг хадгална.
  const isPlainText = !/<[a-z][\s\S]*>/i.test(sanitizedHtml);
  const upper = (s: string) =>
    s.toLocaleUpperCase(language === "en" ? "en-US" : "mn-MN");
  const meta = `${formatShortDate(news.createdAt, language)} • ${calcReadTime(news.content)} ${t("minRead")}`;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={news.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-background"
    >
      {/* ── Hero ── */}
      <header className={cn("relative overflow-hidden text-white", HERO_BG)}>
        <HeroBackdrop news={news} />
        <div className={cn("relative", CONTAINER)}>
          <div className="flex items-center justify-between gap-3 py-5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold backdrop-blur-md transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("knowledgeTitle")}
            </button>
            <div className="flex items-center gap-2">
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label={t("knowledgeDeletePost")}
                  title={t("knowledgeDeletePost")}
                  className={cn(glassBtn, "hover:bg-red-500/80")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className={glassBtn}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "mx-auto max-w-4xl text-center",
              count > 0 ? "pb-44 pt-6 sm:pt-12" : "pb-20 pt-6 sm:pt-12",
            )}
          >
            {/* [AUDIT] HeroFeature-тэй ижил: CSS uppercase кирилл Д-г эвддэг тул JS-ээр. */}
            <p
              className="text-3xl font-black leading-none text-[#07070c] sm:text-4xl"
              style={{
                WebkitTextStroke: "1.4px rgba(255,255,255,0.88)",
                paintOrder: "stroke fill",
              }}
            >
              {upper(categoryLabel(news.category, t))}
            </p>
            <h1 className="mx-auto mt-5 text-3xl font-black leading-[1.08] tracking-tight [text-wrap:balance] sm:text-5xl lg:text-6xl">
              {news.title}
            </h1>
            <div className="mt-10 flex items-center justify-center gap-3">
              <AuthorAvatar
                name={author}
                className="h-12 w-12 text-sm ring-2 ring-white/30"
              />
              <div className="text-left">
                <p className="text-sm font-semibold text-white/65">{author}</p>
                <p className="text-sm font-bold text-white">{meta}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* ── Нүүр зураг (hero-оос доош давж харагдана) ── */}
      {count > 0 && (
        <div className={cn("relative -mt-32", CONTAINER)}>
          <div className="relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden rounded-[28px] bg-muted shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)] ring-1 ring-black/5">
            <KnowledgeCoverImage
              key={imageUrls[index]}
              path={imageUrls[index]}
              alt={news.title}
              fill
            />
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={t("knowledgePrev")}
                  className={cn(
                    glassBtn,
                    "absolute left-4 top-1/2 -translate-y-1/2 bg-black/35 hover:bg-black/55",
                  )}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={t("knowledgeNext")}
                  className={cn(
                    glassBtn,
                    "absolute right-4 top-1/2 -translate-y-1/2 bg-black/35 hover:bg-black/55",
                  )}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
                  {imageUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`${i + 1} / ${count}`}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        i === index ? "w-6 bg-white" : "w-2 bg-white/50",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Нийтлэлийн бие ── */}
      <article
        className={cn(CONTAINER, "pb-24", count > 0 ? "pt-14" : "pt-12")}
      >
        <div
          className={cn(
            "mx-auto max-w-3xl",
            ARTICLE_BODY,
            isPlainText && "whitespace-pre-line",
          )}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />

        <footer className="mx-auto mt-16 flex max-w-3xl flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <div className="flex items-center gap-3">
            <AuthorAvatar name={author} className="h-12 w-12 text-sm" />
            <div>
              <p className="text-sm font-bold text-foreground">{author}</p>
              <p className="text-sm text-muted-foreground">{meta}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-bold text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("knowledgeBackToNews")}
          </button>
        </footer>
      </article>
    </motion.div>
  );
}
