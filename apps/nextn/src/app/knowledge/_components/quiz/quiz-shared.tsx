"use client";

// Quiz хэсгийн төрөл, өнгө, жижиг бүрдлүүд.
import { QuizQuestionInput } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number | null;
}

export interface QuizItem {
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

export interface QuizResultRow {
  rank: number;
  userId: string;
  userName: string;
  correctCount: number;
  totalQuestions: number;
  timeTakenMs: number;
  answeredAt: string;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  totalAttempts: number;
  correctCount: number;
  totalQuestions: number;
  avgTimeMs: number | null;
}

export const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
];
// Quiz бүр тогтмол өнгөтэй (id-аас) — жагсаалт солигдоход өнгө нь үсрэхгүй.
export const QUIZ_GRADIENTS = [
  "from-violet-600 via-indigo-600 to-blue-700",
  "from-amber-500 via-orange-600 to-rose-700",
  "from-emerald-500 via-teal-600 to-cyan-700",
  "from-rose-500 via-pink-600 to-fuchsia-700",
  "from-sky-500 via-blue-600 to-indigo-700",
];
export const MEDAL_GRADIENTS: Record<number, string> = {
  1: "from-amber-200 to-yellow-500",
  2: "from-slate-100 to-slate-400",
  3: "from-orange-200 to-amber-700",
};
export const OPTION_LETTERS = "ABCDEF";

export function hashIndex(value: string, size: number) {
  let h = 0;
  for (let i = 0; i < value.length; i++)
    h = (h * 31 + value.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % size;
}
export const avatarGrad = (name: string) =>
  AVATAR_COLORS[hashIndex(name, AVATAR_COLORS.length)];
export const quizGradient = (id: string) =>
  QUIZ_GRADIENTS[hashIndex(id, QUIZ_GRADIENTS.length)];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
export function fmtSec(ms: number) {
  return (ms / 1000).toFixed(1);
}

export const emptyQuestion = (): QuizQuestionInput => ({
  question: "",
  options: ["", ""],
  correctIndex: 0,
});

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#07070c] text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#07070c] dark:hover:bg-blue-100";
export const fieldClass =
  "w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

export function RankBadge({ rank }: { rank: number }) {
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

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
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
