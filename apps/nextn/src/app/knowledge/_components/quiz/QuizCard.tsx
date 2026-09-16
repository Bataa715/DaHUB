"use client";

// Нэг quiz — бөглөх, үр дүн харах.
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { quizApi, QuizAnswerItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ListChecks,
  Loader2,
  Medal,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  QuizItem,
  QuizResultRow,
  OPTION_LETTERS,
  quizGradient,
  initials,
  fmtSec,
  primaryBtn,
  RankBadge,
  Avatar,
} from "./quiz-shared";

// ─── Single quiz card ───────────────────────────────────────────────────────
export function QuizCard({
  quiz,
  index,
  onAnswered,
  onDeleted,
}: {
  quiz: QuizItem;
  index: number;
  onAnswered: () => void;
  onDeleted: () => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  // Карт дээр дарж дэлгэрэнгүйг диалогоор нээнэ — жагсаалт нь бүх
  // асуултыг задлан харуулснаас болж хэт урт болдог байсан.
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<QuizResultRow[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  // Хугацааг quiz-ийг анх нээсэн мөчөөс хэмжинэ (карт харагдсан мөчөөс биш).
  const startedAtRef = useRef(0);

  const answered = !!quiz.myAttempt;
  const canDelete = user && (user.id === quiz.authorId || user.isAdmin);
  // [SEC] Backend-тэй тааруулав: хараахан хариулаагүй, зохиогч/админ биш бол
  // үр дүнг харах боломжгүй (бусдын сонголтоос зөв хариултыг таамаглахаас сэргийлнэ).
  const canViewResults =
    answered || (user && (user.id === quiz.authorId || user.isAdmin));
  const total = quiz.questions.length;
  const selectedCount = quiz.questions.filter(
    (q) => selections[q.id] !== undefined,
  ).length;
  const allSelected = !answered && total > 0 && selectedCount === total;
  const perfect =
    answered && quiz.myAttempt!.correctCount === quiz.myAttempt!.totalQuestions;
  const gradient = quizGradient(quiz.id);

  const openQuiz = () => {
    if (!answered && startedAtRef.current === 0)
      startedAtRef.current = Date.now();
    setOpen(true);
  };

  const handleSubmitAll = async () => {
    if (answered || submitting || !allSelected) return;
    setSubmitting(true);
    try {
      const answers: QuizAnswerItem[] = quiz.questions.map((q) => ({
        questionId: q.id,
        selectedIndex: selections[q.id],
      }));
      const timeTakenMs = Math.max(0, Date.now() - startedAtRef.current);
      await quizApi.answer(quiz.id, answers, timeTakenMs);
      setOpen(false);
      onAnswered();
    } catch {
      toast({
        title: t("error"),
        description: t("quizAnswerError"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleResults = async () => {
    const next = !showResults;
    setShowResults(next);
    if (next && !results) {
      setLoadingResults(true);
      try {
        const data = await quizApi.results(quiz.id);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoadingResults(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("quizDeleteConfirm"))) return;
    try {
      await quizApi.delete(quiz.id);
      toast({ title: t("success"), description: t("quizDeletedDesc") });
      onDeleted();
    } catch {
      toast({
        title: t("error"),
        description: t("quizDeleteError"),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* ── Карт — дарж quiz-ийг нээнэ ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          delay: index * 0.05,
          ease: [0.22, 1, 0.36, 1],
        }}
        role="button"
        tabIndex={0}
        onClick={openQuiz}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openQuiz();
          }
        }}
        className="group flex cursor-pointer flex-col overflow-hidden rounded-[28px] bg-card shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] ring-1 ring-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_70px_-30px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div
          className={cn(
            "relative h-32 overflow-hidden bg-gradient-to-br p-5 text-white",
            gradient,
          )}
        >
          <Trophy
            aria-hidden
            strokeWidth={1.2}
            className="absolute -bottom-6 -right-4 h-32 w-32 text-white/15 transition-transform duration-700 group-hover:-rotate-12 group-hover:scale-110"
          />
          <div className="relative flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs font-bold backdrop-blur">
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              {quiz.questionCount} {t("quizQuestionCountLabel")}
            </span>
            <div className="flex items-center gap-1.5">
              {answered && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black tabular-nums",
                    perfect
                      ? "bg-white text-emerald-600"
                      : "bg-black/25 text-white backdrop-blur",
                  )}
                >
                  {perfect && <Check className="h-3.5 w-3.5" aria-hidden />}
                  {quiz.myAttempt!.correctCount}/
                  {quiz.myAttempt!.totalQuestions}
                </span>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete();
                  }}
                  aria-label={t("quizDeleteConfirm")}
                  className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white/80 backdrop-blur transition-colors hover:bg-red-500 hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center gap-2.5">
            <Avatar name={quiz.authorName} className="h-8 w-8 text-[11px]" />
            <p className="truncate text-xs text-muted-foreground">
              {t("quizByLabel")}{" "}
              <span className="font-semibold text-foreground">
                {quiz.authorName}
              </span>
            </p>
          </div>
          <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-snug tracking-tight text-foreground">
            {quiz.title}
          </h3>

          <div className="mt-auto pt-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {quiz.answerCount} {t("quizParticipantsLabel")}
              </span>
              {quiz.avgScorePercent != null && (
                <span className="font-semibold">
                  {quiz.avgScorePercent}% {t("quizAvgScoreLabel")}
                </span>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r", gradient)}
                style={{ width: `${quiz.avgScorePercent ?? 0}%` }}
              />
            </div>
            <span
              className={cn(
                "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-colors",
                answered
                  ? "bg-muted text-foreground group-hover:bg-muted/70"
                  : "bg-[#07070c] text-white group-hover:bg-blue-700 dark:bg-white dark:text-[#07070c] dark:group-hover:bg-blue-100",
              )}
            >
              {answered ? t("quizViewResultsBtn") : t("knowledgeQuizBannerCta")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Quiz бөглөх / үр дүн харах ────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl gap-0 overflow-y-auto p-0 [&>button]:text-white">
          <div
            className={cn(
              "relative overflow-hidden bg-gradient-to-br px-7 pb-7 pt-8 text-white",
              gradient,
            )}
          >
            <Trophy
              aria-hidden
              strokeWidth={1.2}
              className="absolute -bottom-8 -right-6 h-44 w-44 text-white/15"
            />
            <DialogHeader className="relative space-y-0 text-left">
              <p className="text-xs font-extrabold tracking-[0.16em] text-white/70">
                {t("knowledgeQuizTab")}
              </p>
              <DialogTitle className="mt-2 pr-8 text-2xl font-black leading-tight tracking-tight text-white">
                {quiz.title}
              </DialogTitle>
            </DialogHeader>
            <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
              <span className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-[10px] font-bold">
                  {initials(quiz.authorName)}
                </span>
                {quiz.authorName}
              </span>
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" aria-hidden />
                {quiz.questionCount} {t("quizQuestionCountLabel")}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden />
                {quiz.answerCount} {t("quizParticipantsLabel")}
              </span>
            </div>

            {answered ? (
              <div className="relative mt-6 flex items-center gap-4 rounded-2xl bg-black/20 p-4 backdrop-blur">
                <span className="text-4xl font-black tabular-nums">
                  {quiz.myAttempt!.correctCount}/
                  {quiz.myAttempt!.totalQuestions}
                </span>
                <div className="text-sm">
                  <p className="font-bold">{t("quizCorrectCountLabel")}</p>
                  <p className="flex items-center gap-1 text-white/70">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {fmtSec(quiz.myAttempt!.timeTakenMs)}
                    {t("quizTimeSecLabel")}
                  </p>
                </div>
                {perfect && (
                  <Medal
                    className="ml-auto h-10 w-10 text-amber-300"
                    aria-hidden
                  />
                )}
              </div>
            ) : (
              <div className="relative mt-6">
                <div className="flex justify-between text-xs font-bold text-white/80">
                  <span>
                    {selectedCount}/{total}
                  </span>
                  <span>
                    {total ? Math.round((selectedCount / total) * 100) : 0}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={false}
                    animate={{
                      width: `${total ? (selectedCount / total) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-7 p-7">
            {quiz.questions.map((q, qi) => (
              <div key={q.id}>
                <p className="flex gap-3 text-base font-semibold leading-snug text-foreground">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#07070c] text-xs font-black text-white dark:bg-white dark:text-[#07070c]">
                    {qi + 1}
                  </span>
                  <span className="pt-0.5">{q.question}</span>
                </p>
                <div className="mt-3 grid gap-2 sm:pl-10">
                  {q.options.map((opt, i) => {
                    const isMine = selections[q.id] === i;
                    const isCorrectOpt = q.correctIndex === i;
                    let tone =
                      "border-border bg-background hover:border-blue-500/50 hover:bg-blue-500/5";
                    let letter = "bg-muted text-muted-foreground";
                    if (answered) {
                      if (isCorrectOpt) {
                        tone =
                          "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
                        letter = "bg-emerald-500 text-white";
                      } else if (isMine) {
                        tone =
                          "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300";
                        letter = "bg-red-500 text-white";
                      } else {
                        tone = "border-border/60 opacity-60";
                      }
                    } else if (isMine) {
                      tone =
                        "border-blue-600 bg-blue-600/10 text-foreground ring-1 ring-blue-600/30";
                      letter = "bg-blue-600 text-white";
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          !answered &&
                          setSelections((prev) => ({ ...prev, [q.id]: i }))
                        }
                        disabled={answered}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition-all",
                          tone,
                          answered ? "cursor-default" : "cursor-pointer",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black transition-colors",
                            letter,
                          )}
                        >
                          {answered && isCorrectOpt ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : answered && isMine ? (
                            <X className="h-3.5 w-3.5" />
                          ) : (
                            OPTION_LETTERS[i]
                          )}
                        </span>
                        <span className="min-w-0 flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!answered && (
              <button
                type="button"
                onClick={handleSubmitAll}
                disabled={!allSelected || submitting}
                className={cn(primaryBtn, "w-full py-3.5")}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Target className="h-4 w-4" aria-hidden />
                )}
                {t("quizSubmitQuizBtn")}
              </button>
            )}

            {canViewResults && (
              <div className="overflow-hidden rounded-2xl ring-1 ring-border/60">
                <button
                  type="button"
                  onClick={toggleResults}
                  className="flex w-full items-center justify-between px-5 py-4 text-sm font-bold text-foreground transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
                    {showResults
                      ? t("quizHideResultsBtn")
                      : t("quizViewResultsBtn")}
                  </span>
                  {showResults ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showResults && (
                  <div className="border-t border-border/60 px-3 pb-3 pt-2">
                    <p className="px-2 pb-2 text-xs font-bold text-muted-foreground">
                      {t("quizResultsTitle")}
                    </p>
                    {loadingResults ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : !results || results.length === 0 ? (
                      <p className="py-5 text-center text-sm text-muted-foreground">
                        {t("quizResultsEmpty")}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {results.map((r) => (
                          <div
                            key={r.userId}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-2 py-2 text-sm",
                              r.userId === user?.id && "bg-blue-500/10",
                            )}
                          >
                            <RankBadge rank={r.rank} />
                            <Avatar
                              name={r.userName}
                              className="h-8 w-8 text-[10px]"
                            />
                            <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                              {r.userName}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" aria-hidden />
                              {fmtSec(r.timeTakenMs)}
                              {t("quizTimeSecLabel")}
                            </span>
                            <span
                              className={cn(
                                "w-12 shrink-0 text-right font-black tabular-nums",
                                r.correctCount === r.totalQuestions
                                  ? "text-emerald-500"
                                  : "text-foreground",
                              )}
                            >
                              {r.correctCount}/{r.totalQuestions}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
