/**
 * Эрсдэлийн үнэлгээний жинхэнэ үзүүлэлтийн каталог.
 *
 * Энд бүх 41 (+ нэмэлт) үзүүлэлтийг бүлэглэл (Score 1–5),
 * хувийн жин (%), Oracle-аас автомат татах SUBID-тай эсэхийг
 * нэгтгэж тодорхойлно.
 *
 * `autoSubid` байвал → INDICATOR_RULES (scoring-rules.ts)-аар Oracle-н
 * RESULT-аас автомат оноо тооцоологдоно. `autoSubid` байхгүй бол гараар
 * оруулах шаардлагатай (UI-д "Гар" товчин дотор input харагдана).
 */

import {
  computeScore,
  type IndicatorRule,
  type ScoreResult,
} from "./scoring-rules";

export type CatalogGroup = 1 | 2 | 3 | 4 | 5;

export interface CatalogIndicator {
  /** Тогтвортой ID (localStorage-д хадгалахад ашиглана) */
  id: string;
  /** Үзүүлэлтийн нэр */
  name: string;
  /** Score бүлэг (1..5). 5 = Judgement Score */
  group: CatalogGroup;
  /** Хувийн жин (%) — нийт тайлан 100% */
  weight: number;
  /** Хэрэв Oracle SUBID-тай таарвал автоматаар тооцооллоно */
  autoSubid?: number;
  /** UI-д тайлбар (tooltip) */
  hint?: string;
}

