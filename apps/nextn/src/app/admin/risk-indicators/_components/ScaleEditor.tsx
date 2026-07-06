"use client";

/**
 * ScaleEditor — эрсдэлийн үзүүлэлтийн оноо тооцоолох дүрмийг тохируулах editor.
 * risk-indicators/page.tsx-ээс задалж гаргав (файлын хэмжээ багасгах зорилготой).
 * Экспортлож буй туслах тогтмолуудыг (GROUP_*, SCALE_TYPE_*, EMPTY_FORM, parseScale)
 * үндсэн хуудас мөн ашигладаг.
 */

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, X, AlertTriangle, ArrowDownUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScoreScaleRule {
  min?: number | null;
  max?: number | null;
  matchType?: "exact" | "contains";
  values?: string[];
  score: number;
  label: string;
}

export interface MultiSubidSource {
  subid: string;
  label?: string;
  type: "numeric" | "string" | "both";
  numericRules?: ScoreScaleRule[];
  stringRules?: ScoreScaleRule[];
  null_empty_score?: "unelehgui" | "1" | "5";
  null_is_unelehgui?: boolean;
}

export interface ScoreScale {
  type: "numeric" | "string" | "both" | "manual" | "multi_subid";
  rules?: ScoreScaleRule[];
  numericRules?: ScoreScaleRule[];
  stringRules?: ScoreScaleRule[];
  sources?: MultiSubidSource[];
  combine?: "max" | "min" | "avg";
  min?: number;
  max?: number;
  step?: number;
  null_empty_score?: "unelehgui" | "1" | "5";
  null_is_unelehgui?: boolean;
}

type NullEmptyScore = "unelehgui" | "1" | "5";

type NullEmptyFields = Pick<
  ScoreScale,
  "null_empty_score" | "null_is_unelehgui"
>;

function readNullEmptyPolicy(scale: NullEmptyFields): NullEmptyScore {
  if (
    scale.null_empty_score === "1" ||
    scale.null_empty_score === "5" ||
    scale.null_empty_score === "unelehgui"
  ) {
    return scale.null_empty_score;
  }
  if (scale.null_is_unelehgui === false) return "5";
  return "unelehgui";
}

function applyNullEmptyPolicy<T extends NullEmptyFields>(
  scale: T,
  policy: NullEmptyScore,
): T {
  return {
    ...scale,
    null_empty_score: policy,
    null_is_unelehgui: policy === "unelehgui",
  };
}

