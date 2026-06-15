"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import { usersApi } from "@/lib/api";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Wrench,
  Lock,
  Loader2,
  Dice6,
  Table2,
  FileText,
  FileSpreadsheet,
  Database,
  BellDot,
  ShieldAlert,
} from "lucide-react";

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  glow: string;
  tag: string;
  matchIds?: string[]; // if set, card is visible if user has ANY of these tool ids
}

function getTools(t: (key: TranslationKey) => string): Tool[] {
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
  ];
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: (i % 3) + 1.5,
  duration: 4 + (i % 5),
  delay: (i % 6) * 0.5,
}));

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const { t } = useLanguage();
  const Icon = tool.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.09, duration: 0.4 }}
    >
      <Link href={tool.href} className="group block h-full">
        <div
          className={`
            relative h-full rounded-2xl
            bg-card/60 backdrop-blur-xl
            border border-border/50
            hover:border-border
            shadow-premium ${tool.glow}
            hover:shadow-premium-lg hover:-translate-y-0.5
            ring-hairline
            transition-all duration-300
            overflow-hidden
          `}
        >
          {/* gradient accent top strip */}
          <div
            className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${tool.gradient} opacity-70 group-hover:opacity-100 transition-opacity`}
          />
          {/* soft glow behind icon */}
          <div
            className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${tool.gradient} opacity-5 group-hover:opacity-10 blur-2xl transition-opacity`}
          />
          <div className="relative p-4 flex flex-col h-full">
            {/* top row: icon + tag */}
            <div className="flex items-start justify-between mb-3">
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-md`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold bg-gradient-to-r ${tool.gradient} text-white opacity-80 group-hover:opacity-100 transition-opacity`}
              >
                {tool.tag}
              </span>
            </div>
            {/* text */}
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground leading-snug">
                {tool.title}
              </h2>
            </div>
            {/* bottom cta */}
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground opacity-70 group-hover:opacity-100 transition-all">
              {t("toolsOpen")}
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ToolsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const allTools = getTools(t);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      if (user.isAdmin) {
        setAllowedTools(allTools.map((tool) => tool.id));
        setIsLoading(false);
        return;
      }
      try {
        const fresh = await usersApi.getOne(user.id);
        setAllowedTools(fresh.allowedTools || []);
      } catch {
        setAllowedTools(user.allowedTools || []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const available = allTools.filter((tool) => {
    const ids = tool.matchIds ?? [tool.id];
    return ids.some((id) => allowedTools.includes(id));
  });

  /*  BG  */
  const BG = (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-foreground/20"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{ y: [0, -18, 0], opacity: [0.15, 0.4, 0.15] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center relative overflow-hidden">
        {BG}
        <Loader2 className="relative z-10 w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center relative overflow-hidden">
        {BG}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t("needLogin")}
          </h2>
          <p className="text-muted-foreground">{t("needLoginToolsDesc")}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] relative overflow-hidden">
      {BG}

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {/*  Page header  */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center shadow-premium ring-hairline">
              <Wrench className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-0.5">
                {t("toolsPageSubtitle")}
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                {t("toolsPageTitle")}
              </h1>
            </div>
          </div>
        </motion.div>

        {available.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[50vh] text-center"
          >
            <div className="p-8 rounded-3xl bg-card/50 backdrop-blur-xl border border-border/50 mb-6">
              <Lock className="w-16 h-16 text-muted-foreground/70 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {t("toolsNoneFound")}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {t("toolsNoneDesc")}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {available.map((tool, i) => (
              <ToolCard key={tool.id} tool={tool} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
