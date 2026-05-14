/**
 * Эрсдэлийн үнэлгээний автомат оноо тооцох дүрмүүд.
 *
 * Бүлэглэл:
 *   Score 1 — Санхүү/гүйцэтгэлийн KPI (SUBID 1–9)
 *   Score 2 — Үйл ажиллагаа/HR/хяналт (SUBID 11–29)
 *   Score 3 — Аудит/хяналтын түүх    (SUBID 30–33)
 *
 * SUBID нь Oracle-ийн жинхэнэ ID (rubric №-тэй яг таарахгүй байж болно).
 */

export type ScoreGroup = "Score 1" | "Score 2" | "Score 3";

export type ScoreValue = 0 | 1 | 2 | 3 | 4 | 5;
export type ScoreResult = ScoreValue | "Үнэлэхгүй" | null;

type NumericRule = {
  min?: number; // inclusive
  max?: number; // exclusive
  score: ScoreValue;
  label: string;
};

type StringRule = {
  match: (s: string) => boolean;
  score: ScoreValue | "Үнэлэхгүй";
  label: string;
};

export type IndicatorRule = {
  subid: number;
  group: ScoreGroup;
  name: string;
  numeric?: NumericRule[];
  // STRING үнэлгээ эсвэл NUMBER хувилбартай хольсон үед (e.g. SUBID 28)
  strings?: StringRule[];
  // Хэрэв уг SUBID онооны бүлэгт хамаарахгүй бол энэ нь үнэлгээгүй гэж заана
  noScore?: boolean;
};

// ── туслах ──────────────────────────────────────────────────────────────────
const exact = (vals: string[]): ((s: string) => boolean) => {
  const set = new Set(vals.map((v) => v.toLowerCase().trim()));
  return (s) => set.has(s.toLowerCase().trim());
};
const contains = (vals: string[]): ((s: string) => boolean) => {
  const arr = vals.map((v) => v.toLowerCase());
  return (s) => {
    const t = s.toLowerCase();
    return arr.some((v) => t.includes(v));
  };
};

