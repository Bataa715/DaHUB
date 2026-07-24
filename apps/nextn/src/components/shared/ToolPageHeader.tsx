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
    // h-14 + border-b ижил box — sidebar толгойтой 1px зөрөхгүй
    <div className="sticky top-0 z-20 h-14 px-4 flex items-center gap-3 border-b border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          {t("back")}
        </button>
      ) : (
        <Link
          href={href}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          {t("back")}
        </Link>
      )}
      <span className="text-border/70 select-none">/</span>
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="font-semibold text-foreground tracking-tight truncate">
          {title}
        </span>
      </div>
      {rightContent && (
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {rightContent}
        </div>
      )}
    </div>
  );
}
