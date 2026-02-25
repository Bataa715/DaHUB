"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { departmentsApi } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Building2,
  Users,
  Shield,
  Mail,
  Briefcase,
  TrendingUp,
  Edit,
  Plus,
  Trash2,
  Loader2,
  Eye,
  ArrowLeft,
  UserCheck,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// Fixed particle positions for SSR
const PARTICLE_POSITIONS = [
  { top: "8%", left: "12%", duration: 3.5 },
  { top: "15%", left: "78%", duration: 4.2 },
  { top: "28%", left: "8%", duration: 3.8 },
  { top: "42%", left: "88%", duration: 4.5 },
  { top: "58%", left: "18%", duration: 3.3 },
  { top: "68%", left: "72%", duration: 4.0 },
  { top: "78%", left: "35%", duration: 3.9 },
  { top: "88%", left: "58%", duration: 4.3 },
  { top: "22%", left: "45%", duration: 3.6 },
  { top: "75%", left: "92%", duration: 4.1 },
  { top: "48%", left: "5%", duration: 3.4 },
  { top: "92%", left: "25%", duration: 4.4 },
];

interface DepartmentUser {
  id: string;
  email: string;
  name: string;
  position?: string;
  isAdmin: boolean;
  isActive?: boolean;
}

interface DepartmentData {
  id: string;
  name: string;
  description?: string;
  employeeCount?: number;
  users?: DepartmentUser[];
  createdAt?: string;
  updatedAt?: string;
}

const cardGradients = [
  {
    card: "from-blue-500/20 to-cyan-500/10",
    icon: "from-blue-500 to-cyan-500",
    border: "hover:border-blue-500/50",
  },
  {
    card: "from-purple-500/20 to-violet-500/10",
    icon: "from-purple-500 to-violet-500",
    border: "hover:border-purple-500/50",
  },
  {
    card: "from-emerald-500/20 to-teal-500/10",
    icon: "from-emerald-500 to-teal-500",
    border: "hover:border-emerald-500/50",
  },
  {
    card: "from-amber-500/20 to-orange-500/10",
    icon: "from-amber-500 to-orange-500",
    border: "hover:border-amber-500/50",
  },
  {
    card: "from-pink-500/20 to-rose-500/10",
    icon: "from-pink-500 to-rose-500",
    border: "hover:border-pink-500/50",
  },
  {
    card: "from-cyan-500/20 to-sky-500/10",
    icon: "from-cyan-500 to-sky-500",
    border: "hover:border-cyan-500/50",
  },
];

