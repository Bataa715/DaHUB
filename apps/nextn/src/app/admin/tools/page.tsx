"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckSquare,
  Dumbbell,
  Users,
  Building,
  UserPlus,
  Check,
  Loader2,
  Shield,
  Settings,
  Wrench,
  LayoutGrid,
  Crown,
  ArrowLeft,
  UserCheck,
  UserX,
  Dice6,
  Table2,
  FileText,
  Database,
  FileStack,
} from "lucide-react";
import Link from "next/link";
import { usersApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DEPARTMENTS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

// Fixed particle positions for SSR
const PARTICLE_POSITIONS = [
  { top: "10%", left: "5%", duration: 3.2 },
  { top: "20%", left: "85%", duration: 4.1 },
  { top: "35%", left: "15%", duration: 3.8 },
  { top: "45%", left: "75%", duration: 4.5 },
  { top: "55%", left: "25%", duration: 3.5 },
  { top: "65%", left: "90%", duration: 4.2 },
  { top: "75%", left: "10%", duration: 3.9 },
  { top: "85%", left: "70%", duration: 4.0 },
  { top: "15%", left: "50%", duration: 3.6 },
  { top: "80%", left: "40%", duration: 4.3 },
  { top: "30%", left: "95%", duration: 3.4 },
  { top: "90%", left: "55%", duration: 4.4 },
];

// Системд байгаа бүх хэрэгслүүд
interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  gradient: string;
  category: "free" | "work";
}

