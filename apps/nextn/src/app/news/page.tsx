"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import Image from "next/image";
import api from "@/lib/api";

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
  Мэдэгдэл: { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-400" },
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

// ─── Hero Section ───────────────────────────────────────────────────────────
function HeroNews({ item, onClick }: { item: News; onClick: () => void }) {
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
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
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
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-400 text-xs">
              {formatDate(item.createdAt)}
            </span>
          </div>

          <p
            className="text-xs font-bold tracking-[0.3em] uppercase text-slate-300"
            style={{ fontFamily: "monospace" }}
          >
            ДОТООД АУДИТ — DAHUB
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
                {item.authorName || "Дотоод Аудитын Газар"}
              </p>
              <p className="text-slate-400 text-xs">
                {formatDate(item.createdAt)} &nbsp;•&nbsp;{" "}
                {calcReadTime(item.content)} мин
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
          <span>Дэлгэрэнгүй</span>
          <ArrowRight className="w-4 h-4" />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Carousel Card ──────────────────────────────────────────────────────────
function CarouselCard({
  item,
  index,
  onClick,
}: {
  item: News;
  index: number;
  onClick: () => void;
}) {
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
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
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
        {calcReadTime(item.content)} мин
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

// ─── Chat Feed Item ──────────────────────────────────────────────────────────
function ChatItem({
  item,
  index,
  onClick,
}: {
  item: News;
  index: number;
  onClick: () => void;
}) {
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
            {item.authorName || "Аудитын Газар"}
          </p>
          <p className="text-slate-500 text-xs whitespace-nowrap">
            {formatDate(item.createdAt)} • {calcReadTime(item.content)} мин
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
                {calcReadTime(item.content)} мин
              </span>
            </div>
          </div>
          {item.imageUrl && (
            <div className="relative w-24 h-24 flex-shrink-0 self-center m-3 rounded-xl overflow-hidden">
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function NewsPage() {
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
            Мэдээ ачаалж байна...
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
          Мэдээ мэдээлэл
        </h1>
        <p className="text-slate-400 text-sm">
          DaHUB — Дотоод аудитын мэдлэгийн сан
        </p>
      </motion.div>

      {/* Hero */}
      {hero && <HeroNews item={hero} onClick={() => handleClick(hero)} />}

      {/* Carousel */}
      {carousel.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-xl">Сүүлийн мэдээнүүд</h2>
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
          <h2 className="text-white font-bold text-xl">Бусад мэдээнүүд</h2>
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
          <p className="text-lg">Мэдээ байхгүй байна</p>
        </div>
      )}

      {/* Detail Dialog */}
      <AnimatePresence>
        {selectedNews && (
          <Dialog
            open={!!selectedNews}
            onOpenChange={() => setSelectedNews(null)}
          >
            <DialogContent
              className="max-w-3xl max-h-[90vh] p-0 overflow-hidden rounded-2xl"
              style={{
                background: "rgba(10,15,26,0.98)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              {selectedNews.imageUrl && (
                <div className="relative w-full h-56">
                  <Image
                    src={selectedNews.imageUrl}
                    alt={selectedNews.title}
                    fill
                    className="object-cover"
                    sizes="900px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,15,26,0.98)] to-transparent" />
                </div>
              )}

              <div className="px-6 pb-6 -mt-8 relative">
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const cat = getCat(selectedNews.category);
                      return (
                        <span
                          className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${cat.bg} ${cat.text}`}
                        >
                          {selectedNews.category}
                        </span>
                      );
                    })()}
                    <span className="text-slate-500 text-xs flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {selectedNews.views}
                    </span>
                  </div>

                  <DialogTitle className="text-white text-2xl font-black leading-tight">
                    {selectedNews.title}
                  </DialogTitle>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-200 text-sm font-semibold">
                        {selectedNews.authorName || "Дотоод Аудитын Газар"}
                      </p>
                      <p className="text-slate-500 text-xs flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {formatDate(selectedNews.createdAt)} &nbsp;•&nbsp;
                        <Clock className="w-3 h-3" />
                        {calcReadTime(selectedNews.content)} минут унших
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                <div
                  className="my-4 h-px"
                  style={{ background: "rgba(99,102,241,0.15)" }}
                />

                <ScrollArea className="max-h-[45vh] pr-2">
                  <div
                    className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: selectedNews.content }}
                  />
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
