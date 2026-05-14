"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { departmentsApi } from "@/lib/api";
import axios from "axios";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2,
  Building2,
  Users,
  UserCheck,
  TrendingUp,
  Pencil,
  Trash2,
  ChevronRight,
  BadgeCheck,
  BarChart3,
  Shield,
  Briefcase,
  BookOpen,
  FlaskConical,
  Landmark,
  Globe,
  Layers,
  Search,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import AdminPageHeader from "@/components/shared/AdminPageHeader";

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

// Хэлтэс бүрт өнгө + дүрс автоматаар
const DEPT_PALETTES = [
  {
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    icon: "bg-blue-500/20 text-blue-400",
    bar: "bg-blue-500",
    ring: "ring-blue-500/30",
    accent: "text-blue-400",
  },
  {
    bg: "bg-violet-500/15",
    border: "border-violet-500/30",
    icon: "bg-violet-500/20 text-violet-400",
    bar: "bg-violet-500",
    ring: "ring-violet-500/30",
    accent: "text-violet-400",
  },
  {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    icon: "bg-emerald-500/20 text-emerald-400",
    bar: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    accent: "text-emerald-400",
  },
  {
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    icon: "bg-amber-500/20 text-amber-400",
    bar: "bg-amber-500",
    ring: "ring-amber-500/30",
    accent: "text-amber-400",
  },
  {
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    icon: "bg-rose-500/20 text-rose-400",
    bar: "bg-rose-500",
    ring: "ring-rose-500/30",
    accent: "text-rose-400",
  },
  {
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/30",
    icon: "bg-cyan-500/20 text-cyan-400",
    bar: "bg-cyan-500",
    ring: "ring-cyan-500/30",
    accent: "text-cyan-400",
  },
  {
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
    icon: "bg-orange-500/20 text-orange-400",
    bar: "bg-orange-500",
    ring: "ring-orange-500/30",
    accent: "text-orange-400",
  },
  {
    bg: "bg-teal-500/15",
    border: "border-teal-500/30",
    icon: "bg-teal-500/20 text-teal-400",
    bar: "bg-teal-500",
    ring: "ring-teal-500/30",
    accent: "text-teal-400",
  },
];

const DEPT_ICONS = [
  Building2,
  Shield,
  Briefcase,
  BookOpen,
  FlaskConical,
  Landmark,
  Globe,
  Layers,
  BarChart3,
];

function getDeptStyle(index: number) {
  return DEPT_PALETTES[index % DEPT_PALETTES.length];
}

function DeptIcon({ index, className }: { index: number; className?: string }) {
  const Icon = DEPT_ICONS[index % DEPT_ICONS.length];
  return <Icon className={className ?? "w-5 h-5"} />;
}

