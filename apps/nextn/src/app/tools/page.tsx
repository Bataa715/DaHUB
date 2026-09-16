"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { getTools } from "@/lib/tools-config";
import { HubPage, toHubItem } from "@/components/shared/HubPage";

/** Нүүр хуудасны "Хэрэгсэл" хэсэг — аудитын ажлын хэрэгслүүд. */
export default function ToolsHubPage() {
  const { t } = useLanguage();
  return (
    <HubPage
      title={t("homeSectionTools")}
      accent="from-emerald-500 to-teal-700"
      sections={[
        {
          id: "tools",
          items: getTools(t)
            .filter((tool) => tool.section === "tool" && !tool.hidden)
            .map(toHubItem),
        },
      ]}
    />
  );
}
