"use client";

import { useMounted } from "@/hooks/use-mounted";
import { startAsync } from "@/lib/start-async";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { Hash, SearchX, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { knowledgeApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  fileToKnowledgeDataUrl,
  KNOWLEDGE_MAX_IMAGES,
} from "@/lib/knowledge-image";
import { KnowledgeCreateModal } from "./_components/KnowledgeCreateModal";
import { QuizSection } from "./_components/QuizSection";
import { MagazineHeader } from "./_components/magazine/MagazineHeader";
import {
  HeroBackdrop,
  HeroFeature,
  HeroSkeleton,
} from "./_components/magazine/HeroFeature";
import { LatestTimeline } from "./_components/magazine/LatestTimeline";
import { WeeklyArchive } from "./_components/magazine/WeeklyArchive";
import { CONTAINER, HERO_BG } from "./_components/magazine/Primitives";
import { ArticleView } from "./_components/magazine/ArticleView";
import {
  ALL_CATEGORY,
  QUIZ_KEY,
  byNewest,
  emptyCreateForm,
  stripHtml,
  type KnowledgeCreateForm,
  type News,
} from "./_lib/knowledge-utils";

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

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 opacity-40" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      {hint && <p className="text-xs mt-1 opacity-60">{hint}</p>}
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
  const mounted = useMounted();

  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] =
    useState<KnowledgeCreateForm>(emptyCreateForm);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      const data = await knowledgeApi.listPublished();
      setNews(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    startAsync(fetchNews);
    return () => {
      document.body.style.overflow = "";
    };
  }, [fetchNews]);

  // ── Шүүлтүүр ба хэсэг бүрийн өгөгдөл ──────────────────────────────────────
  const isQuiz = activeCategory === QUIZ_KEY;
  const query = search.trim().toLocaleLowerCase();
  const isSearching = !isQuiz && query.length > 0;

  const newsCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of news) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [news]);

  const categoryNews = useMemo(
    () =>
      activeCategory === ALL_CATEGORY || activeCategory === QUIZ_KEY
        ? news
        : news.filter((item) => item.category === activeCategory),
    [news, activeCategory],
  );

  const newest = useMemo(() => byNewest(categoryNews), [categoryNews]);
  const featured = newest[0] ?? null;
  const latest = useMemo(() => newest.slice(1), [newest]);

  const searchResults = useMemo(() => {
    if (!query) return [];
    return newest.filter((item) =>
      `${item.title} ${item.authorName ?? ""} ${stripHtml(item.content)}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [newest, query]);

  const handleCategory = (key: string) => {
    setActiveCategory(key);
    if (key === QUIZ_KEY) setSearch("");
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    if (isQuiz && value.trim()) setActiveCategory(ALL_CATEGORY);
  };

  const openQuiz = () => {
    handleCategory(QUIZ_KEY);
    document
      .getElementById("main-content")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Нийтлэл үүсгэх ─────────────────────────────────────────────────────────
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
      setCreateForm(emptyCreateForm());
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

  // ── Нийтлэл унших ──────────────────────────────────────────────────────────
  const handleClick = async (item: News) => {
    const sb = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sb + "px";
    document.body.style.overflow = "hidden";
    try {
      setSelectedNews(await knowledgeApi.getOne(item.id));
    } catch {
      setSelectedNews(item);
    }
  };

  const closeDetail = useCallback(() => {
    setSelectedNews(null);
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

  const showFeature = !isQuiz && !isSearching;

  return (
    <div className="relative min-h-full bg-background pb-24">
      {/* ── Hero (бараан) — толгой хэсэг + онцлох нийтлэл ── */}
      <section className={`relative overflow-hidden text-white ${HERO_BG}`}>
        {showFeature && featured && <HeroBackdrop news={featured} />}
        <div className={`relative ${CONTAINER}`}>
          <MagazineHeader
            activeCategory={activeCategory}
            onCategory={handleCategory}
            counts={newsCountByCategory}
            search={search}
            onSearch={handleSearch}
            onCreate={() => setShowCreate(true)}
            onQuiz={openQuiz}
            quizActive={isQuiz}
          />
          {showFeature && isLoading && <HeroSkeleton />}
          {showFeature && !isLoading && featured && (
            <HeroFeature news={featured} onOpen={() => handleClick(featured)} />
          )}
          {!(showFeature && (isLoading || featured)) && <div className="h-8" />}
        </div>
      </section>

      {isQuiz ? (
        <QuizSection />
      ) : isLoading ? null : isSearching ? (
        <div className="pt-12">
          {searchResults.length > 0 ? (
            <LatestTimeline
              key={`search|${activeCategory}|${query}`}
              title={`${t("knowledgeSearchResults")} · ${searchResults.length}`}
              items={searchResults}
              onOpen={handleClick}
            />
          ) : (
            <EmptyState icon={SearchX} title={t("knowledgeSearchEmpty")} />
          )}
        </div>
      ) : !featured ? (
        <EmptyState
          icon={Hash}
          title={t("noNews")}
          hint={t("knowledgeFirstPost")}
        />
      ) : (
        <div className="space-y-20 pt-16 sm:space-y-24 sm:pt-20">
          <LatestTimeline
            key={`feed|${activeCategory}`}
            title={t("knowledgeLatest")}
            items={latest}
            onOpen={handleClick}
          />
          <WeeklyArchive
            key={activeCategory}
            items={categoryNews}
            onOpen={handleClick}
          />
        </div>
      )}

      {/* ── Create Modal ── */}
      {mounted && showCreate && (
        <KnowledgeCreateModal
          form={createForm}
          setForm={setCreateForm}
          loading={createLoading}
          onUpload={handleImageUpload}
          onRemoveImage={removeCreateImage}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* ── Open-book fullscreen reader ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selectedNews && (
              <ArticleView
                key={selectedNews.id}
                news={selectedNews}
                imageUrls={
                  selectedNews.imageUrls?.length
                    ? selectedNews.imageUrls
                    : selectedNews.imageUrl
                      ? [selectedNews.imageUrl]
                      : []
                }
                sanitizedHtml={sanitizeHtml(selectedNews.content)}
                canDelete={!!user && selectedNews.authorId === user.id}
                onClose={closeDetail}
                onDelete={() => handleDelete(selectedNews.id)}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
