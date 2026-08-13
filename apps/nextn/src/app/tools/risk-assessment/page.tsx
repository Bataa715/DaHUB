"use client";

import { useRouter } from "next/navigation";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldAlert,
  ClipboardList,
  ChevronRight,
  BookmarkCheck,
} from "lucide-react";

export default function RiskAssessmentPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();

  // [SEC] "Эрсдэлийн үнэлгээ хийх" (edit) and "Тайлан" (read-only report) are
  // now separately grantable tools (risk_assessment / risk_assessment_report)
  // — hide whichever card the user doesn't actually have access to, instead
  // of letting them click through and bounce off the middleware redirect.
  const isAdmin = !!user?.isAdmin || !!user?.isSuperAdmin;
  const allowedTools = user?.allowedTools ?? [];
  const canDoAssessment = isAdmin || allowedTools.includes("risk_assessment");
  const canViewReport =
    isAdmin || allowedTools.includes("risk_assessment_report");

  return (
    <div className="bg-background text-foreground">
      <ToolPageHeader
        href="/"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title={t("toolRiskAssessmentTitle")}
      />
      <div className="w-full px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {/* Эрсдэлийн үнэлгээ хийх */}
          {canDoAssessment && (
            <button
              onClick={() => router.push("/tools/risk-assessment/work")}
              className="group rounded-2xl border border-border bg-card shadow-premium hover:shadow-premium-lg hover:-translate-y-0.5 hover:border-rose-500/40 ring-hairline transition-all duration-300 text-left p-6 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-rose-500" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground mb-1">
                  {t("riskDoAssessCardTitle")}
                </div>
              </div>
              <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                {t("toolsOpen")} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          )}

          {/* Тайлан */}
          {canViewReport && (
            <button
              onClick={() => router.push("/tools/risk-assessment/tailan")}
              className="group rounded-2xl border border-border bg-card shadow-premium hover:shadow-premium-lg hover:-translate-y-0.5 hover:border-blue-500/40 ring-hairline transition-all duration-300 text-left p-6 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <BookmarkCheck className="w-6 h-6 text-blue-500" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground mb-1">
                  {t("riskReportCardTitle")}
                </div>
              </div>
              <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                {t("toolsOpen")} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
