"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { quizApi, QuizQuestionInput, QuizAnswerItem } from "@/lib/api";
import {
  Loader2,
  Plus,
  X,
  Trophy,
  Check,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
  ListChecks,
} from "lucide-react";

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
function avatarGrad(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
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
  const [questions, setQuestions] = useState<QuizQuestionInput[]>([emptyQuestion()]);
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
          correctIndex: q.correctIndex >= nextOptions.length ? 0 : q.correctIndex,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {t("quizCreateDialogTitle")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("quizCreateDialogDesc")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("quizTitleLabel")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("quizTitlePlaceholder")}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {questions.map((q, qi) => (
            <div
              key={qi}
              className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">
                  {t("quizQuestionLabel")} {qi + 1}
                </p>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qi)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <input
                value={q.question}
                onChange={(e) => updateQuestionText(qi, e.target.value)}
                placeholder={t("quizQuestionPlaceholder")}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />

              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground/70">
                  {t("quizCorrectAnswerHint")}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectIndex(qi, oi)}
                        title={t("quizCorrectAnswerHint")}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          q.correctIndex === oi
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-border"
                        }`}
                      >
                        {q.correctIndex === oi && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </button>
                      <input
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={`${t("quizOptionPlaceholder")} ${oi + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      {q.options.length > 2 && (
                        <button
                          onClick={() => removeOption(qi, oi)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {q.options.length < 6 && (
                  <button
                    onClick={() => addOption(qi)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t("quizAddOptionBtn")}
                  </button>
                )}
              </div>
            </div>
          ))}

          {questions.length < 20 && (
            <button
              onClick={addQuestion}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-violet-600 dark:text-violet-400 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all"
            >
              <Plus className="w-4 h-4" /> {t("quizAddQuestionBtn")}
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted transition-colors"
          >
            {t("quizCancelBtn")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !isValid}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("quizCreateSubmitBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single quiz card ───────────────────────────────────────────────────────
function QuizCard({
  quiz,
  onAnswered,
  onDeleted,
}: {
  quiz: QuizItem;
  onAnswered: () => void;
  onDeleted: () => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<QuizResultRow[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  const answered = !!quiz.myAttempt;
  const canDelete = user && (user.id === quiz.authorId || user.isAdmin);
  // [SEC] Backend-тэй тааруулав: хараахан хариулаагүй, зохиогч/админ биш бол
  // үр дүнг харах боломжгүй (бусдын сонголтоос зөв хариултыг таамаглахаас сэргийлнэ).
  const canViewResults =
    answered || (user && (user.id === quiz.authorId || user.isAdmin));
  const allSelected =
    !answered && quiz.questions.every((q) => selections[q.id] !== undefined);

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
    <div className="rounded-2xl border border-border bg-card shadow-premium overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrad(quiz.authorName)} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}
            >
              {initials(quiz.authorName)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">
                {t("quizByLabel")} {quiz.authorName}
              </p>
              <h3 className="text-foreground font-bold text-sm leading-snug">
                {quiz.title}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {quiz.questionCount} {t("quizQuestionCountLabel")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {answered && (
              <span
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                  quiz.myAttempt!.correctCount === quiz.myAttempt!.totalQuestions
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {quiz.myAttempt!.correctCount}/{quiz.myAttempt!.totalQuestions}
              </span>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {quiz.questions.map((q, qi) => (
            <div key={q.id} className="space-y-1.5">
              <p className="text-foreground text-sm font-semibold">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, i) => {
                  const isMine = selections[q.id] === i;
                  const isCorrectOpt = q.correctIndex === i;
                  let cls =
                    "border-border hover:border-violet-300 dark:hover:border-violet-700 hover:bg-muted/50";
                  if (answered) {
                    if (isCorrectOpt)
                      cls = "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                    else if (isMine)
                      cls = "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400";
                    else cls = "border-border/60 opacity-60";
                  } else if (isMine) {
                    cls = "border-violet-500/70 bg-violet-500/10 text-violet-700 dark:text-violet-300";
                  }
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        !answered &&
                        setSelections((prev) => ({ ...prev, [q.id]: i }))
                      }
                      disabled={answered}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm font-medium text-left transition-all ${cls} ${
                        answered ? "cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {answered && isCorrectOpt && (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        {answered && isMine && !isCorrectOpt && (
                          <X className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {!answered && (
          <button
            onClick={handleSubmitAll}
            disabled={!allSelected || submitting}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("quizSubmitQuizBtn")}
          </button>
        )}

        {answered && (
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              quiz.myAttempt!.correctCount === quiz.myAttempt!.totalQuestions
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground/80"
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            {quiz.myAttempt!.correctCount}/{quiz.myAttempt!.totalQuestions}{" "}
            {t("quizCorrectCountLabel")} · {fmtSec(quiz.myAttempt!.timeTakenMs)}
            {t("quizTimeSecLabel")}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {quiz.answerCount}{" "}
              {t("quizParticipantsLabel")}
            </span>
            {quiz.avgScorePercent != null && (
              <span>
                {quiz.avgScorePercent}% {t("quizAvgScoreLabel")}
              </span>
            )}
          </div>
          {canViewResults && (
            <button
              onClick={toggleResults}
              className="flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              {showResults ? t("quizHideResultsBtn") : t("quizViewResultsBtn")}
              {showResults ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {canViewResults && showResults && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("quizResultsTitle")}
          </p>
          {loadingResults ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : !results || results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              {t("quizResultsEmpty")}
            </p>
          ) : (
            <div className="space-y-1">
              {results.map((r) => (
                <div
                  key={r.userId}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs"
                >
                  <span className="w-5 text-center text-muted-foreground shrink-0">
                    {r.rank}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGrad(r.userName)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}
                  >
                    {initials(r.userName)}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-medium text-foreground">
                    {r.userName}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {fmtSec(r.timeTakenMs)}
                    {t("quizTimeSecLabel")}
                  </span>
                  <span
                    className={`font-bold shrink-0 ${
                      r.correctCount === r.totalQuestions
                        ? "text-emerald-500"
                        : "text-foreground"
                    }`}
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
  );
}

// ─── Leaderboard panel ──────────────────────────────────────────────────────
function QuizLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const { t } = useLanguage();
  const medals = ["", "🥇", "🥈", "🥉"];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-amber-500" />
        <p className="text-foreground text-sm font-bold">
          {t("quizLeaderboardTitle")}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-6">
          {t("quizLeaderboardEmpty")}
        </p>
      ) : (
        rows.slice(0, 10).map((r) => (
          <div
            key={r.userId}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${r.rank <= 3 ? "bg-muted/60" : ""}`}
          >
            <span
              className={`w-5 text-center text-xs shrink-0 ${r.rank <= 3 ? "text-amber-500" : "text-muted-foreground"}`}
            >
              {r.rank <= 3 ? medals[r.rank] : r.rank}
            </span>
            <div
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarGrad(r.userName)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
            >
              {initials(r.userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-xs font-semibold truncate">
                {r.userName}
              </p>
              {r.avgTimeMs != null && (
                <p className="text-muted-foreground text-[10px] flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {fmtSec(r.avgTimeMs)}
                  {t("quizTimeSecLabel")}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-foreground text-xs font-bold">
                {r.correctCount}/{r.totalQuestions}
              </p>
              <p className="text-muted-foreground text-[10px]">
                {t("quizRankCorrectLabel")}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main section ───────────────────────────────────────────────────────────
export function QuizSection() {
  const { t } = useLanguage();
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start max-w-5xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 dark:bg-violet-500/20 text-white dark:text-violet-300 dark:border dark:border-violet-400/30 hover:bg-violet-700 dark:hover:bg-violet-500/35 transition-colors text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> {t("quizCreateBtn")}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Trophy className="w-7 h-7 opacity-40" />
            </div>
            <p className="font-semibold text-sm">{t("quizEmpty")}</p>
            <p className="text-xs mt-1 opacity-60">{t("quizEmptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((q) => (
              <QuizCard key={q.id} quiz={q} onAnswered={load} onDeleted={load} />
            ))}
          </div>
        )}
      </div>

      <div className="hidden lg:block sticky top-4">
        <QuizLeaderboard rows={leaderboard} />
      </div>

      {showCreate && (
        <CreateQuizDialog onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}
