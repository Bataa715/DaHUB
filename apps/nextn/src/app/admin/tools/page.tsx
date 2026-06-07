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
  FileStack,
  FileSpreadsheet,
  BellDot,
  Search,
  UserMinus,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usersApi } from "@/lib/api";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { useToast } from "@/hooks/use-toast";
import { DEPARTMENTS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

// Системд байгаа бүх хэрэгслүүд
interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  gradient: string;
  category: "free" | "work";
  adminPath?: string;
  adminLabel?: string;
}

const AVAILABLE_TOOLS: Tool[] = [
  {
    id: "sanamsargui-tuuwer",
    name: "Санамсаргүй түүвэр",
    description: "Түүврийн хэмжээ тооцоолох, санамсаргүй сонгон авах хэрэгсэл",
    icon: Dice6,
    color: "from-violet-500 to-blue-500",
    gradient: "bg-gradient-to-br from-violet-500/20 to-blue-500/20",
    category: "work",
  },
  {
    id: "pivot",
    name: "Pivot",
    description: "Excel файлаас pivot хүснэгт болон давтамжийн хүснэгт үүсгэх",
    icon: Table2,
    color: "from-cyan-500 to-teal-500",
    gradient: "bg-gradient-to-br from-cyan-500/20 to-teal-500/20",
    category: "work",
  },
  {
    id: "db_access_requester",
    name: "Эрх хүсэгч",
    description: "ClickHouse хүснэгтэд хандах эрх хүсэх боломж олгох",
    icon: Database,
    color: "from-cyan-500 to-teal-500",
    gradient: "bg-gradient-to-br from-cyan-500/20 to-teal-500/20",
    category: "work",
  },
  {
    id: "db_access_granter",
    name: "Эрх олгогч",
    description:
      "ClickHouse хүснэгтэд хандах эрхийн хүсэлтийг зөвшөөрөх, татгалзах",
    icon: Database,
    color: "from-violet-500 to-indigo-500",
    gradient: "bg-gradient-to-br from-violet-500/20 to-indigo-500/20",
    category: "work",
  },
  {
    id: "tailan",
    name: "Улирлын тайлан (ажилтан)",
    description: "Улирлын ажлын тайлангаа бэлтгэж хэлтсийн ахлагч руу илгээх",
    icon: FileText,
    color: "from-blue-500 to-violet-500",
    gradient: "bg-gradient-to-br from-blue-500/20 to-violet-500/20",
    category: "work",
  },
  {
    id: "tailan_dept_head",
    name: "Улирлын тайлан (хэлтсийн ахлагч)",
    description: "Хэлтсийн гишүүдийн улирлын ажлын тайланг нэгтгэж, татах эрх",
    icon: FileStack,
    color: "from-violet-500 to-purple-500",
    gradient: "bg-gradient-to-br from-violet-500/20 to-purple-500/20",
    category: "work",
  },
  {
    id: "reports",
    name: "Тайлан татах",
    description:
      "SQL болон Python горимын тайлангуудыг нэг дороос татах хэрэгсэл",
    icon: FileSpreadsheet,
    color: "from-emerald-500 to-violet-500",
    gradient: "bg-gradient-to-br from-emerald-500/20 to-violet-500/20",
    category: "work",
    adminPath: "/admin/reports",
    adminLabel: "Тайлан →",
  },
  {
    id: "data_doc",
    name: "Өгөгдлийн толь бичиг",
    description: "ClickHouse баганын тайлбар",
    icon: Database,
    color: "from-teal-500 to-cyan-500",
    gradient: "bg-gradient-to-br from-teal-500/20 to-cyan-500/20",
    category: "work",
  },
  {
    id: "alert_box",
    name: "Alert Box",
    description:
      "Банкны гүйлгээний эрсдэлийн шинжилгээ, CIF хайлт, улаан тугийн мэдэгдэл",
    icon: BellDot,
    color: "from-red-500 to-rose-500",
    gradient: "bg-gradient-to-br from-red-500/20 to-rose-500/20",
    category: "work",
  },
  {
    id: "risk_assessment",
    name: "Салбарын эрсдэлийн үнэлгээ",
    description:
      "Сар бүрийн эрсдэлийн үнэлгээ — салбаруудын оноо, гар засвар, аудит лог",
    icon: ShieldAlert,
    color: "from-rose-500 to-orange-500",
    gradient: "bg-gradient-to-br from-rose-500/20 to-orange-500/20",
    category: "work",
    adminPath: "/admin/risk-indicators",
    adminLabel: "Тохиргоо →",
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
  allowedTools: string[];
}

export default function AdminToolsPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Sub-admin: restrict visible tools to their grantableTools list
  const isSuperAdmin = user?.isSuperAdmin;
  const subAdminTools: string[] | null =
    user?.isAdmin && !isSuperAdmin ? (user?.grantableTools ?? []) : null;
  const visibleTools =
    subAdminTools !== null
      ? AVAILABLE_TOOLS.filter((t) => subAdminTools.includes(t.id))
      : AVAILABLE_TOOLS;
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [, setIsLoading] = useState(true);
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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Хэрэглэгчдийг татах
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await usersApi.getAll();
      setUsers(data.filter((u: User) => !u.isAdmin));
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Алдаа",
        description: "Хэрэглэгчдийг татахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Tool сонгоход
  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
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
    if (!selectedTool) return;
    const usersWithoutAccess = getUsersWithoutAccess(selectedTool.id);
    setSelectedUsers(new Set(usersWithoutAccess.map((u) => u.id)));
  };

  // Хэлтсийн хэрэглэгчдийг сонгох
  const selectDepartmentUsers = (dept: string) => {
    if (!selectedTool) return;
    const deptUsers = getUsersWithoutAccess(selectedTool.id).filter(
      (u) => u.department === dept,
    );
    setSelectedUsers(new Set(deptUsers.map((u) => u.id)));
  };

  // Эрх олгох
  const grantAccess = async () => {
    if (!selectedTool || selectedUsers.size === 0) return;

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
          if (!currentTools.includes(selectedTool.id)) {
            await usersApi.updateTools(userId, [
              ...currentTools,
              selectedTool.id,
            ]);
          }
          successCount++;
        } catch (err) {
          console.error(`Error granting access to ${targetUser.name}:`, err);
          errors.push(targetUser.name);
        }
      }

      if (errors.length === 0) {
        toast({
          title: "Амжилттай",
          description: `${successCount} хэрэглэгчид ${selectedTool.name} эрх олголоо`,
        });
      } else {
        toast({
          title: "Хэсэгчлэн амжилттай",
          description: `${successCount} амжилттай, ${errors.length} алдаа: ${errors.join(", ")}`,
          variant: "destructive",
        });
      }

      await loadUsers();
      setSelectedUsers(new Set());
      setActiveTab("current");
    } catch (error) {
      console.error("Error granting access:", error);
      toast({
        title: "Алдаа",
        description: "Эрх олгоход алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk эрх хасах
  const bulkRevokeAccess = async () => {
    if (!selectedTool || revokeSelectedUsers.size === 0) return;

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
          const newTools = currentTools.filter((t) => t !== selectedTool.id);
          await usersApi.updateTools(userId, newTools);
          successCount++;
        } catch (err) {
          console.error(`Error revoking access from ${targetUser.name}:`, err);
          errors.push(targetUser.name);
        }
      }

      if (errors.length === 0) {
        toast({
          title: "Амжилттай",
          description: `${successCount} хэрэглэгчээс ${selectedTool.name} эрхийг хаслаа`,
        });
      } else {
        toast({
          title: "Хэсэгчлэн амжилттай",
          description: `${successCount} амжилттай, ${errors.length} алдаа: ${errors.join(", ")}`,
          variant: "destructive",
        });
      }

      await loadUsers();
      setRevokeSelectedUsers(new Set());
    } catch (error) {
      console.error("Error revoking access:", error);
      toast({
        title: "Алдаа",
        description: "Эрх хасахад алдаа гарлаа",
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
    if (!selectedTool) return;
    const filtered = getFilteredUsersWithAccess();
    setRevokeSelectedUsers(new Set(filtered.map((u) => u.id)));
  };

  // Revoke tab: select department
  const selectRevokeDepartmentUsers = (dept: string) => {
    if (!selectedTool) return;
    const deptUsers = getUsersWithAccess(selectedTool.id).filter(
      (u) => u.department === dept,
    );
    setRevokeSelectedUsers(new Set(deptUsers.map((u) => u.id)));
  };

  // Revoke tab: filtered list
  const getFilteredUsersWithAccess = () => {
    if (!selectedTool) return [];
    let list = getUsersWithAccess(selectedTool.id);
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
    if (!selectedTool) return [];
    let list = getUsersWithoutAccess(selectedTool.id);
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
            Та энэ хуудсыг үзэх эрхгүй байна.
          </p>
          <a
            href="/admin/login"
            className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground underline"
          >
            Admin нэвтрэх
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md">
            <Wrench className="w-3.5 h-3.5 text-foreground" />
          </div>
        }
        title="Хэрэгсэл - Эрх удирдах"
      />

      <div className="container mx-auto py-6 px-4">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {visibleTools.map((tool) => {
            const usersWithAccess = getUsersWithAccess(tool.id);
            const pct =
              users.length > 0
                ? Math.round((usersWithAccess.length / users.length) * 100)
                : 0;
            return (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool)}
                className="group text-left bg-background border border-border hover:border-border/80 rounded-xl p-4 transition-colors"
              >
                <p className="text-sm font-medium text-foreground mb-3 leading-snug">
                  {tool.name}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground/60">
                    {usersWithAccess.length} хэрэглэгч
                  </span>
                  {tool.adminPath ? (
                    <Link
                      href={tool.adminPath}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {tool.adminLabel ?? "Тохиргоо →"}
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool Detail Sheet */}
      <Sheet open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <SheetContent className="w-full sm:max-w-md bg-background border-border p-0 flex flex-col">
          <SheetTitle className="sr-only">
            {selectedTool?.name ?? "Эрх удирдах"}
          </SheetTitle>
          {selectedTool && (
            <>
              {/* Header */}
              <div className={`bg-gradient-to-br ${selectedTool.color} p-5`}>
                <p className="text-foreground/70 text-xs font-medium uppercase tracking-widest mb-1">
                  Эрх удирдах
                </p>
                <p className="text-foreground text-lg font-semibold leading-snug">
                  {selectedTool.name}
                </p>
                <p className="text-foreground/60 text-xs mt-1 line-clamp-2">
                  {selectedTool.description}
                </p>
                <div className="flex gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-foreground text-xl font-bold leading-none">
                      {getUsersWithAccess(selectedTool.id).length}
                    </p>
                    <p className="text-foreground/60 text-xs mt-0.5">эрхтэй</p>
                  </div>
                  <div className="w-px bg-foreground/20" />
                  <div className="text-center">
                    <p className="text-foreground text-xl font-bold leading-none">
                      {getUsersWithoutAccess(selectedTool.id).length}
                    </p>
                    <p className="text-foreground/60 text-xs mt-0.5">эрхгүй</p>
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
                    Эрхтэй ({getUsersWithAccess(selectedTool.id).length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="grant"
                    className="rounded-none text-xs font-medium text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white"
                  >
                    Эрх олгох ({getUsersWithoutAccess(selectedTool.id).length})
                  </TabsTrigger>
                </TabsList>

                {/* Эрхтэй хэрэглэгчид */}
                <TabsContent
                  value="current"
                  className="flex-1 overflow-hidden mt-0 hidden data-[state=active]:flex flex-col"
                >
                  {/* Quick actions */}
                  <div className="px-5 py-3 border-b border-border space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllRevokeUsers}
                        disabled={
                          getUsersWithAccess(selectedTool.id).length === 0
                        }
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Бүгдийг сонгох
                      </button>
                      <button
                        onClick={() => setRevokeSelectedUsers(new Set())}
                        disabled={revokeSelectedUsers.size === 0}
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Цэвэрлэх
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
                        <SelectValue placeholder="Хэлтсээр сонгох..." />
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
                        placeholder="Нэр, хэлтсээр хайх..."
                        className="w-full bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 pl-8 pr-3 py-1.5 focus:outline-none focus:border-border"
                      />
                    </div>
                  </div>

                  {/* User list */}
                  <ScrollArea className="flex-1">
                    {getUsersWithAccess(selectedTool.id).length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          Одоогоор эрхтэй хэрэглэгч байхгүй
                        </p>
                        <button
                          onClick={() => setActiveTab("grant")}
                          className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                        >
                          Эрх олгох
                        </button>
                      </div>
                    ) : getFilteredUsersWithAccess().length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          Хайлтад тохирох хэрэглэгч олдсонгүй
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/60">
                        {getFilteredUsersWithAccess().map((user, index) => (
                          <motion.div
                            key={user.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
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
                              className={`w-7 h-7 rounded-md bg-gradient-to-br ${selectedTool.color} flex items-center justify-center text-foreground text-xs font-bold shrink-0`}
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
                          </motion.div>
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
                          className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-foreground text-sm font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Хасаж байна...
                            </>
                          ) : (
                            <>
                              <UserMinus className="w-4 h-4" />
                              {revokeSelectedUsers.size} хэрэглэгчээс эрх хасах
                            </>
                          )}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>

                {/* Эрх олгох */}
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
                          getUsersWithoutAccess(selectedTool.id).length === 0
                        }
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Бүгдийг сонгох
                      </button>
                      <button
                        onClick={() => setSelectedUsers(new Set())}
                        disabled={selectedUsers.size === 0}
                        className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Цэвэрлэх
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
                        <SelectValue placeholder="Хэлтсээр сонгох..." />
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
                        placeholder="Нэр, хэлтсээр хайх..."
                        className="w-full bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 pl-8 pr-3 py-1.5 focus:outline-none focus:border-border"
                      />
                    </div>
                  </div>

                  {/* User list */}
                  <ScrollArea className="flex-1">
                    {getUsersWithoutAccess(selectedTool.id).length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Check className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Бүх хэрэглэгчид эрхтэй байна</p>
                      </div>
                    ) : getFilteredUsersWithoutAccess().length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          Хайлтад тохирох хэрэглэгч олдсонгүй
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/60">
                        {getFilteredUsersWithoutAccess().map((user, index) => (
                          <motion.div
                            key={user.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
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
                          </motion.div>
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
                          className={`w-full bg-gradient-to-r ${selectedTool.color} text-foreground text-sm font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2`}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Хадгалж байна...
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              {selectedUsers.size} хэрэглэгчид эрх олгох
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
