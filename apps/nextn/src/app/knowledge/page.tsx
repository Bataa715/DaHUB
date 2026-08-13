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
  Trophy,
  Upload,
  Sparkles,
  PenLine,
  Layers,
  ShieldCheck,
  Cpu,
  Laugh,
  Landmark,
  ChevronRight,
  TrendingUp,
  Hash,
} from "lucide-react";
import {
  knowledgeApi,
  knowledgeReactionsApi,
  knowledgeCommentsApi,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { KnowledgeCoverImage } from "./_components/KnowledgeCoverImage";
import { KnowledgeBookReader } from "./_components/KnowledgeBookReader";
import { QuizSection } from "./_components/QuizSection";
import {
  fileToKnowledgeDataUrl,
  KNOWLEDGE_MAX_IMAGES,
} from "@/lib/knowledge-image";

interface TopPublisher {
  rank: number;
  authorId: string;
  authorName: string;
  newsCount: number;
  totalViews: number;
}

function hasKnowledgeImage(path?: string): boolean {
  return !!knowledgeApi.parseImageId(path);
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
  imageUrls?: string[];
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

// Тусгай "ангилал" — QUIZ хэсэг рүү шилжих товч. Бодит контент ангилал биш
// тул CATEGORIES массивт (пост үүсгэх сонголтод) ордоггүй, зөвхөн sidebar/
// mobile pill жагсаалтад нэмэгддэг.
const QUIZ_KEY = "__quiz__";

// ─── Category config ───────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "Бүгд", labelKey: "knowledgeCatAll" as const, icon: Layers, color: "text-foreground" },
  { key: "Аудит", labelKey: "knowledgeCatAudit" as const, icon: ShieldCheck, color: "text-blue-500" },
  { key: "Технологи", labelKey: "knowledgeCatTech" as const, icon: Cpu, color: "text-violet-500" },
  {
    key: "Сонин хачин",
    labelKey: "knowledgeCatFun" as const,
    icon: Laugh,
    color: "text-emerald-500",
  },
  {
    key: "Банк санхүү",
    labelKey: "knowledgeCatFinance" as const,
    icon: Landmark,
    color: "text-amber-500",
  },
  {
    key: "Risk",
    label: "Risk",
    icon: TrendingUp,
    color: "text-rose-500",
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
  Risk: {
    bg: "bg-rose-100 dark:bg-rose-500/15",
    text: "text-rose-700 dark:text-rose-400",
    ring: "ring-rose-300/80 dark:ring-rose-400/30",
    dot: "bg-rose-500",
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
function formatRelative(d: string, justNowLabel = "Яг одоо") {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return justNowLabel;
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
  const authorName =
    item.authorName || t("newsDefaultAuthor") || t("knowledgePageEmployeeFallback");
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
        whileHover={{ y: -2 }}
        onClick={onClick}
        className="cursor-pointer rounded-2xl border border-border bg-card hover:border-violet-300/60 dark:hover:border-violet-700/50 shadow-premium hover:shadow-premium-lg ring-hairline transition-all duration-300 overflow-hidden"
      >
        {/* Image banner */}
        {hasKnowledgeImage(item.imageUrl) && (
          <div className="relative w-full h-44 overflow-hidden bg-muted">
            <KnowledgeCoverImage
              path={item.imageUrl}
              alt={item.title}
              fill
              className="transition-transform duration-500 group-hover:scale-[1.02]"
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
            </div>
            {!hasKnowledgeImage(item.imageUrl) && (
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
              {t("knowledgeRead")} <ChevronRight className="w-3 h-3" />
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
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2 py-6 px-3">
      {/* Create button */}
      <button
        onClick={onCreateClick}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-600 dark:bg-violet-500/20 text-white dark:text-violet-300 dark:border dark:border-violet-400/30 hover:bg-violet-700 dark:hover:bg-violet-500/35 transition-colors text-sm font-semibold shadow-sm mb-2"
      >
        <PenLine className="w-4 h-4" />
        {t("knowledgeShare")}
      </button>

      {/* Category filters */}
      <div className="space-y-0.5">
        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1.5">
          {t("knowledgeCategory")}
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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-violet-600 dark:text-violet-400" : c.color}`}
              />
              <span className="flex-1 text-left font-bold">{t(c.labelKey ?? "knowledgeCatAll")}</span>
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

        {/* QUIZ — feed ангиллуудаас тусад нь, доор тодруулж харуулна */}
        <div className="pt-1.5 mt-1 border-t border-border/60">
          <button
            onClick={() => onCategory(QUIZ_KEY)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold transition-all mt-1.5 ${
              activeCategory === QUIZ_KEY
                ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Trophy
              className={`w-4 h-4 flex-shrink-0 ${activeCategory === QUIZ_KEY ? "text-violet-600 dark:text-violet-400" : "text-amber-500"}`}
            />
            <span className="flex-1 text-left font-bold">{t("knowledgeQuizTab")}</span>
          </button>
        </div>
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
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-4 py-6 px-4">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-amber-500" />
        <p className="text-foreground text-sm font-bold">{t("knowledgePublisher")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : publishers.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-6">
          {t("knowledgeEmpty")}
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
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-foreground text-xs font-bold">
                    {p.totalViews.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground text-[10px]">{t("knowledgeViews")}</p>
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
  const { toast } = useToast();
  const [news, setNews] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [activeCategory, setActiveCategory] = useState("Бүгд");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    content: "",
    category: "Аудит",
    imageUrls: [] as string[],
  });
  const [createLoading, setCreateLoading] = useState(false);

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
      const data = await knowledgeApi.listPublished();
      setNews(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const data = await knowledgeApi.getTopPublishers();
      setTopPublishers(data);
    } catch {
      setTopPublishers([]);
    } finally {
      setStatsLoading(false);
    }
  };

  // Filtered news
  const filteredNews = news.filter((item) => {
    return activeCategory === "Бүгд" || item.category === activeCategory;
  });

  // Count by category
  const newsCountByCategory: Record<string, number> = {};
  for (const item of news) {
    newsCountByCategory[item.category] =
      (newsCountByCategory[item.category] ?? 0) + 1;
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    const remaining = KNOWLEDGE_MAX_IMAGES - createForm.imageUrls.length;
    if (remaining <= 0) {
      toast({
        title: t("error"),
        description: t("knowledgeMaxImages"),
        variant: "destructive",
      });
      return;
    }

    const picked = files.slice(0, remaining);
    const next: string[] = [];
    for (const file of picked) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: t("error"),
          description: t("knowledgeImageTooBig"),
          variant: "destructive",
        });
        continue;
      }
      try {
        next.push(await fileToKnowledgeDataUrl(file));
      } catch {
        toast({
          title: t("error"),
          description: t("newsCreateError"),
          variant: "destructive",
        });
      }
    }
    if (next.length) {
      setCreateForm((f) => ({
        ...f,
        imageUrls: [...f.imageUrls, ...next].slice(0, KNOWLEDGE_MAX_IMAGES),
      }));
    }
  };

  const removeCreateImage = (idx: number) => {
    setCreateForm((f) => ({
      ...f,
      imageUrls: f.imageUrls.filter((_, i) => i !== idx),
    }));
  };

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.content.trim()) return;
    setCreateLoading(true);
    try {
      await knowledgeApi.create({
        title: createForm.title,
        content: createForm.content,
        category: createForm.category,
        imageUrls: createForm.imageUrls,
      });
      setShowCreate(false);
      setCreateForm({
        title: "",
        content: "",
        category: "Аудит",
        imageUrls: [],
      });
      fetchNews();
    } catch {
      toast({
        title: t("error"),
        description: t("newsCreateError"),
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("newsDeleteConfirm"))) return;
    try {
      await knowledgeApi.delete(id);
      if (selectedNews?.id === id) closeDetail();
      fetchNews();
    } catch {
      toast({
        title: t("error"),
        description: t("newsDeleteError"),
        variant: "destructive",
      });
    }
  };

  const handleClick = async (item: News) => {
    const sb = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sb + "px";
    document.body.style.overflow = "hidden";
    try {
      const [newsRes, reactRes, commentsRes] = await Promise.all([
        knowledgeApi.getOne(item.id),
        knowledgeReactionsApi.get(item.id),
        knowledgeCommentsApi.get(item.id),
      ]);
      setSelectedNews(newsRes);
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

  useEffect(() => {
    if (!selectedNews) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNews, closeDetail]);

  const handleReact = async (emoji: string) => {
    if (!selectedNews) return;
    try {
      if (reactions?.myReaction === emoji) {
        await knowledgeReactionsApi.remove(selectedNews.id);
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
        await knowledgeReactionsApi.react(selectedNews.id, emoji);
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
      await knowledgeCommentsApi.add(selectedNews.id, commentText);
      setCommentText("");
      const updated = await knowledgeCommentsApi.get(selectedNews.id);
      setComments(updated);
    } catch {
      toast({
        title: t("error"),
        description: t("newsCommentError"),
        variant: "destructive",
      });
    } finally {
      setCommentPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedNews) return;
    try {
      await knowledgeCommentsApi.delete(selectedNews.id, commentId);
      setComments((c) => c.filter((x) => x.id !== commentId));
    } catch {
      /* silent */
    }
  };

  const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: (i * 37 + 11) % 100,
    top: (i * 53 + 7) % 100,
    size: (i % 3) + 1.5,
    duration: 3 + (i % 5),
    delay: (i % 6) * 0.5,
    color:
      i % 3 === 0 ? "59,130,246" : i % 3 === 1 ? "168,85,247" : "16,185,129",
  }));

  return (
    <div className="relative flex min-h-[calc(100vh-120px)] overflow-hidden">
      {/* ── Арын цэгүүд ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              backgroundColor: `rgba(${p.color},0.35)`,
            }}
            animate={{ y: [0, -18, 0], opacity: [0.25, 0.6, 0.25] }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ── Left Sidebar ── */}
      <aside className="relative z-10 hidden lg:block w-[220px] xl:w-[240px] flex-shrink-0 border-r border-border sticky top-0 self-start">
        <LeftSidebar
          activeCategory={activeCategory}
          onCategory={setActiveCategory}
          newsCountByCategory={newsCountByCategory}
          onCreateClick={() => setShowCreate(true)}
        />
      </aside>

      {/* ── Center Feed ── */}
      <main className="relative z-10 flex-1 min-w-0 px-4 md:px-6 xl:px-8 py-6">
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-5 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-foreground text-lg font-black">{t("knowledgeTitle")}</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <PenLine className="w-3.5 h-3.5" /> {t("knowledgeShare")}
          </button>
        </div>

        {/* Mobile category pills — QUIZ нь бусад ангиллын хамт, тусад нь тодруулж харагдана */}
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
                {t(c.labelKey ?? "knowledgeCatAll")}
              </button>
            );
          })}
          <button
            onClick={() => setActiveCategory(QUIZ_KEY)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeCategory === QUIZ_KEY
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="w-3 h-3" /> {t("knowledgeQuizTab")}
          </button>
        </div>

        {activeCategory === QUIZ_KEY ? (
          <QuizSection />
        ) : isLoading ? (
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
              {t("knowledgeFirstPost")}
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
      {activeCategory !== QUIZ_KEY && (
        <aside className="relative z-10 hidden xl:block w-[260px] flex-shrink-0 border-l border-border sticky top-0 self-start">
          <RightSidebar publishers={topPublishers} loading={statsLoading} />
        </aside>
      )}

      {/* ── Create Modal ── */}
      {mounted &&
        showCreate &&
        createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 landscape:p-2 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreate(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl sm:max-w-3xl md:w-[92vw] md:max-w-6xl md:h-[88vh] landscape:max-w-[94vw] landscape:h-[92vh] landscape:max-h-[92vh] max-h-[95vh] rounded-2xl overflow-hidden bg-card border border-border shadow-premium-xl ring-hairline flex flex-col"
            >
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-border flex-shrink-0">
                <h2 className="text-foreground font-bold text-base flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-violet-500" />
                  {t("knowledgeShare")}
                </h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <div className="h-full px-5 sm:px-6 py-4 sm:py-5 grid grid-cols-1 md:grid-cols-[minmax(0,340px)_1fr] landscape:grid-cols-[minmax(0,320px)_1fr] gap-4 sm:gap-5 overflow-y-auto md:overflow-hidden landscape:overflow-hidden">
                  <div className="space-y-4 md:overflow-y-auto landscape:overflow-y-auto md:pr-1">
                    <div>
                      <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                        {t("knowledgeTitleLabel")}
                      </label>
                      <input
                        type="text"
                        value={createForm.title}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            title: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                        placeholder={t("knowledgeTitlePlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                        {t("knowledgeCategory")}
                      </label>
                      <select
                        value={createForm.category}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      >
                        <option value="Аудит">{t("knowledgeCatAudit")}</option>
                        <option value="Технологи">{t("knowledgeCatTech")}</option>
                        <option value="Сонин хачин">{t("knowledgeCatFun")}</option>
                        <option value="Банк санхүү">{t("knowledgeCatFinance")}</option>
                        <option value="Risk">Risk</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                        {t("knowledgePageImageLabel")}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({createForm.imageUrls.length}/{KNOWLEDGE_MAX_IMAGES})
                        </span>
                      </label>
                      {createForm.imageUrls.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {createForm.imageUrls.map((src, idx) => (
                            <div
                              key={`${idx}-${src.slice(0, 24)}`}
                              className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-border"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeCreateImage(idx)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/85 text-foreground flex items-center justify-center hover:bg-background"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {createForm.imageUrls.length < KNOWLEDGE_MAX_IMAGES && (
                        <label className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-xl cursor-pointer border-2 border-dashed border-border hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs text-center px-2">
                            {t("knowledgePageImageUploadHint")}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col min-h-[min(50vh,420px)] md:min-h-0 md:h-full landscape:min-h-0 landscape:h-full">
                    <label className="text-foreground/70 text-xs font-semibold block mb-1.5 flex-shrink-0">
                      {t("raCsvExportContentLabel")}
                    </label>
                    <textarea
                      value={createForm.content}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          content: e.target.value,
                        }))
                      }
                      className="flex-1 min-h-[min(50vh,420px)] md:min-h-0 w-full rounded-xl px-3 py-3 text-sm sm:text-base leading-relaxed text-foreground bg-muted border border-input placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      placeholder={t("knowledgePageContentPlaceholder")}
                    />
                  </div>
                </div>
              </div>
              <div className="px-5 sm:px-6 py-3.5 sm:py-4 flex justify-end gap-2 border-t border-border bg-muted/30 flex-shrink-0">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors"
                >
                  {t("cancel")}
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
                  {t("knowledgePageShareBtn")}
                </button>
              </div>
            </motion.div>
          </motion.div>,
          document.body,
        )}

      {/* ── Open-book fullscreen reader ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selectedNews && (
              <KnowledgeBookReader
                news={selectedNews}
                hasImage={
                  hasKnowledgeImage(selectedNews.imageUrl) ||
                  (selectedNews.imageUrls?.length ?? 0) > 0
                }
                imageUrls={
                  selectedNews.imageUrls?.length
                    ? selectedNews.imageUrls
                    : selectedNews.imageUrl
                      ? [selectedNews.imageUrl]
                      : []
                }
                cat={getCat(selectedNews.category)}
                authorLabel={
                  selectedNews.authorName || t("knowledgePageEmployeeFallback")
                }
                authorGradient={getAvatarColor(
                  selectedNews.authorName ||
                    t("knowledgePageEmployeeFallback"),
                )}
                authorInitials={getInitials(
                  selectedNews.authorName ||
                    t("knowledgePageEmployeeFallback"),
                )}
                formattedDate={formatDate(selectedNews.createdAt)}
                readTime={calcReadTime(selectedNews.content)}
                minReadLabel={t("minRead")}
                justNowLabel={t("knowledgeJustNow")}
                backLabel={t("back")}
                closeLabel={t("close")}
                commentsLabel={t("knowledgePageCommentsLabel")}
                commentPlaceholder={t("newsCommentPlaceholder")}
                commentEmpty={t("newsCommentEmpty")}
                sanitizedHtml={sanitizeHtml(selectedNews.content)}
                reactions={reactions}
                comments={comments}
                commentText={commentText}
                commentPosting={commentPosting}
                commentInputRef={commentInputRef}
                canDelete={!!user && selectedNews.authorId === user.id}
                currentUserId={user?.id}
                getAvatarColor={getAvatarColor}
                getInitials={getInitials}
                formatRelative={formatRelative}
                onClose={closeDetail}
                onDelete={() => handleDelete(selectedNews.id)}
                onReact={handleReact}
                onCommentChange={setCommentText}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