const NULL_EMPTY_OPTIONS: {
  value: NullEmptyScore;
  label: string;
  hint: string;
}[] = [
  {
    value: "unelehgui",
    label: "Үнэлэхгүй",
    hint: "жин хасагдана",
  },
  {
    value: "1",
    label: "Оноо 1",
    hint: "хоосон = сайн",
  },
  {
    value: "5",
    label: "Оноо 5",
    hint: "хоосон = муу",
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

export const GROUP_LABELS: Record<number, string> = {
  1: "Score 1",
  2: "Score 2",
  3: "Score 3",
  4: "Score 4",
  5: "Judgement",
};
export const GROUP_SHORT: Record<number, string> = {
  1: "S1",
  2: "S2",
  3: "S3",
  4: "S4",
  5: "J",
};

export const GROUP_ACCENT: Record<
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

export const SCALE_TYPE_LABELS: Record<string, string> = {
  numeric: "Тоон",
  string: "Мөр",
  both: "Хосолсон",
  manual: "Гараар",
  no_score: "Оноогүй",
  multi_subid: "Олон SUBID",
};

export const SCALE_TYPE_BADGE_CLASS: Record<string, string> = {
  numeric: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  string: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  both: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  manual: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  no_score: "bg-muted/30 text-muted-foreground border-border/30",
  multi_subid: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const DEFAULT_MULTI_SUBID_SCALE: ScoreScale = {
  type: "multi_subid",
  combine: "max",
  null_empty_score: "unelehgui",
  sources: [
    { subid: "16", label: "DAG", type: "numeric", numericRules: [] },
    { subid: "16.1", label: "CEC", type: "numeric", numericRules: [] },
  ],
};

const COMBINE_OPTIONS: {
  value: NonNullable<ScoreScale["combine"]>;
  label: string;
  hint: string;
}[] = [
  { value: "max", label: "Хамгийн муу", hint: "max" },
  { value: "min", label: "Хамгийн сайн", hint: "min" },
  { value: "avg", label: "Дундаж", hint: "avg" },
];

const DEFAULT_SCALE: ScoreScale = { type: "manual", min: 1, max: 5, step: 1 };

export const EMPTY_FORM = {
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

export function parseScale(raw: string): ScoreScale {
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
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 0, label: "Ү" },
];

// ── Тоон дүрмийн туслахууд ────────────────────────────────────────────────────
// Үнэлгээний бодит семантик (scoring-rules.ts): min ≤ утга < max,
// өндөр оноотой дүрэм ЭХЭЛЖ шалгагдана.

/** Бодит үнэлгээтэй яг ижил логикоор аль дүрэм тохирохыг олно */
function matchNumericRule(rules: ScoreScaleRule[], n: number): number {
  const order = rules
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.score - a.r.score);
  for (const { r, i } of order) {
    const minOk = r.min == null || n >= r.min;
    const maxOk = r.max == null || n < r.max;
    if (minOk && maxOk) return i;
  }
  return -1;
}

function ruleRangeText(r: ScoreScaleRule): string {
  if (r.min == null && r.max == null) return "бүх утга";
  if (r.min == null) return `утга < ${r.max}`;
  if (r.max == null) return `${r.min} ≤ утга`;
  return `${r.min} ≤ утга < ${r.max}`;
}

/** Давхцаж буй дүрмийн хосуудыг олно (null = хязгааргүй) */
function findRuleOverlaps(rules: ScoreScaleRule[]): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < rules.length; a++) {
    for (let b = a + 1; b < rules.length; b++) {
      const ra = rules[a];
      const rb = rules[b];
      const aMin = ra.min ?? -Infinity;
      const aMax = ra.max ?? Infinity;
      const bMin = rb.min ?? -Infinity;
      const bMax = rb.max ?? Infinity;
      if (aMin < bMax && bMin < aMax) out.push([a, b]);
    }
  }
  return out;
}

