"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./AccountMenu";
import { HUB_BG } from "./HubPage";

interface AdminPageHeaderProps {
  href?: string;
  icon?: ReactNode;
  title: string;
  rightContent?: ReactNode;
}

const roundBtn =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

/** Админ хуудасны толгой — үндсэн вэбийн ToolPageHeader-тэй ижил бараан загвар. */
export default function AdminPageHeader({
  href = "/admin",
  icon,
  title,
  rightContent,
}: AdminPageHeaderProps) {
  const { t } = useLanguage();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full min-w-0 shrink-0 text-white",
        HUB_BG,
      )}
    >
      <div className="flex h-14 min-w-0 items-center gap-3 px-4 sm:px-8 lg:px-12 2xl:px-16">
        <Link
          href={href}
          aria-label={t("back")}
          title={t("back")}
          className={roundBtn}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Зөвхөн хуудасны icon + нэр */}
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          {icon && <span className="flex shrink-0 items-center">{icon}</span>}
          <span className="truncate font-bold tracking-tight">{title}</span>
        </div>

        {rightContent && (
          <div className="flex shrink-0 items-center gap-2">{rightContent}</div>
        )}
        <AccountMenu admin />
      </div>
    </header>
  );
}
