"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { departmentsApi } from "@/lib/api";
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
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
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

export default function AdminDepartmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", employeeCount: 0 });

  useEffect(() => { loadDepartments(); }, []);

  const loadDepartments = async () => {
    try {
      const data = await departmentsApi.getAll();
      const filteredData = data.map((dept: DepartmentData) => ({
        ...dept,
        users: dept.users?.filter((u) => !u.isAdmin) || [],
      }));
      setDepartments(filteredData);
    } catch {
      toast({ title: "Алдаа", description: "Хэлтсүүдийг ачаалахад алдаа гарлаа.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDepartment = (dept: DepartmentData) => { setSelectedDepartment(dept); setIsViewOpen(true); };

  const handleEditDepartment = (dept: DepartmentData) => {
    setSelectedDepartment(dept);
    setFormData({ name: dept.name || "", description: dept.description || "", employeeCount: dept.employeeCount || 0 });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDepartment) return;
    setIsSaving(true);
    try {
      await departmentsApi.update(selectedDepartment.id, formData);
      toast({ title: "Амжилттай", description: "Хэлтсийн мэдээлэл шинэчлэгдлээ." });
      setIsEditOpen(false);
      loadDepartments();
    } catch {
      toast({ title: "Алдаа", description: "Хэлтсийн мэдээлэл шинэчлэхэд алдаа гарлаа.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDepartment = async (e: React.MouseEvent, dept: DepartmentData) => {
    e.stopPropagation();
    if (!confirm(`"${dept.name}" хэлтсийг устгахдаа итгэлтэй байна уу?`)) return;
    try {
      await departmentsApi.delete(dept.id);
      toast({ title: "Амжилттай", description: "Хэлтэс устгагдлаа." });
      loadDepartments();
    } catch (error: any) {
      toast({ title: "Алдаа", description: error.response?.data?.message || "Хэлтсийг устгахад алдаа гарлаа.", variant: "destructive" });
    }
  };

  const totalEmployees = departments.reduce((sum, d) => sum + (d.users?.length || 0), 0);
  const activeEmployees = departments.reduce((sum, d) => sum + (d.users?.filter((u) => u.isActive !== false).length || 0), 0);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500">Хандах эрхгүй</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminPageHeader title="Хэлтсүүд" />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Нийт хэлтэс", value: departments.length },
            { label: "Нийт ажилтан", value: totalEmployees },
            { label: "Идэвхтэй", value: activeEmployees },
            { label: "Дундаж", value: Math.round(totalEmployees / Math.max(departments.length, 1)) },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Department grid */}
        {departments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 py-20 text-center text-slate-600">
            Хэлтэс байхгүй байна
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {departments.map((dept, index) => {
                const activeCount = dept.users?.filter((u) => u.isActive !== false).length || 0;
                const pct = totalEmployees > 0 ? ((dept.users?.length || 0) / totalEmployees) * 100 : 0;

                return (
                  <motion.div
                    key={dept.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: index * 0.04 }}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-4 cursor-pointer transition-colors group"
                    onClick={() => handleViewDepartment(dept)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-semibold text-white text-sm leading-snug group-hover:text-slate-100">{dept.name}</p>
                      <div className="flex gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditDepartment(dept); }}
                          className="text-[10px] text-slate-500 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
                        >
                          Засах
                        </button>
                        <button
                          onClick={(e) => handleDeleteDepartment(e, dept)}
                          className="text-[10px] text-slate-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                        >
                          Устгах
                        </button>
                      </div>
                    </div>

                    {dept.description && (
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{dept.description}</p>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>{dept.users?.length || 0} ажилтан</span>
                      {activeCount > 0 && <span className="text-emerald-500">{activeCount} идэвхтэй</span>}
                    </div>
                    <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-slate-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + index * 0.05 }}
                      />
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
          <SheetTitle className="sr-only">{selectedDepartment?.name ?? "Хэлтэс"}</SheetTitle>
          {selectedDepartment && (
            <>
              <div className="border-b border-slate-800 px-5 py-4">
                <p className="text-xs text-slate-500 mb-0.5 uppercase tracking-widest">Хэлтэс</p>
                <p className="text-lg font-semibold text-white">{selectedDepartment.name}</p>
                {selectedDepartment.description && (
                  <p className="text-xs text-slate-500 mt-1">{selectedDepartment.description}</p>
                )}
                <div className="flex gap-4 mt-3">
                  <div>
                    <p className="text-lg font-bold text-white leading-none">{selectedDepartment.users?.length || 0}</p>
                    <p className="text-xs text-slate-500">нийт</p>
                  </div>
                  <div className="w-px bg-slate-800" />
                  <div>
                    <p className="text-lg font-bold text-emerald-400 leading-none">
                      {selectedDepartment.users?.filter((u) => u.isActive !== false).length || 0}
                    </p>
                    <p className="text-xs text-slate-500">идэвхтэй</p>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {selectedDepartment.users && selectedDepartment.users.length > 0 ? (
                  <div className="divide-y divide-slate-800/60">
                    {selectedDepartment.users.map((u, i) => (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between px-5 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-medium text-slate-400">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm text-white">{u.name}</p>
                            {u.position && <p className="text-xs text-slate-500">{u.position}</p>}
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${u.isActive !== false ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-slate-800"}`}>
                          {u.isActive !== false ? "Идэвхтэй" : "Идэвхгүй"}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-600 text-sm">Ажилтан бүртгэгдээгүй</div>
                )}
              </ScrollArea>

              <div className="border-t border-slate-800 p-4">
                <button
                  onClick={() => { setIsViewOpen(false); handleEditDepartment(selectedDepartment); }}
                  className="w-full py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Засах
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Хэлтэс засах</DialogTitle>
            <DialogDescription className="text-slate-400">Хэлтсийн мэдээллийг шинэчлэх</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Хэлтсийн нэр</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Тайлбар</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Хэлтсийн чиг үүрэг..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="border border-slate-700 text-slate-300 hover:bg-slate-800">
              Цуцлах
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving} className="bg-white text-slate-950 hover:bg-slate-200 border-0">
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
