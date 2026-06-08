"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  X,
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

// ── Scale Editor Components ───────────────────────────────────────────────────

const SCORE_BADGE: Record<number, string> = {
  1: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  2: "bg-lime-500/15 text-lime-500 border-lime-500/30",
  3: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  4: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  5: "bg-red-500/15 text-red-400 border-red-500/30",
  0: "bg-muted/20 text-muted-foreground/50 border-border/30",
};

const SCORE_SELECT_OPTIONS = [
  { value: 1, label: "1 – Маш сайн" },
  { value: 2, label: "2 – Сайн" },
  { value: 3, label: "3 – Дунд" },
  { value: 4, label: "4 – Хангалтгүй" },
  { value: 5, label: "5 – Муу" },
  { value: 0, label: "Ү – Үнэлэхгүй" },
];

function NumericRulesSection({
  rules,
  onChange,
}: {
  rules: ScoreScaleRule[];
  onChange: (r: ScoreScaleRule[]) => void;
}) {
  const update = (i: number, patch: Partial<ScoreScaleRule>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...rules,
      { min: undefined, max: undefined, score: 3, label: "" },
    ]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/80">
          Тоон дүрмүүд
        </span>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Нэмэх
        </button>
      </div>
      {rules.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/30 text-center py-4 border border-dashed border-border/20 rounded-xl">
          Дүрэм байхгүй — «Нэмэх» дараарай
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[68px_68px_112px_1fr_28px] gap-1.5 px-1">
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Min
            </span>
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Max
            </span>
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Оноо
            </span>
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Тайлбар
            </span>
            <span />
          </div>
          {rules.map((rule, i) => (
            <div
              key={i}
              className="grid grid-cols-[68px_68px_112px_1fr_28px] gap-1.5 items-center group"
            >
              <Input
                type="number"
                value={rule.min ?? ""}
                onChange={(e) =>
                  update(i, {
                    min:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
                placeholder="—"
                className="h-7 text-xs rounded-lg bg-foreground/5 border-border/40 text-foreground/80 placeholder:text-muted-foreground/20 px-2"
              />
              <Input
                type="number"
                value={rule.max ?? ""}
                onChange={(e) =>
                  update(i, {
                    max:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
                placeholder="—"
                className="h-7 text-xs rounded-lg bg-foreground/5 border-border/40 text-foreground/80 placeholder:text-muted-foreground/20 px-2"
              />
              <select
                value={rule.score}
                onChange={(e) => update(i, { score: Number(e.target.value) })}
                className={`h-7 text-xs rounded-lg border px-2 font-medium ${
                  SCORE_BADGE[rule.score] ??
                  "bg-foreground/5 border-border/40 text-foreground/80"
                }`}
              >
                {SCORE_SELECT_OPTIONS.map((o) => (
                  <option
                    key={o.value}
                    value={o.value}
                    className="bg-background text-foreground"
                  >
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                value={rule.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Тайлбар..."
                className="h-7 text-xs rounded-lg bg-foreground/5 border-border/40 text-foreground/80 placeholder:text-muted-foreground/20"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StringRulesSection({
  rules,
  onChange,
}: {
  rules: ScoreScaleRule[];
  onChange: (r: ScoreScaleRule[]) => void;
}) {
  const update = (i: number, patch: Partial<ScoreScaleRule>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...rules,
      { matchType: "exact" as const, values: [], score: 3, label: "" },
    ]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
          Мөр дүрмүүд
        </span>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Нэмэх
        </button>
      </div>
      {rules.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/30 text-center py-4 border border-dashed border-border/20 rounded-xl">
          Дүрэм байхгүй — «Нэмэх» дараарай
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/30 bg-foreground/[0.02] p-2.5 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <select
                  value={rule.matchType ?? "exact"}
                  onChange={(e) =>
                    update(i, {
                      matchType: e.target.value as "exact" | "contains",
                    })
                  }
                  className="h-7 flex-1 text-xs rounded-lg bg-foreground/5 border border-border/40 text-foreground/80 px-2"
                >
                  <option value="exact" className="bg-background">
                    Яг тохирно
                  </option>
                  <option value="contains" className="bg-background">
                    Агуулна
                  </option>
                </select>
                <select
                  value={rule.score}
                  onChange={(e) => update(i, { score: Number(e.target.value) })}
                  className={`h-7 w-[132px] text-xs rounded-lg border px-2 font-medium ${
                    SCORE_BADGE[rule.score] ??
                    "bg-foreground/5 border-border/40 text-foreground/80"
                  }`}
                >
                  {SCORE_SELECT_OPTIONS.map((o) => (
                    <option
                      key={o.value}
                      value={o.value}
                      className="bg-background text-foreground"
                    >
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <Input
                value={(rule.values ?? []).join(", ")}
                onChange={(e) => {
                  const vals = e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                  update(i, { values: vals });
                }}
                placeholder="утга1, утга2, ..."
                className="h-7 text-xs rounded-lg bg-foreground/5 border-border/40 text-foreground/70 placeholder:text-muted-foreground/30"
              />
              <Input
                value={rule.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Тайлбар..."
                className="h-7 text-xs rounded-lg bg-foreground/5 border-border/40 text-foreground/70 placeholder:text-muted-foreground/30"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScaleEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (json: string) => void;
}) {
  const [scale, setScale] = useState<ScoreScale>(() => parseScale(value));
  const isMounted = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Fire onChange only on user edits, not on initial mount
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    onChangeRef.current(JSON.stringify(scale));
  }, [scale]);

  // Always read from numericRules/stringRules; fall back to legacy rules field
  const numericRules = scale.numericRules ?? scale.rules ?? [];
  const stringRules =
    scale.stringRules ?? (scale.type === "string" ? scale.rules : []) ?? [];

  const setNumericRules = (rules: ScoreScaleRule[]) =>
    setScale((s) => {
      const next: ScoreScale = { ...s, numericRules: rules };
      delete (next as unknown as Record<string, unknown>).rules;
      return next;
    });

  const setStringRules = (rules: ScoreScaleRule[]) =>
    setScale((s) => {
      const next: ScoreScale = { ...s, stringRules: rules };
      delete (next as unknown as Record<string, unknown>).rules;
      return next;
    });

  return (
    <div className="space-y-3">
      {/* ── Type selector ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">
          Оноо тооцоолох арга
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {(["numeric", "string", "both"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setScale((s) => ({ ...s, type: t }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                scale.type === t
                  ? (SCALE_TYPE_BADGE_CLASS[t] ??
                    "bg-foreground/10 text-foreground border-border/50")
                  : "border-border/30 text-muted-foreground/50 hover:border-border/50 hover:text-foreground/70 bg-transparent"
              }`}
            >
              {SCALE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── null_is_unelehgui toggle ────────────────────────────────────── */}
      <label className="flex items-center gap-2.5 cursor-pointer w-fit select-none">
        <button
          type="button"
          role="switch"
          aria-checked={!!scale.null_is_unelehgui}
          onClick={() =>
            setScale((s) => ({
              ...s,
              null_is_unelehgui: !s.null_is_unelehgui,
            }))
          }
          className={`relative w-9 h-5 rounded-full border transition-all shrink-0 ${
            scale.null_is_unelehgui
              ? "bg-sky-500/30 border-sky-500/50"
              : "bg-foreground/5 border-border/40"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm ${
              scale.null_is_unelehgui
                ? "left-[18px] bg-sky-400"
                : "left-0.5 bg-foreground/30"
            }`}
          />
        </button>
        <span className="text-[11px] text-muted-foreground/60">
          Хоосон утга →{" "}
          <span className="text-sky-400/80 font-medium">"Үнэлэхгүй"</span>
          <span className="text-muted-foreground/40 ml-1">(жин хасагдана)</span>
        </span>
      </label>

      {/* ── Rules ──────────────────────────────────────────────────────── */}
      {scale.type === "numeric" && (
        <NumericRulesSection rules={numericRules} onChange={setNumericRules} />
      )}
      {scale.type === "string" && (
        <StringRulesSection rules={stringRules} onChange={setStringRules} />
      )}
      {scale.type === "both" && (
        <div className="space-y-3">
          <NumericRulesSection
            rules={numericRules}
            onChange={setNumericRules}
          />
          <div className="border-t border-border/20" />
          <StringRulesSection rules={stringRules} onChange={setStringRules} />
        </div>
      )}
    </div>
  );
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

  // Settings — history management
  const [historyList, setHistoryList] = useState<{ id: string; name: string; pDate: string; createdAt: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeleteTarget, setHistoryDeleteTarget] = useState<string | null>(null);
  const [historyDeleting, setHistoryDeleting] = useState(false);

  // Load history when settings tab is opened (lazy)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await riskApi.listHistory();
      setHistoryList(data || []);
    } catch {}
    finally { setHistoryLoading(false); }
  }, []);

  const doDeleteReportHistory = useCallback(async (id: string) => {
    setHistoryDeleting(true);
    try {
      await riskApi.deleteHistory(id);
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
    } catch {}
    finally { setHistoryDeleting(false); setHistoryDeleteTarget(null); }
  }, []);

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
              Hold
              {heldIds.size > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                  {heldIds.size}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              onClick={loadHistory}
              className="text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-foreground/10 rounded-lg text-sm px-4 h-8 transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Тайлангууд устгах
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
            {/* Header bar */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                  Hold хийсэн үзүүлэлт тухайн сарын тооцооноос хасагдаж, үлдсэн
                  жин харьцангуйгаар тооцогдоно.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {holdsLoading && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/30" />
                )}
                <input
                  type="month"
                  value={holdsPeriod}
                  onChange={(e) => setHoldsPeriod(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-foreground/5 border border-border/40 text-foreground/70 text-sm focus:border-border/60 focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Summary pill */}
            {heldIds.size > 0 && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[12px] text-amber-300/90">
                  <strong className="font-semibold">{heldIds.size}</strong>{" "}
                  үзүүлэлт hold хийгдсэн байна — тооцооноос хасагдана.
                </span>
                <button
                  onClick={() => {
                    [...heldIds].forEach((id) => toggleHold(id));
                  }}
                  className="ml-auto text-[11px] text-amber-400/60 hover:text-amber-400 transition-colors"
                >
                  Бүгдийг цуцлах
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/20" />
              </div>
            ) : (
              <div className="space-y-1.5">
                {([1, 2, 3, 4, 5] as const).map((grp) => {
                  const grpInds = indicators
                    .filter((ind) => ind.group_num === grp)
                    .sort((a, b) => a.sort_order - b.sort_order);
                  if (grpInds.length === 0) return null;
                  const accent = GROUP_ACCENT[grp];
                  const heldCount = grpInds.filter((ind) =>
                    heldIds.has(ind.id),
                  ).length;

                  return (
                    <div
                      key={grp}
                      className="rounded-xl border border-border/30 bg-card overflow-hidden"
                    >
                      {/* Group label row */}
                      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border/15 bg-foreground/[0.015]">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.bg} ${accent.text}`}
                        >
                          {GROUP_SHORT[grp]}
                        </span>
                        <span className="text-[12px] font-medium text-foreground/60">
                          {GROUP_LABELS[grp]}
                        </span>
                        <span className="text-[11px] text-muted-foreground/30 ml-auto tabular-nums">
                          {grpInds.length} үзүүлэлт
                          {heldCount > 0 && (
                            <span className="ml-2 text-amber-400/80 font-semibold">
                              · {heldCount} hold
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Indicator toggle rows */}
                      <div className="divide-y divide-border/10">
                        {grpInds.map((ind) => {
                          const held = heldIds.has(ind.id);
                          return (
                            <button
                              key={ind.id}
                              onClick={() => toggleHold(ind.id)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                held
                                  ? "bg-amber-500/5 hover:bg-amber-500/8"
                                  : "hover:bg-foreground/[0.02]"
                              }`}
                            >
                              {/* Toggle indicator */}
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  held
                                    ? "bg-amber-500/20 border-amber-500/40"
                                    : "border-border/40 bg-transparent"
                                }`}
                              >
                                {held && (
                                  <PauseCircle className="w-2.5 h-2.5 text-amber-400" />
                                )}
                              </span>

                              {/* subid */}
                              <code
                                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 ${accent.bg} ${accent.text}`}
                              >
                                {ind.subid}
                              </code>

                              {/* name */}
                              <span
                                className={`flex-1 text-[12px] min-w-0 truncate transition-colors ${
                                  held
                                    ? "text-amber-300/70 line-through"
                                    : "text-foreground/75"
                                }`}
                              >
                                {ind.name}
                              </span>

                              {/* weight */}
                              <span
                                className={`text-[11px] tabular-nums shrink-0 ${
                                  held
                                    ? "text-amber-400/50"
                                    : "text-muted-foreground/30"
                                }`}
                              >
                                {ind.weight}%
                              </span>

                              {/* hold label */}
                              {held && (
                                <span className="text-[10px] font-semibold text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
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

          {/* ── Tab 3: Report History Management ──────────────────── */}
          <TabsContent value="settings" className="mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Хадгалсан тайлангуудын жагсаалт</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Тайлан бүрийг энд устгаж болно.</p>
                </div>
                <Button size="sm" variant="outline" onClick={loadHistory} disabled={historyLoading} className="gap-1.5">
                  {historyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Loader2 className="w-3.5 h-3.5 opacity-0" />}
                  Шинэчлэх
                </Button>
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Уншиж байна…</span>
                </div>
              ) : historyList.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/20 py-12 text-center">
                  <p className="text-sm text-muted-foreground">Хадгалсан тайлан байхгүй байна</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="px-4 py-2.5 text-left font-bold text-[11px] text-muted-foreground uppercase tracking-wide">Нэр</th>
                        <th className="px-4 py-2.5 text-left font-bold text-[11px] text-muted-foreground uppercase tracking-wide">Огноо</th>
                        <th className="px-4 py-2.5 text-left font-bold text-[11px] text-muted-foreground uppercase tracking-wide">Хадгалсан</th>
                        <th className="px-3 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {historyList.map((h, i) => (
                        <tr key={h.id} className={`border-b border-border/50 last:border-b-0 ${i % 2 === 1 ? "bg-muted/10" : ""} hover:bg-muted/20 transition-colors`}>
                          <td className="px-4 py-2.5 font-medium text-foreground">{h.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{h.pDate}</td>
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{h.createdAt?.slice(0, 10) ?? "—"}</td>
                          <td className="px-3 py-2">
                            {historyDeleteTarget === h.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => doDeleteReportHistory(h.id)}
                                  disabled={historyDeleting}
                                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold disabled:opacity-50"
                                >
                                  {historyDeleting ? "..." : "Тийм"}
                                </button>
                                <button
                                  onClick={() => setHistoryDeleteTarget(null)}
                                  className="px-2 py-1 rounded border border-border text-[10px] hover:bg-muted/40"
                                >
                                  Болих
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setHistoryDeleteTarget(h.id)}
                                className="p-1.5 rounded border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors"
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
            </div>
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

            {/* Scale editor */}
            <div className="pt-1 border-t border-border/20 space-y-2.5">
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
