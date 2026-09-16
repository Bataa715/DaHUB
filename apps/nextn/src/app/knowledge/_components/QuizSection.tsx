"use client";

import { startAsync } from "@/lib/start-async";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { quizApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import { Loader2, Plus, Sparkles, Trophy } from "lucide-react";
import { CONTAINER, HERO_BG } from "./magazine/Primitives";
import { QuizItem, LeaderboardRow } from "./quiz/quiz-shared";
import { CreateQuizDialog } from "./quiz/CreateQuizDialog";
import { QuizCard } from "./quiz/QuizCard";
import { QuizLeaderboard } from "./quiz/QuizLeaderboard";

// ─── Main section ───────────────────────────────────────────────────────────
export function QuizSection() {
  const { t } = useLanguage();
  // Quiz үүсгэх эрхгүй бол товч харагдахгүй (backend ч 403 өгнө).
  const { canAccess } = useAllowedTools();
  const canCreate = canAccess(["quiz_write"]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const [q, lb] = await Promise.all([
        quizApi.list(),
        quizApi.leaderboard(),
      ]);
      setQuizzes(q);
      setLeaderboard(lb);
    } catch {
      /* silent — matches feed's error handling style */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startAsync(load);
  }, [load]);

  const stats = [
    { label: t("quizStatTotal"), value: quizzes.length },
    {
      label: t("quizStatAttempts"),
      value: quizzes.reduce((sum, q) => sum + q.answerCount, 0),
    },
    {
      label: t("quizStatMine"),
      value: quizzes.filter((q) => q.myAttempt).length,
    },
  ];

  return (
    <div>
      {/* Hero — DAG news-ийн бараан толгой хэсгийг үргэлжлүүлнэ */}
      <section className={cn("relative overflow-hidden text-white", HERO_BG)}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-amber-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 bottom-0 h-[26rem] w-[26rem] rounded-full bg-blue-600/20 blur-3xl"
        />
        <div
          className={cn(
            "relative flex flex-wrap items-end justify-between gap-8 pb-24 pt-4",
            CONTAINER,
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <p className="flex items-center gap-2 text-sm font-extrabold tracking-[0.16em] text-amber-300">
              <Sparkles className="h-4 w-4" aria-hidden />
              {t("knowledgeQuizTab")}
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              {t("knowledgeQuizBannerTitle")}
            </h2>
            <p className="mt-4 text-base text-white/65 sm:text-lg">
              {t("knowledgeQuizBannerDesc")}
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[#07070c] transition-colors hover:bg-amber-200"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t("quizCreateBtn")}
              </button>
            )}
          </motion.div>

          <div className="grid w-full grid-cols-3 gap-3 sm:w-auto">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10 backdrop-blur"
              >
                <p className="text-3xl font-black tabular-nums">
                  {loading ? "–" : s.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/55">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div
        className={cn(
          "relative -mt-14 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]",
          CONTAINER,
        )}
      >
        <div className="min-w-0">
          {loading ? (
            <div className="flex justify-center rounded-[28px] bg-card py-24 ring-1 ring-border/60">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : quizzes.length === 0 ? (
            <div className="flex flex-col items-center rounded-[28px] bg-card py-24 text-center ring-1 ring-border/60">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10">
                <Trophy className="h-8 w-8 text-amber-500" aria-hidden />
              </span>
              <p className="mt-4 font-bold text-foreground">{t("quizEmpty")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("quizEmptyHint")}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {quizzes.map((q, i) => (
                <QuizCard
                  key={q.id}
                  quiz={q}
                  index={i}
                  onAnswered={load}
                  onDeleted={load}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-6">
          <QuizLeaderboard rows={leaderboard} />
        </aside>
      </div>

      {showCreate && (
        <CreateQuizDialog
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
