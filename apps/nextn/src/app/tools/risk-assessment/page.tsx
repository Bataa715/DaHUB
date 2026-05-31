"use client";

import { useRouter } from "next/navigation";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ShieldAlert,
  Activity,
  ClipboardList,
  ChevronRight,
} from "lucide-react";

export default function RiskAssessmentPage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-rose-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title={t("toolRiskAssessmentTitle")}
        subtitle={t("riskBranchSubtitle")}
      />
      <div className="container mx-auto px-4 py-10 flex-1 max-w-[900px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Card 1: Эрсдэлийн үнэлгээ хийх */}
          <button
            onClick={() => router.push("/tools/risk-assessment/work")}
            className="group rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-rose-500/40 transition-all text-left p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-rose-500" />
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground mb-1">
                {t("riskDoAssessCardTitle")}
              </div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              {t("toolsOpen")} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>

          {/* Card 2: Эрсдэлийн хяналт */}
          <button
            onClick={() => router.push("/tools/risk-assessment/hyanalt")}
            className="group rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all text-left p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-500" />
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground mb-1">
                {t("riskMonitorCardTitle")}
              </div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {t("toolsOpen")} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
