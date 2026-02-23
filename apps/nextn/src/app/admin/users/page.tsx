"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  Loader2,
  Users as UsersIcon,
  Shield,
  Building2,
  Briefcase,
  Search,
  Clock,
  Power,
  PowerOff,
  Trash2,
  Lock,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DEPARTMENTS } from "@/lib/constants";
import Link from "next/link";

interface UserData {
  id: string;
  userId?: string;
  email?: string;
  name: string;
  position?: string;
  department?: string;
  isAdmin: boolean;
  isActive?: boolean;
  allowedTools?: string[];
  lastLoginAt?: string;
  createdAt: string;
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
];

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, departmentFilter]);

  const loadUsers = async () => {
    try {
      const data = await usersApi.getAll();
      setUsers((data || []).filter((u: UserData) => !u.isAdmin));
    } catch (error) {
      console.error("Error loading users:", error);
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

  const filterUsers = () => {
    let filtered = [...users];

    if (departmentFilter !== "all") {
      filtered = filtered.filter((u) => u.department === departmentFilter);
    }

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
    } catch (error) {
      console.error("Error toggling user status:", error);
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
      toast({
        title: "Амжилттай",
        description: "Хэрэглэгч устгагдлаа.",
      });
      setDeleteUser(null);
      loadUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Алдаа",
        description: "Хэрэглэгч устгахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400">Ачаалж байна...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />

        {/* Floating particles */}
        {PARTICLE_POSITIONS.map((pos, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-500/30 rounded-full"
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            animate={{ y: [0, -20, 0], opacity: [0.3, 0.7, 0.3] }}
            transition={{
              duration: 3 + (i % 4),
              repeat: Infinity,
              delay: (i % 8) * 0.3,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Link href="/admin">
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-slate-800/50"
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
          className="flex items-center justify-between flex-wrap gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30">
              <UsersIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Хэрэглэгчид</h1>
              <p className="text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Бүх бүртгэлтэй хэрэглэгчдийн удирдлага
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-slate-700/50 text-slate-300 border-0 text-lg px-4 py-2">
              {filteredUsers.length} / {users.length}
            </Badge>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Нэр, албан тушаалаар хайх..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <Select
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
                >
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="Хэлтсээр шүүх" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem
                      value="all"
                      className="text-white hover:bg-slate-700"
                    >
                      Бүх хэлтэс
                    </SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem
                        key={dept}
                        value={dept}
                        className="text-white hover:bg-slate-700"
                      >
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white">
                Хэрэглэгчдийн жагсаалт
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700/50 hover:bg-slate-700/20">
                      <TableHead className="text-slate-400">Төлөв</TableHead>
                      <TableHead className="text-slate-400">ID</TableHead>
                      <TableHead className="text-slate-400">Нэр</TableHead>
                      <TableHead className="text-slate-400">Хэлтэс</TableHead>
                      <TableHead className="text-slate-400">
                        Албан тушаал
                      </TableHead>
                      <TableHead className="text-slate-400">
                        Сүүлд нэвтэрсэн
                      </TableHead>
                      <TableHead className="text-slate-400 text-right">
                        Үйлдэл
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-12 text-slate-400"
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
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-slate-700/50 hover:bg-slate-700/20"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={userData.isActive !== false}
                                onCheckedChange={() =>
                                  handleToggleUserStatus(
                                    userData.id,
                                    userData.isActive !== false,
                                  )
                                }
                              />
                              {userData.isActive !== false ? (
                                <Power className="w-4 h-4 text-green-500" />
                              ) : (
                                <PowerOff className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-700/50 px-2 py-1 rounded text-blue-400">
                              {userData.userId || "-"}
                            </code>
                          </TableCell>
                          <TableCell className="font-medium text-white">
                            <div className="flex items-center gap-2">
                              {userData.isAdmin && (
                                <Shield className="w-4 h-4 text-blue-500" />
                              )}
                              {userData.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {userData.department ? (
                              <div className="flex items-center gap-2 text-slate-300">
                                <Building2 className="w-4 h-4 text-slate-500" />
                                <span className="text-sm">
                                  {userData.department}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {userData.position ? (
                              <div className="flex items-center gap-2 text-slate-300">
                                <Briefcase className="w-4 h-4 text-slate-500" />
                                <span className="text-sm">
                                  {userData.position}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {userData.lastLoginAt ? (
                              <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <Clock className="w-4 h-4" />
                                {new Date(userData.lastLoginAt).toLocaleString(
                                  "mn-MN",
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-sm">
                                Хэзээ ч үгүй
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => setDeleteUser(userData)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Хэрэглэгч устгах
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Та "{deleteUser?.name}" хэрэглэгчийг устгахдаа итгэлтэй байна уу?
              Энэ үйлдлийг буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
              Болих
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-500 text-white hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
