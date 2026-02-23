"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Shield,
  ShieldCheck,
  Star,
  StarOff,
  UserPlus,
  Trash2,
  Search,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";

interface AdminUser {
  id: string;
  name: string;
  userId: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  department?: string;
  createdAt?: string;
}

interface AllUser {
  id: string;
  name: string;
  userId: string;
  email: string;
  isAdmin: boolean;
  department?: string;
}

export default function AdminsPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user as any)?.isSuperAdmin;

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add admin sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"normal" | "super">(
    "normal",
  );
  const [addLoading, setAddLoading] = useState(false);

  // Remove confirm state
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await usersApi.getAdmins();
      setAdmins(data);
    } catch {
      setError("Админуудыг ачааллахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      const data = await usersApi.getAll();
      setAllUsers(data.filter((u: AllUser) => !u.isAdmin));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchAllUsers();
  }, [fetchAdmins, fetchAllUsers]);

  const handleToggleSuperAdmin = async (admin: AdminUser) => {
    if (!isSuperAdmin) return;
    if (admin.id === user?.id) return;
    try {
      await usersApi.setAdminRole(admin.id, true, !admin.isSuperAdmin);
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === admin.id ? { ...a, isSuperAdmin: !admin.isSuperAdmin } : a,
        ),
      );
    } catch {
      setError("Эрх шинэчлэхэд алдаа гарлаа.");
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeTarget || !isSuperAdmin) return;
    setRemoveLoading(true);
    try {
      await usersApi.setAdminRole(removeTarget.id, false, false);
      setAdmins((prev) => prev.filter((a) => a.id !== removeTarget.id));
      setAllUsers((prev) => [...prev, { ...removeTarget, isAdmin: false }]);
      setRemoveTarget(null);
    } catch {
      setError("Админ устгахад алдаа гарлаа.");
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedUserId || !isSuperAdmin) return;
    setAddLoading(true);
    try {
      await usersApi.setAdminRole(
        selectedUserId,
        true,
        selectedRole === "super",
      );
      await fetchAdmins();
      setAllUsers((prev) => prev.filter((u) => u.id !== selectedUserId));
      setShowAddSheet(false);
      setSelectedUserId("");
      setAddSearch("");
      setSelectedRole("normal");
    } catch {
      setError("Админ нэмэхэд алдаа гарлаа.");
    } finally {
      setAddLoading(false);
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      (u.name ?? "").toLowerCase().includes(addSearch.toLowerCase()) ||
      (u.userId ?? "").toLowerCase().includes(addSearch.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(addSearch.toLowerCase()),
  );

  const superAdminCount = admins.filter((a) => a.isSuperAdmin).length;
  const normalAdminCount = admins.filter((a) => !a.isSuperAdmin).length;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-amber-400" />
            Админ удирдлага
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Системийн администраторуудыг удирдах
          </p>
        </div>
        {isSuperAdmin && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Админ нэмэх
          </motion.button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Нийт админ",
            value: admins.length,
            icon: Shield,
            color: "text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
          },
          {
            label: "Супер админ",
            value: superAdminCount,
            icon: Crown,
            color: "text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
          },
          {
            label: "Энгийн админ",
            value: normalAdminCount,
            icon: ShieldCheck,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-5 flex items-center gap-4 ${stat.bg}`}
          >
            <stat.icon className={`w-8 h-8 ${stat.color}`} />
            <div>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Admin List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {admins.map((admin, i) => {
              const isSelf = admin.id === user?.id;
              return (
                <motion.div
                  key={admin.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${admin.isSuperAdmin ? "bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/40" : "bg-blue-500/20 text-blue-400"}`}
                  >
                    {(admin.name ?? admin.userId ?? "?")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">
                        {admin.name || admin.userId}
                      </span>
                      {admin.isSuperAdmin && (
                        <span className="flex items-center gap-1 bg-amber-500/15 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
                          <Crown className="w-3 h-3" />
                          Супер админ
                        </span>
                      )}
                      {!admin.isSuperAdmin && (
                        <span className="flex items-center gap-1 bg-blue-500/15 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">
                          <Shield className="w-3 h-3" />
                          Энгийн админ
                        </span>
                      )}
                      {isSelf && (
                        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
                          Та
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm truncate">
                      {admin.userId} {admin.email ? `· ${admin.email}` : ""}
                    </p>
                  </div>

                  {/* Actions — only super admin can act, and cannot act on self */}
                  {isSuperAdmin && !isSelf && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleToggleSuperAdmin(admin)}
                        title={
                          admin.isSuperAdmin
                            ? "Супер эрх хасах"
                            : "Супер эрх олгох"
                        }
                        className={`p-2 rounded-lg transition-colors ${admin.isSuperAdmin ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"}`}
                      >
                        {admin.isSuperAdmin ? (
                          <StarOff className="w-4 h-4" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setRemoveTarget(admin)}
                        title="Админ эрх хасах"
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {admins.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Одоогоор админ байхгүй байна</p>
            </div>
          )}
        </div>
      )}

      {/* Add Admin Sheet */}
      <AnimatePresence>
        {showAddSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddSheet(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                  Шинэ админ нэмэх
                </h2>
                <button
                  onClick={() => setShowAddSheet(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {/* Role selector */}
                <div className="mb-5">
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Эрхийн төрөл
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["normal", "super"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
                          selectedRole === role
                            ? role === "super"
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                              : "bg-blue-500/20 border-blue-500/50 text-blue-400"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {role === "super" ? (
                          <Crown className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                        {role === "super" ? "Супер админ" : "Энгийн админ"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* User search */}
                <div className="mb-5">
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Хэрэглэгч сонгох
                  </label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="Хайх..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">
                        Хэрэглэгч олдсонгүй
                      </p>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUserId(u.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                            selectedUserId === u.id
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(u.name ?? u.userId ?? "?")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {u.name || u.userId}
                            </div>
                            <div className="text-xs opacity-60 truncate">
                              {u.email}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-800">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddAdmin}
                  disabled={!selectedUserId || addLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {addLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Нэмэх
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Remove Confirm Dialog */}
      <AnimatePresence>
        {removeTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRemoveTarget(null)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">
                      Админ эрх хасах
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Энэ үйлдлийг буцаах боломжтой
                    </p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-6">
                  <span className="text-white font-medium">
                    {removeTarget.name || removeTarget.userId}
                  </span>{" "}
                  хэрэглэгчийн админ эрхийг хасах уу?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRemoveTarget(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Цуцлах
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleRemoveAdmin}
                    disabled={removeLoading}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {removeLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Хасах
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
