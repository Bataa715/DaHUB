"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserPlus,
  Check,
  Loader2,
  Shield,
  Wrench,
  Dice6,
  Table2,
  FileText,
  Database,
  FileSpreadsheet,
  BellDot,
  Search,
  UserMinus,
  ShieldAlert,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { usersApi } from "@/lib/api";
import { isWebVisibleUser } from "@/lib/utils";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { useToast } from "@/hooks/use-toast";
import { DEPARTMENTS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";

// A "variant" is one concrete grantable tool-key (matches backend VALID_TOOLS).
// Some real-world tools have more than one variant (e.g. DB access has a
// "requester" and a "granter" side) — those used to render as separate cards;
// now they're grouped into a single card with a scenario switcher inside.
interface ToolVariant {
  id: string;
  labelKey: TranslationKey;
}

interface ToolGroup {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ComponentType<any>;
  color: string;
  gradient: string;
  adminPath?: string;
  adminLabelKey?: TranslationKey;
  variants: ToolVariant[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "sanamsargui-tuuwer",
    nameKey: "toolSampleTitle",
    descKey: "admToolsPageSampleDesc",
    icon: Dice6,
    color: "from-violet-500 to-blue-500",
    gradient: "bg-gradient-to-br from-violet-500/20 to-blue-500/20",
    variants: [{ id: "sanamsargui-tuuwer", labelKey: "toolSampleTitle" }],
  },
  {
    id: "pivot",
    nameKey: "toolPivotTitle",
    descKey: "admToolsPagePivotDesc",
    icon: Table2,
    color: "from-cyan-500 to-teal-500",
    gradient: "bg-gradient-to-br from-cyan-500/20 to-teal-500/20",
    variants: [{ id: "pivot", labelKey: "toolPivotTitle" }],
  },
  {
    id: "db_access",
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
    id: "tailan",
    nameKey: "admToolsPageTailanGroupName",
    descKey: "admToolsPageTailanGroupDesc",
    icon: FileText,
    color: "from-blue-500 to-violet-500",
    gradient: "bg-gradient-to-br from-blue-500/20 to-violet-500/20",
    adminPath: "/admin/tailan-templates",
    adminLabelKey: "admToolsPageTemplateArrow",
    variants: [
      { id: "tailan", labelKey: "admAdminsToolTailanEmployee" },
      { id: "tailan_dept_head", labelKey: "admToolsPageTailanDeptHeadName" },
    ],
  },
  {
    id: "reports",
    nameKey: "toolReportsTitle",
    descKey: "admToolsPageReportsDesc",
    icon: FileSpreadsheet,
    color: "from-emerald-500 to-violet-500",
    gradient: "bg-gradient-to-br from-emerald-500/20 to-violet-500/20",
    adminPath: "/admin/reports",
    adminLabelKey: "admToolsPageReportArrow",
    variants: [{ id: "reports", labelKey: "toolReportsTitle" }],
  },
  {
    id: "data_doc",
    nameKey: "toolDataDocTitle",
    descKey: "admToolsPageDataDocDesc",
    icon: Database,
    color: "from-teal-500 to-cyan-500",
    gradient: "bg-gradient-to-br from-teal-500/20 to-cyan-500/20",
    variants: [{ id: "data_doc", labelKey: "toolDataDocTitle" }],
  },
  {
    id: "alert_box",
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
    nameKey: "admToolsPageRiskGroupName",
    descKey: "admToolsPageRiskGroupDesc",
    icon: ShieldAlert,
    color: "from-rose-500 to-orange-500",
    gradient: "bg-gradient-to-br from-rose-500/20 to-orange-500/20",
    adminPath: "/admin/risk-indicators",
    adminLabelKey: "admToolsPageSettingsArrow",
    variants: [
      { id: "risk_assessment", labelKey: "toolRiskAssessmentTitle" },
      { id: "risk_assessment_report", labelKey: "toolRiskAssessmentReportTitle" },
    ],
  },
  {
    id: "monitoring_box",
    nameKey: "toolMonitoringBoxTitle",
    descKey: "admToolsPageMonitoringDesc",
    icon: Activity,
    color: "from-orange-500 to-red-500",
    gradient: "bg-gradient-to-br from-orange-500/20 to-red-500/20",
    variants: [{ id: "monitoring_box", labelKey: "toolMonitoringBoxTitle" }],
  },
];

interface User {
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

export default function AdminToolsPage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Sub-admin: restrict visible tools/variants to their grantableTools list
  const isSuperAdmin = user?.isSuperAdmin;
  const subAdminTools: string[] | null =
    user?.isAdmin && !isSuperAdmin ? (user?.grantableTools ?? []) : null;
  const visibleGroups: ToolGroup[] =
    subAdminTools !== null
      ? TOOL_GROUPS.map((g) => ({
          ...g,
          variants: g.variants.filter((v) => subAdminTools.includes(v.id)),
        })).filter((g) => g.variants.length > 0)
      : TOOL_GROUPS;

  const [selectedGroup, setSelectedGroup] = useState<ToolGroup | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("current");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  // Revoke tab state
  const [revokeSelectedUsers, setRevokeSelectedUsers] = useState<Set<string>>(
    new Set(),
  );
  const [revokeSearch, setRevokeSearch] = useState("");
  const [revokeDepartment, setRevokeDepartment] = useState<string>("");
  // Grant tab search
  const [grantSearch, setGrantSearch] = useState("");

  // The variant currently active inside the open Sheet — falls back to the
  // group's first variant (covers both single- and multi-variant groups).
  const activeVariant =
    selectedGroup?.variants.find((v) => v.id === selectedVariantId) ??
    selectedGroup?.variants[0] ??
    null;
  const activeToolId = activeVariant?.id ?? "";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Хэрэглэгчдийг татах
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const data = await usersApi.getAll({ excludeAdmins: true, limit: 1000 });
      setUsers(
        (data as User[]).filter(
          (u) => isWebVisibleUser(u) && u.isActive !== false,
        ),
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "production")
        console.error("Error loading users:", error);
      toast({
        title: t("error"),
        description: t("admToolsPageLoadUsersError"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Group сонгоход (нэг эсвэл олон variant-тай карт) — эхний variant-аар эхэлнэ
  const handleGroupSelect = (group: ToolGroup) => {
    setSelectedGroup(group);
    setSelectedVariantId(group.variants[0]?.id ?? "");
    setActiveTab("current");
    setSelectedUsers(new Set());
    setSelectedDepartment("");
    setRevokeSelectedUsers(new Set());
    setRevokeSearch("");
    setRevokeDepartment("");
    setGrantSearch("");
  };

  // Sheet дотор variant (тухайлбал "Эрх хүсэгч" ⇄ "Эрх олгогч") сэлгэхэд —
  // тухайн variant-ийн хэрэглэгчийн жагсаалт шинээр эхэлнэ.
  const handleVariantSwitch = (variantId: string) => {
    setSelectedVariantId(variantId);
    setActiveTab("current");
    setSelectedUsers(new Set());
    setSelectedDepartment("");
    setRevokeSelectedUsers(new Set());
    setRevokeSearch("");
    setRevokeDepartment("");
    setGrantSearch("");
  };

  // Тухайн tool-д эрхтэй хэрэглэгчид
  const getUsersWithAccess = (toolId: string) => {
    return users.filter((u) => u.allowedTools?.includes(toolId));
  };

  // Тухайн tool-д эрхгүй хэрэглэгчид
  const getUsersWithoutAccess = (toolId: string) => {
    return users.filter((u) => !u.allowedTools?.includes(toolId));
  };

  // Карт дээрх нийт тоо — group-ийн АЛЬ Ч НЭГ variant-д эрхтэй хэрэглэгчдийн
  // цуглуулга (давхардалгүй), олон карт биш нэг картаар харуулахын тулд.
  const getUsersWithAnyVariant = (group: ToolGroup) => {
    const ids = new Set(group.variants.map((v) => v.id));
    return users.filter((u) => u.allowedTools?.some((t) => ids.has(t)));
  };

  // Хэрэглэгч сонгох/болих
  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  // Бүх хэрэглэгчийг сонгох
  const selectAllUsers = () => {
    if (!activeToolId) return;
    const usersWithoutAccess = getUsersWithoutAccess(activeToolId);
    setSelectedUsers(new Set(usersWithoutAccess.map((u) => u.id)));
  };

  // Хэлтсийн хэрэглэгчдийг сонгох
  const selectDepartmentUsers = (dept: string) => {
    if (!activeToolId) return;
    const deptUsers = getUsersWithoutAccess(activeToolId).filter(
      (u) => u.department === dept,
    );
    setSelectedUsers(new Set(deptUsers.map((u) => u.id)));
  };

  // Эрх олгох
  const grantAccess = async () => {
    if (!activeToolId || selectedUsers.size === 0) return;

    setIsSaving(true);
    let successCount = 0;
    const errors: string[] = [];

    try {
      // Sequential execution — concurrent ClickHouse mutations cause race conditions
      for (const userId of Array.from(selectedUsers)) {
        const targetUser = users.find((u) => u.id === userId);
        if (!targetUser) continue;
        // Re-fetch latest tools for this user to avoid stale state overwrites
        try {
          const fresh = await usersApi.getOne(userId);
          const currentTools: string[] = fresh.allowedTools || [];
          if (!currentTools.includes(activeToolId)) {
            await usersApi.updateTools(userId, [...currentTools, activeToolId]);
          }
          successCount++;
        } catch (err) {
          if (process.env.NODE_ENV !== "production")
            console.error("Error granting access to user:", err);
          errors.push(targetUser.name);
        }
      }

      const variantLabel = activeVariant ? t(activeVariant.labelKey) : "";
      if (errors.length === 0) {
        toast({
          title: t("success"),
          description: `${successCount} ${t("admToolsPageGrantedPart1")} ${variantLabel} ${t("admToolsPageGrantedPart2")}`,
        });
      } else {
        toast({
          title: t("admToolsPagePartialSuccess"),
          description: `${successCount} ${t("admToolsPagePartialPart1")}, ${errors.length} ${t("admToolsPagePartialPart2")}: ${errors.join(", ")}`,
          variant: "destructive",
        });
      }

      await loadUsers();
      setSelectedUsers(new Set());
      setActiveTab("current");
    } catch (error) {
      if (process.env.NODE_ENV !== "production")
        console.error("Error granting access:", error);
      toast({
        title: t("error"),
        description: t("admToolsPageGrantError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk эрх хасах
  const bulkRevokeAccess = async () => {
    if (!activeToolId || revokeSelectedUsers.size === 0) return;

    setIsSaving(true);
    let successCount = 0;
    const errors: string[] = [];

    try {
      for (const userId of Array.from(revokeSelectedUsers)) {
        const targetUser = users.find((u) => u.id === userId);
        if (!targetUser) continue;
        try {
          const fresh = await usersApi.getOne(userId);
          const currentTools: string[] = fresh.allowedTools || [];
          const newTools = currentTools.filter(
            (toolId) => toolId !== activeToolId,
          );
          await usersApi.updateTools(userId, newTools);
          successCount++;
        } catch (err) {
          if (process.env.NODE_ENV !== "production")
            console.error("Error revoking access from user:", err);
          errors.push(targetUser.name);
        }
      }

      const variantLabel = activeVariant ? t(activeVariant.labelKey) : "";
      if (errors.length === 0) {
        toast({
          title: t("success"),
          description: `${successCount} ${t("admToolsPageRevokedPart1")} ${variantLabel} ${t("admToolsPageRevokedPart2")}`,
        });
      } else {
        toast({
          title: t("admToolsPagePartialSuccess"),
          description: `${successCount} ${t("admToolsPagePartialPart1")}, ${errors.length} ${t("admToolsPagePartialPart2")}: ${errors.join(", ")}`,
          variant: "destructive",
        });
      }

      await loadUsers();
      setRevokeSelectedUsers(new Set());
    } catch (error) {
      if (process.env.NODE_ENV !== "production")
        console.error("Error revoking access:", error);
      toast({
        title: t("error"),
        description: t("admToolsPageRevokeError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Revoke tab: toggle selection
  const toggleRevokeSelection = (userId: string) => {
    const newSet = new Set(revokeSelectedUsers);
    if (newSet.has(userId)) newSet.delete(userId);
    else newSet.add(userId);
    setRevokeSelectedUsers(newSet);
  };

  // Revoke tab: select all visible
  const selectAllRevokeUsers = () => {
    if (!activeToolId) return;
    const filtered = getFilteredUsersWithAccess();
    setRevokeSelectedUsers(new Set(filtered.map((u) => u.id)));
  };

  // Revoke tab: select department
  const selectRevokeDepartmentUsers = (dept: string) => {
    if (!activeToolId) return;
    const deptUsers = getUsersWithAccess(activeToolId).filter(
      (u) => u.department === dept,
    );
    setRevokeSelectedUsers(new Set(deptUsers.map((u) => u.id)));
  };

  // Revoke tab: filtered list
  const getFilteredUsersWithAccess = () => {
    if (!activeToolId) return [];
    let list = getUsersWithAccess(activeToolId);
    if (revokeSearch.trim()) {
      const q = revokeSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q),
      );
    }
    return list;
  };

  // Grant tab: filtered list
  const getFilteredUsersWithoutAccess = () => {
    if (!activeToolId) return [];
    let list = getUsersWithoutAccess(activeToolId);
    if (grantSearch.trim()) {
      const q = grantSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q),
      );
    }
    return list;
  };

  // Нийт эрхийн статистик
  const totalUsersWithAnyTool = users.filter(
    (u) => u.allowedTools?.length > 0,
  ).length;
  const totalPermissions = users.reduce(
    (acc, u) => acc + (u.allowedTools?.length || 0),
    0,
  );

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!user?.isAdmin && !user?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground/60 text-sm">
            {t("admToolsPageNoAccessMsg")}
          </p>
          <a
            href="/admin/login"
            className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground underline"
          >
            {t("admToolsPageAdminLoginLink")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-premium">
            <Wrench className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        }
        title={t("admToolsPagePageTitle")}
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: t("admToolsPageStatTotalUsers"), value: users.length },
            {
              label: t("admToolsPageStatWithAccess"),
              value: totalUsersWithAnyTool,
            },
            {
              label: t("admToolsPageStatTotalPermissions"),
              value: totalPermissions,
            },
            { label: t("admToolsPageStatTools"), value: visibleGroups.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-background border border-border rounded-xl px-4 py-3 shadow-premium ring-hairline"
            >
              <p className="text-xs text-muted-foreground/60 mb-0.5">
                {stat.label}
              </p>
              <p className="text-xl font-semibold text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tool Cards */}
        <div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleGroups.map((group) => {
              const usersWithAccess = getUsersWithAnyVariant(group);
              const pct =
                users.length > 0
                  ? Math.round((usersWithAccess.length / users.length) * 100)
                  : 0;
              return (
                <button
                  key={group.id}
                  onClick={() => handleGroupSelect(group)}
                  className="group text-left bg-background border-2 border-border hover:border-border rounded-xl p-3 flex flex-col gap-3 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground leading-snug whitespace-normal break-words">
                      {t(group.nameKey)}
                    </p>
                    {group.variants.length > 1 && (
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {group.variants.length} {t("admToolsPageScenarioUnit")}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground/60">
                        {usersWithAccess.length} {t("admToolsPageUserUnit")}
                      </span>
                      {group.adminPath ? (
                        <Link
                          href={group.adminPath}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {group.adminLabelKey
                            ? t(group.adminLabelKey)
                            : t("admToolsPageSettingsArrow")}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">
                          {pct}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tool Detail Sheet */}
      <Sheet open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <SheetContent className="w-full sm:max-w-md bg-background border-border p-0 flex flex-col">
          <SheetTitle className="sr-only">
            {selectedGroup ? t(selectedGroup.nameKey) : t("admReportsManageAccessTitle")}
          </SheetTitle>
          {selectedGroup && activeVariant && (
            <>
              {/* Header */}
              <div className={`bg-gradient-to-br ${selectedGroup.color} p-5`}>
                <p className="text-foreground/70 text-xs font-medium uppercase tracking-widest mb-1">
                  {t("admReportsManageAccessTitle")}
                </p>
                <p className="text-foreground text-lg font-semibold leading-snug">
                  {t(selectedGroup.nameKey)}
                </p>
                <p className="text-foreground/60 text-xs mt-1 line-clamp-2">
                  {t(selectedGroup.descKey)}
                </p>

                {/* Scenario switcher — only shown when the card groups >1 variant */}
                {selectedGroup.variants.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedGroup.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleVariantSwitch(v.id)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                          v.id === activeToolId
                            ? "bg-foreground text-background"
                            : "bg-foreground/10 text-foreground/70 hover:bg-foreground/20"
                        }`}
                      >
                        {t(v.labelKey)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-foreground text-xl font-bold leading-none">
                      {getUsersWithAccess(activeToolId).length}
                    </p>
                    <p className="text-foreground/60 text-xs mt-0.5">
                      {t("admReportsWithAccessUnit")}
                    </p>
                  </div>
                  <div className="w-px bg-foreground/20" />
                  <div className="text-center">
                    <p className="text-foreground text-xl font-bold leading-none">
                      {getUsersWithoutAccess(activeToolId).length}
                    </p>
                    <p className="text-foreground/60 text-xs mt-0.5">
                      {t("admReportsWithoutAccessUnit")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="grid w-full grid-cols-2 bg-background rounded-none border-b border-border h-10">
                  <TabsTrigger
                    value="current"
                    className="rounded-none text-xs font-medium text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white"
                  >
                    {t("admReportsWithAccessTabLabel")} (
                    {getUsersWithAccess(activeToolId).length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="grant"
                    className="rounded-none text-xs font-medium text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white"
                  >
                    {t("admReportsGrantAccessTabLabel")} (
                    {getUsersWithoutAccess(activeToolId).length})
                  </TabsTrigger>
                </TabsList>

                {/* Users with access */}
                <TabsContent
                  value="current"
                  className="flex-1 overflow-hidden mt-0 hidden data-[state=active]:flex flex-col"
                >
                  {/* Quick actions */}
                  <div className="px-5 py-3 border-b border-border space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllRevokeUsers}
                        disabled={getUsersWithAccess(activeToolId).length === 0}
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t("admReportsSelectAllBtn")}
                      </button>
                      <button
                        onClick={() => setRevokeSelectedUsers(new Set())}
                        disabled={revokeSelectedUsers.size === 0}
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t("admReportsClearBtn")}
                      </button>
                    </div>
                    <Select
                      value={revokeDepartment}
                      onValueChange={(value) => {
                        setRevokeDepartment(value);
                        selectRevokeDepartmentUsers(value);
                      }}
                    >
                      <SelectTrigger className="bg-background border-border text-muted-foreground text-xs h-8 focus:ring-0">
                        <SelectValue
                          placeholder={t("admToolsPageDeptSelectPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem
                            key={dept}
                            value={dept}
                            className="text-foreground/80 text-xs focus:bg-muted focus:text-foreground"
                          >
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input
                        type="text"
                        value={revokeSearch}
                        onChange={(e) => setRevokeSearch(e.target.value)}
                        placeholder={t("admToolsPageSearchPlaceholder")}
                        className="w-full bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 pl-8 pr-3 py-1.5 focus:outline-none focus:border-border"
                      />
                    </div>
                  </div>

                  {/* User list */}
                  <ScrollArea className="flex-1">
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                      </div>
                    ) : getUsersWithAccess(activeToolId).length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          {t("admToolsPageNoUsersWithAccess")}
                        </p>
                        <button
                          onClick={() => setActiveTab("grant")}
                          className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                        >
                          {t("admReportsGrantAccessTabLabel")}
                        </button>
                      </div>
                    ) : getFilteredUsersWithAccess().length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          {t("admToolsPageNoSearchResults")}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/60">
                        {getFilteredUsersWithAccess().map((user) => (
                          <div
                            key={user.id}
                            className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                              revokeSelectedUsers.has(user.id)
                                ? "bg-muted"
                                : "hover:bg-background/60"
                            }`}
                            onClick={() => toggleRevokeSelection(user.id)}
                          >
                            <Checkbox
                              checked={revokeSelectedUsers.has(user.id)}
                              onCheckedChange={() =>
                                toggleRevokeSelection(user.id)
                              }
                              className="border-border data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-foreground shrink-0"
                            />
                            <div
                              className={`w-7 h-7 rounded-md bg-gradient-to-br ${selectedGroup.color} flex items-center justify-center text-foreground text-xs font-bold shrink-0`}
                            >
                              {user.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground truncate">
                                {user.name}
                              </p>
                              <p className="text-xs text-muted-foreground/60 truncate">
                                {user.department}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Revoke button */}
                  <AnimatePresence>
                    {revokeSelectedUsers.size > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="p-4 border-t border-border"
                      >
                        <button
                          onClick={bulkRevokeAccess}
                          disabled={isSaving}
                          className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-semibold py-2.5 rounded-xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t("admToolsPageRevokingText")}
                            </>
                          ) : (
                            <>
                              <UserMinus className="w-4 h-4" />
                              {revokeSelectedUsers.size}{" "}
                              {t("admToolsPageRevokeBtnSuffix")}
                            </>
                          )}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>

                {/* Grant access */}
                <TabsContent
                  value="grant"
                  className="flex-1 overflow-hidden mt-0 hidden data-[state=active]:flex flex-col"
                >
                  {/* Quick actions */}
                  <div className="px-5 py-3 border-b border-border space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllUsers}
                        disabled={
                          getUsersWithoutAccess(activeToolId).length === 0
                        }
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t("admReportsSelectAllBtn")}
                      </button>
                      <button
                        onClick={() => setSelectedUsers(new Set())}
                        disabled={selectedUsers.size === 0}
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t("admReportsClearBtn")}
                      </button>
                    </div>
                    <Select
                      value={selectedDepartment}
                      onValueChange={(value) => {
                        setSelectedDepartment(value);
                        selectDepartmentUsers(value);
                      }}
                    >
                      <SelectTrigger className="bg-background border-border text-muted-foreground text-xs h-8 focus:ring-0">
                        <SelectValue
                          placeholder={t("admToolsPageDeptSelectPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem
                            key={dept}
                            value={dept}
                            className="text-foreground/80 text-xs focus:bg-muted focus:text-foreground"
                          >
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input
                        type="text"
                        value={grantSearch}
                        onChange={(e) => setGrantSearch(e.target.value)}
                        placeholder={t("admToolsPageSearchPlaceholder")}
                        className="w-full bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 pl-8 pr-3 py-1.5 focus:outline-none focus:border-border"
                      />
                    </div>
                  </div>

                  {/* User list */}
                  <ScrollArea className="flex-1">
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                      </div>
                    ) : getUsersWithoutAccess(activeToolId).length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Check className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          {t("admToolsPageAllUsersHaveAccess")}
                        </p>
                      </div>
                    ) : getFilteredUsersWithoutAccess().length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          {t("admToolsPageNoSearchResults")}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/60">
                        {getFilteredUsersWithoutAccess().map((user) => (
                          <div
                            key={user.id}
                            className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                              selectedUsers.has(user.id)
                                ? "bg-muted"
                                : "hover:bg-background/60"
                            }`}
                            onClick={() => toggleUserSelection(user.id)}
                          >
                            <Checkbox
                              checked={selectedUsers.has(user.id)}
                              onCheckedChange={() =>
                                toggleUserSelection(user.id)
                              }
                              className="border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background shrink-0"
                            />
                            <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
                              {user.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground truncate">
                                {user.name}
                              </p>
                              <p className="text-xs text-muted-foreground/60 truncate">
                                {user.department}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Grant button */}
                  <AnimatePresence>
                    {selectedUsers.size > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="p-4 border-t border-border"
                      >
                        <button
                          onClick={grantAccess}
                          disabled={isSaving}
                          className={`w-full bg-gradient-to-r ${selectedGroup.color} text-white text-sm font-semibold py-2.5 rounded-xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2`}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t("admToolsPageSavingText")}
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              {selectedUsers.size}{" "}
                              {t("admToolsPageGrantBtnSuffix")}
                            </>
                          )}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