const AVAILABLE_TOOLS: Tool[] = [
  {
    id: "todo",
    name: "Todo",
    description: "Хийх ажлын жагсаалт, даалгавар удирдах",
    icon: CheckSquare,
    color: "from-blue-500 to-cyan-500",
    gradient: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20",
    category: "free",
  },
  {
    id: "fitness",
    name: "Fitness",
    description: "Биеийн тамирын бүртгэл, дасгал хөтлөх",
    icon: Dumbbell,
    color: "from-emerald-500 to-teal-500",
    gradient: "bg-gradient-to-br from-emerald-500/20 to-teal-500/20",
    category: "free",
  },
  {
    id: "chess",
    name: "Оюуны спорт",
    description: "Шатар тоглоомд хамт ажиллагсадтайгаа ID-аар урилга илгээж тоглох",
    icon: Crown,
    color: "from-amber-500 to-yellow-500",
    gradient: "bg-gradient-to-br from-amber-500/20 to-yellow-500/20",
    category: "free",
  },
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("current");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

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
            await usersApi.updateTools(userId, [...currentTools, selectedTool.id]);
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

  // Эрх хасах
  const revokeAccess = async (userId: string) => {
    if (!selectedTool) return;

    try {
      const user = users.find((u) => u.id === userId);
      if (user) {
        const newTools = (user.allowedTools || []).filter(
          (t) => t !== selectedTool.id,
        );
        await usersApi.updateTools(userId, newTools);

        toast({
          title: "Амжилттай",
          description: `${user.name}-с ${selectedTool.name} эрхийг хаслаа`,
        });

        await loadUsers();
      }
    } catch (error) {
      console.error("Error revoking access:", error);
      toast({
        title: "Алдаа",
        description: "Эрх хасахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  // Нийт эрхийн статистик
  const totalUsersWithAnyTool = users.filter(
    (u) => u.allowedTools?.length > 0,
  ).length;
  const totalPermissions = users.reduce(
    (acc, u) => acc + (u.allowedTools?.length || 0),
    0,
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-8 text-center">
            <Shield className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <p className="text-slate-300">Та энэ хуудсыг үзэх эрхгүй байна.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl"
          animate={{
            rotate: [0, 360],
          }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Floating Particles */}
      {PARTICLE_POSITIONS.map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
          style={{ top: pos.top, left: pos.left }}
          animate={{
            y: [-20, 20, -20],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: pos.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 container mx-auto py-8 px-4 space-y-8">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link href="/admin">
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Буцах
            </Button>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/30">
            <Wrench className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Хэрэгслүүдийн эрх удирдах
            </h1>
          </div>
          <p className="text-slate-400 max-w-lg mx-auto">
            Хэрэглэгчдэд хэрэгслүүдийн эрх олгох, хасах. Эрхийг зөв удирдснаар
            системийн аюулгүй байдлыг хангана.
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {[
            {
              label: "Нийт хэрэглэгч",
              value: users.length,
              icon: Users,
              color: "from-blue-500 to-cyan-500",
            },
            {
              label: "Эрхтэй хэрэглэгч",
              value: totalUsersWithAnyTool,
              icon: UserCheck,
              color: "from-emerald-500 to-teal-500",
            },
            {
              label: "Нийт эрх",
              value: totalPermissions,
              icon: Shield,
              color: "from-purple-500 to-pink-500",
            },
            {
              label: "Хэрэгсэл",
              value: AVAILABLE_TOOLS.length,
              icon: Wrench,
              color: "from-amber-500 to-orange-500",
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative group"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-20 rounded-xl blur-xl transition-opacity duration-300`}
              />
              <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{stat.label}</p>
                      <p
                        className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}
                      >
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}
                    >
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tool Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-purple-400" />
            Хэрэгслүүд
          </h2>

          {/* ── Чөлөөт хэрэгслүүд ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-base font-semibold text-white">
                Чөлөөт хэрэгслүүд
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {AVAILABLE_TOOLS.filter((t) => t.category === "free").length}
              </span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {AVAILABLE_TOOLS.filter((t) => t.category === "free").map(
                (tool, index) => {
                  const usersWithAccess = getUsersWithAccess(tool.id);
                  const Icon = tool.icon;
                  return (
                    <motion.div
                      key={tool.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="group cursor-pointer"
                      onClick={() => handleToolSelect(tool)}
                    >
                      <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm relative overflow-hidden h-full transition-all duration-300 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10">
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                        />
                        <CardHeader className="relative p-4">
                          <div className="flex items-center justify-between mb-3">
                            <motion.div
                              className={`p-3 rounded-xl bg-gradient-to-br ${tool.color} shadow-lg`}
                              whileHover={{ rotate: [0, -10, 10, 0] }}
                              transition={{ duration: 0.5 }}
                            >
                              <Icon className="w-6 h-6 text-white" />
                            </motion.div>
                            <Badge className="bg-slate-700/80 text-slate-300 border-0">
                              <UserCheck className="w-3 h-3 mr-1" />
                              {usersWithAccess.length} хэрэглэгч
                            </Badge>
                          </div>
                          <CardTitle className="text-white text-sm group-hover:text-emerald-300 transition-colors">
                            {tool.name}
                          </CardTitle>
                          <CardDescription className="text-slate-400 text-xs line-clamp-2">
                            {tool.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="relative px-4 pb-4 pt-0">
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-400">Эрхтэй</span>
                              <span className="text-slate-300">
                                {users.length > 0
                                  ? Math.round(
                                      (usersWithAccess.length / users.length) *
                                        100,
                                    )
                                  : 0}
                                %
                              </span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full bg-gradient-to-r ${tool.color}`}
                                initial={{ width: 0 }}
                                animate={{
                                  width:
                                    users.length > 0
                                      ? `${(usersWithAccess.length / users.length) * 100}%`
                                      : "0%",
                                }}
                                transition={{
                                  duration: 1,
                                  delay: 0.5 + index * 0.1,
                                }}
                              />
                            </div>
                          </div>
                          <Button
                            className={`w-full bg-gradient-to-r ${tool.color} hover:opacity-90 text-white border-0 transition-all duration-300 group-hover:shadow-lg`}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Эрх удирдах
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                },
              )}
            </div>
          </div>

          {/* ── Ажлын хэрэгслүүд ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-base font-semibold text-white">
                Ажлын хэрэгслүүд
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {AVAILABLE_TOOLS.filter((t) => t.category === "work").length}
              </span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {AVAILABLE_TOOLS.filter((t) => t.category === "work").map(
                (tool, index) => {
                  const usersWithAccess = getUsersWithAccess(tool.id);
                  const Icon = tool.icon;
                  return (
                    <motion.div
                      key={tool.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="group cursor-pointer"
                      onClick={() => handleToolSelect(tool)}
                    >
                      <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm relative overflow-hidden h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                        />
                        <CardHeader className="relative p-4">
                          <div className="flex items-center justify-between mb-3">
                            <motion.div
                              className={`p-3 rounded-xl bg-gradient-to-br ${tool.color} shadow-lg`}
                              whileHover={{ rotate: [0, -10, 10, 0] }}
                              transition={{ duration: 0.5 }}
                            >
                              <Icon className="w-6 h-6 text-white" />
                            </motion.div>
                            <Badge className="bg-slate-700/80 text-slate-300 border-0">
                              <UserCheck className="w-3 h-3 mr-1" />
                              {usersWithAccess.length} хэрэглэгч
                            </Badge>
                          </div>
                          <CardTitle className="text-white text-sm group-hover:text-purple-300 transition-colors">
                            {tool.name}
                          </CardTitle>
                          <CardDescription className="text-slate-400 text-xs line-clamp-2">
                            {tool.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="relative px-4 pb-4 pt-0">
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-400">Эрхтэй</span>
                              <span className="text-slate-300">
                                {users.length > 0
                                  ? Math.round(
                                      (usersWithAccess.length / users.length) *
                                        100,
                                    )
                                  : 0}
                                %
                              </span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full bg-gradient-to-r ${tool.color}`}
                                initial={{ width: 0 }}
                                animate={{
                                  width:
                                    users.length > 0
                                      ? `${(usersWithAccess.length / users.length) * 100}%`
                                      : "0%",
                                }}
                                transition={{
                                  duration: 1,
                                  delay: 0.5 + index * 0.1,
                                }}
                              />
                            </div>
                          </div>
                          <Button
                            className={`w-full bg-gradient-to-r ${tool.color} hover:opacity-90 text-white border-0 transition-all duration-300 group-hover:shadow-lg`}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Эрх удирдах
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                },
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tool Detail Sheet */}
      <Sheet open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <SheetContent className="w-full sm:max-w-xl bg-slate-900 border-slate-700">
          {selectedTool && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <motion.div
                    className={`p-4 rounded-2xl bg-gradient-to-br ${selectedTool.color}`}
                    initial={{ scale: 0.8, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <selectedTool.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <SheetTitle className="text-white text-xl">
                      {selectedTool.name}
                    </SheetTitle>
                    <SheetDescription className="text-slate-400">
                      {selectedTool.description}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="mt-6"
              >
                <TabsList className="grid w-full grid-cols-2 bg-slate-800 p-1">
                  <TabsTrigger
                    value="current"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white text-slate-400"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Эрхтэй ({getUsersWithAccess(selectedTool.id).length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="grant"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white text-slate-400"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Эрх олгох
                  </TabsTrigger>
                </TabsList>

                {/* Эрхтэй хэрэглэгчид */}
                <TabsContent value="current" className="mt-4">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    {getUsersWithAccess(selectedTool.id).length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-12"
                      >
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                          <Users className="w-10 h-10 text-slate-600" />
                        </div>
                        <p className="text-slate-400">
                          Одоогоор эрхтэй хэрэглэгч байхгүй
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-800"
                          onClick={() => setActiveTab("grant")}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Эрх олгох
                        </Button>
                      </motion.div>
                    ) : (
                      <div className="space-y-2">
                        <AnimatePresence>
                          {getUsersWithAccess(selectedTool.id).map(
                            (user, index) => (
                              <motion.div
                                key={user.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${selectedTool.color} flex items-center justify-center text-white font-medium`}
                                  >
                                    {user.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">
                                      {user.name}
                                    </p>
                                    <p className="text-sm text-slate-400">
                                      {user.department} • {user.position}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => revokeAccess(user.id)}
                                >
                                  <UserX className="w-4 h-4 mr-1" />
                                  Хасах
                                </Button>
                              </motion.div>
                            ),
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Эрх олгох */}
                <TabsContent value="grant" className="mt-4 space-y-4">
                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-400">
                      Түргэн сонголт
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllUsers}
                        disabled={
                          getUsersWithoutAccess(selectedTool.id).length === 0
                        }
                        className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Бүгдийг сонгох
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUsers(new Set())}
                        disabled={selectedUsers.size === 0}
                        className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        Сонголт цэвэрлэх
                      </Button>
                    </div>

                    {/* Department Select */}
                    <Select
                      value={selectedDepartment}
                      onValueChange={(value) => {
                        setSelectedDepartment(value);
                        selectDepartmentUsers(value);
                      }}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-300">
                        <SelectValue placeholder="Хэлтсээр сонгох..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem
                            key={dept}
                            value={dept}
                            className="text-slate-300 focus:bg-slate-700 focus:text-white"
                          >
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* User List */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">
                      Хэрэглэгчид (
                      {getUsersWithoutAccess(selectedTool.id).length})
                    </h4>
                    <ScrollArea className="h-[calc(100vh-500px)]">
                      {getUsersWithoutAccess(selectedTool.id).length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-center py-12"
                        >
                          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-10 h-10 text-emerald-400" />
                          </div>
                          <p className="text-slate-400">
                            Бүх хэрэглэгчид эрхтэй байна
                          </p>
                        </motion.div>
                      ) : (
                        <div className="space-y-2">
                          {getUsersWithoutAccess(selectedTool.id).map(
                            (user, index) => (
                              <motion.div
                                key={user.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                                  selectedUsers.has(user.id)
                                    ? "bg-purple-500/20 border border-purple-500/50"
                                    : "bg-slate-800/50 border border-slate-700/50 hover:border-slate-600"
                                }`}
                                onClick={() => toggleUserSelection(user.id)}
                              >
                                <Checkbox
                                  checked={selectedUsers.has(user.id)}
                                  onCheckedChange={() =>
                                    toggleUserSelection(user.id)
                                  }
                                  className="border-slate-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                />
                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-medium">
                                  {user.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-white">
                                    {user.name}
                                  </p>
                                  <p className="text-sm text-slate-400">
                                    {user.department} • {user.position}
                                  </p>
                                </div>
                              </motion.div>
                            ),
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Grant Button */}
                  <AnimatePresence>
                    {selectedUsers.size > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="sticky bottom-0 pt-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent"
                      >
                        <Button
                          className={`w-full bg-gradient-to-r ${selectedTool.color} hover:opacity-90 text-white border-0 h-12 text-base`}
                          onClick={grantAccess}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Хадгалж байна...
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-5 h-5 mr-2" />
                              {selectedUsers.size} хэрэглэгчид эрх олгох
                            </>
                          )}
                        </Button>
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