export const INDICATOR_CATALOG: CatalogIndicator[] = [
  // ────────────────────────── Score 1 (35%) ──────────────────────────
  {
    id: "s1-001",
    name: "Салбарын үнэлгээний хуудасны үнэлгээ",
    group: 1,
    weight: 2,
  },
  {
    id: "s1-002",
    name: "Анхаарал хандуулах зээл",
    group: 1,
    weight: 3,
    autoSubid: 5,
  },
  {
    id: "s1-003",
    name: "Даатгалын үйл ажиллагаа",
    group: 1,
    weight: 2,
    autoSubid: 21,
  },
  {
    id: "s1-004",
    name: "Дотоод үнэлгээний ашгийн төлөвлөгөөний биелэлт",
    group: 1,
    weight: 3,
    autoSubid: 3,
  },
  {
    id: "s1-005",
    name: "Зээлийн материал буцаалт",
    group: 1,
    weight: 2,
    autoSubid: 20,
  },
  {
    id: "s1-006",
    name: "Зээлийн төлөвлөгөөний биелэлт",
    group: 1,
    weight: 3,
    autoSubid: 1,
  },
  {
    id: "s1-007",
    name: "Зээлийн хэрэг бүртгэлийн үйл ажиллагаа",
    group: 1,
    weight: 2,
    autoSubid: 19,
  },
  {
    id: "s1-008",
    name: "Зээлийн эргэн хяналт",
    group: 1,
    weight: 2,
    autoSubid: 18,
  },
  {
    id: "s1-009",
    name: "Зээлийн өр цуглуулах үйл ажиллагаа",
    group: 1,
    weight: 2,
    autoSubid: 17,
  },
  {
    id: "s1-010",
    name: "ОН-н зах зээлд эзлэх байр суурь",
    group: 1,
    weight: 2,
    autoSubid: 27,
  },
  {
    id: "s1-011",
    name: "Салбарын зэрэглэл",
    group: 1,
    weight: 1,
    autoSubid: 11,
  },
  { id: "s1-012", name: "Тоон төлөвлөгөө", group: 1, weight: 2 },
  {
    id: "s1-013",
    name: "Хүүгийн бус орлого",
    group: 1,
    weight: 2,
    autoSubid: 4,
  },
  { id: "s1-014", name: "Чанаргүй зээл", group: 1, weight: 3, autoSubid: 6 },
  {
    id: "s1-015",
    name: "Чанаргүй зээлийн тоо",
    group: 1,
    weight: 2,
    autoSubid: 7,
  },
  {
    id: "s1-016",
    name: "Эх үүсвэрийн төлөвлөгөөний биелэлт",
    group: 1,
    weight: 3,
    autoSubid: 2,
  },

  // ────────────────────────── Score 2 (20%) ──────────────────────────
  { id: "s2-001", name: "Ёс зүйн зөрчил гаргасан эсэх", group: 2, weight: 3 },
  {
    id: "s2-002",
    name: "Ажилтнуудын ажилласан жилийн дундаж",
    group: 2,
    weight: 2,
    autoSubid: 12,
  },
  {
    id: "s2-003",
    name: "Ажилтнуудын ажлын гүйцэтгэлийн үнэлгээний дундаж",
    group: 2,
    weight: 2,
  },
  { id: "s2-004", name: "Гарсан гомдлын тоо", group: 2, weight: 3 },
  {
    id: "s2-005",
    name: "Монгол банкны үнэлгээ",
    group: 2,
    weight: 2,
    autoSubid: 28,
  },
  {
    id: "s2-006",
    name: "Нэг ажилтанд ногдох сургалтын цаг",
    group: 2,
    weight: 2,
    autoSubid: 16,
  },
  {
    id: "s2-007",
    name: "Орон тоо бүрэн эсэх",
    group: 2,
    weight: 2,
    autoSubid: 15,
  },
  {
    id: "s2-008",
    name: "Удирдах ажилтнуудын ажилласан жил",
    group: 2,
    weight: 2,
    autoSubid: 13,
  },
  {
    id: "s2-009",
    name: "Хүний нөөцийн эргэц",
    group: 2,
    weight: 2,
    autoSubid: 14,
  },

  // ────────────────────────── Score 3 (20%) ──────────────────────────
  {
    id: "s3-001",
    name: "Follow up үнэлгээ",
    group: 3,
    weight: 4,
    autoSubid: 33,
  },
  { id: "s3-002", name: "Зайны аудитын үнэлгээ", group: 3, weight: 4 },
  {
    id: "s3-003",
    name: "Өмнөх аудитаас хойшхи хугацаа",
    group: 3,
    weight: 4,
    autoSubid: 32,
  },
  {
    id: "s3-004",
    name: "Өмнөх аудитын үнэлгээ",
    group: 3,
    weight: 4,
    autoSubid: 30,
  },
  {
    id: "s3-005",
    name: "Өндөр эрсдэлтэй асуудлын тоо",
    group: 3,
    weight: 4,
    autoSubid: 31,
  },

  // ────────────────────────── Score 4 (15%) ──────────────────────────
  {
    id: "s4-001",
    name: "Банкны нууцын зэрэглэлтэй мэдээлэл задруулсан эсэх",
    group: 4,
    weight: 2,
  },
  { id: "s4-002", name: "Баримтын зөрчил", group: 4, weight: 2, autoSubid: 24 },
  {
    id: "s4-003",
    name: "Бүртгэлийн зайны хяналтын үнэлгээ",
    group: 4,
    weight: 2,
    autoSubid: 25,
  },
  {
    id: "s4-004",
    name: "Илүүдэл дутагдал гарсан эсэх",
    group: 4,
    weight: 2,
    autoSubid: 26,
  },
  { id: "s4-005", name: "Мэдлэгийн түвшин", group: 4, weight: 1 },
  {
    id: "s4-006",
    name: "Хамрах хугацаанд олгосон чанаргүй зээл",
    group: 4,
    weight: 2,
    autoSubid: 22,
  },
  {
    id: "s4-007",
    name: "Харилцагчийн нууцын зэрэглэлтэй мэдээлэл задруулсан эсэх",
    group: 4,
    weight: 2,
  },
  {
    id: "s4-008",
    name: "Хувийн хэргийн зөрчил",
    group: 4,
    weight: 2,
    autoSubid: 23,
  },

  // ────────────────────── Judgement Score (10%) ──────────────────────
  { id: "j-001", name: "Аудиторын үнэлэмж", group: 5, weight: 10 },

  // ──────────────────── Нэмэлт / тэмдэглэлийн үзүүлэлт ────────────────────
  // Эдгээр нь rubric-д бичигдсэн боловч жин/бүлэглэл нь ил тодорхойгүй
  // үзүүлэлтүүд. Тооцоонд оруулахгүй (weight=0), зөвхөн бүртгэлийн
  // зориулалттай.
  {
    id: "x-001",
    name: "Үйл ажиллагааг сайжруулах шинэ програм хангамж, хэрэгсэл нэвтэрсэн эсэх",
    group: 4,
    weight: 0,
    hint: "Жин тогтоогдоогүй (нэмэлт мэдээлэл)",
  },
  {
    id: "x-002",
    name: "Банкны хэмжээнд ёс зүйтэй холбоотой зөрчил гарсан эсэх",
    group: 4,
    weight: 0,
    hint: "Жин тогтоогдоогүй (нэмэлт мэдээлэл)",
  },
];

export const CATALOG_BY_GROUP: Record<CatalogGroup, CatalogIndicator[]> = {
  1: INDICATOR_CATALOG.filter((i) => i.group === 1),
  2: INDICATOR_CATALOG.filter((i) => i.group === 2),
  3: INDICATOR_CATALOG.filter((i) => i.group === 3),
  4: INDICATOR_CATALOG.filter((i) => i.group === 4),
  5: INDICATOR_CATALOG.filter((i) => i.group === 5),
};

export const GROUP_LABEL: Record<CatalogGroup, string> = {
  1: "Score 1",
  2: "Score 2",
  3: "Score 3",
  4: "Score 4",
  5: "Judgement Score",
};