// ── дүрмүүд ────────────────────────────────────────────────────────────────
export const INDICATOR_RULES: IndicatorRule[] = [
  // ─── Score 1 (SUBID 1–9) ────────────────────────────────────────────────
  {
    subid: 1,
    group: "Score 1",
    name: "Зээлийн төлөвлөгөөний биелэлт",
    numeric: [
      { max: 80, score: 5, label: "80%-аас доош" },
      { min: 80, max: 90, score: 4, label: "80-89%" },
      { min: 90, max: 95, score: 3, label: "90-94%" },
      { min: 95, max: 100, score: 2, label: "95-99%" },
      { min: 100, score: 1, label: "100%+" },
    ],
  },
  {
    subid: 2,
    group: "Score 1",
    name: "Эх үүсвэрийн төлөвлөгөөний биелэлт",
    numeric: [
      { max: 80, score: 5, label: "80%-аас доош" },
      { min: 80, max: 90, score: 4, label: "80-89%" },
      { min: 90, max: 95, score: 3, label: "90-94%" },
      { min: 95, max: 100, score: 2, label: "95-99%" },
      { min: 100, score: 1, label: "100%+" },
    ],
  },
  {
    subid: 3,
    group: "Score 1",
    name: "Дотоод үнэлгээний ашиг",
    numeric: [
      { max: 70.0001, score: 5, label: "70%-аас доош" },
      { min: 70.0001, max: 80, score: 4, label: "70-79%" },
      { min: 80, max: 90, score: 3, label: "80-89%" },
      { min: 90, max: 100, score: 2, label: "90-99%" },
      { min: 100, score: 1, label: "100%" },
    ],
  },
  {
    subid: 4,
    group: "Score 1",
    name: "Хүүгийн бус орлого",
    numeric: [
      { max: 70.0001, score: 5, label: "70%-аас доош" },
      { min: 70.0001, max: 80, score: 4, label: "70-79%" },
      { min: 80, max: 90, score: 3, label: "80-89%" },
      { min: 90, max: 100, score: 2, label: "90-99%" },
      { min: 100, score: 1, label: "100%" },
    ],
  },
  {
    subid: 5,
    group: "Score 1",
    name: "Анхаарал хандуулах зээл",
    numeric: [
      { min: 3.5, score: 5, label: "3.5%+" },
      { min: 3, max: 3.5, score: 4, label: "3-3.4%" },
      { min: 2, max: 3, score: 3, label: "2-2.9%" },
      { min: 1.1, max: 2, score: 2, label: "1.1-1.9%" },
      { max: 1.0001, score: 1, label: "≤1%" },
    ],
  },
  {
    subid: 6,
    group: "Score 1",
    name: "Чанаргүй зээл",
    numeric: [
      { min: 4, score: 5, label: "4%+" },
      { min: 3, max: 4, score: 4, label: "3-3.9%" },
      { min: 2, max: 3, score: 3, label: "2-2.9%" },
      { min: 1.1, max: 2, score: 2, label: "1.1-1.9%" },
      { max: 1.0001, score: 1, label: "≤1%" },
    ],
  },
  {
    subid: 7,
    group: "Score 1",
    name: "Чанаргүй зээлийн тоо",
    numeric: [
      { min: 2.6, score: 5, label: "2.6%+" },
      { min: 2.1, max: 2.6, score: 4, label: "2.1-2.5%" },
      { min: 1.6, max: 2.1, score: 3, label: "1.6-2%" },
      { min: 1.1, max: 1.6, score: 2, label: "1.1-1.5%" },
      { max: 1.0001, score: 1, label: "≤1%" },
    ],
  },
  {
    subid: 8,
    group: "Score 1",
    name: "БҮХ-н үнэлгээ",
    numeric: [
      { max: 75, score: 5, label: "<75%" },
      { min: 75, max: 85, score: 4, label: "75-84.9%" },
      { min: 85, max: 90, score: 3, label: "85-89.9%" },
      { min: 90, max: 95, score: 2, label: "90-94.9%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },
  {
    subid: 9,
    group: "Score 1",
    name: "Тоон төлөвлөгөө",
    numeric: [
      { max: 75, score: 5, label: "<75%" },
      { min: 75, max: 85, score: 4, label: "75-84.9%" },
      { min: 85, max: 90, score: 3, label: "85-89.9%" },
      { min: 90, max: 95, score: 2, label: "90-94.9%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },

  // SUBID 10 — ХДХХ-д ирсэн гомдол: онооны бүлэгт ороогүй
  { subid: 10, group: "Score 2", name: "ХДХХ-д ирсэн гомдол", noScore: true },

  // ─── Score 2 (SUBID 11–29) ──────────────────────────────────────────────
  {
    subid: 11,
    group: "Score 2",
    name: "Салбарын зэрэглэл",
    strings: [
      { match: exact(["бизнес төв", "a1"]), score: 5, label: "Бизнес төв, A1" },
      { match: exact(["a2", "b1"]), score: 4, label: "A2, B1" },
      { match: exact(["a3", "b2"]), score: 3, label: "A3, B2" },
    ],
  },
  {
    subid: 12,
    group: "Score 2",
    name: "Ажилтнуудын ажилласан жилийн дундаж",
    numeric: [
      { max: 1, score: 5, label: "0-1 жил" },
      { min: 5, score: 5, label: "5+ жил" },
      { min: 4, max: 5, score: 4, label: "4-5 жил" },
      { min: 3, max: 4, score: 3, label: "3-4 жил" },
      { min: 2, max: 3, score: 2, label: "2-3 жил" },
      { min: 1, max: 2, score: 1, label: "1-2 жил" },
    ],
  },
  {
    subid: 13,
    group: "Score 2",
    name: "Удирдах ажилтнуудын ажилласан жил",
    numeric: [
      { max: 1, score: 5, label: "0-1 жил" },
      { min: 4, score: 5, label: "4+ жил/удирдлагагүй" },
      { min: 3.5, max: 4, score: 4, label: "3.5-4 жил" },
      { min: 3, max: 3.5, score: 3, label: "3-3.5 жил" },
      { min: 2, max: 3, score: 2, label: "2-3 жил" },
      { min: 1, max: 2, score: 1, label: "1-2 жил" },
    ],
  },
  {
    subid: 14,
    group: "Score 2",
    name: "Хүний нөөцийн эргэц",
    numeric: [
      { min: 20, score: 5, label: "20%+" },
      { min: 16, max: 20, score: 4, label: "16-19%" },
      { min: 13, max: 16, score: 3, label: "13-15%" },
      { min: 10, max: 13, score: 2, label: "10-12%" },
      { max: 10, score: 1, label: "<10%" },
    ],
  },
  {
    subid: 15,
    group: "Score 2",
    name: "Орон тоо бүрэн эсэх",
    numeric: [
      { max: 85, score: 5, label: "<85%" },
      { min: 85, max: 90, score: 4, label: "85-89%" },
      { min: 90, max: 95, score: 3, label: "90-94%" },
      { min: 95, max: 100, score: 2, label: "95-99%" },
      { min: 100, score: 1, label: "100%" },
    ],
  },
  {
    subid: 16,
    group: "Score 2",
    name: "Нэг ажилтанд ногдох сургалтын цаг",
    numeric: [
      { max: 10, score: 5, label: "<10 цаг" },
      { min: 10, max: 12, score: 4, label: "10-11.9" },
      { min: 12, max: 14, score: 3, label: "12-13.9" },
      { min: 14, max: 16, score: 2, label: "14-15.9" },
      { min: 16, score: 1, label: "≥16" },
    ],
  },
  {
    subid: 17,
    group: "Score 2",
    name: "Зээлийн өр цуглуулах үйл ажиллагаа",
    numeric: [
      { max: 80, score: 5, label: "0-79%" },
      { min: 80, max: 85, score: 4, label: "80-84%" },
      { min: 85, max: 90, score: 3, label: "85-89%" },
      { min: 90, max: 95, score: 2, label: "90-94%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },
  {
    subid: 18,
    group: "Score 2",
    name: "Зээлийн эргэн хяналт",
    numeric: [
      { max: 60, score: 5, label: "0-59%" },
      { min: 60, max: 70, score: 4, label: "60-69%" },
      { min: 70, max: 80, score: 3, label: "70-79%" },
      { min: 80, max: 90, score: 2, label: "80-89%" },
      { min: 90, score: 1, label: "90-100%" },
    ],
  },
  {
    subid: 19,
    group: "Score 2",
    name: "Зээлийн хэрэг бүртгэлийн үйл ажиллагаа",
    numeric: [
      { max: 80, score: 5, label: "0-79%" },
      { min: 80, max: 85, score: 4, label: "80-84%" },
      { min: 85, max: 90, score: 3, label: "85-89%" },
      { min: 90, max: 95, score: 2, label: "90-94%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },
  {
    subid: 20,
    group: "Score 2",
    name: "Зээлийн материал буцаалт",
    numeric: [
      { max: 70, score: 5, label: "0-69%" },
      { min: 70, max: 80, score: 4, label: "70-79%" },
      { min: 80, max: 90, score: 3, label: "80-89%" },
      { min: 90, max: 95, score: 2, label: "90-94%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },
  {
    subid: 21,
    group: "Score 2",
    name: "Даатгалын үйл ажиллагаа",
    numeric: [
      { max: 30.0001, score: 5, label: "0-30%" },
      { min: 30.0001, max: 59.0001, score: 4, label: "30-59%" },
      { min: 59.0001, max: 84.0001, score: 3, label: "60-84%" },
      { min: 84.0001, max: 94.0001, score: 2, label: "85-94%" },
      { min: 94.0001, score: 1, label: "95-100%" },
    ],
  },
  {
    subid: 22,
    group: "Score 2",
    name: "Хамрах хугацаанд олгосон чанаргүй зээл",
    numeric: [
      { min: 31, score: 5, label: "31%+" },
      { min: 21, max: 31, score: 4, label: "21-30%" },
      { min: 11, max: 21, score: 3, label: "11-20%" },
      { min: 0.1, max: 11, score: 2, label: "0.1-10%" },
      { max: 0.1, score: 1, label: "0%" },
    ],
  },
  {
    subid: 23,
    group: "Score 2",
    name: "Хувийн хэргийн зөрчил",
    numeric: [
      { max: 60, score: 5, label: "0-59%" },
      { min: 60, max: 70, score: 4, label: "60-69%" },
      { min: 70, max: 80, score: 3, label: "70-79%" },
      { min: 80, max: 90, score: 2, label: "80-89%" },
      { min: 90, score: 1, label: "90-100%" },
    ],
  },
  {
    subid: 24,
    group: "Score 2",
    name: "Баримтын зөрчил",
    numeric: [
      { max: 60, score: 5, label: "0-59%" },
      { min: 60, max: 80, score: 4, label: "60-79%" },
      { min: 80, max: 90, score: 3, label: "80-89%" },
      { min: 90, max: 95, score: 2, label: "90-94%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },
  {
    subid: 25,
    group: "Score 2",
    name: "Бүртгэлийн зайны хяналтын үнэлгээ",
    numeric: [
      { max: 80, score: 5, label: "0-79%" },
      { min: 80, max: 85, score: 4, label: "80-84%" },
      { min: 85, max: 90, score: 3, label: "85-89%" },
      { min: 90, max: 95, score: 2, label: "90-94%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },
  {
    subid: 26,
    group: "Score 2",
    name: "Илүүдэл дутагдал гарсан эсэх",
    // RESULT = тоо хэдэн удаа гарсан
    numeric: [
      { min: 5, score: 5, label: "5+ удаа" },
      { min: 3, max: 5, score: 4, label: "3-4 удаа" },
      { min: 1, max: 3, score: 3, label: "1-2 удаа" },
      { max: 1, score: 0, label: "Үнэлэхгүй (гараагүй)" },
    ],
  },
  {
    subid: 27,
    group: "Score 2",
    name: "ОН-н зах зээлд эзлэх байр суурь",
    // Жинхэнэ дүрэм нь өмнөх улирлаас өсөлт/бууралттай харьцуулдаг тул
    // зөвхөн RESULT тоогоор бууруулсан загвартай ойртуулна.
    numeric: [
      { max: 10, score: 5, label: "<10%" },
      { min: 10, max: 16, score: 3, label: "10-15%" },
      { min: 16, score: 1, label: "16%+" },
    ],
  },
  {
    subid: 28,
    group: "Score 2",
    name: "Монголбанкны шалгалтын үнэлгээ",
    strings: [
      { match: exact(["муу", "5"]), score: 5, label: "Муу" },
      { match: exact(["хангалтгүй", "4"]), score: 4, label: "Хангалтгүй" },
      { match: exact(["дунд", "3"]), score: 3, label: "Дунд" },
      { match: exact(["хэвийн", "2"]), score: 2, label: "Хэвийн" },
      { match: exact(["сайн", "1"]), score: 1, label: "Сайн" },
    ],
    numeric: [
      { min: 4.5, score: 5, label: "Муу" },
      { min: 3.5, max: 4.5, score: 4, label: "Хангалтгүй" },
      { min: 2.5, max: 3.5, score: 3, label: "Дунд" },
      { min: 1.5, max: 2.5, score: 2, label: "Хэвийн" },
      { max: 1.5, score: 1, label: "Сайн" },
    ],
  },
  {
    subid: 29,
    group: "Score 2",
    name: "Нууцлалын зөрчил",
    numeric: [
      { min: 3, score: 5, label: "3+ удаа" },
      { min: 1, max: 3, score: 4, label: "1-2 удаа" },
      { max: 1, score: 0, label: "Үнэлэхгүй (зөрчилгүй)" },
    ],
  },

  // ─── Score 3 (SUBID 30–33) ──────────────────────────────────────────────
  {
    subid: 30,
    group: "Score 3",
    name: "Өмнөх аудитын үнэлгээ",
    strings: [
      {
        match: contains([
          "хангалтгүй",
          "идэвхитэй менежмент",
          "идэвхтэй менежмент",
        ]),
        score: 5,
        label: "Хангалтгүй",
      },
      {
        match: contains([
          "сайжруулах",
          "тодорхой давтамж",
          "байнгын хяналт",
          "мониторинг",
        ]),
        score: 3,
        label: "Сайжруулах шаардлагатай",
      },
      {
        match: contains(["хангалттай", "анхаарал татах том асуудал байхгүй"]),
        score: 1,
        label: "Хангалттай",
      },
      {
        match: contains(["аудит хийгдэж байгаагүй", "өмнө аудит"]),
        score: "Үнэлэхгүй",
        label: "Өмнө аудит хийгдэж байгаагүй",
      },
    ],
  },
  {
    subid: 31,
    group: "Score 3",
    name: "Өндөр эрсдэлтэй асуудлын тоо",
    numeric: [
      { min: 25, score: 5, label: "25%+" },
      { min: 21, max: 25, score: 4, label: "21-25%" },
      { min: 15, max: 21, score: 3, label: "15-20%" },
      { min: 10, max: 15, score: 2, label: "10-14%" },
      { max: 10, score: 1, label: "≤10%" },
    ],
  },
  {
    subid: 32,
    group: "Score 3",
    name: "Өмнөх аудитаас хойш хугацаа",
    numeric: [
      { min: 3, score: 5, label: "3+ жил" },
      { min: 2.5, max: 3, score: 4, label: "2.5-3 жил" },
      { min: 2, max: 2.5, score: 3, label: "2-2.5 жил" },
      { min: 1, max: 2, score: 2, label: "1-2 жил" },
      { max: 1, score: 1, label: "0-1 жил" },
    ],
  },
  {
    subid: 33,
    group: "Score 3",
    name: "Follow up үнэлгээ",
    numeric: [
      { max: 80, score: 5, label: "<80%" },
      { min: 80, max: 85, score: 4, label: "80-84%" },
      { min: 85, max: 90, score: 3, label: "85-89%" },
      { min: 90, max: 95, score: 2, label: "90-94%" },
      { min: 95, score: 1, label: "95-100%" },
    ],
  },

  // SUBID 35 — Ажилтны ур чадварын түвшин: rubric-д заагаагүй
  {
    subid: 35,
    group: "Score 2",
    name: "Ажилтны ур чадварын түвшин",
    noScore: true,
  },
];

const RULE_BY_SUBID = new Map<number, IndicatorRule>(
  INDICATOR_RULES.map((r) => [r.subid, r]),
);

export function getRule(
  subid: number | string | null | undefined,
): IndicatorRule | undefined {
  const n = Number(subid);
  if (!Number.isFinite(n)) return undefined;
  return RULE_BY_SUBID.get(n);
}

export function getGroup(
  subid: number | string | null | undefined,
): ScoreGroup | null {
  return getRule(subid)?.group ?? null;
}

/** Үндсэн оноо тооцоологч. Үр дүн null бол энэ үзүүлэлтэд оноо хамаарахгүй. */
export function computeScore(
  subid: number | string | null | undefined,
  result: any,
  resultType?: string | null,
): { score: ScoreResult; label: string | null; rule?: IndicatorRule } {
  const rule = getRule(subid);
  if (!rule || rule.noScore) return { score: null, label: null, rule };

  const raw = result == null ? "" : String(result).trim();
  const isStringType = (resultType || "").toUpperCase() === "STRING";

  // STRING дүрэм байгаа бол эхэлж шалгана
  if (rule.strings && (isStringType || isNaN(Number(raw.replace(",", "."))))) {
    for (const s of rule.strings) {
      if (s.match(raw)) return { score: s.score, label: s.label, rule };
    }
  }

  // NUMERIC дүрэм
  if (rule.numeric) {
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) {
      // Хамгийн өндөр оноотойгоос бага руу шалгаж эхний таарсан хэсгийг буцаана
      const sorted = [...rule.numeric].sort((a, b) => b.score - a.score);
      for (const r of sorted) {
        const minOk = r.min == null || n >= r.min;
        const maxOk = r.max == null || n < r.max;
        if (minOk && maxOk) return { score: r.score, label: r.label, rule };
      }
    }
  }

  // STRING дүрэм байсан ч таарахгүй бол сүүлд дахин шалгая
  if (rule.strings) {
    for (const s of rule.strings) {
      if (s.match(raw)) return { score: s.score, label: s.label, rule };
    }
  }

  return { score: "Үнэлэхгүй", label: "тодорхойлогдоогүй", rule };
}

/** UI-д харагдах өнгө. */
export function scoreColorClass(score: ScoreResult): string {
  if (score === 5) return "bg-red-500/15 text-red-600 border-red-500/30";
  if (score === 4)
    return "bg-orange-500/15 text-orange-600 border-orange-500/30";
  if (score === 3) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  if (score === 2) return "bg-lime-500/15 text-lime-700 border-lime-500/30";
  if (score === 1)
    return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (score === 0 || score === "Үнэлэхгүй")
    return "bg-slate-500/10 text-muted-foreground/70 border-border/30";
  return "bg-transparent text-muted-foreground border-transparent";
}

export function scoreDisplay(score: ScoreResult): string {
  if (score == null) return "—";
  if (score === "Үнэлэхгүй") return "Ү";
  return String(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated branch helpers (Final report)
// ─────────────────────────────────────────────────────────────────────────────

export type Region = "UB" | "LOC";
export type RiskLevel = "Өндөр" | "Дунд" | "Бага";

const UB_RATINGS = new Set(["УБТ", "A1", "A2", "A3", "SME", "C", "БИЗНЕС ТӨВ"]);
const LOC_RATINGS = new Set(["ОБТ", "Б1", "Б2"]);

export const WEIGHTS: Record<
  Region,
  { s1: number; s2: number; s3: number; s4: number; j: number }
> = {
  UB: { s1: 0.35, s2: 0.2, s3: 0.2, s4: 0.15, j: 0.1 },
  LOC: { s1: 0.25, s2: 0.2, s3: 0.2, s4: 0.1, j: 0.1 },
};

export function detectRegion(rating: string): Region {
  const t = (rating || "").toUpperCase().trim();
  if (LOC_RATINGS.has(t)) return "LOC";
  if (UB_RATINGS.has(t)) return "UB";
  if (/^Б/.test(t)) return "LOC";
  return "UB";
}

export function riskLevel(total: number | null | undefined): RiskLevel | "" {
  if (total == null || !Number.isFinite(total)) return "";
  if (total >= 3.5) return "Өндөр";
  if (total >= 2.5) return "Дунд";
  return "Бага";
}

export function riskLevelClass(lv: string): string {
  if (lv === "Өндөр") return "bg-rose-500/15 text-rose-600 border-rose-500/30";
  if (lv === "Дунд")
    return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  if (lv === "Бага")
    return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  return "text-muted-foreground border-transparent";
}

export type BranchAggregate = {
  branchId: string;
  branchName: string;
  solid: string;
  rating: string;
  region: Region;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s4: number;
  j: number;
  total: number | null;
  level: RiskLevel | "";
};

/** Жинлэсэн дундаж — байгаа компонентуудаар (хоосон бол жингээс хасах). */
export function computeTotal(
  region: Region,
  s1: number | null,
  s2: number | null,
  s3: number | null,
  s4: number,
  j: number,
): number | null {
  const w = WEIGHTS[region];
  let wsum = 0;
  let vsum = 0;
  if (s1 != null) {
    vsum += s1 * w.s1;
    wsum += w.s1;
  }
  if (s2 != null) {
    vsum += s2 * w.s2;
    wsum += w.s2;
  }
  if (s3 != null) {
    vsum += s3 * w.s3;
    wsum += w.s3;
  }
  if (s4 > 0) {
    vsum += s4 * w.s4;
    wsum += w.s4;
  }
  if (j > 0) {
    vsum += j * w.j;
    wsum += w.j;
  }
  return wsum > 0 ? vsum / wsum : null;
}

type AggInputRow = {
  SOLID?: any;
  BRANCHID?: any;
  BRANCHNAME?: any;
  SUBID?: any;
  RESULT?: any;
  RESULT_TYPE?: any;
};

/**
 * Score-той rows-аас салбараар бүлэглэн Score 1/2/3 дунджийг
 * тооцоолж BranchAggregate жагсаалт буцаана.
 *  - score4 / judgement: { [branchId]: number } гар оруулга (default 0)
 */
export function aggregateBranch(
  rows: AggInputRow[],
  score4Map: Record<string, number> = {},
  judgementMap: Record<string, number> = {},
): BranchAggregate[] {
  type Acc = {
    branchId: string;
    branchName: string;
    solid: string;
    rating: string;
    sums: Record<ScoreGroup, { sum: number; cnt: number }>;
  };
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const key = String(r.BRANCHID ?? r.SOLID ?? "");
    if (!key) continue;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        branchId: String(r.BRANCHID ?? ""),
        branchName: String(r.BRANCHNAME ?? ""),
        solid: String(r.SOLID ?? ""),
        rating: "",
        sums: {
          "Score 1": { sum: 0, cnt: 0 },
          "Score 2": { sum: 0, cnt: 0 },
          "Score 3": { sum: 0, cnt: 0 },
        },
      };
      map.set(key, acc);
    }

    if (Number(r.SUBID) === 11 && r.RESULT != null) {
      acc.rating = String(r.RESULT).trim();
    }

    const grp = getGroup(r.SUBID as any);
    if (!grp) continue;
    const sr = computeScore(r.SUBID as any, r.RESULT, r.RESULT_TYPE);
    if (typeof sr.score === "number" && sr.score > 0) {
      acc.sums[grp].sum += sr.score;
      acc.sums[grp].cnt += 1;
    }
  }

  const list: BranchAggregate[] = [];
  for (const acc of map.values()) {
    const s1 = acc.sums["Score 1"].cnt
      ? acc.sums["Score 1"].sum / acc.sums["Score 1"].cnt
      : null;
    const s2 = acc.sums["Score 2"].cnt
      ? acc.sums["Score 2"].sum / acc.sums["Score 2"].cnt
      : null;
    const s3 = acc.sums["Score 3"].cnt
      ? acc.sums["Score 3"].sum / acc.sums["Score 3"].cnt
      : null;
    const region = detectRegion(acc.rating);
    const s4 = score4Map[acc.branchId] ?? 0;
    const j = judgementMap[acc.branchId] ?? 0;
    const total = computeTotal(region, s1, s2, s3, s4, j);
    list.push({
      branchId: acc.branchId,
      branchName: acc.branchName,
      solid: acc.solid,
      rating: acc.rating || "—",
      region,
      s1,
      s2,
      s3,
      s4,
      j,
      total,
      level: riskLevel(total),
    });
  }

  list.sort((a, b) => a.branchName.localeCompare(b.branchName, "mn"));
  return list;
}
