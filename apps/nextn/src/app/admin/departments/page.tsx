"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { departmentsApi } from "@/lib/api";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Building2, Users, Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { isRegularAppUser } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DepartmentUser {
  id: string;
  email: string;
  name: string;
  position?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isActive?: boolean;
}

interface DepartmentData {
  id: string;
  name: string;
  description?: string;
  code?: string;
  users?: DepartmentUser[];
  createdAt?: string;
  updatedAt?: string;
}

export default function AdminDepartmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);

  const [selectedDepartment, setSelectedDepartment] =
    useState<DepartmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "" });
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await departmentsApi.getAll();
      const filtered = data.map((dept: DepartmentData) => ({
        ...dept,
        users: dept.users?.filter((u) => isRegularAppUser(u)) || [],
      }));
      setDepartments(filtered);
    } catch {
      toast({
        title: t("error"),
        description: t("admDeptLoadError"),
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

  const handleCreateDepartment = async () => {
    const name = createName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await departmentsApi.create({
        name,
        code: createCode.trim().toUpperCase() || undefined,
      });
      toast({ title: t("success"), description: t("admDeptCreatedDesc") });
      setIsCreateOpen(false);
      setCreateName("");
      setCreateCode("");
      loadDepartments();
    } catch (error) {
      let message = t("admDeptCreateError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditDepartment = (dept: DepartmentData) => {
    setSelectedDepartment(dept);
    setFormData({ name: dept.name || "", code: dept.code || "" });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDepartment) return;
    setIsSaving(true);
    try {
      // Зөвхөн засагдах талбарууд — description/users илгээхгүй (validation 400-ээс сэргийлнэ)
      await departmentsApi.update(selectedDepartment.id, {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
      });
      toast({
        title: t("success"),
        description: t("admDeptUpdatedDesc"),
      });
      setIsEditOpen(false);
      loadDepartments();
    } catch (error) {
      let message = t("admDeptUpdateError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: Array.isArray(message) ? message.join(", ") : message,
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
    if (!confirm(`"${dept.name}" ${t("admDeptDeleteConfirmSuffix")}`)) return;
    try {
      await departmentsApi.delete(dept.id);
      toast({ title: t("success"), description: t("admDeptDeletedDesc") });
      loadDepartments();
    } catch (error) {
      let message = t("admDeptDeleteError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title={t("admDeptPageTitle")}
        rightContent={
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground/60 text-xs">
              {departments.length} {t("admDeptUnit")}
            </span>
            <Button
              size="sm"
              onClick={() => {
                setCreateName("");
                setIsCreateOpen(true);
              }}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> {t("admDeptAddBtn")}
            </Button>
          </div>
        }
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Grid */}
        {departments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <Building2 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/50">
              {t("admDeptEmpty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-5">
            {departments.map((dept) => {
              const userCount = dept.users?.length || 0;
              return (
                <div
                  key={dept.id}
                  className="rounded-xl border border-border bg-card px-4 py-5 flex flex-col gap-3 cursor-pointer hover:bg-accent/30 transition-colors group min-h-[120px]"
                  onClick={() => handleViewDepartment(dept)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDepartment(dept);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
                        title={t("admCommonEditBtn")}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDepartment(e, dept)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title={t("tailan_deleteAction")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {dept.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {dept.code && (
                        <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80 tracking-wide">
                          {dept.code}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground/50">
                        {userCount} {t("admDeptEmployeeUnit")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Sheet */}
      <Sheet open={isViewOpen} onOpenChange={setIsViewOpen}>
        <SheetContent className="sm:max-w-md bg-background border-border p-0 flex flex-col">
          <SheetTitle className="sr-only">
            {selectedDepartment?.name ?? t("navDepartments")}
          </SheetTitle>
          {selectedDepartment && (
            <>
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-muted-foreground/60" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedDepartment.name}
                    </p>
                    <p className="text-xs text-muted-foreground/50">
                      {selectedDepartment.users?.length || 0}{" "}
                      {t("admDeptEmployeeUnit")}
                    </p>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {selectedDepartment.users &&
                selectedDepartment.users.length > 0 ? (
                  <div className="py-2">
                    <p className="px-5 py-2 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                      {t("navEmployees")}
                    </p>
                    <div className="divide-y divide-border">
                      {selectedDepartment.users.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 px-5 py-2.5"
                        >
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {u.name}
                            </p>
                            {u.position && (
                              <p className="text-xs text-muted-foreground/50 truncate">
                                {u.position}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <Users className="w-6 h-6 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground/50">
                      {t("admDeptNoEmployeesShort")}
                    </p>
                  </div>
                )}
              </ScrollArea>

              <div className="border-t border-border p-4">
                <button
                  onClick={() => {
                    setIsViewOpen(false);
                    handleEditDepartment(selectedDepartment);
                  }}
                  className="w-full py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" /> {t("admDeptEditBtnFull")}
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">
              {t("admDeptEditBtnFull")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/60 text-xs">
              {t("admDeptEditDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t("admDeptNameLabel")}
            </Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((f) => ({ ...f, name: e.target.value }))
              }
              className="bg-muted border-border text-foreground focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t("admDeptCodeLabel")}
            </Label>
            <Input
              value={formData.code}
              onChange={(e) =>
                setFormData((f) => ({
                  ...f,
                  code: e.target.value.toUpperCase(),
                }))
              }
              placeholder={t("admDeptCodeExamplePlaceholder")}
              maxLength={12}
              className="bg-muted border-border text-foreground focus-visible:ring-ring uppercase"
            />
            <p className="text-muted-foreground/60 text-[11px]">
              {t("admDeptCodeHintEdit")}
            </p>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              className="border border-border text-foreground/80 hover:bg-muted"
            >
              {t("admDeptCancelBtn")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">
              {t("admDeptCreateDialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/60 text-xs">
              {t("admDeptCreateDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t("admDeptNameLabel")}
            </Label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDepartment();
              }}
              placeholder={t("admDeptNamePlaceholder")}
              autoFocus
              className="bg-muted border-border text-foreground focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t("admDeptCodeLabel")}
            </Label>
            <Input
              value={createCode}
              onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDepartment();
              }}
              placeholder={t("admDeptCodeExamplePlaceholder")}
              maxLength={12}
              className="bg-muted border-border text-foreground focus-visible:ring-ring uppercase"
            />
            <p className="text-muted-foreground/60 text-[11px]">
              {t("admDeptCodeHintCreate")}
            </p>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              className="border border-border text-foreground/80 hover:bg-muted"
            >
              {t("admDeptCancelBtn")}
            </Button>
            <Button
              onClick={handleCreateDepartment}
              disabled={isSaving || !createName.trim()}
            >
              {isSaving && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              {t("tailan_addEntry")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
