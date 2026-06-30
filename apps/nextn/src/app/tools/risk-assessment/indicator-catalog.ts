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

import { type ScoreResult, type OracleValue } from "./scoring-rules";

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
    name: "Зээлийн эргэн хяналт – Covenant",
    group: 1,
    weight: 2,
    hint: "LOANREMONITORING",
  },
  {
    id: "s1-008b",
    name: "Зээлийн эргэн хяналт – Газар дээрх",
    group: 1,
    weight: 2,
    hint: "LOANREMONITORING",
  },
  {
    id: "s1-008c",
    name: "Зээлийн эргэн хяналт – Зайны",
    group: 1,
    weight: 2,
    hint: "LOANREMONITORING",
  },
  {
    id: "s1-008d",
    name: "Зээлийн эргэн хяналт – Зардлийн",
    group: 1,
    weight: 2,
    hint: "LOANREMONITORING",
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
  { id: "judgment", name: "Аудиторын үнэлэмж", group: 5, weight: 10 },

  // ──────────────────── Мэдээллийн үзүүлэлтүүд (Score 1, шинээр бичнэ) ──────
  // Эдгээр нь жингүй (weight=0), зөвхөн мэдээллийн зориулалттай үзүүлэлтүүд.
  {
    id: "x-001",
    name: "Нийт идэвхтэй харилцагчийн тоо",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-002",
    name: "Нийт идэвхтэй харилцагчийн тоо – Дижитал",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-003",
    name: "Идэвхтэй ЦХАГэрээний тоо",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-004",
    name: "Нийт картын тоо – Дебит",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-005",
    name: "Нийт картын тоо – Кредит",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-006",
    name: "Нийт идэвхтэй картын тоо – Дебит",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-007",
    name: "Нийт идэвхтэй картын тоо – Кредит",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-008",
    name: "Нэг бизнесийн харилцааны менежерийн хариуцах SME зээлдэгчийн тоо",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
  },
  {
    id: "x-009",
    name: "Тогтмол орлоготой зээлтэй харилцагчийн тоонд идэвхтэй цалингийн данстай харилцагчийн эзлэх хувь",
    group: 1,
    weight: 0,
    hint: "Шинээр бичнэ",
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
  SOLID?: OracleValue;
  BRANCHID?: OracleValue;
  BRANCHNAME?: OracleValue;
  SUBID?: OracleValue;
  RESULT?: OracleValue;
  RESULT_TYPE?: OracleValue;
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
}

export interface BranchCatalogResult {
  branchId: string;
  /** Бүлэг тус бүрийн жигнэсэн дундаж (нийт жинд харьцуулсан) */
  groupScores: Record<CatalogGroup, number | null>;
  /** Үзүүлэлт тус бүрийн дэлгэрэнгүй */
  values: Record<string, IndicatorValue>;
}

/** Автомат биш (гараар оруулах) үзүүлэлтийн тоо бүлэг тус бүрд */
export const MANUAL_COUNT_BY_GROUP: Record<CatalogGroup, number> = {
  1: CATALOG_BY_GROUP[1].filter((i) => i.autoSubid == null).length,
  2: CATALOG_BY_GROUP[2].filter((i) => i.autoSubid == null).length,
  3: CATALOG_BY_GROUP[3].filter((i) => i.autoSubid == null).length,
  4: CATALOG_BY_GROUP[4].filter((i) => i.autoSubid == null).length,
  5: CATALOG_BY_GROUP[5].filter((i) => i.autoSubid == null).length,
};
