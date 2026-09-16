"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import { getTools } from "@/lib/tools-config";
import { getDashboardNav } from "@/components/shared/DashboardShell";
import { HUB_BG, HubPage, toHubItem } from "@/components/shared/HubPage";
import { cn } from "@/lib/utils";

/**
 * Нүүр хуудасны "Дашбоард" хэсэг — захирал голчлон ашигладаг тул хаб карт давхарга
 * алгасаж, эрхтэй эхний самбарыг sidebar-тай шууд нээнэ. Эрхгүй бол түгжигдсэн
 * картуудаар ямар самбар байгааг харуулна.
 */
export default function DashboardEntryPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { loading, canAccess } = useAllowedTools();

  const firstHref = loading
    ? undefined
    : getDashboardNav(t).find((item) => canAccess(item.accessIds))?.href;

  useEffect(() => {
    if (firstHref) router.replace(firstHref);
  }, [firstHref, router]);

  if (loading || firstHref) {
    return (
      <div
        className={cn(
          "dark-surface grid min-h-full flex-1 place-items-center",
          HUB_BG,
        )}
      >
        <Loader2 className="h-7 w-7 animate-spin text-white/60" aria-hidden />
      </div>
    );
  }

  return (
    <HubPage
      title={t("homeSectionDashboard")}
      accent="from-violet-600 to-fuchsia-700"
      sections={[
        {
          id: "dashboards",
          items: getTools(t)
            .filter((tool) => tool.section === "dashboard" && !tool.hidden)
            .map(toHubItem),
        },
      ]}
    />
  );
}
