"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  oracleConfigApi,
  getApiErrorMessage,
  type OracleDashboardConfig,
  type OracleEventChainConfig,
} from "@/lib/api";
import {
  BellDot,
  Loader2,
  Database,
  GitBranch,
  Power,
  PowerOff,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TabKey = "dashboards" | "chains";

const EMPTY_DASHBOARD = {
  name: "",
  tableName: "",
  fromClause: "",
  cifColumn: "",
  dateColumn: "",
  amountColumn: "",
  enabled: true,
};

const EMPTY_CHAIN = {
  name: "",
  description: "",
  sourceLabel: "",
  targetLabel: "",
  sourceIds: "",
  targetIds: "",
  enabled: true,
};

function parseIds(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

function formatIds(ids: number[]): string {
  return ids.join(", ");
}

export default function AdminAlertBoxPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabKey>("dashboards");
  const [dashboards, setDashboards] = useState<OracleDashboardConfig[]>([]);
  const [chains, setChains] = useState<OracleEventChainConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [dashModalOpen, setDashModalOpen] = useState(false);
  const [editingDash, setEditingDash] = useState<OracleDashboardConfig | null>(
    null,
  );
  const [dashForm, setDashForm] = useState(EMPTY_DASHBOARD);
  const [dashSaving, setDashSaving] = useState(false);

  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [editingChain, setEditingChain] =
    useState<OracleEventChainConfig | null>(null);
  const [chainForm, setChainForm] = useState(EMPTY_CHAIN);
  const [chainSaving, setChainSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "dashboard"; item: OracleDashboardConfig }
    | { type: "chain"; item: OracleEventChainConfig }
    | null
  >(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [d, c] = await Promise.all([
        oracleConfigApi.listDashboards(),
        oracleConfigApi.listChains(),
      ]);
      setDashboards(d);
      setChains(c);
    } catch (e: unknown) {
      toast({
        title: "Алдаа",
        description:
          getApiErrorMessage(e) || "Тохиргоог ачаалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openCreateDashboard = () => {
    setEditingDash(null);
    setDashForm(EMPTY_DASHBOARD);
    setDashModalOpen(true);
  };

  const openEditDashboard = (d: OracleDashboardConfig) => {
    setEditingDash(d);
    setDashForm({
      name: d.name,
      tableName: d.tableName,
      fromClause: d.fromClause ?? "",
      cifColumn: d.cifColumn,
      dateColumn: d.dateColumn ?? "",
      amountColumn: d.amountColumn ?? "",
      enabled: d.enabled,
    });
    setDashModalOpen(true);
  };

  const saveDashboard = async () => {
    setDashSaving(true);
    try {
      const payload = {
        name: dashForm.name.trim(),
        tableName: dashForm.tableName.trim(),
        fromClause: dashForm.fromClause.trim() || undefined,
        cifColumn: dashForm.cifColumn.trim(),
        dateColumn: dashForm.dateColumn.trim() || null,
        amountColumn: dashForm.amountColumn.trim() || null,
        enabled: dashForm.enabled,
      };
      if (editingDash) {
        const updated = await oracleConfigApi.updateDashboard(
          editingDash.id,
          payload,
        );
        setDashboards((prev) =>
          prev.map((x) => (x.id === editingDash.id ? updated : x)),
        );
        toast({ title: "Амжилттай", description: "Дашбоард шинэчлэгдлээ." });
      } else {
        const created = await oracleConfigApi.createDashboard(payload);
        setDashboards((prev) => [...prev, created].sort((a, b) => a.id - b.id));
        toast({ title: "Амжилттай", description: "Шинэ дашбоард нэмэгдлээ." });
      }
      setDashModalOpen(false);
    } catch (e: unknown) {
      toast({
        title: "Алдаа",
        description: getApiErrorMessage(e) || "Хадгалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setDashSaving(false);
    }
  };

  const openCreateChain = () => {
    setEditingChain(null);
    setChainForm(EMPTY_CHAIN);
    setChainModalOpen(true);
  };

  const openEditChain = (c: OracleEventChainConfig) => {
    setEditingChain(c);
    setChainForm({
      name: c.name,
      description: c.description,
      sourceLabel: c.sourceLabel,
      targetLabel: c.targetLabel,
      sourceIds: formatIds(c.sourceIds),
      targetIds: formatIds(c.targetIds),
      enabled: c.enabled,
    });
    setChainModalOpen(true);
  };

  const saveChain = async () => {
    const sourceIds = parseIds(chainForm.sourceIds);
    const targetIds = parseIds(chainForm.targetIds);
    if (!sourceIds.length || !targetIds.length) {
      toast({
        title: "Алдаа",
        description: "Source/Target ID-уудыг зөв оруулна уу (жишээ: 5, 6).",
        variant: "destructive",
      });
      return;
    }
    setChainSaving(true);
    try {
      const payload = {
        name: chainForm.name.trim(),
        description: chainForm.description.trim(),
        sourceLabel: chainForm.sourceLabel.trim(),
        targetLabel: chainForm.targetLabel.trim(),
        sourceIds,
        targetIds,
        enabled: chainForm.enabled,
      };
      if (editingChain) {
        const updated = await oracleConfigApi.updateChain(
          editingChain.id,
          payload,
        );
        setChains((prev) =>
          prev.map((x) => (x.id === editingChain.id ? updated : x)),
        );
        toast({ title: "Амжилттай", description: "Event chain шинэчлэгдлээ." });
      } else {
        const created = await oracleConfigApi.createChain(payload);
        setChains((prev) => [...prev, created].sort((a, b) => a.id - b.id));
        toast({
          title: "Амжилттай",
          description: "Шинэ event chain нэмэгдлээ.",
        });
      }
      setChainModalOpen(false);
    } catch (e: unknown) {
      toast({
        title: "Алдаа",
        description: getApiErrorMessage(e) || "Хадгалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setChainSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const key =
      deleteTarget.type === "dashboard"
        ? `d-${deleteTarget.item.id}`
        : `c-${deleteTarget.item.id}`;
    setSavingId(key);
    try {
      if (deleteTarget.type === "dashboard") {
        await oracleConfigApi.deleteDashboard(deleteTarget.item.id);
        setDashboards((prev) =>
          prev.filter((x) => x.id !== deleteTarget.item.id),
        );
      } else {
        await oracleConfigApi.deleteChain(deleteTarget.item.id);
        setChains((prev) => prev.filter((x) => x.id !== deleteTarget.item.id));
      }
      toast({ title: "Амжилттай", description: "Устгагдлаа." });
    } catch (e: unknown) {
      toast({
        title: "Алдаа",
        description: getApiErrorMessage(e) || "Устгахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
      setDeleteTarget(null);
    }
  };

  const toggleDashboard = async (d: OracleDashboardConfig) => {
    const key = `d-${d.id}`;
    setSavingId(key);
    try {
      const updated = await oracleConfigApi.setDashboardEnabled(
        d.id,
        !d.enabled,
      );
      setDashboards((prev) =>
        prev.map((x) =>
          x.id === d.id ? { ...x, enabled: updated.enabled } : x,
        ),
      );
    } catch (e: unknown) {
      toast({
        title: "Алдаа",
        description: getApiErrorMessage(e) || "Төлөв өөрчлөхөд алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const toggleChain = async (c: OracleEventChainConfig) => {
    const key = `c-${c.id}`;
    setSavingId(key);
    try {
      const updated = await oracleConfigApi.setChainEnabled(c.id, !c.enabled);
      setChains((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, enabled: updated.enabled } : x,
        ),
      );
    } catch (e: unknown) {
      toast({
        title: "Алдаа",
        description: getApiErrorMessage(e) || "Төлөв өөрчлөхөд алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  const enabledDashboards = dashboards.filter((d) => d.enabled).length;
  const enabledChains = chains.filter((c) => c.enabled).length;

  return (
    <div className="admin-shell min-h-screen bg-background">
      <AdminPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-premium">
            <BellDot className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Alert Box — Тохиргоо"
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("dashboards")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === "dashboards"
                  ? "bg-foreground text-background"
                  : "border border-border text-foreground/70 hover:bg-muted"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Дашбоард
              <span className="text-xs opacity-70">
                {enabledDashboards}/{dashboards.length}
              </span>
            </button>
            <button
              onClick={() => setTab("chains")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === "chains"
                  ? "bg-foreground text-background"
                  : "border border-border text-foreground/70 hover:bg-muted"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Event Chain
              <span className="text-xs opacity-70">
                {enabledChains}/{chains.length}
              </span>
            </button>
          </div>

          {tab === "dashboards" ? (
            <Button size="sm" onClick={openCreateDashboard} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Дашбоард нэмэх
            </Button>
          ) : (
            <Button size="sm" onClick={openCreateChain} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Chain нэмэх
            </Button>
          )}
        </div>

        {tab === "dashboards" && (
          <div className="grid gap-2.5 md:grid-cols-2">
            {dashboards.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-2 py-8 text-center">
                Дашбоард байхгүй. «Дашбоард нэмэх» товчоор шинээр үүсгэнэ үү.
              </p>
            ) : (
              dashboards.map((d) => (
                <div
                  key={d.id}
                  className={`rounded-xl border-2 px-4 py-3 flex items-start gap-3 transition-colors ${
                    d.enabled
                      ? "border-border bg-card"
                      : "border-dashed border-border/50 bg-card/40 opacity-70"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground/80">
                        DB{d.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          d.enabled
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {d.enabled ? "Идэвхтэй" : "Идэвхгүй"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {d.name}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground/70 mt-1 truncate">
                      {d.tableName}
                    </p>
                    {d.fromClause && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1 line-clamp-2 font-mono">
                        FROM: {d.fromClause}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditDashboard(d)}
                      title="Засах"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({ type: "dashboard", item: d })
                      }
                      title="Устгах"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleDashboard(d)}
                      disabled={savingId === `d-${d.id}`}
                      title={d.enabled ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                        d.enabled
                          ? "text-emerald-500 hover:bg-emerald-500/10"
                          : "text-muted-foreground/60 hover:bg-muted"
                      }`}
                    >
                      {savingId === `d-${d.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : d.enabled ? (
                        <Power className="w-4 h-4" />
                      ) : (
                        <PowerOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "chains" && (
          <div className="grid gap-2.5 md:grid-cols-2">
            {chains.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-2 py-8 text-center">
                Event chain байхгүй. «Chain нэмэх» товчоор шинээр үүсгэнэ үү.
              </p>
            ) : (
              chains.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl border-2 px-4 py-3 flex items-start gap-3 transition-colors ${
                    c.enabled
                      ? "border-border bg-card"
                      : "border-dashed border-border/50 bg-card/40 opacity-70"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground/80">
                        #{c.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          c.enabled
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.enabled ? "Идэвхтэй" : "Идэвхгүй"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">
                      {c.description}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground/60 mt-1.5">
                      {c.sourceLabel} → {c.targetLabel}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                      [{c.sourceIds.join(", ")}] → [{c.targetIds.join(", ")}]
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditChain(c)}
                      title="Засах"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({ type: "chain", item: c })
                      }
                      title="Устгах"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleChain(c)}
                      disabled={savingId === `c-${c.id}`}
                      title={c.enabled ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                        c.enabled
                          ? "text-emerald-500 hover:bg-emerald-500/10"
                          : "text-muted-foreground/60 hover:bg-muted"
                      }`}
                    >
                      {savingId === `c-${c.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : c.enabled ? (
                        <Power className="w-4 h-4" />
                      ) : (
                        <PowerOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Dashboard modal */}
      <Dialog open={dashModalOpen} onOpenChange={setDashModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDash
                ? `Дашбоард засах (DB${editingDash.id})`
                : "Шинэ дашбоард"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Нэр</Label>
              <Input
                value={dashForm.name}
                onChange={(e) =>
                  setDashForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Дашбоардын нэр"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хүснэгт (tableName)</Label>
              <Input
                value={dashForm.tableName}
                onChange={(e) =>
                  setDashForm((f) => ({ ...f, tableName: e.target.value }))
                }
                placeholder="DATA_ANALYST.MY_TABLE"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>FROM clause (заавал биш)</Label>
              <Textarea
                value={dashForm.fromClause}
                onChange={(e) =>
                  setDashForm((f) => ({ ...f, fromClause: e.target.value }))
                }
                placeholder="TABLE M JOIN ... ON ..."
                rows={2}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>CIF column</Label>
                <Input
                  value={dashForm.cifColumn}
                  onChange={(e) =>
                    setDashForm((f) => ({ ...f, cifColumn: e.target.value }))
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date column</Label>
                <Input
                  value={dashForm.dateColumn}
                  onChange={(e) =>
                    setDashForm((f) => ({ ...f, dateColumn: e.target.value }))
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount column</Label>
                <Input
                  value={dashForm.amountColumn}
                  onChange={(e) =>
                    setDashForm((f) => ({ ...f, amountColumn: e.target.value }))
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dashForm.enabled}
                onChange={(e) =>
                  setDashForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              Идэвхтэй
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDashModalOpen(false)}>
              Болих
            </Button>
            <Button
              onClick={saveDashboard}
              disabled={
                dashSaving ||
                !dashForm.name.trim() ||
                !dashForm.tableName.trim() ||
                !dashForm.cifColumn.trim()
              }
            >
              {dashSaving && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              )}
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chain modal */}
      <Dialog open={chainModalOpen} onOpenChange={setChainModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingChain
                ? `Event chain засах (#${editingChain.id})`
                : "Шинэ event chain"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Нэр</Label>
              <Input
                value={chainForm.name}
                onChange={(e) =>
                  setChainForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Тайлбар</Label>
              <Textarea
                value={chainForm.description}
                onChange={(e) =>
                  setChainForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Source label</Label>
                <Input
                  value={chainForm.sourceLabel}
                  onChange={(e) =>
                    setChainForm((f) => ({ ...f, sourceLabel: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target label</Label>
                <Input
                  value={chainForm.targetLabel}
                  onChange={(e) =>
                    setChainForm((f) => ({ ...f, targetLabel: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Source dashboard IDs</Label>
                <Input
                  value={chainForm.sourceIds}
                  onChange={(e) =>
                    setChainForm((f) => ({ ...f, sourceIds: e.target.value }))
                  }
                  placeholder="5, 6"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target dashboard IDs</Label>
                <Input
                  value={chainForm.targetIds}
                  onChange={(e) =>
                    setChainForm((f) => ({ ...f, targetIds: e.target.value }))
                  }
                  placeholder="7"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chainForm.enabled}
                onChange={(e) =>
                  setChainForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              Идэвхтэй
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChainModalOpen(false)}>
              Болих
            </Button>
            <Button
              onClick={saveChain}
              disabled={chainSaving || !chainForm.name.trim()}
            >
              {chainSaving && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              )}
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.type === "dashboard"
              ? `DB${deleteTarget.item.id} — ${(deleteTarget.item as OracleDashboardConfig).name}`
              : `#${deleteTarget?.item.id} — ${(deleteTarget?.item as OracleEventChainConfig)?.name}`}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-500"
            >
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
