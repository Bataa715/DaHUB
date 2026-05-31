"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  riskIndicatorConfigApi,
  riskApi,
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
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  BarChart3,
  Layers,
  PauseCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreScaleRule {
  min?: number | null;
  max?: number | null;
  matchType?: "exact" | "contains";
  values?: string[];
  score: number;
  label: string;
}

interface ScoreScale {
  type: "numeric" | "string" | "both" | "manual";
  rules?: ScoreScaleRule[];
  numericRules?: ScoreScaleRule[];
  stringRules?: ScoreScaleRule[];
  min?: number;
  max?: number;
  step?: number;
  null_is_unelehgui?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<number, string> = {
  1: "Score 1",
  2: "Score 2",
  3: "Score 3",
  4: "Score 4",
  5: "Score 5",
};
const GROUP_SHORT: Record<number, string> = {
  1: "S1",
  2: "S2",
  3: "S3",
  4: "S4",
  5: "J",
};

const GROUP_ACCENT: Record<
  number,
  { ring: string; bg: string; text: string; dot: string }
> = {
  1: {
    ring: "ring-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-500",
  },
  2: {
    ring: "ring-teal-500/30",
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    dot: "bg-teal-500",
  },
  3: {
    ring: "ring-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    dot: "bg-purple-500",
  },
  4: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  5: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
};

const SCALE_TYPE_LABELS: Record<string, string> = {
  numeric: "Тоон",
  string: "Мөр",
  both: "Хосолсон",
  manual: "Гараар",
  no_score: "Оноогүй",
};

const SCALE_TYPE_BADGE_CLASS: Record<string, string> = {
  numeric: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  string: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  both: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  manual: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  no_score: "bg-muted/30 text-muted-foreground border-border/30",
};

const DEFAULT_SCALE: ScoreScale = { type: "manual", min: 1, max: 5, step: 1 };

const EMPTY_FORM = {
  subid: "",
  name: "",
  group_num: 1,
  weight: 0,
  is_manual: 0 as 0 | 1,
  is_judgment: 0 as 0 | 1,
  hint: "",
  score_scale: JSON.stringify(DEFAULT_SCALE),
  sort_order: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseScale(raw: string): ScoreScale {
  try {
    return JSON.parse(raw) as ScoreScale;
  } catch {
    return { ...DEFAULT_SCALE };
  }
}

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

  // Holds
  const [holdsPeriod, setHoldsPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
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
      .catch(() => { /* intentional: hold state is UI-only; failure leaves holds unset */ })
      .finally(() => setHoldsLoading(false));
  }, [holdsPeriod]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const grouped = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((g) => ({
        group: g,
        rows: indicators
          .filter((i) => i.group_num === g)
          .sort((a, b) => a.sort_order - b.sort_order),
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
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
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
    if (!form.subid.trim() || !form.name.trim()) {
      toast({
        title: "Алдаа",
        description: "SubID болон Нэр шаардлагатай.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = { ...form };
    try {
      if (editingId) {
        await riskIndicatorConfigApi.update(editingId, payload);
        toast({ title: "Хадгалагдлаа" });
      } else {
        await riskIndicatorConfigApi.create(payload);
        toast({ title: "Нэмэгдлээ" });
      }
      closeDialog();
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

  // ── Reorder — optimistic update, revert on error ───────────────────────────
  const move = useCallback(
    async (ind: IndicatorConfig, dir: -1 | 1) => {
      const group = indicators
        .filter((i) => i.group_num === ind.group_num)
        .sort((a, b) => a.sort_order - b.sort_order);
      const idx = group.findIndex((i) => i.id === ind.id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= group.length) return;

      const newGroup = [...group];
      [newGroup[idx], newGroup[swapIdx]] = [newGroup[swapIdx], newGroup[idx]];
      const reorderedIds = newGroup.map((i) => i.id);

      // Optimistic: update state immediately without waiting for API
      setIndicators((prev) => {
        const others = prev.filter((i) => i.group_num !== ind.group_num);
        const updated = newGroup.map((item, i) => ({ ...item, sort_order: i }));
        return [...others, ...updated];
      });

      try {
        await riskIndicatorConfigApi.reorder(reorderedIds);
      } catch {
        toast({
          title: "Алдаа",
          description: "Дараалал өөрчлөхөд алдаа гарлаа.",
          variant: "destructive",
        });
        await loadIndicators(); // Revert to server state
      }
    },
    [indicators, toast, loadIndicators],
  );

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
      <div className="max-w-[1280px] mx-auto px-5 py-6">
        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-base font-semibold text-foreground">
            Эрсдэлийн үзүүлэлт
          </h1>
          {!loading && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Нийт {indicators.length} · Нийт жин{" "}
              <span
                className={
                  Math.abs(totalAllWeight - 100) > 0.01
                    ? "text-amber-400"
                    : "text-emerald-400"
                }
              >
                {totalAllWeight}%
                {Math.abs(totalAllWeight - 100) > 0.01 ? " ⚠" : " ✓"}
              </span>
            </p>
          )}
        </div>

        <Tabs defaultValue="indicators">
          <TabsList className="bg-foreground/5 border border-border/40 rounded-xl p-1 gap-0.5 mb-5">
            <TabsTrigger
              value="indicators"
              className="text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-foreground/10 rounded-lg text-sm px-4 h-8 transition-all"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Үзүүлэлтүүд
            </TabsTrigger>
            <TabsTrigger
              value="holds"
              className="text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-foreground/10 rounded-lg text-sm px-4 h-8 transition-all"
            >
              <PauseCircle className="w-3.5 h-3.5 mr-1.5" />
              Сарын hold
              {heldIds.size > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                  {heldIds.size}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Indicators ───────────────────────────────────── */}
          <TabsContent value="indicators" className="mt-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Хайх... (нэр, subid)"
                  className="pl-9 h-9 bg-foreground/5 border-border/40 text-foreground/80 placeholder:text-muted-foreground/50 text-sm rounded-xl"
                />
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={openCreate}
                className="bg-blue-600 hover:bg-blue-500 text-foreground gap-1.5 text-xs rounded-xl h-9 font-medium px-4"
              >
                <Plus className="w-3.5 h-3.5" /> Нэмэх
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/30" />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGrouped.map(({ group, rows, totalWeight }) => {
                  const accent = GROUP_ACCENT[group];
                  return (
                    <div
                      key={group}
                      className={`rounded-xl border ${accent.ring} ring-1 overflow-hidden bg-card`}
                    >
                      {/* Group header */}
                      <div
                        className={`px-4 py-2.5 border-b border-border/20 flex items-center justify-between ${accent.bg}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.bg} ${accent.text} ring-1 ${accent.ring}`}
                          >
                            {GROUP_SHORT[group]}
                          </span>
                          <span
                            className={`text-[13px] font-semibold ${accent.text}`}
                          >
                            {GROUP_LABELS[group]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground/50">
                            {rows.length} үзүүлэлт
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${accent.bg} ${accent.text}`}
                          >
                            {totalWeight}%
                          </span>
                        </div>
                      </div>

                      {/* Indicator rows */}
                      <div className="divide-y divide-border/15">
                        {rows.map((ind, rowIdx) => {
                          const scaleObj = parseScale(ind.score_scale);
                          const badgeClass =
                            SCALE_TYPE_BADGE_CLASS[scaleObj.type] ??
                            SCALE_TYPE_BADGE_CLASS.manual;
                          return (
                            <div
                              key={ind.id}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-foreground/[0.02] transition-colors group"
                            >
                              {/* Reorder arrows */}
                              <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  disabled={rowIdx === 0}
                                  onClick={() => move(ind, -1)}
                                  className="text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20 transition-colors"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={rowIdx === rows.length - 1}
                                  onClick={() => move(ind, 1)}
                                  className="text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20 transition-colors"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* SubID */}
                              <code
                                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded shrink-0 ${accent.bg} ${accent.text}`}
                              >
                                {ind.subid}
                              </code>

                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground truncate">
                                  {ind.name}
                                </p>
                                {ind.hint && (
                                  <p className="text-[11px] text-muted-foreground/40 truncate">
                                    {ind.hint}
                                  </p>
                                )}
                              </div>

                              {/* Scale type */}
                              <Badge
                                className={`text-[10px] border px-1.5 py-0.5 rounded font-medium shrink-0 ${badgeClass}`}
                              >
                                {SCALE_TYPE_LABELS[scaleObj.type] ??
                                  scaleObj.type}
                              </Badge>

                              {/* Weight */}
                              <div className="w-12 text-right shrink-0">
                                <span className="text-sm font-semibold text-foreground/80">
                                  {ind.weight}
                                </span>
                                <span className="text-[11px] text-muted-foreground/40 ml-0.5">
                                  %
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEdit(ind)}
                                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(ind.id)}
                                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {indicators.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border border-border/30">
                    <BarChart3 className="w-8 h-8 text-muted-foreground/20" />
                    <div className="text-center">
                      <p className="text-muted-foreground text-sm">
                        Үзүүлэлт олдсонгүй
                      </p>
                      <p className="text-muted-foreground/40 text-xs mt-1">
                        «Нэмэх» товчоор шинэ үзүүлэлт нэмнэ үү
                      </p>
                    </div>
                  </div>
                )}

                {indicators.length > 0 && filteredGrouped.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Search className="w-5 h-5 text-muted-foreground/20" />
                    <p className="text-muted-foreground/50 text-sm">
                      «{search}» хайлтад тохирсон үзүүлэлт олдсонгүй
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Holds ────────────────────────────────────────── */}
          <TabsContent value="holds" className="mt-0">
            <div className="flex items-center justify-between mb-4 gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Сарын үзүүлэлт hold
                </p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">
                  Hold хийгдсэн үзүүлэлт тухайн сарын тооцооноос хасагдаж,
                  үлдсэн жин харьцангуйгаар тооцогдоно.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {holdsLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/40" />
                )}
                <input
                  type="month"
                  value={holdsPeriod}
                  onChange={(e) => setHoldsPeriod(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-foreground/5 border border-border/40 text-foreground/80 text-sm focus:border-border/60 focus:outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/30" />
              </div>
            ) : (
              <div className="space-y-2">
                {([1, 2, 3, 4, 5] as const).map((grp) => {
                  const grpInds = indicators.filter(
                    (ind) => ind.group_num === grp,
                  );
                  if (grpInds.length === 0) return null;
                  const accent = GROUP_ACCENT[grp];
                  const heldCount = grpInds.filter((ind) =>
                    heldIds.has(ind.id),
                  ).length;
                  return (
                    <div
                      key={grp}
                      className={`rounded-xl border ${accent.ring} ring-1 overflow-hidden bg-card`}
                    >
                      <div
                        className={`px-4 py-2.5 border-b border-border/20 flex items-center gap-2 ${accent.bg}`}
                      >
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.bg} ${accent.text} ring-1 ${accent.ring}`}
                        >
                          {GROUP_SHORT[grp]}
                        </span>
                        <span className={`text-sm font-medium ${accent.text}`}>
                          {GROUP_LABELS[grp]}
                        </span>
                        {heldCount > 0 && (
                          <span className="ml-auto text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {heldCount} hold
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-3 flex flex-wrap gap-2">
                        {grpInds.map((ind) => {
                          const held = heldIds.has(ind.id);
                          return (
                            <button
                              key={ind.id}
                              onClick={() => toggleHold(ind.id)}
                              title={ind.hint ?? ind.name}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                held
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 line-through"
                                  : "bg-foreground/[0.03] border-border/40 text-foreground/80 hover:border-border/60 hover:bg-foreground/[0.05]"
                              }`}
                            >
                              {held && (
                                <PauseCircle className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                              <span>{ind.name}</span>
                              <span className="opacity-40 text-[10px]">
                                {ind.weight}%
                              </span>
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
        </Tabs>
      </div>

      {/* ── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="bg-card border-border/40 text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              {editingId ? "Үзүүлэлт засах" : "Шинэ үзүүлэлт"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  SubID <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.subid}
                  onChange={(e) =>
                    !editingId && setForm({ ...form, subid: e.target.value })
                  }
                  readOnly={!!editingId}
                  placeholder="UB1.1"
                  className={`h-9 rounded-xl border-border/50 placeholder:text-muted-foreground/40 ${
                    editingId
                      ? "bg-foreground/[0.03] text-muted-foreground/50 cursor-default select-none"
                      : "bg-foreground/5 text-foreground"
                  }`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  Нэр <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Үзүүлэлтийн нэр"
                  className="bg-foreground/5 border-border/50 text-foreground placeholder:text-muted-foreground/40 h-9 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Бүлэг</Label>
                <Select
                  value={String(form.group_num)}
                  onValueChange={(v) =>
                    setForm({ ...form, group_num: Number(v) })
                  }
                >
                  <SelectTrigger className="bg-foreground/5 border-border/50 text-foreground/80 h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {[1, 2, 3, 4, 5].map((g) => {
                      const accent = GROUP_ACCENT[g];
                      return (
                        <SelectItem
                          key={g}
                          value={String(g)}
                          className="text-foreground/80 focus:bg-foreground/8"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold ${accent.bg} ${accent.text}`}
                            >
                              {GROUP_SHORT[g]}
                            </span>
                            {GROUP_LABELS[g]}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Жин %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.weight}
                  onChange={(e) =>
                    setForm({ ...form, weight: Number(e.target.value) })
                  }
                  className="bg-foreground/5 border-border/50 text-foreground h-9 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Тайлбар / Hint
              </Label>
              <Input
                value={form.hint}
                onChange={(e) => setForm({ ...form, hint: e.target.value })}
                placeholder="Нэмэлт тайлбар..."
                className="bg-foreground/5 border-border/50 text-foreground placeholder:text-muted-foreground/40 h-9 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={closeDialog}
              disabled={saving}
              className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-xl hover:bg-foreground/5 transition-colors font-medium"
            >
              Болих
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-foreground/8 disabled:text-muted-foreground/50 text-foreground rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? "Хадгалах" : "Нэмэх"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-card border-border/40 text-foreground max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <AlertDialogTitle className="text-foreground text-center">
              Үзүүлэлт устгах
            </AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-muted-foreground text-sm text-center pb-2">
            Устгахдаа итгэлтэй байна уу?{" "}
            <span className="text-red-400/70">Буцаах боломжгүй.</span>
          </p>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="flex-1 bg-transparent border-border/50 text-foreground/80 hover:bg-foreground/5 hover:text-foreground rounded-xl">
              Болих
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-500 hover:bg-red-400 text-foreground border-0 rounded-xl font-semibold"
            >
              {deleting && (
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
