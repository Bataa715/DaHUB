import type { TranslationKey } from "@/contexts/LanguageContext";
import {
  Dice6,
  Table2,
  FileText,
  FileSpreadsheet,
  Database,
  BellDot,
  ShieldAlert,
  Activity,
} from "lucide-react";

export interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  glow: string;
  tag: string;
  matchIds?: string[]; // if set, tool is visible if user has ANY of these tool ids
}

// Shared tool catalog — used by the Sidebar (main nav) and the legacy /tools grid page.
// Keep this the single source of truth for tool metadata (icon, route, access id).
export function getTools(t: (key: TranslationKey) => string): Tool[] {
  return [
    {
      id: "sanamsargui-tuuwer",
      title: t("toolSampleTitle"),
      description: t("toolSampleDesc"),
      icon: Dice6,
      href: "/tools/sanamsargui-tuuwer",
      gradient: "from-violet-500 to-indigo-500",
      glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
      tag: "Audit",
    },
    {
      id: "pivot",
      title: t("toolPivotTitle"),
      description: t("toolPivotDesc"),
      icon: Table2,
      href: "/tools/pivot",
      gradient: "from-cyan-500 to-blue-500",
      glow: "shadow-cyan-500/20 group-hover:shadow-cyan-500/40",
      tag: "Analysis",
    },
    {
      id: "tailan",
      matchIds: ["tailan", "tailan_dept_head"],
      title: t("toolReportTitle"),
      description: t("toolReportDesc"),
      icon: FileText,
      href: "/tools/tailan",
      gradient: "from-violet-500 to-purple-500",
      glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
      tag: "Report",
    },
    {
      id: "db_access_requester",
      title: t("toolDbRequestTitle"),
      description: t("toolDbRequestDesc"),
      icon: Database,
      href: "/tools/db-access",
      gradient: "from-cyan-500 to-teal-500",
      glow: "shadow-cyan-500/20 group-hover:shadow-cyan-500/40",
      tag: "Security",
    },
    {
      id: "db_access_granter",
      title: t("toolDbGrantTitle"),
      description: t("toolDbGrantDesc"),
      icon: Database,
      href: "/tools/db-access/manage",
      gradient: "from-violet-500 to-indigo-500",
      glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
      tag: "Security",
    },
    {
      id: "reports",
      matchIds: ["reports"],
      title: t("toolReportsTitle"),
      description: t("toolReportsDesc"),
      icon: FileSpreadsheet,
      href: "/tools/reports",
      gradient: "from-emerald-500 to-violet-500",
      glow: "shadow-emerald-500/20 group-hover:shadow-emerald-500/40",
      tag: "Report",
    },
    {
      id: "data_doc",
      title: t("toolDataDocTitle"),
      description: t("toolDataDocDesc"),
      icon: Database,
      href: "/tools/data-doc",
      gradient: "from-teal-500 to-cyan-500",
      glow: "shadow-teal-500/20 group-hover:shadow-teal-500/40",
      tag: "Data",
    },
    {
      id: "alert_box",
      title: t("toolAlertBoxTitle"),
      description: t("toolAlertBoxDesc"),
      icon: BellDot,
      href: "/tools/alert-box",
      gradient: "from-red-500 to-rose-500",
      glow: "shadow-red-500/20 group-hover:shadow-red-500/40",
      tag: "Audit",
    },
    {
      id: "risk_assessment",
      title: t("toolRiskAssessmentTitle"),
      description: t("toolRiskAssessmentDesc"),
      icon: ShieldAlert,
      href: "/tools/risk-assessment",
      gradient: "from-rose-500 to-orange-500",
      glow: "shadow-rose-500/20 group-hover:shadow-rose-500/40",
      tag: "Risk",
    },
    {
      id: "monitoring_box",
      title: t("toolMonitoringBoxTitle"),
      description: t("toolMonitoringBoxDesc"),
      icon: Activity,
      href: "/tools/monitoring-box",
      gradient: "from-orange-500 to-red-500",
      glow: "shadow-orange-500/20 group-hover:shadow-orange-500/40",
      tag: "Audit",
    },
  ];
}
