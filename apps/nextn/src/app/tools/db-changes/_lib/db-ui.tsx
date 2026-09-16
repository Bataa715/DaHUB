import { toolFieldClass } from "@/components/shared/tool-ui";
import { cn } from "@/lib/utils";

/** Backend `db-changes.logic.ts`-ийн утгуудтай ижил (DB-д хадгалагдсан) */
export const SYSTEM_TYPES = [
  "Кор систем",
  "Картзоне",
  "Интернэт банк",
  "Бусад",
] as const;

export const SQL_COMMANDS = [
  "drop",
  "create",
  "update",
  "delete",
  "other",
] as const;

export const SYSTEM_COLORS: Record<string, string> = {
  "Кор систем": "#2563eb",
  Картзоне: "#f59e0b",
  "Интернэт банк": "#10b981",
  Бусад: "#94a3b8",
};

const COMMAND_STYLE: Record<string, string> = {
  drop: "bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400",
  create: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  update:
    "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
  delete:
    "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400",
  other: "bg-muted text-muted-foreground ring-border",
};

export const COMMAND_BAR: Record<string, string> = {
  drop: "bg-red-500",
  create: "bg-sky-500",
  update: "bg-amber-500",
  delete: "bg-orange-500",
  other: "bg-slate-400",
};

export function CommandBadge({ command }: { command: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-inset",
        COMMAND_STYLE[command] ?? COMMAND_STYLE.other,
      )}
    >
      {command.toUpperCase()}
    </span>
  );
}

export const selectClass = cn(
  toolFieldClass,
  "border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
);

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Сүүлийн N хоног (өнөөдрийг оруулаад) */
export function lastDays(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { startDate: ymd(start), endDate: ymd(end) };
}

/** Өмнөх систем 14 хоногийн тайлан гаргадаг байсан тул 14 анхдагч */
export const PRESETS = [
  { days: 7, labelKey: "nnPeriod7" },
  { days: 14, labelKey: "nnPeriod14" },
  { days: 28, labelKey: "nnPeriod28" },
] as const;
