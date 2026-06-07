"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  Clock,
  Loader2,
  X,
  ArrowLeft,
  Trophy,
  Upload,
  Trash2,
  MessageCircle,
  Send,
  BookOpen,
  Hash,
  Sparkles,
  Search,
  PenLine,
  Layers,
  ShieldCheck,
  Cpu,
  Laugh,
  Landmark,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import api, { newsReactionsApi, newsCommentsApi } from "@/lib/api";

interface TopPublisher {
  rank: number;
  authorId: string;
  authorName: string;
  newsCount: number;
  totalViews: number;
}

function getImageUrl(path?: string): string | null {
  if (!path) return null;
  return `/api${path}`;
}

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("dompurify") as typeof import("dompurify");
  const DOMPurify = mod.default ?? (mod as unknown as typeof mod.default);
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onmouseout",
      "onmouseenter",
      "onmouseleave",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
      "onkeydown",
      "onkeyup",
      "onkeypress",
      "onpaste",
      "ondrop",
      "ondragstart",
      "oncontextmenu",
      "onscroll",
      "oninput",
    ],
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

interface Comment {
  id: string;
  newsId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ─── Category config ───────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "Бүгд", label: "Бүгд", icon: Layers, color: "text-foreground" },
  { key: "Аудит", label: "Аудит", icon: ShieldCheck, color: "text-blue-500" },
  { key: "Технологи", label: "Технологи", icon: Cpu, color: "text-violet-500" },
  {
    key: "Сонин хачин",
    label: "Сонин хачин",
    icon: Laugh,
    color: "text-emerald-500",
  },
  {
    key: "Банк санхүү",
    label: "Банк санхүү",
    icon: Landmark,
    color: "text-amber-500",
  },
];

const CAT_COLORS: Record<
  string,
  { bg: string; text: string; ring: string; dot: string }
> = {
  Аудит: {
    bg: "bg-blue-100 dark:bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-400",
    ring: "ring-blue-300/80 dark:ring-blue-400/30",
    dot: "bg-blue-500",
  },
  Технологи: {
    bg: "bg-violet-100 dark:bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-400",
    ring: "ring-violet-300/80 dark:ring-violet-400/30",
    dot: "bg-violet-500",
  },
  "Сонин хачин": {
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-300/80 dark:ring-emerald-400/30",
    dot: "bg-emerald-500",
  },
  "Банк санхүү": {
    bg: "bg-amber-100 dark:bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-300/80 dark:ring-amber-400/30",
    dot: "bg-amber-500",
  },
};

