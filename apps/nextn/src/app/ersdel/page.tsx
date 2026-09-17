"use client";

import { Building2, Cpu, Workflow } from "lucide-react";
import { HubPage, type HubSection } from "@/components/shared/HubPage";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Нүүр хуудасны "Эрсдэлийн үнэлгээ" хэсэг — 3 үндсэн төрөл, тус бүр тусдаа эрхтэй.
 * Төрөл рүү дарж ороод доторх дэд хуудсууд (үнэлгээ хийх, тайлан) харагдана.
 * /tools/risk-assessment нь салбарын үнэлгээний эрхээр хамгаалагдсан тул хаб
 * энэ хамгаалалтгүй зам дээр байрлана (/dashboard, /tools-тай адил).
 *
 * [ROUTE] Өмнө нь /risk-assessment байсан — прод nginx тэр угтварыг Nest-ийн
 * `risk-assessment` controller руу чиглүүлдэг тул хуудас backend-ийн 404 өгч
 * байв. Next хуудасны дээд түвшний зам Nest controller-ийн угтвартай ХЭЗЭЭ Ч
 * давхцах ёсгүй.
 */
export default function RiskAssessmentHubPage() {
  const { t } = useLanguage();

  const sections: HubSection[] = [
    {
      id: "types",
      items: [
        {
          id: "branch",
          href: "/ersdel/salbar",
          icon: Building2,
          title: t("toolRiskAssessmentTitle"),
          gradient: "from-rose-500 to-orange-500",
          accessIds: ["risk_assessment", "risk_assessment_report"],
        },
        {
          // TODO эрхийн id (VALID_TOOLS) нь хэрэгсэл хөгжүүлэгдэх үед нэмэгдэнэ.
          id: "operational",
          href: "#",
          icon: Workflow,
          title: t("riskOperationalTitle"),
          gradient: "from-violet-500 to-purple-600",
          accessIds: [],
          comingSoon: true,
        },
        {
          id: "it",
          href: "#",
          icon: Cpu,
          title: t("riskItTitle"),
          gradient: "from-cyan-500 to-blue-600",
          accessIds: [],
          comingSoon: true,
        },
      ],
    },
  ];

  return (
    <HubPage
      title={t("homeSectionRisk")}
      accent="from-rose-600 to-orange-600"
      sections={sections}
    />
  );
}
