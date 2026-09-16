"use client";

import Link from "next/link";
import { LayoutGrid, PenLine, Search, Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GolomtMark } from "@/components/GolomtMark";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import {
  ALL_CATEGORY,
  CATEGORIES,
  categoryLabel,
  isCyberCategory,
} from "../../_lib/knowledge-utils";

/**
 * DAG news-ийн толгой хэсэг. QUIZ-д "Мэдлэгээ сорь" товчоор ордог
 * ("Мэдлэг хуваалцах"-ийн хажууд); ангилал дарахад мэдээ рүү буцна.
 */
export function MagazineHeader({
  activeCategory,
  onCategory,
  counts,
  search,
  onSearch,
  onCreate,
  onQuiz,
  quizActive,
}: {
  activeCategory: string;
  onCategory: (key: string) => void;
  counts: Record<string, number>;
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  onQuiz: () => void;
  quizActive: boolean;
}) {
  const { t } = useLanguage();
  // Нийтлэл үүсгэх эрхгүй бол товч огт харагдахгүй (backend ч 403 өгнө).
  const { canAccess } = useAllowedTools();
  const canShare = canAccess(["medleg_write"]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <header className="relative z-10 pt-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* DAG news бүтэн дэлгэцээр нээгддэг тул нүүр хуудас руу буцах цорын ганц зам */}
        <Link
          href="/"
          aria-label={t("knowledgeGoHome")}
          title={t("knowledgeGoHome")}
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <LayoutGrid className="h-5 w-5" />
        </Link>

        <div className="flex items-center gap-2.5">
          <GolomtMark className="h-7 w-7 flex-shrink-0 text-white" />
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            {t("knowledgeTitle")}
          </h1>
        </div>

        <span aria-hidden className="hidden h-6 w-px bg-white/30 sm:block" />

        <label className="relative flex min-w-[160px] max-w-xs flex-1 items-center">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-0 h-4 w-4 text-white/50"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("knowledgeSearchPlaceholder")}
            aria-label={t("knowledgeSearchPlaceholder")}
            className="w-full border-b border-transparent bg-transparent py-1.5 pl-7 pr-2 text-sm font-semibold text-white placeholder:text-white/45 focus:border-white/40 focus:outline-none"
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onQuiz}
            aria-pressed={quizActive}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors sm:px-5",
              quizActive
                ? "bg-amber-300 text-[#07070c]"
                : "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            <Trophy
              className={cn("h-4 w-4", !quizActive && "text-amber-300")}
              aria-hidden
            />
            {t("knowledgeQuizBannerTitle")}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white/30 sm:px-5"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              {t("knowledgeShare")}
            </button>
          )}
        </div>
      </div>

      <nav
        aria-label={t("knowledgeCategory")}
        className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none"
      >
        {CATEGORIES.map((c) => {
          const active = !quizActive && activeCategory === c.key;
          const count = c.key === ALL_CATEGORY ? total : (counts[c.key] ?? 0);
          // Кибер мэдээ — бусад ангиллаас ялгарах терминал маягийн товч
          const cyber = isCyberCategory(c.key);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => onCategory(c.key)}
              className={cn(
                "inline-flex flex-shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold transition-colors",
                cyber
                  ? "rounded-md border font-mono tracking-wide"
                  : "rounded-full",
                cyber
                  ? active
                    ? "border-emerald-400 bg-emerald-400 text-[#052e1b]"
                    : "border-emerald-400/40 text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-400/10"
                  : active
                    ? "bg-white text-[#07070c]"
                    : "text-white/65 hover:bg-white/10 hover:text-white",
              )}
            >
              {categoryLabel(c.key, t)}
              {count > 0 && (
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    active ? "text-black/45" : "text-white/40",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
