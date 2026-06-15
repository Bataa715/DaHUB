"use client";

import { useState, useEffect, useCallback } from "react";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Search,
  AlertTriangle,
  Loader2,
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
  { id: "excel_report", name: "Excel тайлан" },
  { id: "data_doc", name: "Өгөгдлийн толь бичиг" },
  { id: "alert_box", name: "Alert Box" },
  { id: "risk_assessment", name: "Салбарын эрсдэлийн үнэлгээ" },
];

interface AdminUser {
  id: string;
  name: string;
  userId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  grantableTools: string[];
  department?: string;
}

interface AllUser {
  id: string;
  name: string;
  userId: string;
  isAdmin: boolean;
}

function ToolCheckList({
  tools,
  setTools,
}: {
  tools: string[];
  setTools: (v: string[]) => void;
}) {
  const toggle = (id: string) =>
    setTools(
      tools.includes(id) ? tools.filter((t) => t !== id) : [...tools, id],
    );
  return (
    <div className="space-y-2 rounded-xl bg-muted/50 p-3 border border-border max-h-52 overflow-y-auto">
      {ALL_TOOLS.map((tool) => {
        const checked = tools.includes(tool.id);
        return (
          <label
            key={tool.id}
            onClick={() => toggle(tool.id)}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                checked
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-border/70 group-hover:border-emerald-500/50"
              }`}
            >
              {checked && (
                <svg
                  className="w-2.5 h-2.5 text-foreground"
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
              className={`text-sm select-none transition-colors ${checked ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"}`}
            >
              {tool.name}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function AdminsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin;

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
        data.map((a: AdminUser) => ({
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

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title="Админ удирдлага"
        rightContent={
          isSuperAdmin ? (
            <button
              onClick={() => setShowAddSheet(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
            >
              + Нэмэх
            </button>
          ) : undefined
        }
      />

      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-2">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 flex items-center gap-2 text-sm mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground/50 py-16">
            Одоогоор админ бүртгэгдээгүй байна
          </p>
        ) : (
          admins.map((admin) => {
            const isSelf = admin.id === user?.id;
            const isExpanded = expandedAdmin === admin.id;
            const toolNames = (admin.grantableTools ?? []).map(
              (tid) => ALL_TOOLS.find((t) => t.id === tid)?.name ?? tid,
            );

            return (
              <div
                key={admin.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                    {(admin.name ?? admin.userId ?? "?")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {admin.name || admin.userId}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${admin.isSuperAdmin ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}
                      >
                        {admin.isSuperAdmin ? "Супер" : "Саб"}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          Та
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-xs text-muted-foreground/50">
                        {admin.userId}
                      </p>
                      {!admin.isSuperAdmin && (
                        <button
                          onClick={() =>
                            setExpandedAdmin(isExpanded ? null : admin.id)
                          }
                          className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40 hover:text-foreground/60 ml-2 transition-colors"
                        >
                          {toolNames.length > 0
                            ? `${toolNames.length} хэрэгсэл`
                            : "хэрэгсэл тохируулаагүй"}
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {isSuperAdmin && !isSelf && (
                    <div className="flex items-center gap-1 shrink-0">
                      {!admin.isSuperAdmin && (
                        <button
                          onClick={() => {
                            setEditTarget(admin);
                            setEditTools(admin.grantableTools ?? []);
                          }}
                          className="text-xs text-muted-foreground/60 hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors border border-border"
                        >
                          Эрх
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleSuperAdmin(admin)}
                        className="text-xs text-muted-foreground/60 hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors border border-border"
                      >
                        {admin.isSuperAdmin ? "Саб болгох" : "Супер болгох"}
                      </button>
                      <button
                        onClick={() => setRemoveTarget(admin)}
                        className="text-xs text-muted-foreground/60 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors border border-border"
                      >
                        Хасах
                      </button>
                    </div>
                  )}
                </div>
                {isExpanded && !admin.isSuperAdmin && (
                  <div className="border-t border-border px-4 py-3">
                    {toolNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {toolNames.map((name) => (
                          <span
                            key={name}
                            className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/40">
                        Ямар ч хэрэгсэл тохируулаагүй байна.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Admin Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent className="bg-background border-border overflow-y-auto">
          <SheetTitle className="text-base font-semibold mb-4">
            Шинэ админ нэмэх
          </SheetTitle>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
              <input
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Хэрэглэгч хайх..."
                className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ring"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto rounded-xl border border-border">
              {filteredUsers.length === 0 ? (
                <p className="text-muted-foreground/60 text-sm p-4 text-center">
                  Хэрэглэгч олдсонгүй
                </p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selectedUserId === u.id ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted/50"}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {(u.name || u.userId || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {u.name || u.userId}
                      </div>
                      <div className="text-xs text-muted-foreground/60">
                        {u.userId}
                      </div>
                    </div>
                    {selectedUserId === u.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground/60 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground/60 mb-2">Роль</p>
              <div className="grid grid-cols-2 gap-2">
                {(["sub", "super"] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`py-2 rounded-xl border text-sm font-medium transition-all ${selectedRole === role ? "bg-muted border-foreground/20 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                  >
                    {role === "super" ? "Супер админ" : "Саб админ"}
                  </button>
                ))}
              </div>
            </div>
            {selectedRole === "sub" && (
              <div>
                <p className="text-xs text-muted-foreground/60 mb-2">
                  Олгох эрхийн хэрэгсэл
                </p>
                <ToolCheckList
                  tools={grantableTools}
                  setTools={setGrantableTools}
                />
              </div>
            )}
            <button
              onClick={handleAddAdmin}
              disabled={!selectedUserId || addLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-background hover:bg-muted disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {addLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Нэмэх
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Tools Sheet */}
      <Sheet
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
      >
        <SheetContent className="bg-background border-border overflow-y-auto">
          <SheetTitle className="text-base font-semibold mb-1">
            Хэрэгсэл эрх засах
          </SheetTitle>
          <p className="text-xs text-muted-foreground/60 mb-4">
            <span className="text-foreground font-medium">
              {editTarget?.name || editTarget?.userId}
            </span>
            -д олгох хэрэгслийн эрхийг сонгоно уу.
          </p>
          <ToolCheckList tools={editTools} setTools={setEditTools} />
          <button
            onClick={handleEditTools}
            disabled={editLoading}
            className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Хадгалах
          </button>
        </SheetContent>
      </Sheet>

      {/* Remove Confirm Dialog */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
      >
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle>Админ эрх хасах</DialogTitle>
            <DialogDescription className="text-muted-foreground/60">
              <span className="text-foreground font-medium">
                {removeTarget?.name || removeTarget?.userId}
              </span>
              -н админ эрхийг хасах уу?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setRemoveTarget(null)}
              className="border border-border"
            >
              Болих
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveAdmin}
              disabled={removeLoading}
            >
              {removeLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              Хасах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
