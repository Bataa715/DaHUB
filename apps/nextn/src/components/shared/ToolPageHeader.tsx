"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ToolPageHeaderProps {
  href?: string;
  onBack?: () => void;
  icon: ReactNode;
  title: string;
  rightContent?: ReactNode;
}

export default function ToolPageHeader({
  href = "/",
  onBack,
  icon,
  title,
  rightContent,
}: ToolPageHeaderProps) {
  const { t } = useLanguage();

  return (
    // h-14 + border-b ижил box — sidebar толгойтой 1px зөрөхгүй.
    // shrink-0: урт хүснэгт/их өгөгдөл үед flex багана header-ийг шахахгүй.
    // min-w-0 max-w-full: өргөн table page-ийг тэлэхэд header дагаж сунахгүй.
    <div className="sticky top-0 z-20 shrink-0 h-14 min-h-14 w-full min-w-0 max-w-full px-4 flex items-center gap-3 border-b border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl box-border">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm shrink-0"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          {t("back")}
        </button>
      ) : (
        <Link
          href={href}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm shrink-0"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          {t("back")}
        </Link>
      )}
      <span className="text-border/70 select-none shrink-0">/</span>
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <span className="shrink-0 flex items-center">{icon}</span>
        <span className="text-sm font-semibold text-foreground tracking-tight truncate leading-none">
          {title}
        </span>
      </div>
      {rightContent && (
        <div className="ml-auto flex items-center gap-2 shrink-0 max-w-[55%] overflow-x-auto scrollbar-none">
          {rightContent}
        </div>
      )}
    </div>
  );
}