export default function AdminDepartmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [selectedDepartment, setSelectedDepartment] =
    useState<DepartmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    employeeCount: 0,
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await departmentsApi.getAll();
      const filteredData = data.map((dept: DepartmentData) => ({
        ...dept,
        users: dept.users?.filter((u) => !u.isAdmin) || [],
      }));
      setDepartments(filteredData);
    } catch (error) {
      console.error("Error loading departments:", error);
      toast({
        title: "Алдаа",
        description: "Хэлтсүүдийг ачаалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDepartment = (dept: DepartmentData) => {
    setSelectedDepartment(dept);
    setIsViewOpen(true);
  };

  const handleEditDepartment = (dept: DepartmentData) => {
    setSelectedDepartment(dept);
    setFormData({
      name: dept.name || "",
      description: dept.description || "",
      employeeCount: dept.employeeCount || 0,
    });
    setIsEditOpen(true);
  };

  const handleAddDepartment = () => {
    setFormData({
      name: "",
      description: "",
      employeeCount: 0,
    });
    setIsAddOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDepartment) return;

    setIsSaving(true);
    try {
      await departmentsApi.update(selectedDepartment.id, formData);
      toast({
        title: "Амжилттай",
        description: "Хэлтсийн мэдээлэл шинэчлэгдлээ.",
      });
      setIsEditOpen(false);
      loadDepartments();
    } catch (error) {
      console.error("Error updating department:", error);
      toast({
        title: "Алдаа",
        description: "Хэлтсийн мэдээлэл шинэчлэхэд алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAdd = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Алдаа",
        description: "Хэлтсийн нэрийг оруулна уу.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await departmentsApi.create(formData);
      toast({
        title: "Амжилттай",
        description: "Шинэ хэлтэс нэмэгдлээ.",
      });
      setIsAddOpen(false);
      loadDepartments();
    } catch (error: any) {
      console.error("Error creating department:", error);
      toast({
        title: "Алдаа",
        description:
          error.response?.data?.message || "Хэлтэс нэмэхэд алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDepartment = async (
    e: React.MouseEvent,
    dept: DepartmentData,
  ) => {
    e.stopPropagation();
    if (!confirm(`"${dept.name}" хэлтсийг устгахдаа итгэлтэй байна уу?`)) {
      return;
    }

    try {
      await departmentsApi.delete(dept.id);
      toast({
        title: "Амжилттай",
        description: "Хэлтэс устгагдлаа.",
      });
      loadDepartments();
    } catch (error: any) {
      console.error("Error deleting department:", error);
      toast({
        title: "Алдаа",
        description:
          error.response?.data?.message || "Хэлтсийг устгахад алдаа гарлаа.",
        variant: "destructive",
      });
    }
  };

  const totalEmployees = departments.reduce(
    (sum, d) => sum + (d.users?.length || 0),
    0,
  );
  const activeEmployees = departments.reduce(
    (sum, d) =>
      sum + (d.users?.filter((u) => u.isActive !== false).length || 0),
    0,
  );

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-12 w-12 text-emerald-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-3xl"
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
          className="absolute w-1 h-1 bg-emerald-400/30 rounded-full"
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
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
              <Building2 className="w-8 h-8 text-emerald-400" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Хэлтсүүд
              </h1>
            </div>
            <p className="text-slate-400 mt-4 max-w-lg">
              Байгууллагын бүх хэлтсийн мэдээлэл, тохиргоо удирдах
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={handleAddDepartment}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/25"
            >
              <Plus className="w-5 h-5 mr-2" />
              Хэлтэс нэмэх
            </Button>
          </motion.div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid gap-4 md:grid-cols-4"
        >
          {[
            {
              label: "Нийт хэлтэс",
              value: departments.length,
              icon: Building2,
              color: "from-emerald-500 to-teal-500",
            },
            {
              label: "Нийт ажилтан",
              value: totalEmployees,
              icon: Users,
              color: "from-blue-500 to-cyan-500",
            },
            {
              label: "Идэвхтэй",
              value: activeEmployees,
              icon: UserCheck,
              color: "from-green-500 to-emerald-500",
            },
            {
              label: "Дундаж ажилтан",
              value: Math.round(
                totalEmployees / Math.max(departments.length, 1),
              ),
              icon: TrendingUp,
              color: "from-purple-500 to-violet-500",
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

        {/* Department Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Бүх хэлтсүүд
          </h2>

          {departments.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
              <CardContent className="py-12 text-center">
                <Building2 className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 mb-4">Хэлтэс байхгүй байна</p>
                <Button
                  onClick={handleAddDepartment}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Эхний хэлтсээ нэмэх
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {departments.map((dept, index) => {
                  const gradient = cardGradients[index % cardGradients.length];
                  const activeCount =
                    dept.users?.filter((u) => u.isActive !== false).length || 0;

                  return (
                    <motion.div
                      key={dept.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      whileHover={{ y: -5, scale: 1.02 }}
                      className="group cursor-pointer"
                      onClick={() => handleViewDepartment(dept)}
                    >
                      <Card
                        className={`bg-slate-800/50 border-slate-700/50 backdrop-blur-sm h-full transition-all duration-300 ${gradient.border} hover:shadow-lg`}
                      >
                        {/* Gradient overlay on hover */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${gradient.card} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`}
                        />

                        <CardHeader className="relative pb-3">
                          <div className="flex items-start justify-between">
                            <motion.div
                              className={`p-3 rounded-xl bg-gradient-to-br ${gradient.icon} shadow-lg`}
                              whileHover={{ rotate: [0, -10, 10, 0] }}
                              transition={{ duration: 0.5 }}
                            >
                              <Building2 className="w-6 h-6 text-white" />
                            </motion.div>
                            <div
                              className="flex gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700/50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDepartment(dept);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700/50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditDepartment(dept);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={(e) => handleDeleteDepartment(e, dept)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="relative space-y-4">
                          <div>
                            <CardTitle className="text-xl mb-1 text-white group-hover:text-emerald-300 transition-colors">
                              {dept.name}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 text-slate-400">
                              {dept.description || "Тайлбар оруулаагүй"}
                            </CardDescription>
                          </div>

                          <div className="flex items-center gap-3 pt-3 border-t border-slate-700/50">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-white">
                                {dept.users?.length || 0}
                              </span>
                              <span className="text-sm text-slate-400">
                                ажилтан
                              </span>
                            </div>
                            {activeCount > 0 && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
                                {activeCount} идэвхтэй
                              </Badge>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full bg-gradient-to-r ${gradient.icon}`}
                              initial={{ width: 0 }}
                              animate={{
                                width:
                                  totalEmployees > 0
                                    ? `${((dept.users?.length || 0) / totalEmployees) * 100}%`
                                    : "0%",
                              }}
                              transition={{
                                duration: 1,
                                delay: 0.5 + index * 0.1,
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      {/* View Department Sheet */}
      <Sheet open={isViewOpen} onOpenChange={setIsViewOpen}>
        <SheetContent className="sm:max-w-xl bg-slate-900 border-slate-700 overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <SheetTitle className="text-white text-xl">
                  {selectedDepartment?.name}
                </SheetTitle>
                <SheetDescription className="text-slate-400">
                  Хэлтсийн дэлгэрэнгүй мэдээлэл
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {selectedDepartment && (
            <div className="space-y-6 mt-6">
              {/* Description */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <Label className="text-slate-400 text-sm">
                  Тайлбар / Чиг үүрэг
                </Label>
                <p className="mt-2 text-slate-200">
                  {selectedDepartment.description || "Тайлбар оруулаагүй"}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-slate-700/50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        {selectedDepartment.users?.length || 0}
                      </p>
                      <p className="text-sm text-slate-400">Нийт ажилтан</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-slate-700/50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                        {selectedDepartment.users?.filter(
                          (u) => u.isActive !== false,
                        ).length || 0}
                      </p>
                      <p className="text-sm text-slate-400">Идэвхтэй</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Users List */}
              <div>
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Ажилтнууд
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {selectedDepartment.users &&
                    selectedDepartment.users.length > 0 ? (
                      selectedDepartment.users.map((u, index) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-medium">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-white">{u.name}</p>
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Mail className="w-3 h-3" />
                                {u.email}
                              </div>
                              {u.position && (
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                  <Briefcase className="w-3 h-3" />
                                  {u.position}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge
                            className={
                              u.isActive !== false
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-slate-700/50 text-slate-400 border-slate-600"
                            }
                          >
                            {u.isActive !== false ? "Идэвхтэй" : "Идэвхгүй"}
                          </Badge>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                        <p className="text-slate-400">Ажилтан бүртгэгдээгүй</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setIsViewOpen(false);
                    handleEditDepartment(selectedDepartment);
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Засах
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Department Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-emerald-400" />
              Хэлтэс засах
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Хэлтсийн мэдээллийг шинэчлэх
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-slate-300">
                Хэлтсийн нэр
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-slate-300">
                Тайлбар / Чиг үүрэг
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                placeholder="Хэлтсийн үндсэн чиг үүрэг, зорилгыг бичнэ үү..."
                className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 placeholder:text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Цуцлах
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Department Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Шинэ хэлтэс нэмэх
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Шинэ хэлтсийн мэдээллийг оруулна уу
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name" className="text-slate-300">
                Хэлтсийн нэр *
              </Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Жишээ: Санхүүгийн хэлтэс"
                className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description" className="text-slate-300">
                Тайлбар / Чиг үүрэг
              </Label>
              <Textarea
                id="add-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                placeholder="Хэлтсийн үндсэн чиг үүрэг, зорилгыг бичнэ үү..."
                className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 placeholder:text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Цуцлах
            </Button>
            <Button
              onClick={handleSaveAdd}
              disabled={isSaving}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Нэмэх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