function NumericRulesSection({
  rules,
  onChange,
}: {
  rules: ScoreScaleRule[];
  onChange: (r: ScoreScaleRule[]) => void;
}) {
  const [testValue, setTestValue] = useState("");

  const update = (i: number, patch: Partial<ScoreScaleRule>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const add = () => {
    // Шинэ дүрмийн доод хязгаарыг өмнөх дүрмийн дээд хязгаараас залгаж эхлүүлнэ
    const lastMax = rules.length ? rules[rules.length - 1].max : undefined;
    onChange([
      ...rules,
      { min: lastMax ?? undefined, max: undefined, score: 3, label: "" },
    ]);
  };

  /** Min-ээр эрэмбэлж, дүрэм бүрийн max-г дараагийн дүрмийн min-тэй залгана */
  const chainBounds = () => {
    const sorted = [...rules].sort(
      (a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity),
    );
    const chained = sorted.map((r, i) =>
      i < sorted.length - 1 ? { ...r, max: sorted[i + 1].min ?? r.max } : r,
    );
    onChange(chained);
  };

  const overlaps = findRuleOverlaps(rules);
  const overlapIdx = new Set(overlaps.flat());

  const testNum = Number(testValue.replace(",", "."));
  const testMatch =
    testValue.trim() !== "" && Number.isFinite(testNum)
      ? matchNumericRule(rules, testNum)
      : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/80">
          Тоон дүрмүүд
        </span>
        <div className="flex items-center gap-1">
          {rules.length > 1 && (
            <button
              type="button"
              onClick={chainBounds}
              title="Min-ээр эрэмбэлж, хязгааруудыг цоорхойгүй залгана"
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-foreground/5 border border-border/30 text-muted-foreground/70 hover:bg-foreground/10 transition-colors"
            >
              <ArrowDownUp className="w-3 h-3" />
              Залгах
            </button>
          )}
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Нэмэх
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
        Муж нь{" "}
        <span className="font-mono text-sky-400/90">Доод ≤ утга &lt; Дээд</span>{" "}
        — доод хязгаар <b>орно</b>, дээд хязгаар <b>орохгүй</b>. Жишээ нь 3–4 ба
        4–5 гэсэн хоёр мужид <span className="font-mono">4</span> утга{" "}
        <b>4–5 мужид</b> орно.
      </p>
      {rules.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/30 text-center py-4 border border-dashed border-border/20 rounded-xl">
          Дүрэм байхгүй — «Нэмэх» дараарай
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[68px_68px_84px_1fr_120px_28px] gap-1.5 px-1">
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Доод ≤
            </span>
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              &lt; Дээд
            </span>
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Оноо
            </span>
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Тайлбар
            </span>
            <span className="text-[10px] text-muted-foreground/40 uppercase">
              Муж
            </span>
            <span />
          </div>
          {rules.map((rule, i) => (
            <div
              key={i}
              className={`grid grid-cols-[68px_68px_84px_1fr_120px_28px] gap-1.5 items-center group rounded-lg ${
                overlapIdx.has(i) ? "bg-amber-500/[0.06]" : ""
              } ${testMatch === i ? "ring-1 ring-emerald-500/50 bg-emerald-500/[0.06]" : ""}`}
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
                placeholder="−∞"
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
                placeholder="+∞"
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
              <span
                className="text-[10px] font-mono text-muted-foreground/60 truncate"
                title={ruleRangeText(rule)}
              >
                {ruleRangeText(rule)}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {overlaps.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                Мужууд давхцаж байна (
                {overlaps.map(([a, b]) => `№${a + 1}↔№${b + 1}`).join(", ")}
                ). Давхцсан утгад <b>өндөр оноотой</b> дүрэм түрүүлж хэрэгжинэ.
                «Залгах» товчоор цэгцлэх боломжтой.
              </span>
            </div>
          )}

          {/* Шууд шалгах — тодорхой утга аль мужид орохыг харуулна */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              Утга шалгах:
            </span>
            <Input
              type="number"
              value={testValue}
              onChange={(e) => setTestValue(e.target.value)}
              placeholder="ж: 4"
              className="h-7 w-24 text-xs rounded-lg bg-foreground/5 border-border/40 text-foreground/80 placeholder:text-muted-foreground/20 px-2"
            />
            {testValue.trim() !== "" &&
              (Number.isFinite(testNum) ? (
                testMatch !== null && testMatch >= 0 ? (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                      SCORE_BADGE[rules[testMatch].score] ?? ""
                    }`}
                  >
                    → Оноо{" "}
                    {rules[testMatch].score === 0
                      ? "Ү"
                      : rules[testMatch].score}{" "}
                    ({ruleRangeText(rules[testMatch])})
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-md border border-border/30 text-muted-foreground/60">
                    → Ямар ч мужид орохгүй (Үнэлэхгүй)
                  </span>
                )
              ) : (
                <span className="text-[11px] text-muted-foreground/40">
                  тоо оруулна уу
                </span>
              ))}
          </div>
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
              <textarea
                value={(rule.values ?? []).join("\n")}
                onChange={(e) => {
                  const vals = e.target.value
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean);
                  update(i, { values: vals });
                }}
                rows={3}
                placeholder={"утга1\nутга2\n..."}
                className="w-full text-xs rounded-lg bg-foreground/5 border border-border/40 text-foreground/70 placeholder:text-muted-foreground/30 px-2.5 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-violet-500/40"
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

function MultiSubidSourceEditor({
  source,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  source: MultiSubidSource;
  index: number;
  onChange: (next: MultiSubidSource) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const numericRules = source.numericRules ?? [];

  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400/90">
          Эх үүсвэр #{index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Устгах"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground/50">SUBID</Label>
          <Input
            value={source.subid}
            onChange={(e) => onChange({ ...source, subid: e.target.value })}
            placeholder="16"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground/50">Шошго</Label>
          <Input
            value={source.label ?? ""}
            onChange={(e) => onChange({ ...source, label: e.target.value })}
            placeholder="DAG"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground/50">
          Хоосон утга (энэ SUBID)
        </Label>
        <div className="flex flex-wrap gap-1">
          {NULL_EMPTY_OPTIONS.map((opt) => {
            const active = readNullEmptyPolicy(source) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange(applyNullEmptyPolicy(source, opt.value))
                }
                className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                  active
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : "border-border/30 text-muted-foreground/50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <NumericRulesSection
        rules={numericRules}
        onChange={(rules) =>
          onChange({ ...source, type: "numeric", numericRules: rules })
        }
      />
    </div>
  );
}

function MultiSubidScaleSection({
  scale,
  onChange,
}: {
  scale: ScoreScale;
  onChange: (next: ScoreScale) => void;
}) {
  const sources = scale.sources ?? [];
  const combine = scale.combine ?? "max";

  const updateSource = (i: number, next: MultiSubidSource) =>
    onChange({
      ...scale,
      sources: sources.map((s, idx) => (idx === i ? next : s)),
    });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-muted-foreground/80 leading-relaxed">
        Нэг indicator, олон SUBID. Indicator-ийн гол{" "}
        <span className="text-rose-400 font-medium">SUBID</span> талбар нь эхний
        эх үүсвэртэй таарах ёстой. Эцсийн оноо = сонгосон нэгтгэл (ихэвчлэн
        хамгийн муу).
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">
          Оноог нэгтгэх
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {COMBINE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...scale, combine: opt.value })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                combine === opt.value
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "border-border/30 text-muted-foreground/50 hover:border-border/50"
              }`}
            >
              {opt.label}
              <span className="text-[10px] opacity-60 ml-1">({opt.hint})</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {sources.map((src, i) => (
          <MultiSubidSourceEditor
            key={`${src.subid}-${i}`}
            source={src}
            index={i}
            onChange={(next) => updateSource(i, next)}
            onRemove={() =>
              onChange({
                ...scale,
                sources: sources.filter((_, idx) => idx !== i),
              })
            }
            canRemove={sources.length > 1}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...scale,
            sources: [
              ...sources,
              { subid: "", label: "", type: "numeric", numericRules: [] },
            ],
          })
        }
        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
      >
        <Plus className="w-3 h-3" />
        SUBID нэмэх
      </button>
    </div>
  );
}

export function ScaleEditor({
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
          {(["numeric", "string", "both", "multi_subid"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                if (t === "multi_subid") {
                  setScale({ ...DEFAULT_MULTI_SUBID_SCALE });
                  return;
                }
                setScale((s) => ({
                  ...s,
                  type: t,
                  sources: undefined,
                  combine: undefined,
                }));
              }}
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

      {/* ── Хоосон утгын бодлого ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">
          Хоосон / null утга
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {NULL_EMPTY_OPTIONS.map((opt) => {
            const active = readNullEmptyPolicy(scale) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setScale((s) => applyNullEmptyPolicy(s, opt.value))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  active
                    ? opt.value === "unelehgui"
                      ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                      : opt.value === "1"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    : "border-border/30 text-muted-foreground/50 hover:border-border/50 hover:text-foreground/70 bg-transparent"
                }`}
              >
                {opt.label}
                <span className="text-[10px] font-normal opacity-70 ml-1">
                  ({opt.hint})
                </span>
              </button>
            );
          })}
        </div>
      </div>

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
      {scale.type === "multi_subid" && (
        <MultiSubidScaleSection
          scale={scale}
          onChange={(next) => setScale(next)}
        />
      )}
    </div>
  );
}
