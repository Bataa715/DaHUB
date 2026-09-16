"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTools } from "@/lib/tools-config";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./AccountMenu";
import { isDashboardRoute } from "./DashboardShell";
import { HUB_BG } from "./HubPage";

interface ToolPageHeaderProps {
  /** Буцах зам. Өгөөгүй (эсвэл "/") бол хэрэгслийн хэсгийг (Хэрэгсэл/Дашбоард) автоматаар олно. */
  href?: string;
  onBack?: () => void;
  icon: ReactNode;
  title: string;
  rightContent?: ReactNode;
}

const roundBtn =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export default function ToolPageHeader({
  href,
  onBack,
  icon,
  title,
  rightContent,
}: ToolPageHeaderProps) {
  const { t } = useLanguage();
  const pathname = usePathname();

  // Одоогийн зам аль хэрэгсэлд хамаарахыг (хамгийн урт prefix) олж, буцах замыг тодорхойлно.
  // Бүртгэлийн href дээр query байж болно — зөвхөн замаар нь тааруулна.
  const tool = getTools(t)
    .map((item) => ({ section: item.section, path: item.href.split("?")[0] }))
    .filter(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0];

  // Дашбоард: /dashboard нь эхний самбар руу буцааж чиглүүлдэг тул буцах товч нүүр рүү.
  const sectionHref =
    tool?.section === "tool"
      ? "/tools"
      : tool?.section === "risk"
        ? "/risk-assessment"
        : "/";
  const backHref =
    href && href !== "/" ? href : sectionHref !== pathname ? sectionHref : "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full min-w-0 max-w-full shrink-0 text-white",
        HUB_BG,
      )}
    >
      {/* h-14 хэвээр — Зардлын хяналт г.м. хуудсууд доороо `sticky top-14` мөртэй. */}
      <div className="flex h-14 min-w-0 items-center gap-3 px-4 sm:px-8 lg:px-12 2xl:px-16">
        {/* Дашбоард дээр зүүн цэсэнд "Нүүр хуудас" байгаа тул буцах товч давхардана */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("back")}
            title={t("back")}
            className={roundBtn}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : isDashboardRoute(pathname) ? null : (
          <Link
            href={backHref}
            aria-label={t("back")}
            title={t("back")}
            className={roundBtn}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}

        {/* Зөвхөн хуудасны icon + нэр */}
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="flex shrink-0 items-center">{icon}</span>
          <span className="truncate font-bold tracking-tight">{title}</span>
        </div>

        {rightContent && (
          <div className="flex max-w-[55%] shrink-0 items-center gap-2 overflow-x-auto scrollbar-none">
            {rightContent}
          </div>
        )}
        <AccountMenu />
      </div>
    </header>
  );
}
