"use client";

import ABSidebar from "./ABSidebar";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { BellDot } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AlertBoxShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="ab-theme flex flex-col h-full min-h-0">
      <ToolPageHeader
        href="/"
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-md">
            <BellDot className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title={t("toolAlertBoxTitle")}
      />
      <ABSidebar />
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto py-6">
        {children}
      </main>
    </div>
  );
}
