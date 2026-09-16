"use client";

// Quiz үүсгэх диалог.
import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { quizApi, QuizQuestionInput } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Check, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { HERO_BG } from "../magazine/Primitives";
import {
  OPTION_LETTERS,
  emptyQuestion,
  primaryBtn,
  fieldClass,
} from "./quiz-shared";

// ─── Create dialog ──────────────────────────────────────────────────────────
export function CreateQuizDialog({
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
