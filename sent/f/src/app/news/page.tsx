"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Loader2,
  ArrowRight,
  X,
  ArrowLeft,
  Plus,
  BarChart3,
  Trophy,
  Upload,
  Trash2,
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
      bg: "bg-muted/50",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground/70",
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
            <span className="text-white/50 text-xs">·</span>
            <span className="text-white/50 text-xs">
              {formatDate(item.createdAt)}
            </span>
          </div>

          <p
            className="text-xs font-bold tracking-[0.3em] uppercase text-white/70"
            style={{ fontFamily: "monospace" }}
          >
            {t("internalAuditLabel")}
          </p>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
            {item.title}
          </h1>

          <div className="flex items-center gap-1.5 text-white/50 text-sm">
            <Eye className="w-4 h-4" />
            <span>{item.views}</span>
          </div>
        </div>

        {/* Read more — bottom-right pill button */}
        <motion.div
          className="absolute bottom-6 right-6 md:bottom-8 md:right-8"
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm px-3.5 py-2 rounded-full transition-colors group-hover:border-white/40">
            {t("readMore")}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
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
          <User className="w-4 h-4 text-foreground" />
        </div>
        <div className={isRight ? "text-right" : "text-left"}>
          <p className="text-foreground/70 text-xs font-semibold whitespace-nowrap">
            {item.authorName || t("newsDefaultAuthor")}
          </p>
          <p className="text-muted-foreground/70 text-xs whitespace-nowrap">
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
            <h3 className="text-foreground font-bold text-base leading-snug line-clamp-2">
              {item.title}
            </h3>
            <div className="flex items-center gap-3 text-muted-foreground/70 text-xs">
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
  const { user } = useAuth();
  const [news, setNews] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", content: "", category: "Ерөнхий", imageUrl: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Stats modal state
  const [showStats, setShowStats] = useState(false);
  const [topPublishers, setTopPublishers] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchNews();
    return () => { document.body.style.overflow = ""; };
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

  // --- Create news ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Max 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCreateForm((f) => ({ ...f, imageUrl: result }));
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.content.trim()) return;
    setCreateLoading(true);
    try {
      await api.post("/news", createForm);
      setShowCreate(false);
      setCreateForm({ title: "", content: "", category: "Ерөнхий", imageUrl: "" });
      setImagePreview(null);
      fetchNews();
    } catch (err) {
      console.error("Create news error:", err);
      alert(t("newsCreateError"));
    } finally {
      setCreateLoading(false);
    }
  };

  // --- Stats ---
  const openStats = async () => {
    setShowStats(true);
    setStatsLoading(true);
    try {
      const res = await api.get("/news/stats/top-publishers");
      setTopPublishers(res.data);
    } catch { setTopPublishers([]); }
    finally { setStatsLoading(false); }
  };

  // --- Delete own news ---
  const handleDelete = async (id: string) => {
    if (!confirm(t("newsDeleteConfirm"))) return;
    try {
      await api.delete(`/news/${id}`);
      if (selectedNews?.id === id) closeDetail();
      fetchNews();
    } catch (err) {
      console.error("Delete news error:", err);
      alert(t("newsDeleteError"));
    }
  };

  const handleClick = async (item: News) => {
    try {
      const response = await api.get(`/news/${item.id}`);
      setSelectedNews(response.data);
    } catch {
      setSelectedNews(item);
    }
    // Lock body scroll without layout shift (compensate scrollbar width)
    const sb = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sb + "px";
    document.body.style.overflow = "hidden";
  };

  const closeDetail = () => {
    setSelectedNews(null);
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
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
          <p className="text-muted-foreground text-sm animate-pulse">
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
        <h1 className="text-3xl font-black text-foreground tracking-tight">
          {t("newsTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("newsSubtitle")}
        </p>
      </motion.div>

      {/* Hero */}
      {hero && <HeroNews item={hero} onClick={() => handleClick(hero)} />}
      {/* Carousel */}
      {carousel.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground font-bold text-xl">{t("latestNews")}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => scroll("left")}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                <ChevronLeft className="w-4 h-4 text-foreground/70" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                <ChevronRight className="w-4 h-4 text-foreground/70" />
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
          <h2 className="text-foreground font-bold text-xl">{t("otherNews")}</h2>
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
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/70">
          <p className="text-lg">{t("noNews")}</p>
        </div>
      )}

      {/* ─── Floating Action Buttons (bottom-right) ─── */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-3">
        {/* Stat button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={openStats}
          className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors"
          style={{ background: "rgba(99,102,241,0.8)", backdropFilter: "blur(8px)" }}
          title={t("newsStatsTitle")}
        >
          <BarChart3 className="w-5 h-5 text-white" />
        </motion.button>
        {/* Add button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreate(true)}
          className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-colors"
          style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}
          title={t("newsCreateTitle")}
        >
          <Plus className="w-7 h-7 text-white" />
        </motion.button>
      </div>

      {/* ─── Create News Modal ─── */}
      {mounted && showCreate && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: "rgba(15,18,35,0.97)", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
              <h2 className="text-white font-bold text-lg">{t("newsCreateTitle")}</h2>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="text-white/60 text-xs font-semibold block mb-1.5">{t("newsFormTitle")}</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
                  placeholder={t("newsFormTitle")}
                />
              </div>
              {/* Category */}
              <div>
                <label className="text-white/60 text-xs font-semibold block mb-1.5">{t("newsFormCategory")}</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
                >
                  <option value="Ерөнхий">Ерөнхий</option>
                  <option value="Мэдэгдэл">Мэдэгдэл</option>
                  <option value="Үйл явдал">Үйл явдал</option>
                  <option value="Танилцуулга">Танилцуулга</option>
                </select>
              </div>
              {/* Image upload */}
              <div>
                <label className="text-white/60 text-xs font-semibold block mb-1.5">{t("newsFormImage")}</label>
                {imagePreview ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden mb-2">
                    <Image src={imagePreview} alt="preview" fill className="object-cover" unoptimized />
                    <button
                      onClick={() => { setImagePreview(null); setCreateForm((f) => ({ ...f, imageUrl: "" })); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
                    style={{ border: "1px dashed rgba(99,102,241,0.3)" }}
                  >
                    <Upload className="w-6 h-6 text-white/30" />
                    <span className="text-white/30 text-xs">{t("newsFormImageHint")}</span>
                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
              {/* Content */}
              <div>
                <label className="text-white/60 text-xs font-semibold block mb-1.5">{t("newsFormContent")}</label>
                <textarea
                  value={createForm.content}
                  onChange={(e) => setCreateForm((f) => ({ ...f, content: e.target.value }))}
                  rows={6}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
                  placeholder={t("newsFormContent")}
                />
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 flex justify-end" style={{ borderTop: "1px solid rgba(99,102,241,0.15)" }}>
              <button
                onClick={handleCreate}
                disabled={createLoading || !createForm.title.trim() || !createForm.content.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
              >
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("newsCreateBtn")}
              </button>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      {/* ─── Stats / Leaderboard Modal ─── */}
      {mounted && showStats && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowStats(false); }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: "rgba(15,18,35,0.97)", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-white font-bold text-lg">{t("newsStatsTitle")}</h2>
              </div>
              <button onClick={() => setShowStats(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {statsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              ) : topPublishers.length === 0 ? (
                <p className="text-white/40 text-center py-10 text-sm">{t("newsStatsEmpty")}</p>
              ) : (
                <div className="space-y-2">
                  {topPublishers.map((p: any) => {
                    const isTop3 = p.rank <= 3;
                    const medals = ["", "🥇", "🥈", "🥉"];
                    return (
                      <div
                        key={p.authorId}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                        style={{
                          background: isTop3 ? "rgba(99,102,241,0.1)" : "transparent",
                          border: isTop3 ? "1px solid rgba(99,102,241,0.15)" : "1px solid transparent",
                        }}
                      >
                        <span className="w-8 text-center text-sm font-bold" style={{ color: isTop3 ? "#fbbf24" : "rgba(255,255,255,0.3)" }}>
                          {isTop3 ? medals[p.rank] : p.rank}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{p.authorName}</p>
                          <p className="text-white/40 text-xs">{p.newsCount} {t("newsStatsCount").toLowerCase()}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white/80 text-sm font-bold">{p.totalViews.toLocaleString()}</p>
                          <p className="text-white/30 text-xs">{t("newsStatsViews").toLowerCase()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      {/* Detail — book/magazine spread (portal to body, AnimatePresence inside) */}
      {mounted && createPortal(
        <AnimatePresence>
          {selectedNews && (
            <motion.div
              key="news-detail"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] flex"
            style={{ background: "rgba(4,6,15,1)" }}
          >
            {/* ─── LEFT PAGE — Cover image + title ───────────────── */}
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
              className="relative hidden md:block w-[44%] flex-shrink-0 h-full overflow-hidden"
              style={{ borderRight: "1px solid rgba(99,102,241,0.22)" }}
            >
              {/* Background */}
              {getImageUrl(selectedNews.imageUrl) ? (
                <Image
                  src={getImageUrl(selectedNews.imageUrl)!}
                  alt={selectedNews.title}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="50vw"
                  priority
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-slate-900" />
              )}
              {/* Overlays — only bottom gradient for text readability */}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent" />

              {/* Brand label */}
              <div className="absolute top-6 left-7 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-70" />
                <span className="text-white/25 text-xs font-mono uppercase tracking-widest">DaHUB News</span>
              </div>

              {/* Bottom: category + title */}
              <div className="absolute bottom-0 left-0 right-0 p-8 space-y-3">
                {(() => {
                  const cat = getCat(selectedNews.category);
                  return (
                    <span className={`inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${cat.bg} ${cat.text}`}>
                      {selectedNews.category}
                    </span>
                  );
                })()}
                <h1 className="text-white text-2xl lg:text-3xl font-black leading-tight">
                  {selectedNews.title}
                </h1>
              </div>
            </motion.div>

            {/* ─── RIGHT PAGE — Article content ──────────────── */}
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
              className="flex-1 flex flex-col h-full min-w-0"
            >
              {/* Nav bar */}
              <div
                className="flex-shrink-0 flex items-center gap-3 px-6 h-12 border-b"
                style={{ borderColor: "rgba(99,102,241,0.18)", background: "rgba(4,6,15,0.95)" }}
              >
                <button
                  onClick={closeDetail}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t("back") || "Буцах"}</span>
                </button>
                <div className="flex-1" />
                <span className="text-white/20 text-xs hidden sm:block">
                  {calcReadTime(selectedNews.content)} {t("minuteRead")}
                </span>
                {/* Delete button — only if user owns this news */}
                {user && selectedNews.authorId === user.id && (
                  <>
                    <div className="w-px h-4 mx-2" style={{ background: "rgba(99,102,241,0.2)" }} />
                    <button
                      onClick={() => handleDelete(selectedNews.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t("newsDelete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <div className="w-px h-4 mx-2" style={{ background: "rgba(99,102,241,0.2)" }} />
                <button
                  onClick={closeDetail}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 min-h-0 overflow-y-auto">



                {/* Article body */}
                <div className="max-w-2xl mx-auto px-6 sm:px-10 py-8 pb-16">

                  {/* Desktop: article header on right page */}
                  <div className="hidden md:block mb-8 pb-8" style={{ borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      {(() => {
                        const cat = getCat(selectedNews.category);
                        return <span className={`inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${cat.bg} ${cat.text}`}>{selectedNews.category}</span>;
                      })()}
                      <span className="text-white/30 text-xs flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {selectedNews.views}
                      </span>
                    </div>
                    <h2 className="text-white/90 text-xl font-bold leading-snug">{selectedNews.title}</h2>
                  </div>

                  {/* Full article content */}
                  <div
                    className="prose prose-invert prose-sm sm:prose-base max-w-none text-white/70 leading-relaxed
                      prose-headings:text-white prose-headings:font-bold
                      prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                      prose-strong:text-white/90
                      prose-code:text-purple-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded
                      prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
                      prose-blockquote:border-l-purple-500 prose-blockquote:text-white/50
                      prose-img:rounded-xl prose-img:mx-auto prose-img:w-full
                      prose-table:text-sm prose-th:text-white/80 prose-td:text-white/60"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedNews.content) }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
