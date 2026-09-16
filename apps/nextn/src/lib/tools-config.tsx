import type { TranslationKey } from "@/contexts/LanguageContext";
import {
  Dice6,
  Building2,
  Database,
  BellDot,
  Network,
  Newspaper,
  ShieldAlert,
  Users2,
  Wallet,
} from "lucide-react";

/** Нүүр хуудасны аль үндсэн хэсэгт харагдах вэ (Хэрэгсэл / Dashboard / Эрсдэлийн үнэлгээ). */
export type ToolSection = "tool" | "dashboard" | "risk";

export interface Tool {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  glow: string;
  tag: string;
  section: ToolSection;
  matchIds?: string[]; // if set, tool is visible if user has ANY of these tool ids
  /**
   * Түр хаасан хэрэгсэл — хаб хуудас болон нүүрэнд карт нь харагдахгүй.
   * Код, маршрут, эрхийн хамгаалалт хэвээр (шууд холбоосоор орж болно).
   */
  hidden?: boolean;
}

// Shared tool catalog — нүүр хуудасны хэсгүүд болон /tools, /dashboard хаб хуудсууд.
// Keep this the single source of truth for tool metadata (icon, route, access id).
export function getTools(t: (key: TranslationKey) => string): Tool[] {
  return [
    {
      id: "sanamsargui-tuuwer",
      title: t("toolSampleTitle"),
      icon: Dice6,
      href: "/tools/sanamsargui-tuuwer",
      gradient: "from-violet-500 to-indigo-500",
      glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
      tag: "Audit",
      section: "tool",
    },
    {
      id: "db_access_requester",
      title: t("toolDbRequestTitle"),
      icon: Database,
      href: "/tools/db-access",
      gradient: "from-cyan-500 to-teal-500",
      glow: "shadow-cyan-500/20 group-hover:shadow-cyan-500/40",
      tag: "Security",
      section: "tool",
      hidden: true,
    },
    {
      id: "db_access_granter",
      title: t("toolDbGrantTitle"),
      icon: Database,
      href: "/tools/db-access/manage",
      gradient: "from-violet-500 to-indigo-500",
      glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
      tag: "Security",
      section: "tool",
      hidden: true,
    },
    {
      // Харилцсан гүйлгээ — Зайны аудитын дэд хэрэгсэл, хэрэгслийн хэсэгт харагдана.
      id: "zainii_audit_rpt",
      title: t("zaBoxRelatedPartyTitle"),
      icon: Users2,
      href: "/tools/zainii-audit/related-party",
      gradient: "from-orange-500 to-red-500",
      glow: "shadow-orange-500/20 group-hover:shadow-orange-500/40",
      tag: "Audit",
      section: "tool",
    },
    {
      // Сөрөг мэдээ — Excel-ээр бүртгэл оруулах
      id: "negative_news_upload",
      title: t("nnToolTitle"),
      icon: Newspaper,
      href: "/tools/negative-news",
      gradient: "from-rose-500 to-pink-600",
      glow: "shadow-rose-500/20 group-hover:shadow-rose-500/40",
      tag: "Audit",
      section: "tool",
    },
    {
      // Өгөгдлийн сангийн өөрчлөлт — audit trail оруулах, бичлэг хянах
      id: "db_changes_upload",
      title: t("dbcToolTitle"),
      icon: Database,
      href: "/tools/db-changes",
      gradient: "from-violet-500 to-purple-600",
      glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
      tag: "Audit",
      section: "tool",
    },
    {
      // Салбарын аудит — эрхийн id нь хуучин "reports" хэвээр (DB өгөгдөл).
      id: "reports",
      matchIds: ["reports"],
      title: t("toolBranchAuditTitle"),
      icon: Building2,
      href: "/tools/salbar-audit",
      gradient: "from-emerald-500 to-violet-500",
      glow: "shadow-emerald-500/20 group-hover:shadow-emerald-500/40",
      tag: "Audit",
      section: "tool",
    },
    {
      id: "alert_box",
      title: t("toolAlertBoxTitle"),
      icon: BellDot,
      href: "/tools/alert-box",
      gradient: "from-red-500 to-rose-500",
      glow: "shadow-red-500/20 group-hover:shadow-red-500/40",
      tag: "Audit",
      section: "dashboard",
    },
    {
      // Зардлын хяналт — дашбоард (удирдлага өдөр тутам хардаг).
      id: "zainii_audit_expense",
      title: t("zaBoxExpenseTitle"),
      icon: Wallet,
      href: "/tools/zainii-audit/expense",
      gradient: "from-sky-500 to-blue-600",
      glow: "shadow-sky-500/20 group-hover:shadow-sky-500/40",
      tag: "Audit",
      section: "dashboard",
    },
    {
      // Сүлжээний шинжилгээ — Palo Alto галт ханын тохиргооны өөрчлөлт
      id: "net_config_changes",
      title: t("netConfigTitle"),
      icon: Network,
      href: "/tools/network-analysis/config-changes",
      gradient: "from-orange-500 to-amber-600",
      glow: "shadow-orange-500/20 group-hover:shadow-orange-500/40",
      tag: "Security",
      section: "dashboard",
    },
    {
      // Сүлжээний шинжилгээ — Microsoft Defender XDR мэдэгдэл
      id: "net_xdr",
      title: t("netXdrTitle"),
      icon: ShieldAlert,
      href: "/tools/network-analysis/xdr",
      gradient: "from-sky-500 to-indigo-600",
      glow: "shadow-sky-500/20 group-hover:shadow-sky-500/40",
      tag: "Security",
      section: "dashboard",
    },
    {
      // Сөрөг мэдээний шинжилгээ — бүртгэлээс автоматаар тооцогдоно
      id: "negative_news_dashboard",
      title: t("nnDashboardTitle"),
      icon: Newspaper,
      href: "/tools/negative-news/dashboard",
      gradient: "from-rose-500 to-pink-600",
      glow: "shadow-rose-500/20 group-hover:shadow-rose-500/40",
      tag: "Audit",
      section: "dashboard",
    },
    {
      // Өгөгдлийн сангийн өөрчлөлтийн шинжилгээ
      id: "db_changes_dashboard",
      title: t("dbcDashboardTitle"),
      icon: Database,
      href: "/tools/db-changes/dashboard",
      gradient: "from-violet-500 to-purple-600",
      glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
      tag: "Audit",
      section: "dashboard",
    },
    {
      id: "risk_assessment",
      matchIds: ["risk_assessment", "risk_assessment_report"],
      title: t("toolRiskAssessmentTitle"),
      icon: ShieldAlert,
      href: "/tools/risk-assessment",
      gradient: "from-rose-500 to-orange-500",
      glow: "shadow-rose-500/20 group-hover:shadow-rose-500/40",
      tag: "Risk",
      section: "risk",
    },
  ];
}
