"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, departmentsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Switch } from "@/components/ui/switch";
import { DEPARTMENTS } from "@/lib/constants";
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
  allowedTools?: string[];
  lastLoginAt?: string;
  createdAt: string;
}

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

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
  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, departmentFilter]);

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
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await departmentsApi.getAll();
      setDepartments(
        (data || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })),
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

  const filterUsers = () => {
    let filtered = [...users];
    if (departmentFilter !== "all")
      filtered = filtered.filter((u) => u.department === departmentFilter);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          (u.department && u.department.toLowerCase().includes(query)) ||
          (u.position && u.position.toLowerCase().includes(query)),
      );
    }
    setFilteredUsers(filtered);
  };

  const handleToggleUserStatus = async (
    userId: string,
    currentStatus: boolean,
  ) => {
    try {
      await usersApi.updateStatus(userId, !currentStatus);
      toast({
        title: "Амжилттай",
        description: `Хэрэглэгчийн эрх ${!currentStatus ? "идэвхжүүллээ" : "хааглаа"}.`,
      });
      loadUsers();
    } catch {
      toast({
        title: "Алдаа",
        description: "Хэрэглэгчийн эрхийг өөрчлөхөд алдаа гарлаа.",
        variant: "destructive",
      });
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground/60">Хандах эрхгүй</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title="Хэрэглэгчид"
        rightContent={
          <span className="text-muted-foreground/60 text-xs">
            {filteredUsers.length} / {users.length}
          </span>
        }
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Нэр, хэлтэс, тушаалаар хайх..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-48 bg-background border-border text-foreground placeholder:text-muted-foreground/50 rounded-xl"
          />
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-48 bg-background border-border text-foreground/80 rounded-xl">
              <SelectValue placeholder="Хэлтэс" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border">
              <SelectItem
                value="all"
                className="text-foreground/80 focus:bg-muted"
              >
                Бүх хэлтэс
              </SelectItem>
              {DEPARTMENTS.map((dept) => (
                <SelectItem
                  key={dept}
                  value={dept}
                  className="text-foreground/80 focus:bg-muted"
                >
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground/60 text-xs font-medium">
                  Төлөв
                </TableHead>
                <TableHead className="text-muted-foreground/60 text-xs font-medium">
                  ID
                </TableHead>
                <TableHead className="text-muted-foreground/60 text-xs font-medium">
                  Нэр
                </TableHead>
                <TableHead className="text-muted-foreground/60 text-xs font-medium">
                  Хэлтэс
                </TableHead>
                <TableHead className="text-muted-foreground/60 text-xs font-medium">
                  Албан тушаал
                </TableHead>
                <TableHead className="text-muted-foreground/60 text-xs font-medium">
                  Сүүлд нэвтэрсэн
                </TableHead>
                <TableHead className="text-muted-foreground/60 text-xs font-medium text-right">
                  Үйлдэл
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground/40"
                  >
                    {searchQuery || departmentFilter !== "all"
                      ? "Хайлтын үр дүн олдсонгүй"
                      : "Хэрэглэгч олдсонгүй"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((userData, index) => (
                  <motion.tr
                    key={userData.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-border hover:bg-background/60 transition-colors"
                  >
                    <TableCell>
                      <Switch
                        checked={userData.isActive !== false}
                        onCheckedChange={() =>
                          handleToggleUserStatus(
                            userData.id,
                            userData.isActive !== false,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {changingUserIdId === userData.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editUserId}
                            onChange={(e) => setEditUserId(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleChangeUserId();
                              if (e.key === "Escape") setChangingUserIdId(null);
                            }}
                            className="h-7 w-32 bg-muted border-border text-foreground text-xs font-mono"
                            autoFocus
                          />
                          <button
                            disabled={isSavingUserId || !editUserId.trim()}
                            onClick={handleChangeUserId}
                            className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
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
                          <Pencil className="w-2.5 h-2.5 text-muted-foreground/30 group-hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {userData.name}
                    </TableCell>
                    <TableCell>
                      {changingDeptUserId === userData.id ? (
                        <div className="flex items-center gap-1">
                          <Select
                            value={selectedDeptId}
                            onValueChange={setSelectedDeptId}
                          >
                            <SelectTrigger className="h-7 w-44 bg-muted border-border text-foreground text-xs">
                              <SelectValue placeholder="Хэлтэс сонгох" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border">
                              {departments.map((dept) => (
                                <SelectItem
                                  key={dept.id}
                                  value={dept.id}
                                  className="text-foreground/80 focus:bg-muted text-xs"
                                >
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            disabled={isSavingDept || !selectedDeptId}
                            onClick={() => handleSaveDept(userData.id)}
                            className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
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
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            {userData.department ?? (
                              <span className="text-muted-foreground/40">
                                —
                              </span>
                            )}
                          </span>
                          <Pencil className="w-2.5 h-2.5 text-muted-foreground/30 group-hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {userData.position || (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground/60">
                      {userData.lastLoginAt ? (
                        new Date(userData.lastLoginAt).toLocaleString("mn-MN", {
                          timeZone: "Asia/Ulaanbaatar",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      ) : (
                        <span className="text-muted-foreground/40">
                          Хэзээ ч үгүй
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user?.isSuperAdmin && (
                          <button
                            onClick={() => {
                              setResetPasswordUser(userData);
                              setNewPassword("");
                            }}
                            className="text-xs text-muted-foreground/60 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
                          >
                            Нууц үг
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteUser(userData)}
                          className="text-xs text-muted-foreground/60 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          Устгах
                        </button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
            <DialogTitle className="text-foreground">
              Нууц үг сэргээх
            </DialogTitle>
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
              className="flex-1 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-colors"
            >
              Болих
            </button>
            <button
              onClick={handleResetPassword}
              disabled={isResetting || newPassword.length < 6}
              className="flex-1 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:bg-secondary disabled:text-muted-foreground/60 text-black rounded-xl transition-colors flex items-center justify-center gap-2"
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
            <AlertDialogTitle className="text-foreground">
              Хэрэглэгч устгах
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              "{deleteUser?.name}" хэрэглэгчийг устгахдаа итгэлтэй байна уу?
              Буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-foreground/80 hover:bg-muted hover:text-foreground">
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
