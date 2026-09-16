"use client";

import ABNotifications from "./ABNotifications";
import ABTabs from "./ABTabs";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { BellDot } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AlertBoxShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLanguage();

  // Дашбоардын зүүн цэс нь самбаруудыг л харуулна — Alert Box-ийн дотоод
  // хуудсууд (Alert/Search/Red Flag/Dashboards) энд товч хэлбэрээр байна.
  return (
    <div className="ab-theme flex h-full min-h-0 flex-1 flex-col">
      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-md">
            <BellDot className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title={t("toolAlertBoxTitle")}
        rightContent={<ABNotifications />}
      />
      <ABTabs />
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto py-6">
        {children}
      </main>
    </div>
  );
}