// ─────────────────────────────────────────────────────────────────────────────
// Манай auto / manual blendтэй тооцооны функц
// ─────────────────────────────────────────────────────────────────────────────

export type ManualMap = Record<string, Record<string, number>>;
// Salbar bүрийн manual оруулсан утга:
// manual[branchId]["s1-001"] = 3.5 ...

export interface BranchInputRow {
  SOLID?: any;
  BRANCHID?: any;
  BRANCHNAME?: any;
  SUBID?: any;
  RESULT?: any;
  RESULT_TYPE?: any;
}

export interface IndicatorValue {
  indicator: CatalogIndicator;
  /** Эцсийн тооцоонд орох оноо (manual override > auto) */
  score: number | null;
  /** Гарал үүсэл */
  source: "manual" | "auto" | "none";
  /** Auto тооцооны үед үндсэн RESULT, label */
  autoRaw?: string;
  autoLabel?: string | null;
  autoRule?: IndicatorRule;
}

export interface BranchCatalogResult {
  branchId: string;
  /** Бүлэг тус бүрийн жигнэсэн дундаж (нийт жинд харьцуулсан) */
  groupScores: Record<CatalogGroup, number | null>;
  /** Үзүүлэлт тус бүрийн дэлгэрэнгүй */
  values: Record<string, IndicatorValue>;
}

/**
 * Нэг салбарын Oracle мөрнүүд + хэрэглэгчийн гар утгуудаас бүлэг бүрийн
 * жигнэсэн дундаж оноог тооцоолно.
 */
export function evaluateBranch(
  branchId: string,
  rows: BranchInputRow[],
  manual: Record<string, number> | undefined,
): BranchCatalogResult {
  // SUBID → ScoreResult (Oracle-аас computeScore-аар татна)
  const autoBySubid = new Map<
    number,
    {
      score: ScoreResult;
      raw: string;
      label: string | null;
      rule?: IndicatorRule;
    }
  >();
  for (const r of rows) {
    const sid = Number(r.SUBID);
    if (!Number.isFinite(sid)) continue;
    if (autoBySubid.has(sid)) continue;
    const sr = computeScore(sid, r.RESULT, r.RESULT_TYPE);
    autoBySubid.set(sid, {
      score: sr.score,
      raw: r.RESULT == null ? "" : String(r.RESULT),
      label: sr.label,
      rule: sr.rule,
    });
  }

  const values: Record<string, IndicatorValue> = {};
  const sumByGroup: Record<CatalogGroup, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  const wByGroup: Record<CatalogGroup, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const ind of INDICATOR_CATALOG) {
    let score: number | null = null;
    let source: IndicatorValue["source"] = "none";
    let autoRaw: string | undefined;
    let autoLabel: string | null | undefined;
    let autoRule: IndicatorRule | undefined;

    // 1) Manual override эхний ээлжинд
    const manualVal = manual?.[ind.id];
    if (typeof manualVal === "number" && manualVal > 0) {
      score = manualVal;
      source = "manual";
    } else if (ind.autoSubid != null) {
      // 2) Auto Oracle-аас
      const a = autoBySubid.get(ind.autoSubid);
      if (a) {
        autoRaw = a.raw;
        autoLabel = a.label;
        autoRule = a.rule;
        if (typeof a.score === "number" && a.score > 0) {
          score = a.score;
          source = "auto";
        }
      }
    }

    values[ind.id] = {
      indicator: ind,
      score,
      source,
      autoRaw,
      autoLabel,
      autoRule,
    };

    if (score != null && ind.weight > 0) {
      sumByGroup[ind.group] += score * ind.weight;
      wByGroup[ind.group] += ind.weight;
    }
  }

  const groupScores: Record<CatalogGroup, number | null> = {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
  };
  (Object.keys(groupScores) as unknown as CatalogGroup[]).forEach((g) => {
    const w = wByGroup[g as CatalogGroup];
    if (w > 0)
      groupScores[g as CatalogGroup] = sumByGroup[g as CatalogGroup] / w;
  });

  return { branchId, groupScores, values };
}

/** Автомат биш (гараар оруулах) үзүүлэлтийн тоо бүлэг тус бүрд */
export const MANUAL_COUNT_BY_GROUP: Record<CatalogGroup, number> = {
  1: CATALOG_BY_GROUP[1].filter((i) => i.autoSubid == null).length,
  2: CATALOG_BY_GROUP[2].filter((i) => i.autoSubid == null).length,
  3: CATALOG_BY_GROUP[3].filter((i) => i.autoSubid == null).length,
  4: CATALOG_BY_GROUP[4].filter((i) => i.autoSubid == null).length,
  5: CATALOG_BY_GROUP[5].filter((i) => i.autoSubid == null).length,
};
