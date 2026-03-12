"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Shield,
  ShieldCheck,
  UserPlus,
  Trash2,
  Search,
  X,
  AlertTriangle,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";

const ALL_TOOLS = [
  { id: "todo", name: "Todo" },
  { id: "chess", name: "Оюуны спорт" },
  { id: "sanamsargui-tuuwer", name: "Санамсаргүй түүвэр" },
  { id: "pivot", name: "Pivot" },
  { id: "db_access_requester", name: "Эрх хүсэгч" },
  { id: "db_access_granter", name: "Эрх олгогч" },
  { id: "tailan", name: "Улирлын тайлан (ажилтан)" },
  { id: "tailan_dept_head", name: "Улирлын тайлан (ахлагч)" },
  { id: "english", name: "Англи үгс" },
];

interface AdminUser {
  id: string;
  name: string;
  userId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  grantableTools: string[];
  department?: string;
  createdAt?: string;
}

interface AllUser {
  id: string;
  name: string;
  userId: string;
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

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"sub" | "super">("sub");
  const [grantableTools, setGrantableTools] = useState<string[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editTools, setEditTools] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await usersApi.getAdmins();
      setAdmins(
        data.map((a: any) => ({
          ...a,
          grantableTools: a.grantableTools ?? [],
        })),
      );
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
    } catch {}
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchAllUsers();
  }, [fetchAdmins, fetchAllUsers]);

  const toggleTool = (
    tools: string[],
    setTools: (v: string[]) => void,
    id: string,
  ) => {
    setTools(
      tools.includes(id) ? tools.filter((t) => t !== id) : [...tools, id],
    );
  };

  const handleToggleSuperAdmin = async (admin: AdminUser) => {
    if (!isSuperAdmin || admin.id === user?.id) return;
    try {
      await usersApi.setAdminRole(
        admin.id,
        true,
        !admin.isSuperAdmin,
        admin.grantableTools,
      );
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
      await usersApi.setAdminRole(removeTarget.id, false, false, []);
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
        selectedRole === "sub" ? grantableTools : [],
      );
      await fetchAdmins();
      setAllUsers((prev) => prev.filter((u) => u.id !== selectedUserId));
      setShowAddSheet(false);
      setSelectedUserId("");
      setAddSearch("");
      setSelectedRole("sub");
      setGrantableTools([]);
    } catch {
      setError("Админ нэмэхэд алдаа гарлаа.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditTools = async () => {
    if (!editTarget || !isSuperAdmin) return;
    setEditLoading(true);
    try {
      await usersApi.setAdminRole(
        editTarget.id,
        true,
        editTarget.isSuperAdmin,
        editTools,
      );
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === editTarget.id ? { ...a, grantableTools: editTools } : a,
        ),
      );
      setEditTarget(null);
    } catch {
      setError("Хэрэгслүүд шинэчлэхэд алдаа гарлаа.");
    } finally {
      setEditLoading(false);
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      (u.name ?? "").toLowerCase().includes(addSearch.toLowerCase()) ||
      (u.userId ?? "").toLowerCase().includes(addSearch.toLowerCase()),
  );

  const superAdminCount = admins.filter((a) => a.isSuperAdmin).length;
  const subAdminCount = admins.filter((a) => !a.isSuperAdmin).length;

  const ToolCheckList = ({
    tools,
    setTools,
  }: {
    tools: string[];
    setTools: (v: string[]) => void;
  }) => (
    <div className="space-y-2 rounded-xl bg-slate-800/50 p-3 border border-slate-700 max-h-52 overflow-y-auto">
      {ALL_TOOLS.map((tool) => {
        const checked = tools.includes(tool.id);
        return (
          <label
            key={tool.id}
            onClick={() => toggleTool(tools, setTools, tool.id)}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                checked
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-slate-600 group-hover:border-emerald-500/50"
              }`}
            >
              {checked && (
                <svg
                  className="w-2.5 h-2.5 text-white"
                  fill="none"
                  viewBox="0 0 12 12"
                >
                  <path
                    d="M1 7l3.5 3.5L11 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span
              className={`text-sm select-none transition-colors ${checked ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}
            >
              {tool.name}
            </span>
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6">
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
            label: "Саб админ",
            value: subAdminCount,
            icon: Wrench,
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Admin list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {admins.map((admin, i) => {
              const isSelf = admin.id === user?.id;
              const isExpanded = expandedAdmin === admin.id;
              const toolNames = (admin.grantableTools ?? []).map(
                (tid) => ALL_TOOLS.find((t) => t.id === tid)?.name ?? tid,
              );

              return (
                <motion.div
                  key={admin.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
                >
                  <div className="p-4 flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        admin.isSuperAdmin
                          ? "bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {(admin.name ?? admin.userId ?? "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">
                          {admin.name || admin.userId}
                        </span>
                        {admin.isSuperAdmin ? (
                          <span className="flex items-center gap-1 bg-amber-500/15 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
                            <Crown className="w-3 h-3" /> Супер админ
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/30">
                            <Wrench className="w-3 h-3" /> Саб админ
                          </span>
                        )}
                        {isSelf && (
                          <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
                            Та
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm truncate">
                        {admin.userId}
                      </p>
                      {!admin.isSuperAdmin && (
                        <button
                          onClick={() =>
                            setExpandedAdmin(isExpanded ? null : admin.id)
                          }
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-0.5 transition-colors"
                        >
                          <Wrench className="w-3 h-3" />
                          {toolNames.length > 0
                            ? `${toolNames.length} хэрэгсэл олгох эрхтэй`
                            : "Хэрэгсэл тохируулаагүй"}
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                    {isSuperAdmin && !isSelf && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!admin.isSuperAdmin && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              setEditTarget(admin);
                              setEditTools(admin.grantableTools ?? []);
                            }}
                            title="Хэрэгсэл эрх тохируулах"
                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <Wrench className="w-4 h-4" />
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleSuperAdmin(admin)}
                          title={
                            admin.isSuperAdmin ? "Саб болгох" : "Супер болгох"
                          }
                          className={`p-2 rounded-lg transition-colors ${admin.isSuperAdmin ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"}`}
                        >
                          <Crown className="w-4 h-4" />
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
                  </div>
                  <AnimatePresence>
                    {isExpanded && !admin.isSuperAdmin && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-800 px-4 pb-3 overflow-hidden"
                      >
                        {toolNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-3">
                            {toolNames.map((name) => (
                              <span
                                key={name}
                                className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-600 text-xs pt-3">
                            Ямар ч хэрэгсэл тохируулаагүй байна.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {admins.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Одоогоор админ бүртгэгдээгүй байна</p>
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-400" />
                    Шинэ админ нэмэх
                  </h2>
                  <button
                    onClick={() => setShowAddSheet(false)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder="Хэрэглэгч хайх..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto mb-5 rounded-xl border border-slate-800">
                  {filteredUsers.length === 0 ? (
                    <p className="text-slate-500 text-sm p-4 text-center">
                      Хэрэглэгч олдсонгүй
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          selectedUserId === u.id
                            ? "bg-amber-500/15 text-white"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium">
                          {(u.name || u.userId || "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {u.name || u.userId}
                          </div>
                          <div className="text-xs text-slate-500">
                            {u.userId}
                          </div>
                        </div>
                        {selectedUserId === u.id && (
                          <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>

                <div className="mb-5">
                  <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">
                    Роль
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["sub", "super"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          selectedRole === role
                            ? role === "super"
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                              : "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                            : "border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {role === "super" ? (
                          <Crown className="w-4 h-4" />
                        ) : (
                          <Wrench className="w-4 h-4" />
                        )}
                        {role === "super" ? "Супер админ" : "Саб админ"}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedRole === "sub" && (
                  <div className="mb-6">
                    <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">
                      Олгох эрхийн хэрэгслүүд
                    </p>
                    <ToolCheckList
                      tools={grantableTools}
                      setTools={setGrantableTools}
                    />
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddAdmin}
                  disabled={!selectedUserId || addLoading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-semibold py-3 rounded-xl transition-colors"
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

      {/* Edit Tools Sheet */}
      <AnimatePresence>
        {editTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditTarget(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-emerald-400" />
                    Хэрэгсэл эрх засах
                  </h2>
                  <button
                    onClick={() => setEditTarget(null)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  <span className="text-white font-medium">
                    {editTarget.name || editTarget.userId}
                  </span>
                  -д олгох хэрэгслийн эрхийг сонгоно уу.
                </p>
                <div className="mb-6">
                  <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">
                    Олгох эрхийн хэрэгслүүд
                  </p>
                  <ToolCheckList tools={editTools} setTools={setEditTools} />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEditTools}
                  disabled={editLoading}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {editLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wrench className="w-4 h-4" />
                  )}
                  Хадгалах
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Remove Confirm Modal */}
      <AnimatePresence>
        {removeTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRemoveTarget(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">
                      Админ эрх хасах
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Энэ үйлдлийг буцааж болохгүй
                    </p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-6">
                  <span className="text-white font-medium">
                    {removeTarget.name || removeTarget.userId}
                  </span>
                  -н админ эрхийг хасах уу?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRemoveTarget(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
                  >
                    Болих
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRemoveAdmin}
                    disabled={removeLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-slate-700 text-white text-sm font-medium transition-colors"
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