function getCat(cat: string) {
  return (
    CAT_COLORS[cat] ?? {
      bg: "bg-muted",
      text: "text-muted-foreground",
      ring: "ring-border",
      dot: "bg-muted-foreground",
    }
  );
}

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
];
function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
function calcReadTime(content: string) {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}
function formatRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Дэнд";
  if (mins < 60) return `${mins}м`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ц`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}ө`;
  return new Date(d).toLocaleDateString("mn-MN", {
    month: "short",
    day: "numeric",
  });
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Post Card ─────────────────────────────────────────────────────────────
function PostCard({
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
  const authorName = item.authorName || t("newsDefaultAuthor") || "Ажилтан";
  const avatarGrad = getAvatarColor(authorName);
  const initials = getInitials(authorName);
  const excerpt = item.content.replace(/<[^>]*>/g, "").slice(0, 180);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.035 }}
      className="group"
    >
      <motion.div
        whileHover={{ y: -1 }}
        onClick={onClick}
        className="cursor-pointer rounded-2xl border border-border bg-card hover:border-violet-300/60 dark:hover:border-violet-700/50 hover:shadow-md transition-all duration-200 overflow-hidden"
      >
        {/* Image banner */}
        {getImageUrl(item.imageUrl) && (
          <div className="relative w-full h-44 overflow-hidden">
            <Image
              src={getImageUrl(item.imageUrl)!}
              alt={item.title}
              fill
              unoptimized
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              sizes="640px"
            />
            {/* Category pill over image */}
            <div className="absolute bottom-3 left-3">
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 backdrop-blur-sm ${cat.bg} ${cat.text} ${cat.ring}`}
              >
                {item.category}
              </span>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Author row */}
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-foreground text-sm font-semibold leading-none block truncate">
                {authorName}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {formatRelative(item.createdAt)}
              </span>
            </div>
            {!getImageUrl(item.imageUrl) && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 flex-shrink-0 ${cat.bg} ${cat.text} ${cat.ring}`}
              >
                {item.category}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <h3 className="text-foreground font-bold text-[15px] leading-snug line-clamp-2">
              {item.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
              {excerpt}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-border/60">
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Eye className="w-3 h-3" /> {item.views}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Clock className="w-3 h-3" /> {calcReadTime(item.content)}{" "}
              {t("minRead")}
            </span>
            <span className="ml-auto text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
              Унших <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}

// ─── Left Sidebar ───────────────────────────────────────────────────────────
function LeftSidebar({
  activeCategory,
  onCategory,
  newsCountByCategory,
  onCreateClick,
}: {
  activeCategory: string;
  onCategory: (c: string) => void;
  newsCountByCategory: Record<string, number>;
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 py-6 px-3">
      {/* Brand */}
      <div className="flex items-center gap-2 px-2 mb-4">
        <div>
          <p className="text-foreground text-sm font-black leading-tight">
            Мэдлэг
          </p>
          <p className="text-muted-foreground text-[10px] leading-tight">
            Мэдлэг хуваалцах
          </p>
        </div>
      </div>

      {/* Create button */}
      <button
        onClick={onCreateClick}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-600 dark:bg-violet-500/20 text-white dark:text-violet-300 dark:border dark:border-violet-400/30 hover:bg-violet-700 dark:hover:bg-violet-500/35 transition-colors text-sm font-semibold shadow-sm mb-2"
      >
        <PenLine className="w-4 h-4" />
        Нийтлэл бичих
      </button>

      {/* Category filters */}
      <div className="space-y-0.5">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5">
          Ангилал
        </p>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const count =
            c.key === "Бүгд"
              ? Object.values(newsCountByCategory).reduce((a, b) => a + b, 0)
              : (newsCountByCategory[c.key] ?? 0);
          const isActive = activeCategory === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onCategory(c.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-violet-600 dark:text-violet-400" : c.color}`}
              />
              <span className="flex-1 text-left">{c.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-violet-200 dark:bg-violet-400/20 text-violet-700 dark:text-violet-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Right Sidebar — Top Publishers ─────────────────────────────────────────
function RightSidebar({
  publishers,
  loading,
}: {
  publishers: TopPublisher[];
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 py-6 px-4">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-amber-500" />
        <p className="text-foreground text-sm font-bold">Шилдэг нийтлэгчид</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : publishers.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-6">
          Мэдээлэл байхгүй
        </p>
      ) : (
        <div className="space-y-1">
          {publishers.slice(0, 8).map((p) => {
            const medals = ["", "🥇", "🥈", "🥉"];
            const grad = getAvatarColor(p.authorName);
            return (
              <div
                key={p.authorId}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${p.rank <= 3 ? "bg-muted/60" : ""}`}
              >
                <span
                  className={`w-5 text-center text-xs flex-shrink-0 ${p.rank <= 3 ? "text-amber-500" : "text-muted-foreground"}`}
                >
                  {p.rank <= 3 ? medals[p.rank] : p.rank}
                </span>
                <div
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}
                >
                  {getInitials(p.authorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-semibold truncate">
                    {p.authorName}
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    {p.newsCount} нийтлэл
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-foreground text-xs font-bold">
                    {p.totalViews.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground text-[10px]">үзэлт</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ShineMedlegPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [news, setNews] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [activeCategory, setActiveCategory] = useState("Бүгд");
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    content: "",
    category: "Аудит",
    imageUrl: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [topPublishers, setTopPublishers] = useState<TopPublisher[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [reactions, setReactions] = useState<{
    counts: Record<string, number>;
    myReaction: string | null;
  } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchNews();
    fetchStats();
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const fetchNews = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/news?published=true");
      setNews(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await api.get("/news/stats/top-publishers");
      setTopPublishers(res.data);
    } catch {
      setTopPublishers([]);
    } finally {
      setStatsLoading(false);
    }
  };

  // Filtered news
  const filteredNews = news.filter((item) => {
    const matchCat =
      activeCategory === "Бүгд" || item.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.content
        .replace(/<[^>]*>/g, "")
        .toLowerCase()
        .includes(q);
    return matchCat && matchSearch;
  });

  // Count by category
  const newsCountByCategory: Record<string, number> = {};
  for (const item of news) {
    newsCountByCategory[item.category] =
      (newsCountByCategory[item.category] ?? 0) + 1;
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Max 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      setCreateForm((f) => ({ ...f, imageUrl: r }));
      setImagePreview(r);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.content.trim()) return;
    setCreateLoading(true);
    try {
      await api.post("/news", createForm);
      setShowCreate(false);
      setCreateForm({
        title: "",
        content: "",
        category: "Аудит",
        imageUrl: "",
      });
      setImagePreview(null);
      fetchNews();
    } catch {
      alert(t("newsCreateError"));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("newsDeleteConfirm"))) return;
    try {
      await api.delete(`/news/${id}`);
      if (selectedNews?.id === id) closeDetail();
      fetchNews();
    } catch {
      alert(t("newsDeleteError"));
    }
  };

  const handleClick = async (item: News) => {
    const sb = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sb + "px";
    document.body.style.overflow = "hidden";
    try {
      const [newsRes, reactRes, commentsRes] = await Promise.all([
        api.get(`/news/${item.id}`),
        newsReactionsApi.get(item.id),
        newsCommentsApi.get(item.id),
      ]);
      setSelectedNews(newsRes.data);
      setReactions(reactRes);
      setComments(commentsRes);
    } catch {
      setSelectedNews(item);
      setReactions(null);
      setComments([]);
    }
  };

  const closeDetail = useCallback(() => {
    setSelectedNews(null);
    setReactions(null);
    setComments([]);
    setCommentText("");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }, []);

  const handleReact = async (emoji: string) => {
    if (!selectedNews) return;
    try {
      if (reactions?.myReaction === emoji) {
        await newsReactionsApi.remove(selectedNews.id);
        setReactions((r) =>
          r
            ? {
                ...r,
                counts: {
                  ...r.counts,
                  [emoji]: Math.max(0, (r.counts[emoji] ?? 1) - 1),
                },
                myReaction: null,
              }
            : r,
        );
      } else {
        const oldEmoji = reactions?.myReaction;
        await newsReactionsApi.react(selectedNews.id, emoji);
        setReactions((r) => {
          if (!r) return r;
          const c = { ...r.counts };
          if (oldEmoji) c[oldEmoji] = Math.max(0, (c[oldEmoji] ?? 1) - 1);
          c[emoji] = (c[emoji] ?? 0) + 1;
          return { counts: c, myReaction: emoji };
        });
      }
    } catch {
      /* silent */
    }
  };

  const handleAddComment = async () => {
    if (!selectedNews || !commentText.trim() || commentPosting) return;
    setCommentPosting(true);
    try {
      await newsCommentsApi.add(selectedNews.id, commentText);
      setCommentText("");
      const updated = await newsCommentsApi.get(selectedNews.id);
      setComments(updated);
    } catch {
      alert(t("newsCommentError"));
    } finally {
      setCommentPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedNews) return;
    try {
      await newsCommentsApi.delete(selectedNews.id, commentId);
      setComments((c) => c.filter((x) => x.id !== commentId));
    } catch {
      /* silent */
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)]">
      {/* ── Left Sidebar ── */}
      <aside className="hidden lg:block w-[220px] xl:w-[240px] flex-shrink-0 border-r border-border sticky top-0 self-start">
        <LeftSidebar
          activeCategory={activeCategory}
          onCategory={setActiveCategory}
          newsCountByCategory={newsCountByCategory}
          onCreateClick={() => setShowCreate(true)}
        />
      </aside>

      {/* ── Center Feed ── */}
      <main className="flex-1 min-w-0 px-4 md:px-6 xl:px-8 py-6">
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-5 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-foreground text-lg font-black">Мэдлэг</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <PenLine className="w-3.5 h-3.5" /> Нийтлэх
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Нийтлэл хайх..."
            className="w-full max-w-xl pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />
        </div>

        {/* Mobile category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 lg:hidden scrollbar-none">
          {CATEGORIES.map((c) => {
            const isActive = activeCategory === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Feed */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Hash className="w-7 h-7 opacity-40" />
            </div>
            <p className="font-semibold text-sm">{t("noNews")}</p>
            <p className="text-xs mt-1 opacity-60">
              Эхний нийтлэлийг та бичиж болно
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 max-w-4xl">
            {filteredNews.map((item, i) => (
              <PostCard
                key={item.id}
                item={item}
                index={i}
                onClick={() => handleClick(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Right Sidebar ── */}
      <aside className="hidden xl:block w-[260px] flex-shrink-0 border-l border-border sticky top-0 self-start">
        <RightSidebar publishers={topPublishers} loading={statsLoading} />
      </aside>

      {/* ── Create Modal ── */}
      {mounted &&
        showCreate &&
        createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreate(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg rounded-2xl overflow-hidden bg-card border border-border shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-foreground font-bold text-base flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-violet-500" />
                  Шинэ нийтлэл
                </h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                    Гарчиг
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, title: e.target.value }))
                    }
                    className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                    placeholder="Нийтлэлийн гарчиг..."
                  />
                </div>
                <div>
                  <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                    Ангилал
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  >
                    <option value="Аудит">Аудит</option>
                    <option value="Технологи">Технологи</option>
                    <option value="Сонин хачин">Сонин хачин</option>
                    <option value="Банк санхүү">Банк санхүү</option>
                  </select>
                </div>
                <div>
                  <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                    Зураг
                  </label>
                  {imagePreview ? (
                    <div className="relative w-full h-40 rounded-xl overflow-hidden mb-2">
                      <Image
                        src={imagePreview}
                        alt="preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        onClick={() => {
                          setImagePreview(null);
                          setCreateForm((f) => ({ ...f, imageUrl: "" }));
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 text-foreground flex items-center justify-center hover:bg-background transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-xl cursor-pointer border-2 border-dashed border-border hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs">
                        Зураг оруулах (2MB хүртэл)
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                    Агуулга
                  </label>
                  <textarea
                    value={createForm.content}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, content: e.target.value }))
                    }
                    rows={6}
                    className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                    placeholder="Нийтлэлийн агуулга..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 flex justify-end gap-2 border-t border-border bg-muted/30">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Болих
                </button>
                <button
                  onClick={handleCreate}
                  disabled={
                    createLoading ||
                    !createForm.title.trim() ||
                    !createForm.content.trim()
                  }
                  className="px-4 py-2 rounded-xl bg-violet-600 dark:bg-violet-500/20 text-white dark:text-violet-300 dark:border dark:border-violet-400/30 text-xs font-semibold hover:bg-violet-700 dark:hover:bg-violet-500/35 transition-colors disabled:opacity-40 flex items-center gap-2 shadow-sm"
                >
                  {createLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Нийтлэх
                </button>
              </div>
            </motion.div>
          </motion.div>,
          document.body,
        )}

      {/* ── Detail Modal ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selectedNews && (
              <motion.div
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm"
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeDetail();
                }}
              >
                <motion.div
                  initial={{ scale: 0.94, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.96, y: 12 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className="relative w-full h-full md:w-[92vw] md:h-[88vh] md:max-w-6xl flex overflow-hidden md:rounded-2xl shadow-2xl"
                >
                  {/* ── LEFT — Cover ── */}
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.32, delay: 0.06 }}
                    className="relative hidden md:flex w-[42%] flex-shrink-0 flex-col overflow-hidden"
                  >
                    {getImageUrl(selectedNews.imageUrl) ? (
                      <>
                        <Image
                          src={getImageUrl(selectedNews.imageUrl)!}
                          alt={selectedNews.title}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="45vw"
                          priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                        <div className="absolute top-0 right-0 bottom-0 w-5 bg-gradient-to-l from-black/40 to-transparent" />
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100 dark:from-violet-950 dark:via-indigo-950 dark:to-slate-900" />
                        <div
                          className="absolute inset-0 opacity-20"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at 30% 70%, rgb(139,92,246) 0%, transparent 60%)",
                          }}
                        />
                        <div className="absolute top-0 right-0 bottom-0 w-5 bg-gradient-to-l from-black/10 to-transparent" />
                      </>
                    )}

                    {/* Brand */}
                    <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                      <BookOpen className="w-4 h-4 text-violet-400" />
                      <span className="text-violet-600/60 dark:text-violet-300/50 text-xs font-mono uppercase tracking-[0.2em]">
                        Мэдлэг
                      </span>
                    </div>

                    {/* Author */}
                    <div className="absolute top-16 left-6 flex items-center gap-2.5 z-10">
                      {(() => {
                        const name = selectedNews.authorName || "Ажилтан";
                        const grad = getAvatarColor(name);
                        const hasImg = !!getImageUrl(selectedNews.imageUrl);
                        return (
                          <>
                            <div
                              className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20`}
                            >
                              {getInitials(name)}
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold ${hasImg ? "text-white/90" : "text-foreground"}`}
                              >
                                {name}
                              </p>
                              <p
                                className={`text-[10px] ${hasImg ? "text-white/50" : "text-muted-foreground"}`}
                              >
                                {formatDate(selectedNews.createdAt)}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Bottom: category + title */}
                    {(() => {
                      const cat = getCat(selectedNews.category);
                      const hasImg = !!getImageUrl(selectedNews.imageUrl);
                      return (
                        <div className="absolute bottom-0 left-0 right-0 p-8 z-10 space-y-3">
                          <span
                            className={`inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ring-1 ${cat.bg} ${cat.text} ${cat.ring}`}
                          >
                            {selectedNews.category}
                          </span>
                          <h1
                            className={`text-2xl lg:text-3xl font-black leading-tight ${hasImg ? "text-white" : "text-foreground"}`}
                          >
                            {selectedNews.title}
                          </h1>
                          <div
                            className={`flex items-center gap-3 text-xs ${hasImg ? "text-white/50" : "text-muted-foreground"}`}
                          >
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {selectedNews.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {calcReadTime(selectedNews.content)} мин
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>

                  {/* ── RIGHT — Content ── */}
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.32, delay: 0.1 }}
                    className="flex-1 flex flex-col min-w-0 overflow-hidden bg-card border-l border-border"
                  >
                    {/* Top bar */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-5 h-12 border-b border-border bg-card">
                      <button
                        onClick={closeDetail}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-medium">
                          Буцах
                        </span>
                      </button>
                      <div className="flex-1" />
                      {user && selectedNews.authorId === user.id && (
                        <button
                          onClick={() => handleDelete(selectedNews.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={closeDetail}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {/* Mobile title */}
                      <div className="md:hidden px-5 pt-5 pb-4 border-b border-border space-y-2">
                        {(() => {
                          const cat = getCat(selectedNews.category);
                          return (
                            <span
                              className={`inline-block text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${cat.bg} ${cat.text} ${cat.ring}`}
                            >
                              {selectedNews.category}
                            </span>
                          );
                        })()}
                        <h2 className="text-foreground text-xl font-black leading-tight">
                          {selectedNews.title}
                        </h2>
                      </div>

                      {/* Article */}
                      <div className="px-6 sm:px-10 py-7 pb-4">
                        <div
                          className="prose prose-sm sm:prose-base max-w-none leading-relaxed
                          text-foreground/80
                          prose-headings:text-foreground prose-headings:font-bold
                          prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
                          prose-strong:text-foreground
                          prose-code:text-violet-600 dark:prose-code:text-violet-400 prose-code:bg-muted prose-code:px-1 prose-code:rounded
                          prose-pre:bg-muted prose-pre:border prose-pre:border-border
                          prose-blockquote:border-l-violet-500 prose-blockquote:text-muted-foreground
                          prose-img:rounded-xl prose-img:mx-auto
                          prose-table:text-sm prose-th:text-foreground/70 prose-td:text-foreground/70"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(selectedNews.content),
                          }}
                        />
                      </div>

                      {/* Reactions */}
                      <div className="px-6 sm:px-10 py-4 border-t border-border">
                        <div className="flex items-center gap-2 flex-wrap">
                          {["👍", "❤️", "😮", "💡", "🔥"].map((emoji) => {
                            const count = reactions?.counts[emoji] ?? 0;
                            const active = reactions?.myReaction === emoji;
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReact(emoji)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border font-medium ${
                                  active
                                    ? "bg-violet-100 dark:bg-violet-500/25 border-violet-400 dark:border-violet-400/50 text-violet-700 dark:text-violet-300 shadow-sm"
                                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:border-violet-300 dark:hover:border-violet-600"
                                }`}
                              >
                                <span>{emoji}</span>
                                {count > 0 && (
                                  <span className="text-xs font-semibold">
                                    {count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Comments */}
                      <div className="px-6 sm:px-10 pb-8 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 mb-4">
                          <MessageCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground/70 text-sm font-semibold">
                            {comments.length > 0
                              ? `${comments.length} сэтгэгдэл`
                              : "Сэтгэгдэл"}
                          </span>
                        </div>

                        {/* Input */}
                        <div className="flex gap-2 mb-5">
                          <input
                            ref={commentInputRef}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment();
                              }
                            }}
                            placeholder={t("newsCommentPlaceholder")}
                            maxLength={1000}
                            className="flex-1 rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                          />
                          <button
                            onClick={handleAddComment}
                            disabled={commentPosting || !commentText.trim()}
                            className="w-9 h-9 rounded-xl bg-violet-600 dark:bg-violet-500/20 text-white dark:text-violet-300 dark:border dark:border-violet-400/25 flex items-center justify-center hover:bg-violet-700 dark:hover:bg-violet-500/35 transition-colors disabled:opacity-40 shadow-sm"
                          >
                            {commentPosting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* List */}
                        <div className="space-y-4">
                          {comments.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">
                              {t("newsCommentEmpty")}
                            </p>
                          ) : (
                            comments.map((c) => {
                              const grad = getAvatarColor(c.authorName);
                              return (
                                <div key={c.id} className="flex gap-3 group">
                                  <div
                                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5`}
                                  >
                                    {getInitials(c.authorName)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                      <span className="text-foreground text-xs font-semibold">
                                        {c.authorName}
                                      </span>
                                      <span className="text-muted-foreground text-[10px]">
                                        {formatRelative(c.createdAt)}
                                      </span>
                                      {user?.id === c.authorId && (
                                        <button
                                          onClick={() =>
                                            handleDeleteComment(c.id)
                                          }
                                          className="opacity-0 group-hover:opacity-100 ml-auto text-muted-foreground hover:text-red-500 transition-all"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-foreground/75 text-sm leading-relaxed">
                                      {c.content}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
