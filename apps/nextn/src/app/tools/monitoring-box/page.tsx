"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, Users2, Wallet, ChevronRight } from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import { RelatedPartyTool } from "./_RelatedPartyTool";
import { ExpenseMonitoringTool } from "./_ExpenseMonitoringTool";

interface MonitorCard {
  id: string;
  titleKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  accent: string;
  status: "live" | "soon";
}

const MONITOR_CARDS: MonitorCard[] = [
  {
    id: "related-party-transactions",
    titleKey: "monBoxRelatedPartyTitle",
    icon: Users2,
    href: "/tools/monitoring-box?tool=related-party",
    accent: "orange",
    status: "live",
  },
  {
    id: "expense-monitoring",
    titleKey: "monBoxExpenseTitle",
    icon: Wallet,
    href: "/tools/monitoring-box?tool=expense-monitoring",
    accent: "blue",
    status: "live",
  },
];

const ACCENT = {
  orange: {
    iconWrap: "bg-orange-500/10 border-orange-500/20",
    icon: "text-orange-500",
    hoverBorder: "hover:border-orange-500/40",
    hoverChevron: "group-hover:text-orange-500",
    open: "text-orange-600 dark:text-orange-400",
  },
  blue: {
    iconWrap: "bg-sky-500/10 border-sky-500/20",
    icon: "text-sky-500",
    hoverBorder: "hover:border-sky-500/40",
    hoverChevron: "group-hover:text-sky-500",
    open: "text-sky-600 dark:text-sky-400",
  },
} as const;

function MonitoringBoxHome() {
  const { t } = useLanguage();
  return (
    <div className="bg-background text-foreground">
      <ToolPageHeader
        icon={<Activity className="w-4 h-4 text-orange-500" />}
        title={t("toolMonitoringBoxTitle")}
      />

      <div className="w-full px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {MONITOR_CARDS.map((card) => {
            const Icon = card.icon;
            const disabled = card.status === "soon";
            const a = ACCENT[card.accent as keyof typeof ACCENT] ?? ACCENT.orange;

            const CardInner = (
              <div
                className={`group rounded-2xl border border-border bg-card shadow-premium ring-hairline text-left p-6 flex flex-col gap-4 h-full transition-all duration-300
                  ${
                    disabled
                      ? "opacity-60 cursor-not-allowed"
                      : `${a.hoverBorder} hover:shadow-premium-lg hover:-translate-y-0.5 cursor-pointer`
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center ${a.iconWrap}`}
                  >
                    <Icon className={`w-6 h-6 ${a.icon}`} />
                  </div>
                  {disabled ? (
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-md px-2 py-0.5">
                      {t("monBoxComingSoon")}
                    </span>
                  ) : (
                    <ChevronRight
                      className={`w-5 h-5 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all ${a.hoverChevron}`}
                    />
                  )}
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {t(card.titleKey)}
                </div>
                {!disabled && (
                  <span
                    className={`mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold ${a.open}`}
                  >
                    {t("toolsOpen")} <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            );

            return disabled ? (
              <div key={card.id}>{CardInner}</div>
            ) : (
              <Link key={card.id} href={card.href} className="block">
                {CardInner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonitoringBoxView() {
  const searchParams = useSearchParams();
  const tool = searchParams.get("tool");
  if (tool === "related-party") {
    return <RelatedPartyTool />;
  }
  if (tool === "expense-monitoring") {
    return <ExpenseMonitoringTool />;
  }
  return <MonitoringBoxHome />;
}

export default function MonitoringBoxPage() {
  return (
    <Suspense>
      <MonitoringBoxView />
    </Suspense>
  );
}
