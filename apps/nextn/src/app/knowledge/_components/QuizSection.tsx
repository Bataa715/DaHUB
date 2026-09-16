"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { quizApi, QuizQuestionInput, QuizAnswerItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ListChecks,
  Loader2,
  Medal,
  Plus,
  Sparkles,
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
import { CONTAINER, HERO_BG } from "./magazine/Primitives";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number | null;
}

interface QuizItem {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  questions: QuizQuestion[];
  questionCount: number;
  answerCount: number;
  avgScorePercent: number | null;
  myAttempt: {
    correctCount: number;
    totalQuestions: number;
    timeTakenMs: number;
  } | null;
}

interface QuizResultRow {
  rank: number;
  userId: string;
  userName: string;
  correctCount: number;
  totalQuestions: number;
  timeTakenMs: number;
  answeredAt: string;
}

interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  totalAttempts: number;
  correctCount: number;
  totalQuestions: number;
  avgTimeMs: number | null;
}

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
];
// Quiz бүр тогтмол өнгөтэй (id-аас) — жагсаалт солигдоход өнгө нь үсрэхгүй.
const QUIZ_GRADIENTS = [
  "from-violet-600 via-indigo-600 to-blue-700",
  "from-amber-500 via-orange-600 to-rose-700",
  "from-emerald-500 via-teal-600 to-cyan-700",
  "from-rose-500 via-pink-600 to-fuchsia-700",
  "from-sky-500 via-blue-600 to-indigo-700",
];
const MEDAL_GRADIENTS: Record<number, string> = {
  1: "from-amber-200 to-yellow-500",
  2: "from-slate-100 to-slate-400",
  3: "from-orange-200 to-amber-700",
};
const OPTION_LETTERS = "ABCDEF";

