import { Cpu, Layers, ShieldCheck, type LucideIcon } from "lucide-react";
import { knowledgeApi } from "@/lib/api";
import type { Language, TranslationKey } from "@/contexts/LanguageContext";

export interface News {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
  authorId: string;
  authorName?: string;
  isPublished: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeCreateForm {
  title: string;
  content: string;
  category: string;
  imageUrls: string[];
}

export const emptyCreateForm = (): KnowledgeCreateForm => ({
  title: "",
  content: "",
  category: "IT knowledge",
  imageUrls: [],
});

export const ALL_CATEGORY = "Бүгд";

/** Кибер аюулгүй байдлын мэдээ — бусдаас ялгарах тусдаа төрхтэй (бараан, ногоон тор). */
export const CYBER_CATEGORY = "Cyber Security news";

export const isCyberCategory = (cat: string) => cat === CYBER_CATEGORY;

// Тусгай "ангилал" — QUIZ хэсэг рүү шилжих товч. Бодит контент ангилал биш
// тул POST_CATEGORIES-д (пост үүсгэх сонголтод) ордоггүй.
export const QUIZ_KEY = "__quiz__";

export type CategoryDef = {
  /** DB-д хадгалагдсан утга — өөрчилж болохгүй */
  key: string;
  labelKey?: TranslationKey;
  label?: string;
  icon: LucideIcon;
};

export const CATEGORIES: CategoryDef[] = [
  { key: ALL_CATEGORY, labelKey: "knowledgeCatAll", icon: Layers },
  { key: "IT knowledge", label: "IT knowledge", icon: Cpu },
  {
    key: "Cyber Security news",
    label: "Cyber Security news",
    icon: ShieldCheck,
  },
  { key: "General knowledge", label: "General knowledge", icon: Layers },
];

export const POST_CATEGORIES = CATEGORIES.filter((c) => c.key !== ALL_CATEGORY);

export function categoryLabel(
  key: string,
  t: (k: TranslationKey) => string,
): string {
  const c = CATEGORIES.find((x) => x.key === key);
  if (!c) return key;
  return c.labelKey ? t(c.labelKey) : (c.label ?? key);
}

export function categoryIcon(key: string): LucideIcon {
  return CATEGORIES.find((x) => x.key === key)?.icon ?? Layers;
}

type CatStyle = {
  bg: string;
  text: string;
  ring: string;
  dot: string;
  /** Зураггүй нийтлэлийн нүүрний градиент */
  gradient: string;
};

const CAT_COLORS: Record<string, CatStyle> = {
  "IT knowledge": {
    bg: "bg-violet-100 dark:bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-400",
    ring: "ring-violet-300/80 dark:ring-violet-400/30",
    dot: "bg-violet-500",
    gradient: "from-violet-500 via-purple-700 to-fuchsia-900",
  },
  "Cyber Security news": {
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-300/80 dark:ring-emerald-400/30",
    dot: "bg-emerald-500",
    gradient: "from-emerald-400 via-teal-600 to-cyan-900",
  },
  "General knowledge": {
    bg: "bg-slate-100 dark:bg-slate-500/15",
    text: "text-slate-700 dark:text-slate-300",
    ring: "ring-slate-300/80 dark:ring-slate-400/30",
    dot: "bg-slate-500",
    gradient: "from-slate-500 via-slate-700 to-slate-900",
  },
  // ── Хуучин нийтлэлүүдийн ангилал — DB дэх өгөгдөл тул өнгө нь хэвээр ──
  Аудит: {
    bg: "bg-blue-100 dark:bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-400",
    ring: "ring-blue-300/80 dark:ring-blue-400/30",
    dot: "bg-blue-500",
    gradient: "from-blue-500 via-blue-700 to-indigo-900",
  },
  Технологи: {
    bg: "bg-violet-100 dark:bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-400",
    ring: "ring-violet-300/80 dark:ring-violet-400/30",
    dot: "bg-violet-500",
    gradient: "from-violet-500 via-purple-700 to-fuchsia-900",
  },
  "Сонин хачин": {
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-300/80 dark:ring-emerald-400/30",
    dot: "bg-emerald-500",
    gradient: "from-emerald-400 via-teal-600 to-cyan-900",
  },
  "Банк санхүү": {
    bg: "bg-amber-100 dark:bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-300/80 dark:ring-amber-400/30",
    dot: "bg-amber-500",
    gradient: "from-amber-400 via-orange-600 to-rose-900",
  },
  Risk: {
    bg: "bg-rose-100 dark:bg-rose-500/15",
    text: "text-rose-700 dark:text-rose-400",
    ring: "ring-rose-300/80 dark:ring-rose-400/30",
    dot: "bg-rose-500",
    gradient: "from-rose-500 via-red-700 to-stone-900",
  },
};

export function getCat(cat: string): CatStyle {
  return (
    CAT_COLORS[cat] ?? {
      bg: "bg-muted",
      text: "text-muted-foreground",
      ring: "ring-border",
      dot: "bg-muted-foreground",
      gradient: "from-slate-500 via-slate-700 to-slate-900",
    }
  );
}

export function hasKnowledgeImage(path?: string): boolean {
  return !!knowledgeApi.parseImageId(path);
}

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
];

export function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function calcReadTime(content: string) {
  const words = stripHtml(content).split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ClickHouse "YYYY-MM-DD HH:MM:SS" буцаадаг — Safari "T"-гүй огноог Invalid Date болгодог.
export function parseDate(d: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2} \d/.test(d) ? d.replace(" ", "T") : d);
}

export function formatDate(d: string) {
  return parseDate(d).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Картын огноо: "9 сарын 15, 2026" / "Sep 15, 2026" */
export function formatShortDate(d: string, language: Language) {
  const date = parseDate(d);
  if (Number.isNaN(date.getTime())) return "";
  if (language === "mn") {
    return `${date.getMonth() + 1} сарын ${date.getDate()}, ${date.getFullYear()}`;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthDay(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

export function byNewest(items: News[]): News[] {
  return [...items].sort(
    (a, b) =>
      parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime(),
  );
}

const DAY_MS = 86_400_000;

export type WeekWindow = { start: number; end: number; from: Date; to: Date };

/**
 * [0] = сүүлийн 7 хоног, [1..] = түүнээс өмнөх 7 хоногийн цонхнууд.
 * Цонхнууд залгаа тул нэг нийтлэл хоёр таб-д давхардахгүй, цоорхой ч үлдэхгүй.
 */
export function buildWeekWindows(
  count: number,
  now = Date.now(),
): WeekWindow[] {
  return Array.from({ length: count }, (_, i) => {
    const start = now - (i + 1) * 7 * DAY_MS;
    const end = i === 0 ? Number.POSITIVE_INFINITY : now - i * 7 * DAY_MS;
    return {
      start,
      end,
      from: new Date(start),
      to: new Date((i === 0 ? now : end) - 1),
    };
  });
}
