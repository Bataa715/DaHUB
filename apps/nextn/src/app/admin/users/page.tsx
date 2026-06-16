"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, departmentsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Check, X, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import axios from "axios";

interface UserData {
  id: string;
  userId?: string;
  name: string;
  position?: string;
  department?: string;
  departmentId?: string;
  isAdmin: boolean;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);
  const [changingDeptUserId, setChangingDeptUserId] = useState<string | null>(
    null,
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [isSavingDept, setIsSavingDept] = useState(false);

  const [changingUserIdId, setChangingUserIdId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState("");
  const [isSavingUserId, setIsSavingUserId] = useState(false);

  const [resetPasswordUser, setResetPasswordUser] = useState<UserData | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await usersApi.getAll();
      setUsers((data || []).filter((u: UserData) => !u.isAdmin));
    } catch {
      toast({
        title: "Алдаа",
        description: "Хэрэглэгчдийг ачааллахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await departmentsApi.getAll();
      setDepartments(
        (data || []).map((d: { id: string; name: string }) => ({
          id: d.id,
          name: d.name,
        })),
      );
    } catch {}
  };

  const handleChangeDept = (userData: UserData) => {
    const current = departments.find((d) => d.name === userData.department);
    setSelectedDeptId(current?.id ?? "");
    setChangingDeptUserId(userData.id);
  };

  const handleSaveDept = async (userId: string) => {
    if (!selectedDeptId) return;
    setIsSavingDept(true);
    try {
      await usersApi.update(userId, { departmentId: selectedDeptId });
      toast({ title: "Амжилттай", description: "Хэлтэс өөрчлөгдлөө." });
      setChangingDeptUserId(null);
      loadUsers();
    } catch {
      toast({
        title: "Алдаа",
        description: "Хэлтэс өөрчлөхөд алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setIsDeleting(true);
    try {
      await usersApi.delete(deleteUser.id);
      toast({ title: "Амжилттай", description: "Хэрэглэгч устгагдлаа." });
      setDeleteUser(null);
      loadUsers();
    } catch {
      toast({
        title: "Алдаа",
        description: "Хэрэглэгч устгахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeUserId = async () => {
    if (!editUserId.trim() || !changingUserIdId) return;
    setIsSavingUserId(true);
    try {
      await usersApi.update(changingUserIdId, { userId: editUserId.trim() });
      toast({
        title: "Амжилттай",
        description: "Хэрэглэгчийн ID өөрчлөгдлөө.",
      });
      setChangingUserIdId(null);
      loadUsers();
    } catch (error) {
      let message = "ID өөрчлөхд алдаа гарлаа.";
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({ title: "Алдаа", description: message, variant: "destructive" });
    } finally {
      setIsSavingUserId(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword || newPassword.length < 6) return;
    setIsResetting(true);
    try {
      await usersApi.resetPassword(resetPasswordUser.id, newPassword);
      toast({
        title: "Нууц үг сэргээлээ",
        description: `${resetPasswordUser.name} — шинэ нууц үг тохируулагдлаа.`,
      });
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (error) {
      let message = "Нууц үг сэргээхэд алдаа гарлаа.";
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({ title: "Алдаа", description: message, variant: "destructive" });
    } finally {
      setIsResetting(false);
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
        title="Хэрэглэгчид"
        rightContent={
          <span className="text-muted-foreground/60 text-xs">
            {users.length} хэрэглэгч
          </span>
        }
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {users.length === 0 ? (
          <p className="text-muted-foreground/40 text-sm text-center py-20">
            Хэрэглэгч олдсонгүй
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {users.map((userData) => (
              <div
                key={userData.id}
                className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-2"
              >
                {/* Name + initials */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                    {userData.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {userData.name}
                    </p>
                    <p className="text-xs text-muted-foreground/60 truncate">
                      {userData.position || "—"}
                    </p>
                  </div>
                </div>

                {/* ID */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50 w-12 shrink-0">
                    ID
                  </span>
                  {changingUserIdId === userData.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editUserId}
                        onChange={(e) => setEditUserId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleChangeUserId();
                          if (e.key === "Escape") setChangingUserIdId(null);
                        }}
                        className="h-7 bg-muted border-border text-foreground text-xs font-mono"
                        autoFocus
                      />
                      <button
                        disabled={isSavingUserId || !editUserId.trim()}
                        onClick={handleChangeUserId}
                        className="p-1 text-emerald-400 disabled:opacity-40"
                      >
                        {isSavingUserId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => setChangingUserIdId(null)}
                        className="p-1 text-muted-foreground/60 hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1.5 group"
                      onClick={() => {
                        setEditUserId(userData.userId ?? "");
                        setChangingUserIdId(userData.id);
                      }}
                    >
                      <code className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                        {userData.userId || "—"}
                      </code>
                      <Pencil className="w-2.5 h-2.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  )}
                </div>

                {/* Department */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50 w-12 shrink-0">
                    Хэлтэс
                  </span>
                  {changingDeptUserId === userData.id ? (
                    <div className="flex items-center gap-1">
                      <Select
                        value={selectedDeptId}
                        onValueChange={setSelectedDeptId}
                      >
                        <SelectTrigger className="h-7 bg-muted border-border text-foreground text-xs">
                          <SelectValue placeholder="Сонгох" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          {departments.map((dept) => (
                            <SelectItem
                              key={dept.id}
                              value={dept.id}
                              className="text-foreground/80 text-xs"
                            >
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        disabled={isSavingDept || !selectedDeptId}
                        onClick={() => handleSaveDept(userData.id)}
                        className="p-1 text-emerald-400 disabled:opacity-40"
                      >
                        {isSavingDept ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => setChangingDeptUserId(null)}
                        className="p-1 text-muted-foreground/60 hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1.5 group text-left"
                      onClick={() => handleChangeDept(userData)}
                    >
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        {userData.department || "—"}
                      </span>
                      <Pencil className="w-2.5 h-2.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 pt-1 border-t border-border">
                  {user?.isAdmin && (
                    <button
                      onClick={() => {
                        setResetPasswordUser(userData);
                        setNewPassword("");
                      }}
                      className="flex-1 text-xs text-muted-foreground/60 hover:text-amber-400 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      Нууц үг
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteUser(userData)}
                    className="flex-1 text-xs text-muted-foreground/60 hover:text-red-400 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Устгах
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Password Dialog */}
      <Dialog
        open={!!resetPasswordUser}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordUser(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle>Нууц үг сэргээх</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              <span className="text-foreground font-medium">
                {resetPasswordUser?.name}
              </span>{" "}
              ({resetPasswordUser?.userId})
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-muted-foreground text-xs mb-1.5 block">
              Шинэ нууц үг
            </Label>
            <Input
              type="text"
              placeholder="Хамгийн багадаа 6 тэмдэгт"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50"
              autoComplete="off"
            />
            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-red-400 text-xs mt-1">
                Хамгийн багадаа 6 тэмдэгт байх ёстой
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setResetPasswordUser(null);
                setNewPassword("");
              }}
              disabled={isResetting}
              className="flex-1 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors"
            >
              Болих
            </button>
            <button
              onClick={handleResetPassword}
              disabled={isResetting || newPassword.length < 6}
              className="flex-1 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:bg-secondary disabled:text-muted-foreground/60 text-black rounded-xl flex items-center justify-center gap-2"
            >
              {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Сэргээх
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent className="bg-background border-border text-foreground max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Хэрэглэгч устгах</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              "{deleteUser?.name}" хэрэглэгчийг устгахдаа итгэлтэй байна уу?
              Буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-foreground/80 hover:bg-muted">
              Болих
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-foreground border-0"
            >
              {isDeleting && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