function hashIndex(value: string, size: number) {
  let h = 0;
  for (let i = 0; i < value.length; i++)
    h = (h * 31 + value.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % size;
}
const avatarGrad = (name: string) =>
  AVATAR_COLORS[hashIndex(name, AVATAR_COLORS.length)];
const quizGradient = (id: string) =>
  QUIZ_GRADIENTS[hashIndex(id, QUIZ_GRADIENTS.length)];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
function fmtSec(ms: number) {
  return (ms / 1000).toFixed(1);
}

const emptyQuestion = (): QuizQuestionInput => ({
  question: "",
  options: ["", ""],
  correctIndex: 0,
});

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#07070c] text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#07070c] dark:hover:bg-blue-100";
const fieldClass =
  "w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

function RankBadge({ rank }: { rank: number }) {
  const medal = MEDAL_GRADIENTS[rank];
  return medal ? (
    <span
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-black text-[#07070c] shadow",
        medal,
      )}
    >
      {rank}
    </span>
  ) : (
    <span className="grid h-7 w-7 shrink-0 place-items-center text-xs font-bold text-muted-foreground">
      {rank}
    </span>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white",
        avatarGrad(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

// ─── Create dialog ──────────────────────────────────────────────────────────
function CreateQuizDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuizQuestionInput[]>([
    emptyQuestion(),
  ]);
  const [saving, setSaving] = useState(false);

  const updateQuestionText = (qi: number, val: string) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, question: val } : q)),
    );

  const updateOption = (qi: number, oi: number, val: string) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, idx) => (idx === oi ? val : o)) }
          : q,
      ),
    );

  const setCorrectIndex = (qi: number, oi: number) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, correctIndex: oi } : q)),
    );

  const addOption = (qi: number) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi && q.options.length < 6
          ? { ...q, options: [...q.options, ""] }
          : q,
      ),
    );

  const removeOption = (qi: number, oi: number) =>
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi || q.options.length <= 2) return q;
        const nextOptions = q.options.filter((_, idx) => idx !== oi);
        return {
          ...q,
          options: nextOptions,
          correctIndex:
            q.correctIndex >= nextOptions.length ? 0 : q.correctIndex,
        };
      }),
    );

  const addQuestion = () => {
    if (questions.length >= 20) return;
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (qi: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  };

  const isValid =
    title.trim().length > 0 &&
    questions.every(
      (q) =>
        q.question.trim().length > 0 &&
        q.options.map((o) => o.trim()).filter(Boolean).length >= 2,
    );

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const cleanQuestions: QuizQuestionInput[] = questions.map((q) => {
        const cleanOptions = q.options.map((o) => o.trim()).filter(Boolean);
        return {
          question: q.question.trim(),
          options: cleanOptions,
          correctIndex: Math.min(q.correctIndex, cleanOptions.length - 1),
        };
      });
      await quizApi.create({ title: title.trim(), questions: cleanQuestions });
      toast({ title: t("success"), description: t("quizCreatedDesc") });
      onCreated();
      onClose();
    } catch {
      toast({
        title: t("error"),
        description: t("quizCreateError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-card shadow-2xl ring-1 ring-border/60"
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden px-7 py-6 text-white",
            HERO_BG,
          )}
        >
          <div
            aria-hidden
            className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/25 blur-3xl"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.16em] text-amber-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t("knowledgeQuizTab")}
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">
                {t("quizCreateDialogTitle")}
              </h3>
              <p className="mt-1 text-sm text-white/60">
                {t("quizCreateDialogDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("quizCancelBtn")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-7">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">
              {t("quizTitleLabel")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("quizTitlePlaceholder")}
              className={cn(fieldClass, "h-12 text-base font-semibold")}
            />
          </div>

          {questions.map((q, qi) => (
            <div
              key={qi}
              className="space-y-4 rounded-2xl bg-muted/40 p-5 ring-1 ring-border/60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#07070c] text-xs font-black text-white dark:bg-white dark:text-[#07070c]">
                    {qi + 1}
                  </span>
                  {t("quizQuestionLabel")}
                </p>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qi)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <input
                value={q.question}
                onChange={(e) => updateQuestionText(qi, e.target.value)}
                placeholder={t("quizQuestionPlaceholder")}
                className={cn(fieldClass, "h-11 font-medium")}
              />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t("quizCorrectAnswerHint")}
                </p>
                {q.options.map((opt, oi) => {
                  const correct = q.correctIndex === oi;
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectIndex(qi, oi)}
                        title={t("quizCorrectAnswerHint")}
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black transition-colors",
                          correct
                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                            : "bg-background text-muted-foreground ring-1 ring-border hover:ring-emerald-500/60",
                        )}
                      >
                        {correct ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          OPTION_LETTERS[oi]
                        )}
                      </button>
                      <input
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={`${t("quizOptionPlaceholder")} ${oi + 1}`}
                        className={cn(
                          fieldClass,
                          "h-10",
                          correct && "border-emerald-500/50",
                        )}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(qi, oi)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {q.options.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addOption(qi)}
                    className="flex items-center gap-1.5 pl-11 pt-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("quizAddOptionBtn")}
                  </button>
                )}
              </div>
            </div>
          ))}

          {questions.length < 20 && (
            <button
              type="button"
              onClick={addQuestion}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-bold text-muted-foreground transition-colors hover:border-blue-500/60 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <Plus className="h-4 w-4" /> {t("quizAddQuestionBtn")}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted"
          >
            {t("quizCancelBtn")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !isValid}
            className={cn(primaryBtn, "px-6 py-2.5")}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("quizCreateSubmitBtn")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Single quiz card ───────────────────────────────────────────────────────
function QuizCard({
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

// ─── Leaderboard panel ──────────────────────────────────────────────────────
function Podium({ row, height }: { row: LeaderboardRow; height: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <Avatar
        name={row.userName}
        className="h-11 w-11 text-xs ring-2 ring-white/30"
      />
      <p className="mt-2 w-full truncate text-[11px] font-semibold">
        {row.userName}
      </p>
      <p className="text-[10px] tabular-nums text-white/60">
        {row.correctCount}/{row.totalQuestions}
      </p>
      <div
        className={cn(
          "mt-2 flex w-full justify-center rounded-t-xl bg-gradient-to-b pt-2 text-lg font-black text-[#07070c]",
          height,
          MEDAL_GRADIENTS[row.rank] ?? "from-white/30 to-white/10",
        )}
      >
        {row.rank}
      </div>
    </div>
  );
}

function QuizLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const { t } = useLanguage();
  const [first, second, third] = rows;
  const rest = rows.slice(3, 10);

  return (
    <div className="overflow-hidden rounded-[28px] bg-card shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] ring-1 ring-border/60">
      <div
        className={cn(
          "relative overflow-hidden px-6 pb-0 pt-5 text-white",
          HERO_BG,
        )}
      >
        <div
          aria-hidden
          className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/25 blur-3xl"
        />
        <p className="relative flex items-center gap-2 text-sm font-bold">
          <Trophy className="h-4 w-4 text-amber-300" aria-hidden />
          {t("quizLeaderboardTitle")}
        </p>
        {first ? (
          <div className="relative mt-6 grid grid-cols-3 items-end gap-2">
            {second ? <Podium row={second} height="h-16" /> : <div />}
            <Podium row={first} height="h-24" />
            {third ? <Podium row={third} height="h-12" /> : <div />}
          </div>
        ) : (
          <p className="relative py-10 text-center text-sm text-white/60">
            {t("quizLeaderboardEmpty")}
          </p>
        )}
      </div>

      {rest.length > 0 && (
        <div className="space-y-1 p-3">
          {rest.map((r) => (
            <div
              key={r.userId}
              className="flex items-center gap-3 rounded-xl px-2 py-2"
            >
              <RankBadge rank={r.rank} />
              <Avatar name={r.userName} className="h-8 w-8 text-[10px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {r.userName}
                </p>
                {r.avgTimeMs != null && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    {fmtSec(r.avgTimeMs)}
                    {t("quizTimeSecLabel")}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-black tabular-nums text-foreground">
                  {r.correctCount}/{r.totalQuestions}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {t("quizRankCorrectLabel")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    load();
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
