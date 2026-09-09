"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, Users2, Wallet, ChevronRight } from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import { RelatedPartyTool } from "./_RelatedPartyTool";
import { ExpenseAuditTool } from "./_ExpenseAuditTool";
import { useZainiiAuditAccess } from "./_access";

interface MonitorCard {
  id: string;
  /** Энэ картыг харуулах эсэхийг эрхээс тодорхойлно */
  needs: "relatedParty" | "expense";
  titleKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  accent: string;
  status: "live" | "soon";
}

const MONITOR_CARDS: MonitorCard[] = [
  {
    id: "related-party-transactions",
    needs: "relatedParty",
    titleKey: "zaBoxRelatedPartyTitle",
    icon: Users2,
    href: "/tools/zainii-audit?tool=related-party",
    accent: "orange",
    status: "live",
  },
  {
    id: "expense",
    needs: "expense",
    titleKey: "zaBoxExpenseTitle",
    icon: Wallet,
    href: "/tools/zainii-audit?tool=expense",
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

function ZainiiAuditHome() {
  const { t } = useLanguage();
  const access = useZainiiAuditAccess();

  // Хэрэглэгчид эрх нь байгаа картыг л харуулна. Эрхгүй картыг харуулаад
  // дарахад нь 403 өгөх нь эвгүй тул огт үзүүлэхгүй.
  const cards = MONITOR_CARDS.filter((c) =>
    c.needs === "relatedParty" ? access.canRelatedParty : access.canExpense,
  );

  return (
    <div className="bg-background text-foreground">
      <ToolPageHeader
        icon={<Activity className="w-4 h-4 text-orange-500" />}
        title={t("toolZainiiAuditTitle")}
      />

      <div className="w-full px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {cards.map((card) => {
            const Icon = card.icon;
            const disabled = card.status === "soon";
            const a =
              ACCENT[card.accent as keyof typeof ACCENT] ?? ACCENT.orange;

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
                      {t("zaBoxComingSoon")}
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

function ZainiiAuditView() {
  const searchParams = useSearchParams();
  const access = useZainiiAuditAccess();
  const tool = searchParams.get("tool");

  // `?tool=` параметрийг гараар бичих боломжтой тул энд ч эрхийг шалгана.
  // Эрхгүй бол картын жагсаалт руу буцаана (backend бас 403 өгнө).
  if (tool === "related-party" && access.canRelatedParty) {
    return <RelatedPartyTool />;
  }
  // "expense-monitoring" нь ХУУЧИН утга — хадгалсан холбоос эвдрэхгүйн тулд
  // хүлээн авсаар байна.
  if (
    (tool === "expense" || tool === "expense-monitoring") &&
    access.canExpense
  ) {
    return <ExpenseAuditTool />;
  }
  return <ZainiiAuditHome />;
}

export default function ZainiiAuditPage() {
  return (
    <Suspense>
      <ZainiiAuditView />
    </Suspense>
  );
}
