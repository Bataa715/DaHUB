"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** YYYY-MM → «2025 - 10 сар» */
export function formatMonthMn(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  return `${m[1]} - ${Number(m[2])} сар`;
}

/** Гар бичмэл / формат → YYYY-MM | null */
export function parseMonthInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  let y: string | undefined;
  let mo: string | undefined;

  // 2025 - 10 сар | 2025-10 сар | 2025/10
  let m = s.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*(?:сар)?$/i);
  if (m) {
    y = m[1];
    mo = m[2];
  } else {
    // 2025 10 сар
    m = s.match(/^(\d{4})\s+(\d{1,2})\s*(?:сар)?$/i);
    if (m) {
      y = m[1];
      mo = m[2];
    }
  }

  if (!y || !mo) return null;
  const mi = Number(mo);
  if (mi < 1 || mi > 12) return null;
  return `${y}-${String(mi).padStart(2, "0")}`;
}

/** Өнөөдрөөс хойш 0 … monthsBack сар хүртэл (шинээс хуучин) */
export function buildMonthOptions(monthsBack = 24): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i <= monthsBack; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Өмнөх сар (YYYY-MM) */
export function prevMonthKey(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type MonthFilterProps = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** Зөвхөн энэ сараас өмнөхүүдийг харуулна (YYYY-MM) */
  maxExclusive?: string;
  placeholder?: string;
  ariaLabel?: string;
  allowClear?: boolean;
};

/**
 * Сараар шүүлт — Монгол хаягтай dropdown (5 мөр харагдана, scroll),
 * гараар он/сар засаж болно.
 */
export default function MonthFilter({
  value,
  onChange,
  className,
  maxExclusive,
  placeholder = "ж: 2025 - 10 сар",
  ariaLabel = "Сар",
  allowClear = true,
}: MonthFilterProps) {
  const options = useMemo(() => {
    const all = buildMonthOptions(24);
    if (!maxExclusive) return all;
    return all.filter((k) => k < maxExclusive);
  }, [maxExclusive]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? formatMonthMn(value) : "");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value ? formatMonthMn(value) : "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !value || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-month="${value}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, value]);

  const commitDraft = () => {
    const parsed = parseMonthInput(draft);
    if (parsed) {
      if (maxExclusive && !(parsed < maxExclusive)) {
        setDraft(value ? formatMonthMn(value) : "");
        return;
      }
      onChange(parsed);
      setDraft(formatMonthMn(parsed));
    } else if (!draft.trim()) {
      onChange("");
      setDraft("");
    } else {
      setDraft(value ? formatMonthMn(value) : "");
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex items-center h-7 rounded-md border border-border bg-background overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/40">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              setOpen(false);
            } else if (e.key === "Escape") {
              setDraft(value ? formatMonthMn(value) : "");
              setOpen(false);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="h-full min-w-[9.5rem] flex-1 bg-transparent px-2 text-[11px] font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
          aria-label={ariaLabel}
          title="Гараар засаж эсвэл жагсаалтаас сонгоно"
        />
        {allowClear && value ? (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setDraft("");
              setOpen(false);
            }}
            className="px-1 h-full text-muted-foreground hover:text-foreground"
            title="Цэвэрлэх"
            aria-label="Цэвэрлэх"
          >
            <X className="w-3 h-3" />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className="px-1.5 h-full border-l border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
          aria-label="Сарын жагсаалт"
        >
          <ChevronDown
            className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-40 left-0 top-[calc(100%+4px)] w-full min-w-[11rem] rounded-md border border-border bg-popover shadow-md overflow-y-auto overscroll-contain"
          style={{ maxHeight: "8.75rem" }}
          role="listbox"
        >
          {options.length === 0 ? (
            <div className="px-2.5 h-7 flex items-center text-[11px] text-muted-foreground">
              Сонголт байхгүй
            </div>
          ) : (
            options.map((key) => {
              const active = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  data-month={key}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(key);
                    setDraft(formatMonthMn(key));
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 h-7 text-[11px] font-medium truncate",
                    active
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  {formatMonthMn(key)}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
