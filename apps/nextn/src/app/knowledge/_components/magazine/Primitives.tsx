"use client";

import { createElement, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KnowledgeCoverImage } from "../KnowledgeCoverImage";
import {
  categoryIcon,
  getAvatarColor,
  getCat,
  getInitials,
  hasKnowledgeImage,
  isCyberCategory,
  type News,
} from "../../_lib/knowledge-utils";

/** Карт бүхэлдээ дарагддаг — гар (Enter/Space) болон screen reader-т ч ажиллана. */
export function cardA11y(onOpen: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
  };
}

export function AuthorAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-bold text-white",
        getAvatarColor(name),
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

/**
 * Нийтлэлийн нүүр зураг. Зураггүй (эсвэл татаж чадаагүй) үед ангиллын
 * градиент + icon харагдана — карт хэзээ ч хоосон саарал болохгүй.
 */
/** Кибер мэдээний тор — терминал маягийн ногоон сүлжээ */
const CYBER_GRID = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(16,185,129,0.22) 0 1px, transparent 1px 14px), repeating-linear-gradient(90deg, rgba(16,185,129,0.22) 0 1px, transparent 1px 14px)",
} as const;

export function CoverArt({
  news,
  className,
  iconClassName,
}: {
  news: News;
  className?: string;
  iconClassName?: string;
}) {
  const cyber = isCyberCategory(news.category);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden bg-gradient-to-br",
        getCat(news.category).gradient,
        className,
      )}
    >
      {cyber && (
        <>
          <div aria-hidden className="absolute inset-0" style={CYBER_GRID} />
          <div
            aria-hidden
            className="absolute -left-6 -top-10 h-32 w-32 rounded-full bg-emerald-400/30 blur-2xl"
          />
        </>
      )}
      {createElement(categoryIcon(news.category), {
        "aria-hidden": true,
        strokeWidth: 1.25,
        className: cn(
          "absolute -bottom-6 -right-6 h-40 w-40",
          cyber ? "text-emerald-300/40" : "text-white/15",
          iconClassName,
        ),
      })}
      {hasKnowledgeImage(news.imageUrl) && (
        <KnowledgeCoverImage
          path={news.imageUrl}
          alt={news.title}
          fill
          className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      )}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-8 text-lg font-bold tracking-tight text-foreground sm:text-xl">
      {children}
    </h2>
  );
}

export const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/** Hero-ийн бараан өнгө — carousel-ийн дээд хагаст үргэлжилнэ */
export const HERO_BG = "dark-surface bg-[#07070c]";
