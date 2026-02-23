"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Shield,
  Building2,
  Activity,
  TrendingUp,
  UserCheck,
  UserX,
  Wrench,
  Newspaper,
  ArrowRight,
  Sparkles,
  BarChart3,
  Lock,
  Loader2,
  ChevronRight,
  Zap,
  Target,
  Award,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DEPARTMENTS } from "@/lib/constants";
import { Progress } from "@/components/ui/progress";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  usersByDepartment: Record<string, number>;
  recentActivity: number;
}

// Fixed particle positions
const PARTICLE_POSITIONS = [
  { left: 10, top: 20 },
  { left: 90, top: 15 },
  { left: 50, top: 80 },
  { left: 25, top: 45 },
  { left: 75, top: 60 },
  { left: 15, top: 75 },
  { left: 85, top: 35 },
  { left: 40, top: 10 },
  { left: 60, top: 90 },
  { left: 30, top: 55 },
  { left: 70, top: 25 },
  { left: 5, top: 65 },
  { left: 95, top: 50 },
  { left: 45, top: 30 },
  { left: 55, top: 70 },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    adminUsers: 0,
    usersByDepartment: {},
    recentActivity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const allUsers = await usersApi.getAll();

      const users = allUsers.filter((u: any) => !u.isAdmin);
      const adminUsers = allUsers.filter((u: any) => u.isAdmin).length;

      const usersByDepartment: Record<string, number> = {};
      DEPARTMENTS.forEach((dept) => {
        usersByDepartment[dept] = 0;
      });

      let activeUsers = 0;

      users.forEach((u: any) => {
        if (u.isActive) activeUsers++;
        if (u.department) {
          usersByDepartment[u.department] =
            (usersByDepartment[u.department] || 0) + 1;
        }
      });

      setStats({
        totalUsers: users.length,
        activeUsers,
        inactiveUsers: users.length - activeUsers,
        adminUsers,
        usersByDepartment,
        recentActivity: users.filter((u: any) => {
          if (!u.lastLoginAt) return false;
          const lastLogin = new Date(u.lastLoginAt);
          const dayAgo = new Date();
          dayAgo.setDate(dayAgo.getDate() - 1);
          return lastLogin > dayAgo;
        }).length,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-slate-400">Ачаалж байна...</p>
        </motion.div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Хандах эрхгүй</h2>
          <p className="text-slate-400">
            Зөвхөн админ хэрэглэгч үзэх боломжтой.
          </p>
        </motion.div>
      </div>
    );
  }

  const quickActions = [
    {
      title: "Хэрэглэгчид",
      description: "Бүх хэрэглэгчийг харах, удирдах",
      icon: Users,
      href: "/admin/users",
      gradient: "from-blue-600 via-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-400",
      count: stats.totalUsers,
    },
    {
      title: "Хэлтсүүд",
      description: "Байгууллагын хэлтсүүдийг удирдах",
      icon: Building2,
      href: "/admin/departments",
      gradient: "from-purple-600 via-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-400",
      count: DEPARTMENTS.length,
    },
    {
      title: "Хэрэгслүүд",
      description: "Эрх олгох, эрхийг удирдах",
      icon: Wrench,
      href: "/admin/tools",
      gradient: "from-emerald-600 via-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      count: stats.activeUsers,
    },
    {
      title: "Мэдээ",
      description: "Мэдээ нийтлэх, засах, устгах",
      icon: Newspaper,
      href: "/admin/news",
      gradient: "from-amber-600 via-orange-500 to-rose-500",
      bgColor: "bg-amber-500/10",
      iconColor: "text-amber-400",
      count: 0,
    },
  ];

  const statCards = [
    {
      title: "Нийт хэрэглэгч",
      value: stats.totalUsers,
      icon: Users,
      gradient: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-400",
      description: "Бүртгэлтэй",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Идэвхтэй",
      value: stats.activeUsers,
      icon: UserCheck,
      gradient: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      description: "Эрхтэй",
      trend: "+8%",
      trendUp: true,
    },
    {
      title: "Идэвхгүй",
      value: stats.inactiveUsers,
      icon: UserX,
      gradient: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-400",
      description: "Хаагдсан",
      trend: "-3%",
      trendUp: false,
    },
    {
      title: "Сүүлийн 24 цагт",
      value: stats.recentActivity,
      icon: Activity,
      gradient: "from-amber-500 to-yellow-500",
      bgColor: "bg-amber-500/10",
      iconColor: "text-amber-400",
      description: "Нэвтэрсэн",
      trend: "Өнөөдөр",
      trendUp: true,
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Modernized Animated Background with Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950">
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-full blur-3xl"
          animate={{
            x: [0, -80, 0],
            y: [0, -60, 0],
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-gradient-to-r from-emerald-600/15 to-teal-600/15 rounded-full blur-3xl"
          animate={{
            x: [-100, 100, -100],
            y: [-80, 80, -80],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />

        {/* Floating particles with improved animation */}
        {PARTICLE_POSITIONS.map((pos, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              background: `radial-gradient(circle, ${
                i % 3 === 0
                  ? "rgba(59, 130, 246, 0.6)"
                  : i % 3 === 1
                    ? "rgba(168, 85, 247, 0.6)"
                    : "rgba(16, 185, 129, 0.6)"
              }, transparent)`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 4 + (i % 5),
              repeat: Infinity,
              delay: (i % 10) * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Enhanced Header with better visual hierarchy */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-50" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-2xl">
                <Shield className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </motion.div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
                Админ хяналтын самбар
                <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border-blue-400/30 text-xs px-3 py-1">
                  v2.0
                </Badge>
              </h1>
              <p className="text-slate-300 flex items-center gap-2 text-sm sm:text-base">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                Сайн байна уу,{" "}
                <span className="font-semibold text-white">{user.name}</span>
                <span className="hidden sm:inline text-slate-500">•</span>
                <span className="hidden sm:inline text-slate-400">
                  {new Date().toLocaleDateString("mn-MN", {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Stats Grid with animations and trends */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8"
        >
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="group"
              >
                <Card className="relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border-slate-700/50 hover:border-slate-600/80 transition-all duration-300 shadow-xl hover:shadow-2xl">
                  {/* Gradient overlay on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                  />

                  <CardContent className="p-6 relative">
                    <div className="flex items-start justify-between mb-4">
                      <motion.div
                        className={`p-3 rounded-xl ${stat.bgColor} backdrop-blur-sm`}
                        whileHover={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                      </motion.div>
                      <Badge
                        className={`${
                          stat.trendUp
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-orange-500/20 text-orange-300"
                        } border-0 text-xs font-semibold`}
                      >
                        {stat.trend}
                      </Badge>
                    </div>
                    <div>
                      <motion.div
                        className="text-4xl font-bold text-white mb-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: 0.3 + index * 0.1,
                          type: "spring",
                        }}
                      >
                        {stat.value}
                      </motion.div>
                      <p className="text-slate-400 text-sm mb-1">
                        {stat.title}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {stat.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Department Stats with progress bars */}
        <div className="grid gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-slate-900/60 backdrop-blur-xl border-slate-700/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-purple-400" />
                  Хэлтсүүдийн статистик
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.usersByDepartment)
                    .filter(([_, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([dept, count], index) => {
                      const percentage = (count / stats.totalUsers) * 100 || 0;
                      return (
                        <motion.div
                          key={dept}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + index * 0.05 }}
                          className="space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300 text-sm font-medium truncate flex-1">
                              {dept}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-xs">
                                {percentage.toFixed(0)}%
                              </span>
                              <Badge className="bg-purple-500/20 text-purple-300 border-0 font-bold">
                                {count}
                              </Badge>
                            </div>
                          </div>
                          <Progress
                            value={percentage}
                            className="h-2 bg-slate-800/50"
                          />
                        </motion.div>
                      );
                    })}
                  {Object.entries(stats.usersByDepartment).filter(
                    ([_, count]) => count > 0,
                  ).length === 0 && (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">
                        Хэрэглэгч бүртгэгдээгүй байна
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
