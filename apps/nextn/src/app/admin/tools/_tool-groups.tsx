// Админ → Хэрэгслийн эрх: картын бүлэг, ангилал, эрхийн variant-ууд.
// Variant id нь backend VALID_TOOLS-тай яг таарна (DB өгөгдөл — бүү солино).
import React from "react";
import {
  Dice6,
  Database,
  Building2,
  BellDot,
  ShieldAlert,
  Activity,
  PenLine,
  Network,
  Newspaper,
} from "lucide-react";
import { TranslationKey } from "@/contexts/LanguageContext";

// A "variant" is one concrete grantable tool-key (matches backend VALID_TOOLS).
// Some real-world tools have more than one variant (e.g. DB access has a
// "requester" and a "granter" side) — those used to render as separate cards;
// now they're grouped into a single card with a scenario switcher inside.
export interface ToolVariant {
  id: string;
  labelKey: TranslationKey;
}

// Админ хуудсанд картуудыг бүлэглэх ангилал: хяналт/мониторингийн самбарууд
// ("dashboard") ба ажил гүйцэтгэх хэрэгслүүд ("tool"). Зөвхөн UI бүлэглэл —
// эрхийн id (variants) болон backend-ийн VALID_TOOLS-д нөлөөлөхгүй.
export type ToolCategory = "dashboard" | "tool";

export const TOOL_CATEGORIES: { id: ToolCategory; labelKey: TranslationKey }[] =
  [
    { id: "dashboard", labelKey: "admToolsPageCategoryDashboard" },
    { id: "tool", labelKey: "admToolsPageCategoryTools" },
  ];

export interface ToolGroup {
  id: string;
  category: ToolCategory;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  adminPath?: string;
  adminLabelKey?: TranslationKey;
  variants: ToolVariant[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "sanamsargui-tuuwer",
    category: "tool",
    nameKey: "toolSampleTitle",
    descKey: "admToolsPageSampleDesc",
    icon: Dice6,
    color: "from-violet-500 to-blue-500",
    gradient: "bg-gradient-to-br from-violet-500/20 to-blue-500/20",
    variants: [{ id: "sanamsargui-tuuwer", labelKey: "toolSampleTitle" }],
  },
  {
    id: "db_access",
    category: "tool",
    nameKey: "admToolsPageDbAccessGroupName",
    descKey: "admToolsPageDbAccessGroupDesc",
    icon: Database,
    color: "from-cyan-500 to-teal-500",
    gradient: "bg-gradient-to-br from-cyan-500/20 to-teal-500/20",
    variants: [
      { id: "db_access_requester", labelKey: "admAdminsToolAccessRequester" },
      { id: "db_access_granter", labelKey: "admAdminsToolAccessGranter" },
    ],
  },
  {
    // Салбарын аудит — эрхийн id нь хуучин "reports" хэвээр (DB өгөгдөл).
    id: "reports",
    category: "tool",
    nameKey: "toolBranchAuditTitle",
    descKey: "toolBranchAuditDesc",
    icon: Building2,
    color: "from-emerald-500 to-violet-500",
    gradient: "bg-gradient-to-br from-emerald-500/20 to-violet-500/20",
    variants: [{ id: "reports", labelKey: "toolBranchAuditTitle" }],
  },
  {
    id: "alert_box",
    category: "dashboard",
    nameKey: "toolAlertBoxTitle",
    descKey: "admToolsPageAlertBoxDesc",
    icon: BellDot,
    color: "from-red-500 to-rose-500",
    gradient: "bg-gradient-to-br from-red-500/20 to-rose-500/20",
    adminPath: "/admin/alert-box",
    adminLabelKey: "admToolsPageSettingsArrow",
    variants: [{ id: "alert_box", labelKey: "toolAlertBoxTitle" }],
  },
  {
    id: "risk_assessment",
    category: "dashboard",
    nameKey: "admToolsPageRiskGroupName",
    descKey: "admToolsPageRiskGroupDesc",
    icon: ShieldAlert,
    color: "from-rose-500 to-orange-500",
    gradient: "bg-gradient-to-br from-rose-500/20 to-orange-500/20",
    adminPath: "/admin/risk-indicators",
    adminLabelKey: "admToolsPageSettingsArrow",
    variants: [
      { id: "risk_assessment", labelKey: "toolRiskAssessmentTitle" },
      {
        id: "risk_assessment_report",
        labelKey: "toolRiskAssessmentReportTitle",
      },
    ],
  },
  {
    id: "zainii_audit",
    category: "dashboard",
    nameKey: "toolZainiiAuditTitle",
    descKey: "admToolsPageZainiiAuditDesc",
    icon: Activity,
    color: "from-orange-500 to-red-500",
    gradient: "bg-gradient-to-br from-orange-500/20 to-red-500/20",
    adminPath: "/admin/zainii-audit",
    adminLabelKey: "admToolsPageSettingsArrow",
    variants: [
      { id: "zainii_audit_rpt", labelKey: "zaBoxRelatedPartyTitle" },
      { id: "zainii_audit_expense", labelKey: "zaBoxExpenseTitle" },
    ],
  },
  {
    id: "negative_news",
    category: "tool",
    nameKey: "nnToolTitle",
    descKey: "admToolsPageNegativeNewsDesc",
    icon: Newspaper,
    color: "from-rose-500 to-pink-600",
    gradient: "bg-gradient-to-br from-rose-500/20 to-pink-600/20",
    variants: [
      { id: "negative_news_upload", labelKey: "nnPermUpload" },
      { id: "negative_news_dashboard", labelKey: "nnDashboardTitle" },
    ],
  },
  {
    id: "db_changes",
    category: "tool",
    nameKey: "dbcToolTitle",
    descKey: "admToolsPageDbChangesDesc",
    icon: Database,
    color: "from-violet-500 to-purple-600",
    gradient: "bg-gradient-to-br from-violet-500/20 to-purple-600/20",
    variants: [
      { id: "db_changes_upload", labelKey: "dbcPermUpload" },
      { id: "db_changes_dashboard", labelKey: "dbcDashboardTitle" },
    ],
  },
  {
    id: "network_analysis",
    category: "dashboard",
    nameKey: "netGroupTitle",
    descKey: "admToolsPageNetworkDesc",
    icon: Network,
    color: "from-orange-500 to-sky-600",
    gradient: "bg-gradient-to-br from-orange-500/20 to-sky-600/20",
    variants: [
      { id: "net_config_changes", labelKey: "netConfigTitle" },
      { id: "net_xdr", labelKey: "netXdrTitle" },
    ],
  },
  {
    // Унших нь бүх ажилтанд нээлттэй — энэ эрх нь зөвхөн үүсгэх эрх.
    id: "dag_news",
    category: "tool",
    nameKey: "navNews",
    descKey: "admToolsPageDagNewsDesc",
    icon: PenLine,
    color: "from-blue-500 to-indigo-600",
    gradient: "bg-gradient-to-br from-blue-500/20 to-indigo-600/20",
    adminPath: "/admin/medleg",
    adminLabelKey: "admToolsPageSettingsArrow",
    variants: [
      { id: "medleg_write", labelKey: "knowledgeShare" },
      { id: "quiz_write", labelKey: "quizCreateBtn" },
    ],
  },
];

export interface User {
  id: string;
  userId: string;
  name: string;
  department: string;
  position: string;
  isActive: boolean;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  allowedTools: string[];
}
