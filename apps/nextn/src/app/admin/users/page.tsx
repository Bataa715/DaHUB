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
import { Loader2, Check, X, Pencil, RefreshCw } from "lucide-react";
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
import { isRegularAppUser } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserData {
  id: string;
  userId?: string;
  name: string;
  position?: string;
  department?: string;
  departmentId?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

// Нууц үгийн шаардлага — backend-тэй ижил (8+ тэмдэгт, том/жижиг үсэг, тоо, тусгай тэмдэгт)
function checkPasswordRules(pw: string) {
  return {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    special: /[@$!%*?&#^()\-_=+[\]{}|;:',.<>/~`]/.test(pw),
  };
}
function isPasswordValid(pw: string) {
  const r = checkPasswordRules(pw);
  return r.length && r.lower && r.upper && r.digit && r.special;
}
// Шаардлага хангасан санамсаргүй нууц үг үүсгэх
function generatePassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "@$!%*?&#";
  const all = lower + upper + digits + special;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pw = pick(lower) + pick(upper) + pick(digits) + pick(special);
  for (let i = 0; i < 8; i++) pw += pick(all);
  // Тэмдэгтүүдийг холих
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export default function UsersPage() {
  const { t } = useLanguage();
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
      const data = await usersApi.getAll({ excludeAdmins: true });
      setUsers((data || []).filter((u: UserData) => isRegularAppUser(u)));
    } catch {
      toast({
        title: t("error"),
        description: t("admUsersLoadError"),
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
    if (!user?.isSuperAdmin) return;
    const current = departments.find((d) => d.name === userData.department);
    setSelectedDeptId(current?.id ?? "");
    setChangingDeptUserId(userData.id);
  };

  const handleSaveDept = async (userId: string) => {
    if (!user?.isSuperAdmin || !selectedDeptId) return;
    setIsSavingDept(true);
    try {
      await usersApi.update(userId, { departmentId: selectedDeptId });
      toast({ title: t("success"), description: t("admUsersDeptChangedDesc") });
      setChangingDeptUserId(null);
      loadUsers();
    } catch {
      toast({
        title: t("error"),
        description: t("admUsersDeptChangeError"),
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
      toast({ title: t("success"), description: t("admUsersDeletedDesc") });
      setDeleteUser(null);
      loadUsers();
    } catch {
      toast({
        title: t("error"),
        description: t("admUsersDeleteError"),
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
        title: t("success"),
        description: t("admUsersIdChangedDesc"),
      });
      setChangingUserIdId(null);
      loadUsers();
    } catch (error) {
      let message = t("admUsersIdChangeError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingUserId(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !isPasswordValid(newPassword)) return;
    setIsResetting(true);
    try {
      await usersApi.resetPassword(resetPasswordUser.id, newPassword);
      toast({
        title: t("admUsersPasswordResetTitle"),
        description: `${resetPasswordUser.name} ${t("admUsersPasswordResetDescSuffix")}`,
      });
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (error) {
      let message = t("admUsersPasswordResetError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
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
        title={t("admLayoutNavUsers")}
        rightContent={
          <span className="text-muted-foreground/60 text-xs">
            {users.length} {t("admUsersCountUnit")}
          </span>
        }
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {users.length === 0 ? (
          <p className="text-muted-foreground/40 text-sm text-center py-20">
            {t("admUsersEmptyList")}
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
                        aria-label={t("admUsersSaveIdAria")}
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
                        aria-label={t("admDeptCancelBtn")}
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

                {/* Department — зөвхөн SuperAdmin засна */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50 w-12 shrink-0">
                    {t("regFlowLabelDept")}
                  </span>
                  {user?.isSuperAdmin &&
                  changingDeptUserId === userData.id ? (
                    <div className="flex items-center gap-1">
                      <Select
                        value={selectedDeptId}
                        onValueChange={setSelectedDeptId}
                      >
                        <SelectTrigger className="h-7 bg-muted border-border text-foreground text-xs">
                          <SelectValue placeholder={t("admUsersSelectPlaceholder")} />
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
                        aria-label={t("admUsersSaveDeptAria")}
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
                        aria-label={t("admDeptCancelBtn")}
                        className="p-1 text-muted-foreground/60 hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : user?.isSuperAdmin ? (
                    <button
                      className="flex items-center gap-1.5 group text-left"
                      onClick={() => handleChangeDept(userData)}
                    >
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        {userData.department || "—"}
                      </span>
                      <Pencil className="w-2.5 h-2.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {userData.department || "—"}
                    </span>
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
                      {t("admUsersPasswordBtn")}
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteUser(userData)}
                    className="flex-1 text-xs text-muted-foreground/60 hover:text-red-400 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    {t("tailan_deleteAction")}
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
            <DialogTitle>{t("admUsersResetPwDialogTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              <span className="text-foreground font-medium">
                {resetPasswordUser?.name}
              </span>{" "}
              ({resetPasswordUser?.userId})
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-muted-foreground text-xs mb-1.5 block">
              {t("admUsersNewPasswordLabel")}
            </Label>
            <div className="relative">
              <Input
                type="text"
                placeholder={t("admUsersPasswordPlaceholderHint")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50 pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setNewPassword(generatePassword())}
                title={t("admUsersGenPasswordTooltip")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {newPassword.length > 0 &&
              (() => {
                const r = checkPasswordRules(newPassword);
                const items: { ok: boolean; label: string }[] = [
                  { ok: r.length, label: t("admUsersRuleLength") },
                  { ok: r.upper, label: t("admUsersRuleUpper") },
                  { ok: r.lower, label: t("admUsersRuleLower") },
                  { ok: r.digit, label: t("admUsersRuleDigit") },
                  { ok: r.special, label: t("admUsersRuleSpecial") },
                ];
                return (
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    {items.map((it) => (
                      <li
                        key={it.label}
                        className={`flex items-center gap-1.5 text-[11px] font-medium ${
                          it.ok
                            ? "text-emerald-500"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {it.ok ? (
                          <Check className="w-3 h-3 shrink-0" />
                        ) : (
                          <X className="w-3 h-3 shrink-0" />
                        )}
                        {it.label}
                      </li>
                    ))}
                  </ul>
                );
              })()}
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
              {t("cancel")}
            </button>
            <button
              onClick={handleResetPassword}
              disabled={isResetting || !isPasswordValid(newPassword)}
              className="flex-1 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:bg-secondary disabled:text-muted-foreground/60 text-black rounded-xl flex items-center justify-center gap-2"
            >
              {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("admUsersResetBtn")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent className="bg-background border-border text-foreground max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admUsersDeleteDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              "{deleteUser?.name}" {t("admUsersDeleteConfirmSuffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-foreground/80 hover:bg-muted">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-foreground border-0"
            >
              {isDeleting && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              {t("tailan_deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
