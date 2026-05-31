"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdminPageHeaderProps {
  href?: string;
  icon?: ReactNode;
  title: string;
  rightContent?: ReactNode;
}

export default function AdminPageHeader({
  href = "/admin",
  icon,
  title,
  rightContent,
}: AdminPageHeaderProps) {
  const { t } = useLanguage();
  return (
    <div className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
        <Link
          href={href}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-foreground">{title}</span>
        </div>
        {rightContent && <div className="ml-auto">{rightContent}</div>}
      </div>
    </div>
  );
}
