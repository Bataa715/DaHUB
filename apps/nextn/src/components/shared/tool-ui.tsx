"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Хэрэгслийн хуудсуудын дундын загвар.
 *
 * Зорилго: хуудас бүр өөрийн өргөн, радиус, аксент өнгө зохиохоо болих.
 * Дүрэм: нэг контейнер, нэг радиус (rounded-2xl), нэг хүрээ (border-border),
 * аксент нь `primary` — бусад өнгө зөвхөн утга илэрхийлэхэд (амжилт/сануулга/эрсдэл).
 */

/** Самбарын харагдах байдал — shadcn Card дээр ч, энгийн div дээр ч ижил үр дүн. */
export const TOOL_PANEL =
  "rounded-2xl border border-border bg-card shadow-none";
export const TOOL_PANEL_HEADER =
  "flex flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border px-5 py-3.5";
export const TOOL_PANEL_TITLE =
  "flex items-center gap-2 text-sm font-bold tracking-tight text-foreground";
export const TOOL_PANEL_BODY = "p-5";

/** Контентын контейнер — бүх хэрэгслийн хуудсанд ижил өргөн, ижил ирмэг. */
export const TOOL_CONTAINER =
  "mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8";

/** Хуудасны үндсэн хэсэг — толгойн доорх бүх контент үүн дотор. */
export function ToolBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(TOOL_CONTAINER, "space-y-5 py-6", className)}>
      {children}
    </div>
  );
}

/** Самбар — хуудасны нэг бүлэг контент. Сүүдэргүй, зөвхөн нимгэн хүрээтэй. */
export function ToolPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-2xl border border-border bg-card", className)}
    >
      {children}
    </section>
  );
}

/** Самбарын толгой — гарчиг, тайлбар, баруун талд үйлдлүүд. */
export function ToolPanelHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(TOOL_PANEL_HEADER, className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <Icon
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Самбарын бие. */
export function ToolPanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(TOOL_PANEL_BODY, className)}>{children}</div>;
}

/** Талбарын шошго — бүх хэрэгсэлд ижил хэмжээ, өнгө. */
export const toolLabelClass =
  "mb-1.5 block text-xs font-semibold text-muted-foreground";

/** Оролтын нэгдсэн өндөр/радиус (shadcn Input/Select дээр нэмж өгнө). */
export const toolFieldClass = "h-9 rounded-lg text-sm";

/** Хүснэгт — гаднах хүрээтэй, хэвтээ гүйлгэдэг. */
export function ToolTableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const toolTableClass = "w-full min-w-full text-sm";
export const toolTheadClass = "bg-muted/40";
export const toolThClass =
  "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground";
export const toolTdClass = "px-3 py-2.5 border-t border-border/60 align-top";

/** Хоосон төлөв — үр дүн алга, эсвэл эхлээд шүүлтүүр сонгоно уу. */
export function ToolEmpty({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Тоон үзүүлэлт — шошго дээр, утга доор. */
export function ToolStat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3",
        className,
      )}
    >
      <p className="truncate text-xs font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Шүүлтүүр/үйлдлийн мөр — толгойн доор наалддаг (толгой нь h-14). */
export function ToolToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="sticky top-14 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div
        className={cn(
          TOOL_CONTAINER,
          "flex flex-wrap items-center gap-2 py-2.5",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Хэвтээ мөрөн график — ангилал бүрийн тоо (эрсдэл, суваг, банк г.м.). */

export function DistributionBars({
  data,
  order,
  labelOf,
  barClassOf = () => "bg-primary",
}: {
  data: Record<string, number>;
  /** Тодорхой дараалал — өгөөгүй бол тоогоор буурахаар */
  order?: string[];
  labelOf: (key: string) => string;
  barClassOf?: (key: string) => string;
}) {
  const keys = order
    ? order.filter((k) => data[k] !== undefined)
    : Object.keys(data).sort((a, b) => data[b] - data[a]);
  const max = Math.max(1, ...keys.map((k) => data[k] ?? 0));

  return (
    <ul className="space-y-3">
      {keys.map((key) => {
        const value = data[key] ?? 0;
        return (
          <li key={key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-foreground">
                {labelOf(key)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {value.toLocaleString()}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", barClassOf(key))}
                style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
