"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  riskIndicatorConfigApi,
  riskApi,
  HOLD_GLOBAL_PERIOD,
  type IndicatorConfig,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  BarChart3,
  Layers,
  PauseCircle,
} from "lucide-react";
import { invalidateIndicatorCache } from "@/app/tools/risk-assessment/use-indicator-config";

// ── Scale editor + туслах тогтмолууд _components/ScaleEditor.tsx-д байрлана ──
import {
  ScaleEditor,
  parseScale,
  EMPTY_FORM,
  GROUP_LABELS,
  GROUP_SHORT,
  GROUP_ACCENT,
  SCALE_TYPE_LABELS,
  SCALE_TYPE_BADGE_CLASS,
} from "./_components/ScaleEditor";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RiskIndicatorsPage() {
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Settings — history management
  const [historyList, setHistoryList] = useState<
    { id: string; name: string; pDate: string; createdAt: string }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeleteTarget, setHistoryDeleteTarget] = useState<string | null>(
    null,
  );
  const [historyDeleting, setHistoryDeleting] = useState(false);

  // Load history when settings tab is opened (lazy)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await riskApi.listHistory();
      setHistoryList(data || []);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const doDeleteReportHistory = useCallback(async (id: string) => {
    setHistoryDeleting(true);
    try {
      await riskApi.deleteHistory(id);
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
    } catch {
    } finally {
      setHistoryDeleting(false);
      setHistoryDeleteTarget(null);
    }
  }, []);

  // Holds — огноо/улирлаас үл хамаарах нэгдсэн (global) hold
  const holdsPeriod = HOLD_GLOBAL_PERIOD;
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());
  const [holdsLoading, setHoldsLoading] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadIndicators = useCallback(async () => {
    setLoading(true);
    try {
      const data = await riskIndicatorConfigApi.list();
      setIndicators(data ?? []);
    } catch {
      toast({
        title: "Алдаа",
        description: "Үзүүлэлт ачааллахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  useEffect(() => {
    if (!holdsPeriod) return;
    setHoldsLoading(true);
    riskApi
      .listHolds(holdsPeriod)
      .then((data) => setHeldIds(new Set(data.map((d) => d.indicatorId))))
      .catch(() => {
        /* intentional: hold state is UI-only; failure leaves holds unset */
      })
      .finally(() => setHoldsLoading(false));
  }, [holdsPeriod]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const grouped = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((g) => ({
        group: g,
        rows: indicators
          .filter((i) => i.group_num === g)
          .sort((a, b) => {
            const an = Number(a.subid);
            const bn = Number(b.subid);
            if (!isNaN(an) && !isNaN(bn)) return an - bn;
            return a.subid.localeCompare(b.subid);
          }),
        totalWeight: indicators
          .filter((i) => i.group_num === g)
          .reduce((s, i) => s + i.weight, 0),
      })),
    [indicators],
  );

  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map((g) => ({
        ...g,
        rows: g.rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.subid.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [grouped, search]);

  // ── Dialog handlers ────────────────────────────────────────────────────────
  const openCreate = (initialGroup?: number) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, group_num: initialGroup ?? 1 });
    setDialogOpen(true);
  };

  const openEdit = (ind: IndicatorConfig) => {
    setEditingId(ind.id);
    setForm({
      subid: ind.subid,
      name: ind.name,
      group_num: ind.group_num,
      weight: ind.weight,
      is_manual: ind.is_manual,
      is_judgment: ind.is_judgment,
      hint: ind.hint ?? "",
      score_scale: ind.score_scale,
      sort_order: ind.sort_order,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const isJudgement = form.group_num === 5;
    if (!isJudgement && (!form.subid.trim() || !form.name.trim())) {
      toast({
        title: "Алдаа",
        description: "SubID болон Нэр шаардлагатай.",
        variant: "destructive",
      });
      return;
    }
    // Judgement: auto name + subid
    const autoSubid =
      isJudgement && !form.subid.trim() ? `j-${Date.now()}` : form.subid;
    const autoName = isJudgement && !form.name.trim() ? "Judgement" : form.name;
    setSaving(true);
    const scaleObj = parseScale(form.score_scale);
    const derivedIsManual: 0 | 1 = scaleObj.type === "manual" ? 1 : 0;
    const payload = {
      ...form,
      subid: autoSubid,
      name: autoName,
      is_manual: isJudgement ? 1 : derivedIsManual,
      is_judgment: isJudgement ? 1 : form.is_judgment,
    };
    try {
      if (editingId) {
        await riskIndicatorConfigApi.update(editingId, payload);
        toast({ title: "Хадгалагдлаа" });
      } else {
        await riskIndicatorConfigApi.create(payload);
        toast({ title: "Нэмэгдлээ" });
      }
      closeDialog();
      invalidateIndicatorCache();
      await loadIndicators();
    } catch {
      toast({
        title: "Алдаа",
        description: "Хадгалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await riskIndicatorConfigApi.delete(deleteTarget);
      toast({ title: "Устгагдлаа" });
      setDeleteTarget(null);
      await loadIndicators();
    } catch {
      toast({
        title: "Алдаа",
        description: "Устгахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ── Reorder removed — sorted by subid ────────────────────────────────────

  // ── Hold toggle — optimistic ───────────────────────────────────────────────
  const toggleHold = useCallback(
    (indicatorId: string) => {
      setHeldIds((prev) => {
        const next = new Set(prev);
        const wasHeld = next.has(indicatorId);
        wasHeld ? next.delete(indicatorId) : next.add(indicatorId);
        riskApi
          .setHold({ indicatorId, period: holdsPeriod, isHeld: !wasHeld })
          .catch(() => {
            toast({
              title: "Алдаа",
              description: "Hold хадгалахад алдаа гарлаа.",
              variant: "destructive",
            });
          });
        return next;
      });
    },
    [holdsPeriod, toast],
  );

  // ── Counts ─────────────────────────────────────────────────────────────────
  const totalAllWeight = useMemo(
    () => indicators.reduce((s, i) => s + i.weight, 0),
    [indicators],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title="Эрсдэлийн үзүүлэлт"
        rightContent={
          !loading ? (
            <span className="text-xs text-muted-foreground/60">
              {indicators.length} үзүүлэлт · нийт жин{" "}
              <span
                className={`font-semibold ${Math.abs(totalAllWeight - 100) > 0.01 ? "text-amber-500" : "text-emerald-500"}`}
              >
                {totalAllWeight}%
                {Math.abs(totalAllWeight - 100) > 0.01 ? " ⚠" : " ✓"}
              </span>
            </span>
          ) : undefined
        }
      />
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <Tabs defaultValue="indicators">
          <TabsList className="mb-6 bg-muted/40 border border-border/40 rounded-xl h-9 p-1 gap-0.5">
            <TabsTrigger
              value="indicators"
              className="text-xs h-7 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Үзүүлэлтүүд
            </TabsTrigger>
            <TabsTrigger
              value="holds"
              className="text-xs h-7 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Hold
              {heldIds.size > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-amber-500/20 text-amber-500 px-1.5 rounded">
                  {heldIds.size}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              onClick={loadHistory}
              className="text-xs h-7 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Тайлан
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Indicators ── */}
          <TabsContent value="indicators" className="mt-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Хайх..."
                  className="pl-8 h-8 text-sm bg-foreground/[0.03] border-border/40 rounded-lg"
                />
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={() => openCreate()}
                className="h-8 text-xs font-medium gap-1 bg-blue-600 hover:bg-blue-500 text-white px-4"
              >
                <Plus className="w-3 h-3" /> Нэмэх
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGrouped.map(({ group, rows, totalWeight }) => (
                  <div
                    key={group}
                    className="rounded-xl border border-border/50 overflow-hidden bg-card"
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/30 bg-muted/20">
                      <span
                        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${GROUP_ACCENT[group].bg} ${GROUP_ACCENT[group].text}`}
                      >
                        {GROUP_SHORT[group]}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {GROUP_LABELS[group]}
                      </span>
                      <span className="text-xs text-muted-foreground/40">
                        {rows.length} үзүүлэлт
                      </span>
                      <div className="flex-1" />
                      <span className="text-xs font-semibold text-foreground/60 tabular-nums">
                        {totalWeight}%
                      </span>
                      <button
                        onClick={() => openCreate(group)}
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-foreground hover:bg-foreground/10 transition-colors ml-1"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Indicator rows */}
                    {rows.length === 0 ? (
                      <div className="px-4 py-5 text-center text-xs text-muted-foreground/30">
                        Үзүүлэлт байхгүй
                      </div>
                    ) : (
                      <div className="divide-y divide-border/25">
                        {rows.map((ind) => {
                          const scaleObj = parseScale(ind.score_scale);
                          const badgeClass =
                            SCALE_TYPE_BADGE_CLASS[scaleObj.type] ??
                            SCALE_TYPE_BADGE_CLASS.manual;
                          return (
                            <div
                              key={ind.id}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 group transition-colors"
                            >
                              <code className="text-[11px] font-mono text-muted-foreground/40 w-10 shrink-0 tabular-nums">
                                {ind.subid}
                              </code>
                              <span className="flex-1 text-[13px] text-foreground/85 truncate min-w-0">
                                {ind.name}
                              </span>
                              <span
                                className={`text-[10px] border px-1.5 py-0.5 rounded font-medium shrink-0 ${badgeClass}`}
                              >
                                {SCALE_TYPE_LABELS[scaleObj.type] ??
                                  scaleObj.type}
                              </span>
                              <span className="text-[13px] font-medium text-foreground/60 tabular-nums w-9 text-right shrink-0">
                                {ind.weight}%
                              </span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={() => openEdit(ind)}
                                  className="p-1 rounded text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(ind.id)}
                                  className="p-1 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {indicators.length === 0 && (
                  <div className="rounded-xl border border-border/30 py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                      Үзүүлэлт байхгүй байна
                    </p>
                    <p className="text-xs text-muted-foreground/40 mt-1">
                      «Нэмэх» товчоор эхлэнэ үү
                    </p>
                  </div>
                )}
                {indicators.length > 0 && filteredGrouped.length === 0 && (
                  <div className="rounded-xl border border-border/30 py-12 text-center">
                    <p className="text-sm text-muted-foreground/60">
                      «{search}» хайлтад тохирсон үзүүлэлт олдсонгүй
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Holds ── */}
          <TabsContent value="holds" className="mt-0">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-medium">Hold үзүүлэлтүүд</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Hold хийсэн үзүүлэлт бүх огноо/улирлын тооцооноос хасагдана
                </p>
              </div>
              <div className="flex items-center gap-2">
                {holdsLoading && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/30" />
                )}
              </div>
            </div>

            {heldIds.size > 0 && (
              <div className="flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs">
                <span className="text-amber-600 dark:text-amber-400">
                  <strong className="font-semibold">{heldIds.size}</strong>{" "}
                  үзүүлэлт hold хийгдсэн — тооцооноос хасагдана
                </span>
                <button
                  onClick={() => [...heldIds].forEach((id) => toggleHold(id))}
                  className="ml-auto font-medium text-amber-500/60 hover:text-amber-500 transition-colors"
                >
                  Бүгдийг цуцлах
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/20" />
              </div>
            ) : (
              <div className="space-y-2">
                {([1, 2, 3, 4, 5] as const).map((grp) => {
                  const grpInds = indicators
                    .filter((ind) => ind.group_num === grp)
                    .sort((a, b) => {
                      const an = Number(a.subid),
                        bn = Number(b.subid);
                      if (!isNaN(an) && !isNaN(bn)) return an - bn;
                      return a.subid.localeCompare(b.subid);
                    });
                  if (grpInds.length === 0) return null;
                  const accent = GROUP_ACCENT[grp];
                  const heldCount = grpInds.filter((ind) =>
                    heldIds.has(ind.id),
                  ).length;
                  return (
                    <div
                      key={grp}
                      className="rounded-xl border border-border/50 bg-card overflow-hidden"
                    >
                      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/25 bg-muted/20">
                        <span
                          className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${accent.bg} ${accent.text}`}
                        >
                          {GROUP_SHORT[grp]}
                        </span>
                        <span className="text-sm font-medium text-foreground/80">
                          {GROUP_LABELS[grp]}
                        </span>
                        {heldCount > 0 && (
                          <span className="text-[11px] font-semibold text-amber-500">
                            · {heldCount} hold
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-border/20">
                        {grpInds.map((ind) => {
                          const held = heldIds.has(ind.id);
                          return (
                            <button
                              key={ind.id}
                              onClick={() => toggleHold(ind.id)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${held ? "bg-amber-500/5 hover:bg-amber-500/8" : "hover:bg-muted/20"}`}
                            >
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${held ? "bg-amber-500 border-amber-500" : "border-border/50 bg-transparent"}`}
                              >
                                {held && (
                                  <svg
                                    className="w-2.5 h-2.5 text-white"
                                    fill="none"
                                    viewBox="0 0 12 12"
                                  >
                                    <path
                                      d="M2 6l3 3 5-5"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </span>
                              <code className="text-[11px] font-mono text-muted-foreground/40 w-8 shrink-0">
                                {ind.subid}
                              </code>
                              <span
                                className={`flex-1 text-[13px] min-w-0 truncate transition-colors ${held ? "text-amber-600 dark:text-amber-400 line-through" : "text-foreground/75"}`}
                              >
                                {ind.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground/40 tabular-nums shrink-0">
                                {ind.weight}%
                              </span>
                              {held && (
                                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
                                  HOLD
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 3: Settings ── */}
          <TabsContent value="settings" className="mt-0">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-medium">Хадгалсан тайлангууд</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Шаардлагагүй тайлануудыг устгана уу
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={loadHistory}
                disabled={historyLoading}
                className="h-8 text-xs gap-1.5 rounded-lg"
              >
                {historyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                Шинэчлэх
              </Button>
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
              </div>
            ) : historyList.length === 0 ? (
              <div className="rounded-xl border border-border/30 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Хадгалсан тайлан байхгүй
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
                <table className="w-full">
                  <thead className="border-b border-border/40 bg-muted/20">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                        Нэр
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                        Огноо
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                        Хадгалсан
                      </th>
                      <th className="w-28" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/25">
                    {historyList.map((h) => (
                      <tr
                        key={h.id}
                        className="hover:bg-muted/15 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                          {h.name}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">
                          {h.pDate}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">
                          {h.createdAt?.slice(0, 10) ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {historyDeleteTarget === h.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => doDeleteReportHistory(h.id)}
                                disabled={historyDeleting}
                                className="h-7 px-3 text-[11px] font-semibold bg-red-500 hover:bg-red-400 text-white rounded-lg disabled:opacity-50"
                              >
                                {historyDeleting ? "..." : "Тийм"}
                              </button>
                              <button
                                onClick={() => setHistoryDeleteTarget(null)}
                                className="h-7 px-3 text-[11px] text-muted-foreground hover:text-foreground border border-border/50 rounded-lg"
                              >
                                Болих
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setHistoryDeleteTarget(h.id)}
                              className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialog: Create/Edit ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="bg-card border-border/40 text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingId ? "Үзүүлэлт засах" : "Шинэ үзүүлэлт"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {form.group_num === 5 ? (
              <div className="space-y-4">
                <div className="px-3.5 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Judgement — зөвхөн жин тохируулна. Нэр болон бусад тохиргоо
                    автоматаар тавигдана.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Жин %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.weight}
                    onChange={(e) =>
                      setForm({ ...form, weight: Number(e.target.value) })
                    }
                    className="h-9 rounded-xl bg-foreground/5 border-border/50"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      SubID <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={form.subid}
                      onChange={(e) =>
                        !editingId &&
                        setForm({ ...form, subid: e.target.value })
                      }
                      readOnly={!!editingId}
                      placeholder="1, 5, 27..."
                      className={`h-9 rounded-xl border-border/50 placeholder:text-muted-foreground/30 ${editingId ? "bg-foreground/[0.03] text-muted-foreground/50 cursor-default" : "bg-foreground/5"}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Нэр <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Үзүүлэлтийн нэр"
                      className="h-9 rounded-xl bg-foreground/5 border-border/50 placeholder:text-muted-foreground/30"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Бүлэг
                    </Label>
                    <Select
                      value={String(form.group_num)}
                      onValueChange={(v) =>
                        setForm({ ...form, group_num: Number(v) })
                      }
                    >
                      <SelectTrigger className="h-9 rounded-xl bg-foreground/5 border-border/50 text-foreground/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/50">
                        {[1, 2, 3, 4].map((g) => (
                          <SelectItem
                            key={g}
                            value={String(g)}
                            className="text-foreground/80 focus:bg-foreground/8"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${GROUP_ACCENT[g].bg} ${GROUP_ACCENT[g].text}`}
                              >
                                {GROUP_SHORT[g]}
                              </span>
                              {GROUP_LABELS[g]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Жин %
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.weight}
                      onChange={(e) =>
                        setForm({ ...form, weight: Number(e.target.value) })
                      }
                      className="h-9 rounded-xl bg-foreground/5 border-border/50"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Аргачлал
                  </Label>
                  <textarea
                    value={form.hint}
                    onChange={(e) => setForm({ ...form, hint: e.target.value })}
                    placeholder="Энэ үзүүлэлтийг хэрхэн үнэлэх аргачлал, тайлбарыг бичнэ үү. Ажилтнууд «Аргачлал» хуудаснаас уншина."
                    rows={4}
                    className="w-full rounded-xl bg-foreground/5 border border-border/50 px-3 py-2 text-sm placeholder:text-muted-foreground/30 resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                <div className="pt-2 border-t border-border/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/40" />
                    <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                      Оноо тооцоолох бүтэц
                    </span>
                  </div>
                  <ScaleEditor
                    key={editingId ?? "new"}
                    value={form.score_scale}
                    onChange={(json) =>
                      setForm((f) => ({ ...f, score_scale: json }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-1">
            <button
              onClick={closeDialog}
              disabled={saving}
              className="flex-1 h-9 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-xl hover:bg-foreground/5 transition-colors"
            >
              Болих
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-9 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? "Хадгалах" : "Нэмэх"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-card border-border/40 text-foreground max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <AlertDialogTitle className="text-center text-sm">
              Үзүүлэлт устгах уу?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-xs text-muted-foreground/60 text-center pb-2">
            Устгасны дараа буцаах боломжгүй.
          </p>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="flex-1 bg-transparent border-border/50 text-foreground/70 hover:text-foreground rounded-xl text-sm">
              Болих
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-500 hover:bg-red-400 text-white border-0 rounded-xl text-sm font-semibold"
            >
              {deleting && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              )}
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
