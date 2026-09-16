"use client";

// Quiz-ийн тэргүүлэгчдийн самбар.
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Clock, Trophy } from "lucide-react";
import { HERO_BG } from "../magazine/Primitives";
import {
  LeaderboardRow,
  MEDAL_GRADIENTS,
  fmtSec,
  RankBadge,
  Avatar,
} from "./quiz-shared";

// ─── Leaderboard panel ──────────────────────────────────────────────────────
export function Podium({
  row,
  height,
}: {
  row: LeaderboardRow;
  height: string;
}) {
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

export function QuizLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
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
