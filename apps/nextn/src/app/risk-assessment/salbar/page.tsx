"use client";

import { BookmarkCheck, ClipboardList } from "lucide-react";
import { HubPage, type HubSection } from "@/components/shared/HubPage";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Салбарын эрсдэлийн үнэлгээний дэд хаб — үнэлгээ хийх, тайлан.
 * Аргачлал тусдаа карт биш: «Үнэлгээ хийх» хуудасны товчоор орно.
 * Хаб өөрөө нээлттэй: эрхгүй хэрэглэгчид карт нь түгжээтэй харагдана
 * (жинхэнэ хамгаалалт нь proxy.ts TOOL_GUARDS + backend @RequireTools).
 */
export default function BranchRiskHubPage() {
  const { t } = useLanguage();

  const sections: HubSection[] = [
    {
      id: "branch",
      items: [
        {
          // [SEC] "Үнэлгээ хийх" (edit) ба "Тайлан" (read-only) нь тусдаа эрх
          // (risk_assessment / risk_assessment_report).
          id: "branch-work",
          href: "/tools/risk-assessment/work",
          icon: ClipboardList,
          title: t("riskDoAssessCardTitle"),
          gradient: "from-rose-500 to-orange-500",
          accessIds: ["risk_assessment"],
        },
        {
          id: "branch-report",
          href: "/tools/risk-assessment/tailan",
          icon: BookmarkCheck,
          title: t("riskReportCardTitle"),
          gradient: "from-blue-500 to-indigo-600",
          accessIds: ["risk_assessment_report"],
        },
      ],
    },
  ];

  return (
    <HubPage
      title={t("toolRiskAssessmentTitle")}
      accent="from-rose-600 to-orange-600"
      sections={sections}
      backHref="/risk-assessment"
    />
  );
}