function AvatarRow({
  users,
  max = 5,
}: {
  users: DepartmentUser[];
  max?: number;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - max;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u, i) => (
        <div
          key={u.id}
          style={{ zIndex: max - i }}
          className="relative w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-300 uppercase"
          title={u.name}
        >
          {u.name.charAt(0)}
        </div>
      ))}
      {rest > 0 && (
        <div
          className="relative w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-400"
          style={{ zIndex: 0 }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

export default function AdminDepartmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [filteredDepts, setFilteredDepts] = useState<DepartmentData[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] =
    useState<DepartmentData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    employeeCount: 0,
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    setFilteredDepts(
      q
        ? departments.filter(
            (d) =>
              d.name.toLowerCase().includes(q) ||
              d.description?.toLowerCase().includes(q),
          )
        : departments,
    );
  }, [search, departments]);

  const loadDepartments = async () => {
    try {
      const data = await departmentsApi.getAll();
      const filtered = data.map((dept: DepartmentData) => ({
        ...dept,
        users: dept.users?.filter((u) => !u.isAdmin) || [],
      }));
      setDepartments(filtered);
    } catch {
      toast({
        title: "Алдаа",
        description: "Хэлтсүүдийг ачаалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDepartment = (dept: DepartmentData, index: number) => {
    setSelectedDepartment(dept);
    setSelectedIndex(index);
    setIsViewOpen(true);
  };

  const handleEditDepartment = (dept: DepartmentData, index?: number) => {
    setSelectedDepartment(dept);
    if (index !== undefined) setSelectedIndex(index);
    setFormData({
      name: dept.name || "",
      description: dept.description || "",
      employeeCount: dept.employeeCount || 0,
    });
    setIsEditOpen(true);
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
    } catch {
      toast({
        title: "Алдаа",
        description: "Хэлтсийн мэдээлэл шинэчлэхэд алдаа гарлаа.",
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
    if (!confirm(`"${dept.name}" хэлтсийг устгахдаа итгэлтэй байна уу?`))
      return;
    try {
      await departmentsApi.delete(dept.id);
      toast({ title: "Амжилттай", description: "Хэлтэс устгагдлаа." });
      loadDepartments();
    } catch (error) {
      let message = "Хэлтсийг устгахад алдаа гарлаа.";
      if (axios.isAxiosError(error)) message = error.response?.data?.message ?? message;
      toast({ title: "Алдаа", description: message, variant: "destructive" });
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
  const avgPerDept = Math.round(
    totalEmployees / Math.max(departments.length, 1),
  );

  const stats = [
    {
      label: "Нийт хэлтэс",
      value: departments.length,
      icon: Building2,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Нийт ажилтан",
      value: totalEmployees,
      icon: Users,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      label: "Идэвхтэй",
      value: activeEmployees,
      icon: UserCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Дундаж / хэлтэс",
      value: avgPerDept,
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
  ];

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Ачаалж байна…</p>
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-slate-400 text-sm">Хандах эрхгүй</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AdminPageHeader title="Хэлтсүүд" />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-2xl border p-4 ${s.bg}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Хэлтэс хайх…"
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 w-56 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{filteredDepts.length} хэлтэс</span>
          </div>
        </div>

        {/* Grid */}
        {filteredDepts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-slate-800 py-24 text-center"
          >
            <div className="inline-flex w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 items-center justify-center mb-3">
              <Building2 className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-slate-500 text-sm">
              {search ? "Хайлтын үр дүн олдсонгүй" : "Хэлтэс байхгүй байна"}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {filteredDepts.map((dept, index) => {
                const palette = getDeptStyle(index);
                const userCount = dept.users?.length || 0;
                const activeCount =
                  dept.users?.filter((u) => u.isActive !== false).length || 0;
                const pct =
                  totalEmployees > 0 ? (userCount / totalEmployees) * 100 : 0;

                return (
                  <motion.div
                    key={dept.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: index * 0.04 }}
                    whileHover={{ y: -2 }}
                    className={`relative rounded-2xl border bg-slate-900/80 hover:bg-slate-900 cursor-pointer group transition-all duration-200 overflow-hidden ${palette.border}`}
                    onClick={() => handleViewDepartment(dept, index)}
                  >
                    {/* Top accent bar */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-0.5 ${palette.bar} opacity-60`}
                    />

                    <div className="p-4 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${palette.icon}`}
                          >
                            <DeptIcon index={index} className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-white leading-snug truncate group-hover:text-slate-100">
                              {dept.name}
                            </p>
                            {dept.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {dept.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div
                          className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditDepartment(dept, index);
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Засах"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteDepartment(e, dept)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Устгах"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Employee stats */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p
                              className={`text-lg font-bold leading-none ${palette.accent}`}
                            >
                              {userCount}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              ажилтан
                            </p>
                          </div>
                          {activeCount > 0 && (
                            <>
                              <div className="w-px h-6 bg-slate-800" />
                              <div className="text-center">
                                <p className="text-lg font-bold text-emerald-400 leading-none">
                                  {activeCount}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  идэвхтэй
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                        {dept.users && dept.users.length > 0 && (
                          <AvatarRow users={dept.users} />
                        )}
                      </div>

                      {/* Progress + chevron */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-600">
                            Нийт ажилтны хувь
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${palette.accent}`}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${palette.bar}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 0.9,
                              delay: 0.3 + index * 0.04,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-600">
                          {dept.createdAt
                            ? new Date(dept.createdAt).toLocaleDateString(
                                "mn-MN",
                              )
                            : "—"}
                        </span>
                        <span
                          className={`flex items-center gap-0.5 text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${palette.accent}`}
                        >
                          Дэлгэрэнгүй <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* View Sheet */}
      <Sheet open={isViewOpen} onOpenChange={setIsViewOpen}>
        <SheetContent className="sm:max-w-md bg-slate-950 border-slate-800 p-0 flex flex-col">
          <SheetTitle className="sr-only">
            {selectedDepartment?.name ?? "Хэлтэс"}
          </SheetTitle>
          {selectedDepartment &&
            (() => {
              const palette = getDeptStyle(selectedIndex);
              const userCount = selectedDepartment.users?.length || 0;
              const activeCount =
                selectedDepartment.users?.filter((u) => u.isActive !== false)
                  .length || 0;
              return (
                <>
                  {/* Sheet header */}
                  <div
                    className={`relative border-b border-slate-800 px-5 py-5 overflow-hidden`}
                  >
                    <div
                      className={`absolute inset-0 ${palette.bg} opacity-40`}
                    />
                    <div
                      className={`absolute top-0 left-0 right-0 h-0.5 ${palette.bar}`}
                    />
                    <div className="relative flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${palette.icon}`}
                      >
                        <DeptIcon index={selectedIndex} className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                          Хэлтэс
                        </p>
                        <p className="text-lg font-bold text-white leading-snug">
                          {selectedDepartment.name}
                        </p>
                        {selectedDepartment.description && (
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {selectedDepartment.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="relative flex gap-4 mt-4 pt-4 border-t border-slate-800/60">
                      <div className="text-center">
                        <p
                          className={`text-2xl font-bold leading-none ${palette.accent}`}
                        >
                          {userCount}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          нийт ажилтан
                        </p>
                      </div>
                      <div className="w-px bg-slate-800" />
                      <div className="text-center">
                        <p className="text-2xl font-bold leading-none text-emerald-400">
                          {activeCount}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          идэвхтэй
                        </p>
                      </div>
                      <div className="w-px bg-slate-800" />
                      <div className="text-center">
                        <p className="text-2xl font-bold leading-none text-slate-400">
                          {userCount - activeCount}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          идэвхгүй
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Users */}
                  <ScrollArea className="flex-1">
                    {selectedDepartment.users &&
                    selectedDepartment.users.length > 0 ? (
                      <div className="py-2">
                        <p className="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                          Ажилтнууд
                        </p>
                        <div className="divide-y divide-slate-800/50">
                          {selectedDepartment.users.map((u, i) => (
                            <motion.div
                              key={u.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex items-center justify-between px-5 py-3 hover:bg-slate-900/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border ${palette.icon} ${palette.border}`}
                                >
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">
                                    {u.name}
                                  </p>
                                  {u.position && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {u.position}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-slate-600">
                                    {u.email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {u.isActive !== false ? (
                                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    <BadgeCheck className="w-3 h-3" /> Идэвхтэй
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                                    Идэвхгүй
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                          <Users className="w-5 h-5 text-slate-600" />
                        </div>
                        <p className="text-slate-500 text-sm">
                          Ажилтан бүртгэгдээгүй
                        </p>
                      </div>
                    )}
                  </ScrollArea>

                  <div className="border-t border-slate-800 p-4">
                    <button
                      onClick={() => {
                        setIsViewOpen(false);
                        handleEditDepartment(selectedDepartment, selectedIndex);
                      }}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${palette.icon} border ${palette.border} hover:brightness-110`}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Хэлтэс засах
                    </button>
                  </div>
                </>
              );
            })()}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${getDeptStyle(selectedIndex).icon}`}
              >
                <DeptIcon index={selectedIndex} />
              </div>
              <div>
                <DialogTitle className="text-white text-base">
                  Хэлтэс засах
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-xs">
                  Хэлтсийн мэдээллийг шинэчлэх
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Хэлтсийн нэр</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="bg-slate-800 border-slate-700 text-white focus-visible:ring-blue-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Тайлбар</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                placeholder="Хэлтсийн чиг үүрэг…"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 resize-none focus-visible:ring-blue-500/30"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              className="border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Цуцлах
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="bg-white text-slate-950 hover:bg-slate-200 border-0"
            >
              {isSaving && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
