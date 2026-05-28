"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  riskIndicatorConfigApi,
  riskApi,
  type IndicatorConfig,
  type GroupConfig,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Search,
  BarChart3,
  Layers,
  Zap,
  Hand,
  AlertTriangle,
  CheckCircle2,
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
  type: "numeric" | "string" | "both" | "manual" | "no_score";
  rules?: ScoreScaleRule[];
  numericRules?: ScoreScaleRule[];
  stringRules?: ScoreScaleRule[];
  min?: number;
  max?: number;
  step?: number;
}

// ── Helpers / constants ───────────────────────────────────────────────────────

const GROUP_LABELS: Record<number, string> = {
  1: "Score 1 – Санхүүгийн эрсдэл",
  2: "Score 2 – Хүний эрсдэл",
  3: "Score 3 – Дотоод хяналт",
  4: "Score 4 – Бусад",
  5: "Judgement Score – Аудиторын үнэлэмж",
};
const GROUP_SHORT: Record<number, string> = {
  1: "S1",
  2: "S2",
  3: "S3",
  4: "S4",
  5: "J",
};

// per-group accent colors  (bg ring text)
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
  no_score: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const DEFAULT_SCALE: ScoreScale = { type: "manual", min: 1, max: 5, step: 1 };

function parseScale(raw: string): ScoreScale {
  try {
    return JSON.parse(raw) as ScoreScale;
  } catch {
    return { ...DEFAULT_SCALE };
  }
}

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

const EMPTY_NUM_RULE: ScoreScaleRule = {
  min: null,
  max: null,
  score: 1,
  label: "",
};
const EMPTY_STR_RULE: ScoreScaleRule = {
  matchType: "exact",
  values: [],
  score: 1,
  label: "",
};

// ── Score Scale Sub-components ────────────────────────────────────────────────

const SCORE_CHIP_STYLE: Record<
  number,
  { active: string; inactive: string; card: string }
> = {
  0: {
    active: "bg-slate-700 text-slate-200 ring-slate-500 shadow-sm",
    inactive:
      "bg-slate-900/60 text-slate-600 ring-slate-800 hover:text-slate-400 hover:bg-slate-800/60",
    card: "border-slate-800/80 bg-slate-900/20",
  },
  1: {
    active: "bg-emerald-800/90 text-emerald-200 ring-emerald-600/80 shadow-sm",
    inactive:
      "bg-slate-900/60 text-slate-600 ring-slate-800 hover:text-emerald-500 hover:bg-emerald-950/60",
    card: "border-emerald-800/40 bg-emerald-950/20",
  },
  2: {
    active: "bg-lime-800/90 text-lime-200 ring-lime-600/80 shadow-sm",
    inactive:
      "bg-slate-900/60 text-slate-600 ring-slate-800 hover:text-lime-500 hover:bg-lime-950/60",
    card: "border-lime-800/40 bg-lime-950/20",
  },
  3: {
    active: "bg-amber-800/90 text-amber-200 ring-amber-600/80 shadow-sm",
    inactive:
      "bg-slate-900/60 text-slate-600 ring-slate-800 hover:text-amber-500 hover:bg-amber-950/60",
    card: "border-amber-800/40 bg-amber-950/20",
  },
  4: {
    active: "bg-orange-800/90 text-orange-200 ring-orange-600/80 shadow-sm",
    inactive:
      "bg-slate-900/60 text-slate-600 ring-slate-800 hover:text-orange-500 hover:bg-orange-950/60",
    card: "border-orange-800/40 bg-orange-950/20",
  },
  5: {
    active: "bg-red-800/90 text-red-200 ring-red-600/80 shadow-sm",
    inactive:
      "bg-slate-900/60 text-slate-600 ring-slate-800 hover:text-red-500 hover:bg-red-950/60",
    card: "border-red-800/40 bg-red-950/20",
  },
};

const SCALE_TYPE_CONFIG: Record<
  ScoreScale["type"],
  { activeClass: string; inactiveClass: string; dot: string }
