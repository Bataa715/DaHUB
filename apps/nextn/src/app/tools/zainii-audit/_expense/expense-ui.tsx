"use client";

// Зардлын хяналт — жижиг дэлгэцийн бүрдлүүд (панел, мөр, нүд).
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { fmtAmount } from "./expense-format";

/**
 * Төлбөрийн хүсэлтийн доорх нэмэлт мэдээллийн самбар (хавсралт / төсөв).
 * Товч дарах шаардлагагүй — агуулга нь ачаалагдмагц шууд харагдана.
 */
export function DetailPanel({
  icon,
  title,
  count,
  loading,
  error,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  loading?: boolean;
  error?: string | null;
  empty: string;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const isEmpty = !loading && !error && (count ?? 0) === 0;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/40">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[11px] font-semibold text-foreground">
          {title}
        </span>
        {!loading && !error && (count ?? 0) > 0 && (
          <span className="ml-auto rounded-full bg-foreground/10 px-1.5 text-[11px] font-medium tabular-nums text-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="p-2.5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {t("loading")}
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
        {isEmpty && (
          <div className="text-xs text-muted-foreground/70 italic">{empty}</div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Гэрээний дүн ба бодит гүйлгээний дүнгийн зөрүү.
 * Аудитор нэмэлт тооцоолол хийхгүйгээр хазайлтыг шууд харна.
 */
export function VarianceHint({
  contract,
  actual,
}: {
  contract: number;
  actual: number;
}) {
  const { t } = useLanguage();
  const diff = actual - contract;
  const pct = contract > 0 ? (diff / contract) * 100 : 0;

  if (Math.abs(diff) < 1) {
    return (
      <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
        {t("zaExpVerVarianceEqual")}
      </p>
    );
  }

  const over = diff > 0;
  return (
    <p
      className={cn(
        "mt-1.5 text-[11px] tabular-nums",
        over ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
      )}
    >
      {t("zaExpVerVariance")}: {over ? "+" : "−"}₮{fmtAmount(Math.abs(diff))}
      {" · "}
      {over ? t("zaExpVerVarianceOver") : t("zaExpVerVarianceUnder")}
      {contract > 0 && ` (${over ? "+" : "−"}${Math.abs(pct).toFixed(1)}%)`}
    </p>
  );
}

export function CellPair({ code, name }: { code?: string; name?: string }) {
  const c = (code ?? "").trim();
  const n = (name ?? "").trim();
  if (!c && !n) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      {c ? <div className="font-mono break-all">{c}</div> : null}
      {n ? <div className="text-muted-foreground break-words">{n}</div> : null}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      {label && <div className="text-muted-foreground">{label}</div>}
      <div className="text-foreground whitespace-pre-wrap break-words">
        {value || "—"}
      </div>
    </div>
  );
}

export function StatRow({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="px-4 py-4 flex items-center gap-3 flex-1">
      <div
        className={cn(
          "w-9 h-9 rounded-md border flex items-center justify-center shrink-0",
          tint,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold tabular-nums leading-none mb-1 break-words">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-2 py-2 font-medium text-left align-bottom whitespace-normal break-words bg-card ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  nowrap = false,
}: {
  children: React.ReactNode;
  className?: string;
  nowrap?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 py-2 align-top text-foreground",
        nowrap ? "whitespace-nowrap" : "whitespace-normal break-words",
        className,
      )}
    >
      {children}
    </td>
  );
}
