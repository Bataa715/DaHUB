"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdminPageHeaderProps {
  href?: string;
  icon?: ReactNode;
  title: string;
  rightContent?: ReactNode;
}

/** Админ хуудасны толгой — sidebar-тай хамт, хуудасны нэр + буцах. */
export default function AdminPageHeader({
  href = "/admin/tools",
  icon,
  title,
  rightContent,
}: AdminPageHeaderProps) {
  const { t } = useLanguage();
  return (
    <div className="sticky top-0 z-20 border-b border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl shadow-premium">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
        <Link
          href={href}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
        <span className="select-none text-muted-foreground/30">/</span>
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate font-semibold tracking-tight text-foreground">
            {title}
          </span>
        </div>
        {rightContent && <div className="ml-auto">{rightContent}</div>}
      </div>
    </div>
  );
}