> = {
  numeric: {
    activeClass:
      "bg-sky-500/20 text-sky-300 border-sky-500/50 ring-1 ring-sky-500/30",
    inactiveClass:
      "bg-transparent text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600",
    dot: "bg-sky-400",
  },
  string: {
    activeClass:
      "bg-violet-500/20 text-violet-300 border-violet-500/50 ring-1 ring-violet-500/30",
    inactiveClass:
      "bg-transparent text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600",
    dot: "bg-violet-400",
  },
  both: {
    activeClass:
      "bg-indigo-500/20 text-indigo-300 border-indigo-500/50 ring-1 ring-indigo-500/30",
    inactiveClass:
      "bg-transparent text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600",
    dot: "bg-indigo-400",
  },
  manual: {
    activeClass:
      "bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/30",
    inactiveClass:
      "bg-transparent text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600",
    dot: "bg-amber-400",
  },
  no_score: {
    activeClass:
      "bg-slate-700/40 text-slate-300 border-slate-600/60 ring-1 ring-slate-600/30",
    inactiveClass:
      "bg-transparent text-slate-600 border-slate-800 hover:text-slate-400 hover:border-slate-700",
    dot: "bg-slate-500",
  },
};

function ScoreInlinePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const LABELS = [
    "Үнэлэхгүй",
    "Бага",
    "Дундаас бага",
    "Дунд",
    "Дундаас их",
    "Өндөр",
  ];
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3, 4, 5].map((s) => {
        const style = SCORE_CHIP_STYLE[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            title={`${s} – ${LABELS[s]}`}
            className={`w-7 h-7 rounded-md text-[11px] font-bold transition-all ring-1 ${value === s ? style.active : style.inactive}`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

function NumericRulesEditor({
  rules,
  onChange,
}: {
  rules: ScoreScaleRule[];
  onChange: (r: ScoreScaleRule[]) => void;
}) {
  const update = (i: number, patch: Partial<ScoreScaleRule>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {rules.map((rule, i) => {
        const style = SCORE_CHIP_STYLE[rule.score];
        return (
          <div
            key={i}
            className={`rounded-xl border p-3 transition-colors ${style.card}`}
          >
            <div className="flex items-start gap-3">
              <div className="space-y-1.5 shrink-0">
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                  Оноо
                </p>
                <ScoreInlinePicker
                  value={rule.score}
                  onChange={(v) => update(i, { score: v })}
                />
              </div>
              <div className="flex items-end gap-2 flex-1">
                <div className="flex-1 space-y-1.5">
                  <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                    Доод хязгаар
                  </p>
                  <Input
                    value={rule.min ?? ""}
                    type="number"
                    onChange={(e) =>
                      update(i, {
                        min:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="–∞"
                    className="h-7 bg-slate-900/80 border-slate-700 text-slate-300 text-xs px-2"
                  />
                </div>
                <span className="text-slate-700 pb-1.5 text-sm">–</span>
                <div className="flex-1 space-y-1.5">
                  <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                    Дээд хязгаар
                  </p>
                  <Input
                    value={rule.max ?? ""}
                    type="number"
                    onChange={(e) =>
                      update(i, {
                        max:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="∞"
                    className="h-7 bg-slate-900/80 border-slate-700 text-slate-300 text-xs px-2"
                  />
                </div>
              </div>
              <div className="flex-[2] space-y-1.5">
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                  Нэршил
                </p>
                <Input
                  value={rule.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Тайлбар..."
                  className="h-7 bg-slate-900/80 border-slate-700 text-slate-300 text-xs px-2"
                />
              </div>
              <button
                onClick={() => remove(i)}
                className="mt-6 p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
      <button
        onClick={() => onChange([...rules, { ...EMPTY_NUM_RULE }])}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-700/60 text-[11px] text-slate-600 hover:text-sky-400 hover:border-sky-700/50 hover:bg-sky-500/5 transition-all"
      >
        <Plus className="w-3.5 h-3.5" /> Дүрэм нэмэх
      </button>
    </div>
  );
}

function StringRulesEditor({
  rules,
  onChange,
}: {
  rules: ScoreScaleRule[];
  onChange: (r: ScoreScaleRule[]) => void;
}) {
  const update = (i: number, patch: Partial<ScoreScaleRule>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {rules.map((rule, i) => {
        const style = SCORE_CHIP_STYLE[rule.score];
        const mt = rule.matchType ?? "exact";
        return (
          <div
            key={i}
            className={`rounded-xl border p-3 transition-colors ${style.card}`}
          >
            <div className="flex items-start gap-3">
              <div className="space-y-1.5 shrink-0">
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                  Оноо
                </p>
                <ScoreInlinePicker
                  value={rule.score}
                  onChange={(v) => update(i, { score: v })}
                />
              </div>
              <div className="flex-[2] space-y-2">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                    Тохирох
                  </p>
                  <div className="flex rounded-lg border border-slate-700/60 overflow-hidden w-fit">
                    {(["exact", "contains"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => update(i, { matchType: t })}
                        className={`px-3 py-1.5 text-[10px] font-semibold border-r last:border-r-0 border-slate-700/60 transition-all ${
                          mt === t
                            ? "bg-slate-700 text-slate-200"
                            : "bg-transparent text-slate-600 hover:text-slate-300 hover:bg-slate-800/40"
                        }`}
                      >
                        {t === "exact" ? "Яг таарах" : "Агуулсан"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                    Утгууд (таслалаар тусгаарлана)
                  </p>
                  <Input
                    value={(rule.values ?? []).join(", ")}
                    onChange={(e) =>
                      update(i, {
                        values: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="A, B, C"
                    className="h-7 bg-slate-900/80 border-slate-700 text-slate-300 text-xs px-2"
                  />
                </div>
              </div>
              <div className="flex-[2] space-y-1.5">
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
                  Нэршил
                </p>
                <Input
                  value={rule.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Тайлбар..."
                  className="h-7 bg-slate-900/80 border-slate-700 text-slate-300 text-xs px-2"
                />
              </div>
              <button
                onClick={() => remove(i)}
                className="mt-6 p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
      <button
        onClick={() => onChange([...rules, { ...EMPTY_STR_RULE }])}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-700/60 text-[11px] text-slate-600 hover:text-violet-400 hover:border-violet-700/50 hover:bg-violet-500/5 transition-all"
      >
        <Plus className="w-3.5 h-3.5" /> Дүрэм нэмэх
      </button>
    </div>
  );
}

function ScoreScaleEditor({
  scale,
  onChange,
}: {
  scale: ScoreScale;
  onChange: (s: ScoreScale) => void;
}) {
  const setType = (type: ScoreScale["type"]) => {
    const base: ScoreScale = { type };
    if (type === "numeric") base.rules = [];
    else if (type === "string") base.rules = [];
    else if (type === "both") {
      base.numericRules = [];
      base.stringRules = [];
    } else if (type === "manual") {
      base.min = 1;
      base.max = 5;
      base.step = 1;
    }
    onChange(base);
  };
  return (
    <div className="space-y-4">
      {/* Type selector — pill buttons */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Оноолох хэлбэр
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(["numeric", "string", "both", "manual", "no_score"] as const).map(
            (t) => {
              const cfg = SCALE_TYPE_CONFIG[t];
              const isActive = scale.type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${isActive ? cfg.activeClass : cfg.inactiveClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {SCALE_TYPE_LABELS[t]}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Numeric rules */}
      {scale.type === "numeric" && (
        <div className="rounded-xl border border-sky-500/20 p-4 bg-sky-500/5">
          <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Тоон
            дүрмүүд
          </p>
          <NumericRulesEditor
            rules={scale.rules ?? []}
            onChange={(r) => onChange({ ...scale, rules: r })}
          />
        </div>
      )}

      {/* String rules */}
      {scale.type === "string" && (
        <div className="rounded-xl border border-violet-500/20 p-4 bg-violet-500/5">
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Мөр
            дүрмүүд
          </p>
          <StringRulesEditor
            rules={scale.rules ?? []}
            onChange={(r) => onChange({ ...scale, rules: r })}
          />
        </div>
      )}

      {/* Both: numeric + string */}
      {scale.type === "both" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-sky-500/20 p-4 bg-sky-500/5">
            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Тоон
              дүрмүүд
            </p>
            <NumericRulesEditor
              rules={scale.numericRules ?? []}
              onChange={(r) => onChange({ ...scale, numericRules: r })}
            />
          </div>
          <div className="rounded-xl border border-violet-500/20 p-4 bg-violet-500/5">
            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Мөр
              дүрмүүд
            </p>
            <StringRulesEditor
              rules={scale.stringRules ?? []}
              onChange={(r) => onChange({ ...scale, stringRules: r })}
            />
          </div>
        </div>
      )}

      {/* Manual: min/max/step with preview */}
      {scale.type === "manual" && (
        <div className="rounded-xl border border-amber-500/20 p-4 bg-amber-500/5">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Гараар
            оруулах хязгаар
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(["min", "max", "step"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <Label className="text-slate-500 text-[10px] uppercase tracking-widest">
                  {field === "min"
                    ? "Хамгийн бага"
                    : field === "max"
                      ? "Хамгийн их"
                      : "Алхам"}
                </Label>
                <Input
                  type="number"
                  value={scale[field] ?? ""}
                  onChange={(e) =>
                    onChange({ ...scale, [field]: Number(e.target.value) })
                  }
                  className="h-8 bg-slate-900/80 border-slate-700 text-slate-300 text-sm"
                />
              </div>
            ))}
          </div>
          {scale.min != null &&
            scale.max != null &&
            scale.step != null &&
            scale.step > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-600">Сонголтууд:</span>
                {Array.from({
                  length: Math.min(
                    20,
                    Math.round((scale.max - scale.min) / scale.step) + 1,
                  ),
                }).map((_, i) => {
                  const v = scale.min! + i * scale.step!;
                  return (
                    <span
                      key={i}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-500/15 text-amber-400 font-bold text-[10px] border border-amber-500/20"
                    >
                      {v % 1 === 0 ? v : v.toFixed(1)}
                    </span>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* No score */}
      {scale.type === "no_score" && (
        <div className="flex items-center gap-3 py-3.5 px-4 bg-slate-900/50 rounded-xl border border-slate-800">
          <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-400">
              Оноо тооцохгүй
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Энэ үзүүлэлт жинд орохгүй — зөвхөн мэдээлэл харуулах зориулалттай.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Group Weight Cell ─────────────────────────────────────────────────────────

function GroupWeightCell({
  region,
  groupNum,
  configs,
  saving,
  onSave,
}: {
  region: string;
  groupNum: number;
  configs: GroupConfig[];
  saving: string | null;
  onSave: (
    region: string,
    groupNum: number,
    weight: number,
    label: string,
  ) => void;
}) {
  const cfg = configs.find(
    (c) => c.region === region && c.group_num === groupNum,
  );
  const [val, setVal] = useState(String(cfg?.weight ?? 0));
  const key = `${region}-${groupNum}`;
  useEffect(() => {
    setVal(String(cfg?.weight ?? 0));
  }, [cfg?.weight]);
  const commit = () => {
    const w = parseFloat(val);
    if (!isNaN(w))
      onSave(region, groupNum, w, cfg?.label ?? `Group ${groupNum}`);
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        className="h-8 w-20 bg-slate-800/80 border-slate-700 text-slate-200 text-sm px-2 text-right focus:border-slate-500"
      />
      <span className="text-slate-500 text-xs font-medium">%</span>
      {saving === key && (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RiskIndicatorsPage() {
  const { toast } = useToast();

  // Tab 1 state
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] =
    useState<IndicatorConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  // Dialog form state
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [scale, setScale] = useState<ScoreScale>({ ...DEFAULT_SCALE });

  // Tab 2 state
  const [groupConfigs, setGroupConfigs] = useState<GroupConfig[]>([]);
  const [groupSaving, setGroupSaving] = useState<string | null>(null);

  // Tab 3: Holds state
  const [holdsPeriod, setHoldsPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());
  const [holdsLoading, setHoldsLoading] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

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

  const loadGroupConfigs = useCallback(async () => {
    try {
      const data = await riskIndicatorConfigApi.listGroupConfig();
      setGroupConfigs(data ?? []);
    } catch {
      toast({
        title: "Алдаа",
        description: "Бүлгийн тохиргоо ачааллахад алдаа гарлаа.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    loadIndicators();
    loadGroupConfigs();
  }, [loadIndicators, loadGroupConfigs]);

  // Load holds for selected period
  useEffect(() => {
    if (!holdsPeriod) return;
    setHoldsLoading(true);
    riskApi
      .listHolds(holdsPeriod)
      .then((data) => setHeldIds(new Set(data.map((d) => d.indicatorId))))
      .catch(() => {})
      .finally(() => setHoldsLoading(false));
  }, [holdsPeriod]);

  const toggleHold = useCallback(
    (indicatorId: string) => {
      setHeldIds((prev) => {
        const next = new Set(prev);
        const wasHeld = next.has(indicatorId);
        if (wasHeld) next.delete(indicatorId);
        else next.add(indicatorId);
        riskApi
          .setHold({ indicatorId, period: holdsPeriod, isHeld: !wasHeld })
          .catch(() => {
            toast({ title: "Алдаа", description: "Hold хадгалахад алдаа гарлаа.", variant: "destructive" });
          });
        return next;
      });
    },
    [holdsPeriod, toast],
  );

  // ── Dialog open/close ──────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingIndicator(null);
    setForm({ ...EMPTY_FORM });
    setScale({ ...DEFAULT_SCALE });
    setDialogOpen(true);
  };

  const openEdit = (ind: IndicatorConfig) => {
    setEditingIndicator(ind);
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
    setScale(parseScale(ind.score_scale));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingIndicator(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.subid.trim() || !form.name.trim()) {
      toast({
        title: "Алдаа",
        description: "SubID болон Нэр заавал шаардлагатай.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = { ...form, score_scale: JSON.stringify(scale) };
    try {
      if (editingIndicator) {
        await riskIndicatorConfigApi.update(editingIndicator.id, payload);
        toast({ title: "Амжилттай", description: "Үзүүлэлт шинэчлэгдлээ." });
      } else {
        await riskIndicatorConfigApi.create(payload);
        toast({ title: "Амжилттай", description: "Үзүүлэлт нэмэгдлээ." });
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
      toast({ title: "Амжилттай", description: "Үзүүлэлт устгагдлаа." });
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

  // ── Reorder ────────────────────────────────────────────────────────────────

  const move = async (ind: IndicatorConfig, dir: -1 | 1) => {
    const group = indicators
      .filter((i) => i.group_num === ind.group_num)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = group.findIndex((i) => i.id === ind.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const ids = group.map((i) => i.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      await riskIndicatorConfigApi.reorder(ids);
      await loadIndicators();
    } catch {
      toast({
        title: "Алдаа",
        description: "Дараалал өөрчлөхөд алдаа гарлаа.",
        variant: "destructive",
      });
    }
  };

  // ── Group weight save ──────────────────────────────────────────────────────

  const handleGroupSave = async (
    region: string,
    groupNum: number,
    weight: number,
    label: string,
  ) => {
    const key = `${region}-${groupNum}`;
    setGroupSaving(key);
    try {
      await riskIndicatorConfigApi.upsertGroupConfig({
        region,
        group_num: groupNum,
        weight,
        label,
      });
      await loadGroupConfigs();
    } catch {
      toast({
        title: "Алдаа",
        description: "Жин хадгалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setGroupSaving(null);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

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

  const totalIndicators = indicators.length;
  const autoCount = indicators.filter((i) => i.is_manual === 0).length;
  const manualCount = indicators.filter((i) => i.is_manual === 1).length;

  const regionSum = (region: string) =>
    [1, 2, 3, 4, 5].reduce((sum, g) => {
      const cfg = groupConfigs.find(
        (c) => c.region === region && c.group_num === g,
      );
      return sum + (cfg?.weight ?? 0);
    }, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080c14]">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-white/5 bg-[#0a0f1a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <h1 className="text-white font-semibold text-[15px] tracking-tight">
              Эрсдэлийн үзүүлэлт
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <Tabs defaultValue="indicators">
          <div className="flex items-center justify-between mb-5">
            <TabsList className="bg-white/5 border border-white/8 rounded-xl p-1 gap-0.5">
              <TabsTrigger
                value="indicators"
                className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 rounded-lg text-sm px-4 h-8 transition-all"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                Үзүүлэлтүүд
              </TabsTrigger>
              <TabsTrigger
                value="groups"
                className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 rounded-lg text-sm px-4 h-8 transition-all"
              >
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                Бүлгийн жин
              </TabsTrigger>
              <TabsTrigger
                value="holds"
                className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 rounded-lg text-sm px-4 h-8 transition-all"
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
          </div>

          {/* ── Tab 1: Indicators ─────────────────────────────────────────── */}
          <TabsContent value="indicators" className="mt-0">
            {/* Stats row */}
            {!loading && (
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: "Нийт үзүүлэлт",
                    value: totalIndicators,
                    icon: Layers,
                    color: "text-white",
                  },
                  {
                    label: "Автомат Oracle",
                    value: autoCount,
                    icon: Zap,
                    color: "text-sky-400",
                  },
                  {
                    label: "Гараар оруулах",
                    value: manualCount,
                    icon: Hand,
                    color: "text-amber-400",
                  },
                  {
                    label: "Бүлгийн тоо",
                    value: grouped.filter((g) => g.rows.length > 0).length,
                    icon: BarChart3,
                    color: "text-purple-400",
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 leading-none mb-1">
                        {label}
                      </p>
                      <p
                        className={`text-xl font-semibold leading-none ${color}`}
                      >
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Хайх... (нэр, subid)"
                  className="pl-9 h-9 bg-white/4 border-white/8 text-slate-300 placeholder:text-slate-600 text-sm focus:border-white/20 rounded-xl"
                />
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={openCreate}
                className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 text-xs rounded-xl h-9 font-medium px-4"
              >
                <Plus className="w-3.5 h-3.5" /> Нэмэх
              </Button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
                <p className="text-slate-600 text-sm">Ачааллаж байна...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGrouped.map(({ group, rows, totalWeight }) => {
                  const accent = GROUP_ACCENT[group];
                  return (
                    <div
                      key={group}
                      className={`rounded-2xl border ${accent.ring} ring-1 overflow-hidden`}
                      style={{ backgroundColor: "rgba(10,15,26,0.8)" }}
                    >
                      {/* Group header */}
                      <div
                        className={`px-4 py-2.5 border-b border-white/5 flex items-center justify-between ${accent.bg}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${accent.bg} ${accent.text} ring-1 ${accent.ring}`}
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
                          <span className="text-[11px] text-slate-500">
                            {rows.length} үзүүлэлт
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${accent.bg} ${accent.text}`}
                          >
                            Нийт жин: {totalWeight}%
                          </span>
                        </div>
                      </div>

                      {/* Indicator rows */}
                      <div className="divide-y divide-white/4">
                        {rows.map((ind) => {
                          const scaleObj = parseScale(ind.score_scale);
                          const badgeClass =
                            SCALE_TYPE_BADGE_CLASS[scaleObj.type] ??
                            SCALE_TYPE_BADGE_CLASS.manual;
                          const isFirst = rows[0].id === ind.id;
                          const isLast = rows[rows.length - 1].id === ind.id;
                          return (
                            <div
                              key={ind.id}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors group"
                            >
                              {/* Reorder */}
                              <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  disabled={isFirst}
                                  onClick={() => move(ind, -1)}
                                  className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={isLast}
                                  onClick={() => move(ind, 1)}
                                  className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* SubID chip */}
                              <code
                                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md shrink-0 ${accent.bg} ${accent.text}`}
                              >
                                {ind.subid}
                              </code>

                              {/* Name + hint */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200 truncate leading-snug">
                                  {ind.name}
                                </p>
                                {ind.hint && (
                                  <p className="text-[11px] text-slate-600 truncate leading-tight">
                                    {ind.hint}
                                  </p>
                                )}
                              </div>

                              {/* Source badge */}
                              {ind.is_manual === 0 ? (
                                <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md">
                                  <Zap className="w-2.5 h-2.5" /> Oracle
                                </span>
                              ) : (
                                <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                                  <Hand className="w-2.5 h-2.5" /> Гараар
                                </span>
                              )}

                              {/* Scale type */}
                              <Badge
                                className={`text-[10px] border px-1.5 py-0.5 rounded-md font-medium shrink-0 ${badgeClass}`}
                              >
                                {SCALE_TYPE_LABELS[scaleObj.type] ??
                                  scaleObj.type}
                              </Badge>

                              {/* Weight */}
                              <div className="w-14 text-right shrink-0">
                                <span className="text-sm font-semibold text-slate-300">
                                  {ind.weight}
                                </span>
                                <span className="text-[11px] text-slate-600 ml-0.5">
                                  %
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEdit(ind)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(ind.id)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
                  <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl border border-white/5 bg-white/2">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                      <BarChart3 className="w-7 h-7 text-slate-700" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 font-medium">
                        Үзүүлэлт олдсонгүй
                      </p>
                      <p className="text-slate-600 text-sm mt-1">
                        Шинэ үзүүлэлт нэмэхийн тулд "Нэмэх" товчийг дарна уу
                      </p>
                    </div>
                  </div>
                )}

                {indicators.length > 0 && filteredGrouped.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Search className="w-6 h-6 text-slate-700" />
                    <p className="text-slate-500 text-sm">
                      "{search}" хайлтад тохирсон үзүүлэлт олдсонгүй
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Group Weights ─────────────────────────────────────── */}
          <TabsContent value="groups" className="mt-0">
            <div className="flex items-center justify-between mb-5">
              <p className="text-slate-500 text-sm">
                UB болон орон нутгийн бүлгийн жинг тохируулна уу. Нийт 100% байх
                ёстой.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {(["UB", "LOC"] as const).map((region) => {
                const sum = regionSum(region);
                const notHundred = Math.abs(sum - 100) > 0.01;
                return (
                  <div
                    key={region}
                    className="rounded-2xl border border-white/8 overflow-hidden bg-[#0a0f1a]"
                  >
                    {/* Card header */}
                    <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-white/3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {region === "UB" ? "Улаанбаатар" : "Орон нутаг"}
                        </p>
                        <p className="text-[11px] text-slate-600">{region}</p>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl border ${
                          notHundred
                            ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                            : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        }`}
                      >
                        {notHundred ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {sum.toFixed(1)}%{notHundred && " – 100% биш"}
                      </div>
                    </div>

                    {/* Weight bar */}
                    <div className="px-5 py-3 border-b border-white/5">
                      <div className="flex rounded-full overflow-hidden h-2 bg-white/5">
                        {[1, 2, 3, 4, 5].map((g) => {
                          const cfg = groupConfigs.find(
                            (c) => c.region === region && c.group_num === g,
                          );
                          const w = cfg?.weight ?? 0;
                          const pct = sum > 0 ? (w / sum) * 100 : 0;
                          const dotColors = [
                            "bg-blue-500",
                            "bg-teal-500",
                            "bg-purple-500",
                            "bg-amber-500",
                            "bg-emerald-500",
                          ];
                          return (
                            <div
                              key={g}
                              className={`${dotColors[g - 1]} transition-all`}
                              style={{ width: `${pct}%` }}
                              title={`${GROUP_LABELS[g]}: ${w}%`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {[1, 2, 3, 4, 5].map((g) => {
                          const accent = GROUP_ACCENT[g];
                          return (
                            <span
                              key={g}
                              className="flex items-center gap-1 text-[10px] text-slate-500"
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${accent.dot}`}
                              />
                              {GROUP_SHORT[g]}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group rows */}
                    <div className="divide-y divide-white/4">
                      {[1, 2, 3, 4, 5].map((g) => {
                        const accent = GROUP_ACCENT[g];
                        const cfg = groupConfigs.find(
                          (c) => c.region === region && c.group_num === g,
                        );
                        const w = cfg?.weight ?? 0;
                        const pct = sum > 0 ? (w / sum) * 100 : 0;
                        return (
                          <div
                            key={g}
                            className="flex items-center gap-4 px-5 py-3 hover:bg-white/2 transition-colors"
                          >
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${accent.bg} ${accent.text} shrink-0`}
                            >
                              {GROUP_SHORT[g]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-slate-300 font-medium leading-tight">
                                {GROUP_LABELS[g]}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className={`${accent.dot} h-full rounded-full transition-all`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-600 w-8 text-right">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <GroupWeightCell
                              region={region}
                              groupNum={g}
                              configs={groupConfigs}
                              saving={groupSaving}
                              onSave={handleGroupSave}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Tab 3: Indicator Holds ───────────────────────────────────── */}
          <TabsContent value="holds" className="mt-0">
            <div className="flex items-center justify-between mb-5 gap-4">
              <div>
                <p className="text-white text-sm font-semibold mb-0.5">Сарын үзүүлэлт hold</p>
                <p className="text-slate-500 text-xs">
                  Hold хийгдсэн үзүүлэлт тухайн сарын тооцооноос хасагдаж, үлдсэн
                  үзүүлэлтийн жин харьцангуйгаар дахин тооцогдоно.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {holdsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                <input
                  type="month"
                  value={holdsPeriod}
                  onChange={(e) => setHoldsPeriod(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm focus:border-white/25 focus:outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {([1, 2, 3, 4, 5] as const).map((grp) => {
                  const grpInds = indicators.filter((ind) => ind.group_num === grp);
                  if (grpInds.length === 0) return null;
                  const accent = GROUP_ACCENT[grp];
                  return (
                    <div
                      key={grp}
                      className={`rounded-2xl border ${accent.ring} ring-1 overflow-hidden`}
                      style={{ backgroundColor: "rgba(10,15,26,0.8)" }}
                    >
                      <div className={`px-4 py-2.5 border-b border-white/5 flex items-center gap-2.5 ${accent.bg}`}>
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${accent.bg} ${accent.text} ring-1 ${accent.ring}`}>
                          {GROUP_SHORT[grp]}
                        </span>
                        <span className="text-slate-300 text-sm font-medium">{GROUP_LABELS[grp]}</span>
                        {grpInds.some((ind) => heldIds.has(ind.id)) && (
                          <span className="ml-auto text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {grpInds.filter((ind) => heldIds.has(ind.id)).length} hold
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
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                                held
                                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300 line-through"
                                  : "bg-white/4 border-white/8 text-slate-300 hover:border-white/20 hover:bg-white/8"
                              }`}
                            >
                              {held && <PauseCircle className="w-3 h-3 text-amber-400" />}
                              <span>{ind.name}</span>
                              <span className="opacity-50 text-[10px]">{ind.weight}%</span>
                              {held && <span className="text-[9px] font-bold text-amber-500">HOLD</span>}
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

      {/* ── Create / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="bg-[#0d1220] border-white/8 text-white max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-white text-base font-semibold">
              {editingIndicator ? "Үзүүлэлт засах" : "Шинэ үзүүлэлт нэмэх"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* SubID + Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs font-medium">
                  SubID <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.subid}
                  onChange={(e) => setForm({ ...form, subid: e.target.value })}
                  placeholder="UB1.1"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 focus:border-white/25 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs font-medium">
                  Нэр <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Үзүүлэлтийн нэр"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 focus:border-white/25 rounded-xl"
                />
              </div>
            </div>

            {/* Group + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs font-medium">
                  Бүлэг
                </Label>
                <Select
                  value={String(form.group_num)}
                  onValueChange={(v) =>
                    setForm({ ...form, group_num: Number(v) })
                  }
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-slate-300 h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1220] border-white/10">
                    {[1, 2, 3, 4, 5].map((g) => {
                      const accent = GROUP_ACCENT[g];
                      return (
                        <SelectItem
                          key={g}
                          value={String(g)}
                          className="text-slate-300 focus:bg-white/8"
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
                <Label className="text-slate-400 text-xs font-medium">
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
                  className="bg-white/5 border-white/10 text-white h-9 focus:border-white/25 rounded-xl"
                />
              </div>
            </div>

            {/* Toggles + hint */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300 font-medium">
                    Гараар оруулах
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Oracle ашиглахгүй
                  </p>
                </div>
                <Switch
                  checked={form.is_manual === 1}
                  onCheckedChange={(v) =>
                    setForm({ ...form, is_manual: v ? 1 : 0 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs font-medium">
                  Тайлбар / Hint
                </Label>
                <Input
                  value={form.hint}
                  onChange={(e) => setForm({ ...form, hint: e.target.value })}
                  placeholder="Нэмэлт тайлбар..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 focus:border-white/25 rounded-xl"
                />
              </div>
            </div>

            {/* Score Scale Editor */}
            <div className="rounded-xl border border-white/8 p-4 bg-white/2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Оноо тооцох хэлбэр
              </p>
              <ScoreScaleEditor scale={scale} onChange={setScale} />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={closeDialog}
              disabled={saving}
              className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-white/10 rounded-xl hover:bg-white/8 transition-colors font-medium"
            >
              Болих
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-white/8 disabled:text-slate-500 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingIndicator ? "Хадгалах" : "Нэмэх"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-[#0d1220] border-white/8 text-white max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <AlertDialogTitle className="text-white text-center">
              Үзүүлэлт устгах
            </AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-slate-400 text-sm text-center pb-2">
            Энэ үзүүлэлтийг устгахдаа итгэлтэй байна уу?
            <br />
            <span className="text-red-400/70">Буцаах боломжгүй.</span>
          </p>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="flex-1 bg-transparent border-white/10 text-slate-300 hover:bg-white/8 hover:text-white rounded-xl">
              Болих
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-500 hover:bg-red-400 text-white border-0 rounded-xl font-semibold"
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
