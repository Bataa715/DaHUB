"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Users2, Wallet } from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { HUB_CONTAINER, HubCard } from "@/components/shared/HubPage";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useZainiiAuditAccess } from "./_access";

interface MonitorCard {
  id: string;
  /** Энэ картыг харуулах эсэхийг эрхээс тодорхойлно */
  needs: "relatedParty" | "expense";
  titleKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
}

const MONITOR_CARDS: MonitorCard[] = [
  {
    id: "related-party-transactions",
    needs: "relatedParty",
    titleKey: "zaBoxRelatedPartyTitle",
    icon: Users2,
    href: "/tools/zainii-audit/related-party",
    gradient: "from-orange-500 to-red-500",
  },
  {
    id: "expense",
    needs: "expense",
    titleKey: "zaBoxExpenseTitle",
    icon: Wallet,
    href: "/tools/zainii-audit/expense",
    gradient: "from-sky-500 to-blue-600",
  },
];

/** Хадгалсан хуучин холбоос (?tool=...) — шинэ маршрут руу дамжуулна. */
const LEGACY_ROUTES: Record<string, string> = {
  "related-party": "/tools/zainii-audit/related-party",
  expense: "/tools/zainii-audit/expense",
  "expense-monitoring": "/tools/zainii-audit/expense",
};

function ZainiiAuditHome() {
  const { t } = useLanguage();
  const router = useRouter();
  const access = useZainiiAuditAccess();
  const legacy = LEGACY_ROUTES[useSearchParams().get("tool") ?? ""];

  useEffect(() => {
    if (legacy) router.replace(legacy);
  }, [legacy, router]);

  // Хэрэглэгчид эрх нь байгаа картыг л харуулна. Эрхгүй картыг харуулаад
  // дарахад нь 403 өгөх нь эвгүй тул огт үзүүлэхгүй.
  const cards = MONITOR_CARDS.filter((c) =>
    c.needs === "relatedParty" ? access.canRelatedParty : access.canExpense,
  );

  if (legacy) return null;

  return (
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        icon={<Activity className="w-4 h-4 text-orange-400" />}
        title={t("toolZainiiAuditTitle")}
      />

      <div className={cn(HUB_CONTAINER, "py-10")}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {cards.map((card, i) => (
            <HubCard
              key={card.id}
              href={card.href}
              icon={card.icon}
              title={t(card.titleKey)}
              tag={t("toolZainiiAuditTitle")}
              gradient={card.gradient}
              index={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ZainiiAuditPage() {
  return (
    <Suspense>
      <ZainiiAuditHome />
    </Suspense>
  );
}
