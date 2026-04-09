"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  User,
  Loader2,
  ArrowRight,
  X,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import api from "@/lib/api";

function getImageUrl(path?: string): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("dompurify") as typeof import("dompurify");
  const DOMPurify = mod.default ?? (mod as unknown as typeof mod.default);
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

interface News {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  authorId: string;
  authorName?: string;
  isPublished: number;
  views: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  Мэдэгдэл: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  Ерөнхий: {
    bg: "bg-purple-500/20",
    text: "text-purple-400",
    dot: "bg-purple-400",
  },
  "Үйл явдал": {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  Танилцуулга: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
};

function getCat(cat: string) {
  return (
    CATEGORY_COLORS[cat] ?? {
      bg: "bg-slate-500/20",
      text: "text-slate-400",
      dot: "bg-slate-400",
    }
  );
}

function calcReadTime(content: string) {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// --- Hero Section -----------------------------------------------------------
function HeroNews({ item, onClick }: { item: News; onClick: () => void }) {
  const { t } = useLanguage();
  const cat = getCat(item.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative w-full rounded-3xl overflow-hidden cursor-pointer group"
      style={{ minHeight: 420 }}
      onClick={onClick}
    >
      <div className="absolute inset-0">
        {getImageUrl(item.imageUrl) ? (
          <Image
            src={getImageUrl(item.imageUrl)!}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      <div
        className="relative z-10 flex flex-col justify-end h-full p-8 md:p-12"
        style={{ minHeight: 420 }}
      >
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-bold uppercase tracking-widest ${cat.text}`}
            >
              {item.category}
            </span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-slate-400 text-xs">
              {formatDate(item.createdAt)}
            </span>
          </div>

          <p
            className="text-xs font-bold tracking-[0.3em] uppercase text-slate-300"
            style={{ fontFamily: "monospace" }}
          >
            {t("internalAuditLabel")}
          </p>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
            {item.title}
          </h1>

          <div className="flex items-center gap-4 pt-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">
                {item.authorName || t("newsDefaultAuthor")}
              </p>
              <p className="text-slate-400 text-xs">
                {formatDate(item.createdAt)} &nbsp;·&nbsp;{" "}
                {calcReadTime(item.content)} {t("minRead")}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-slate-400 text-sm">
              <Eye className="w-4 h-4" />
              <span>{item.views}</span>
            </div>
          </div>
        </div>

        <motion.div
          className="absolute bottom-8 right-8 md:bottom-12 md:right-12 flex items-center gap-2 text-white/60 text-sm group-hover:text-white transition-colors"
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span>{t("readMore")}</span>
          <ArrowRight className="w-4 h-4" />
        </motion.div>
      </div>
    </motion.div>
  );
}

// --- Carousel Card ----------------------------------------------------------
function CarouselCard({
  item,
  index,
  onClick,
}: {
  item: News;
  index: number;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  const cat = getCat(item.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      onClick={onClick}
      className="relative flex-shrink-0 w-64 md:w-72 h-96 rounded-2xl overflow-hidden cursor-pointer group"
    >
      <div className="absolute inset-0">
        {getImageUrl(item.imageUrl) ? (
          <Image
            src={getImageUrl(item.imageUrl)!}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="300px"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
      </div>

      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
          style={{ width: `${20 + index * 15}%` }}
        />
      </div>

      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
        {calcReadTime(item.content)} {t("minRead")}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        <div className="flex items-center gap-3 text-white/70 text-xs">
          <span className={`w-2 h-2 rounded-full ${cat.dot} opacity-80`} />
          <Eye className="w-3.5 h-3.5" />
          <span>{item.views}</span>
        </div>
        <h3 className="text-white font-bold text-sm leading-snug line-clamp-3">
          {item.title}
        </h3>
        <span
          className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${cat.bg} ${cat.text}`}
        >
          {item.category}
        </span>
      </div>
    </motion.div>
  );
}

// --- Chat Feed Item ----------------------------------------------------------
function ChatItem({
  item,
  index,
  onClick,
}: {
  item: News;
  index: number;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  const isRight = index % 2 !== 0;
  const cat = getCat(item.category);

  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? 30 : -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className={`flex items-start gap-4 ${isRight ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`flex flex-col items-center gap-1.5 flex-shrink-0 ${isRight ? "items-end" : "items-start"}`}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/30">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className={isRight ? "text-right" : "text-left"}>
          <p className="text-slate-300 text-xs font-semibold whitespace-nowrap">
            {item.authorName || t("newsDefaultAuthor")}
          </p>
          <p className="text-slate-500 text-xs whitespace-nowrap">
            {formatDate(item.createdAt)} · {calcReadTime(item.content)} {t("minRead")}
          </p>
        </div>
      </div>

      <motion.div
        whileHover={{ y: -2 }}
        onClick={onClick}
        className="flex-1 max-w-2xl cursor-pointer rounded-2xl overflow-hidden transition-all"
        style={{
          background: "rgba(15,20,35,0.7)",
          border: "1px solid rgba(99,102,241,0.15)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-stretch">
          <div className="flex-1 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${cat.text}`}
              >
                {item.category}
              </span>
            </div>
            <h3 className="text-white font-bold text-base leading-snug line-clamp-2">
              {item.title}
            </h3>
            <div className="flex items-center gap-3 text-slate-500 text-xs">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {item.views}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {calcReadTime(item.content)} {t("minRead")}
              </span>
            </div>
          </div>
          {getImageUrl(item.imageUrl) ? (
            <div className="relative w-24 h-24 flex-shrink-0 self-center m-3 rounded-xl overflow-hidden">
              <Image
                src={getImageUrl(item.imageUrl)!}
                alt={item.title}
                fill
                unoptimized
                className="object-cover"
                sizes="96px"
              />
            </div>
          ) : (
            <div className="relative w-24 h-24 flex-shrink-0 self-center m-3 rounded-xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Main Page --------------------------------------------------------------
export default function NewsPage() {
  const { t } = useLanguage();
  const [news, setNews] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/news?published=true");
      setNews(response.data);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = async (item: News) => {
    try {
      const response = await api.get(`/news/${item.id}`);
      setSelectedNews(response.data);
    } catch {
      setSelectedNews(item);
    }
  };

  const scroll = (dir: "left" | "right") => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({
      left: dir === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  const hero = news[0];
  const carousel = news.slice(1, 6);
  const feed = news.slice(6);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-10 w-10 text-purple-400" />
          </motion.div>
          <p className="text-slate-400 text-sm animate-pulse">
            {t("newsLoading")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-3xl font-black text-white tracking-tight">
          {t("newsTitle")}
        </h1>
        <p className="text-slate-400 text-sm">
          {t("newsSubtitle")}
        </p>
      </motion.div>

      {/* Hero */}
      {hero && <HeroNews item={hero} onClick={() => handleClick(hero)} />}

      {/* Carousel */}
      {carousel.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-xl">{t("latestNews")}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => scroll("left")}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>
          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto pb-2"
            style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
          >
            {carousel.map((item, i) => (
              <div key={item.id} style={{ scrollSnapAlign: "start" }}>
                <CarouselCard
                  item={item}
                  index={i}
                  onClick={() => handleClick(item)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Feed */}
      {feed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-white font-bold text-xl">{t("otherNews")}</h2>
          <div className="space-y-5">
            {feed.map((item, i) => (
              <ChatItem
                key={item.id}
                item={item}
                index={i}
                onClick={() => handleClick(item)}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && news.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <p className="text-lg">{t("noNews")}</p>
        </div>
      )}

      {/* Detail — full-screen overlay */}
      <AnimatePresence>
        {selectedNews && (
          <motion.div
            key="news-detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: "rgba(8,12,23,0.98)", backdropFilter: "blur(12px)" }}
          >
            {/* ── Sticky top bar ── */}
            <div
              className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 h-14 border-b"
              style={{ borderColor: "rgba(99,102,241,0.18)", background: "rgba(10,15,28,0.96)" }}
            >
              <button
                onClick={() => setSelectedNews(null)}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t("back") || "Буцах"}</span>
              </button>
              <div
                className="mx-2 h-4 w-px flex-shrink-0"
                style={{ background: "rgba(99,102,241,0.25)" }}
              />
              <p className="flex-1 text-white font-semibold text-sm truncate">
                {selectedNews.title}
              </p>
              <button
                onClick={() => setSelectedNews(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700/60 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto">
              {/* Cover image */}
              {getImageUrl(selectedNews.imageUrl) && (
                <div className="relative w-full" style={{ height: "min(45vh, 420px)" }}>
                  <Image
                    src={getImageUrl(selectedNews.imageUrl)!}
                    alt={selectedNews.title}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="100vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,12,23,1)] via-[rgba(8,12,23,0.3)] to-transparent" />
                </div>
              )}

              {/* Content */}
              <div className="max-w-3xl mx-auto px-4 sm:px-8 pb-16">
                <div
                  className={getImageUrl(selectedNews.imageUrl) ? "-mt-10 relative" : "pt-8"}
                >
                  {/* Category + views */}
                  <div className="flex items-center gap-2 mb-4">
                    {(() => {
                      const cat = getCat(selectedNews.category);
                      return (
                        <span
                          className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                            cat.bg
                          } ${cat.text}`}
                        >
                          {selectedNews.category}
                        </span>
                      );
                    })()}
                    <span className="text-slate-500 text-xs flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {selectedNews.views}
                    </span>
                  </div>

                  {/* Title */}
                  <h1 className="text-white text-2xl sm:text-3xl font-black leading-tight mb-4">
                    {selectedNews.title}
                  </h1>

                  {/* Author / meta */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-200 text-sm font-semibold">
                        {selectedNews.authorName || t("newsDefaultAuthor")}
                      </p>
                      <p className="text-slate-500 text-xs flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {formatDate(selectedNews.createdAt)} &nbsp;·&nbsp;
                        <Clock className="w-3 h-3" />
                        {calcReadTime(selectedNews.content)} {t("minuteRead")}
                      </p>
                    </div>
                  </div>

                  <div
                    className="mb-6 h-px"
                    style={{ background: "rgba(99,102,241,0.18)" }}
                  />

                  {/* Full content */}
                  <div
                    className="prose prose-invert prose-sm sm:prose-base max-w-none text-slate-300 leading-relaxed
                      prose-headings:text-white prose-headings:font-bold
                      prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                      prose-strong:text-slate-100
                      prose-code:text-purple-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded
                      prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
                      prose-blockquote:border-l-purple-500 prose-blockquote:text-slate-400
                      prose-img:rounded-xl prose-img:mx-auto prose-img:w-full
                      prose-table:text-sm prose-th:text-slate-200 prose-td:text-slate-400"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(selectedNews.content),
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
