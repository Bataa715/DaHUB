// ─── Constants ────────────────────────────────────────────────────────────────

export const getCurrentYear = () => new Date().getFullYear();
export const getCurrentQuarter = () =>
  Math.ceil((new Date().getMonth() + 1) / 3);
export const Q_NAMES = ["I", "II", "III", "IV"];

export const PRODUCT_TYPES = [
  "Өгөгдөл боловсруулалт",
  "Дашбоард",
  "Процесс автоматжуулалт",
  "Predictive анализ",
];

// ─── Section definitions ──────────────────────────────────────────────────────

export const SECTION_DEFS = [
  {
    id: "s1",
    num: "I",
    label: "ТУЗ болон аудитын хорооны төлөв",
    color: "blue",
    icon: "bar",
    weight: 30,
    heading: "ТУЗ БОЛОН АУДИТЫН ХОРООНИЙ ТӨЛӨВ БАЙДАЛ",
    subtitle:
      "Дата анализийн ажлын үр дүн аудитын үйл ажиллагааг дэмжсэн байдал",
  },
  {
    id: "s2",
    num: "II",
    label: "Харилцагчийн төлөв",
    color: "emerald",
    icon: "users",
    weight: 25,
    heading: "ХАРИЛЦАГЧИЙН ТӨЛӨВ БАЙДАЛ",
  },
  {
    id: "s3",
    num: "III",
    label: "Дотоод үйл ажиллагааны төлөв",
    color: "amber",
    icon: "settings",
    weight: 25,
    heading: "ДОТООД ҮЙЛ АЖИЛЛАГААНЫ ТӨЛӨВ БАЙДАЛ",
  },
  {
    id: "s4",
    num: "IV",
    label: "Сургалт хөгжлийн төлөв",
    color: "purple",
    icon: "book",
    weight: 20,
    heading: "СУРГАЛТ ХӨГЖЛИЙН ТӨЛӨВ БАЙДАЛ",
  },
] as const;

export type SectionId = (typeof SECTION_DEFS)[number]["id"];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KpiRow {
  indicator: string;
  weight: number;
  score: string;
  evaluatedBy: string;
}

export interface DashboardRow {
  title: string;
  description: string;
  images?: { id: string; dataUrl: string; width: number; height?: number }[];
}

export interface Section2TaskRow {
  order: number;
  title: string;
  result: string;
  period: string;
  completion: string;
  employeeName?: string;
  images?: { id: string; dataUrl: string; width: number; height?: number }[];
}

export interface Section23Row {
  title: string;
  usage: string;
  clientScore: string;
  employeeName?: string;
}

export interface Section42Row {
  employeeName: string;
  text: string;
}

export interface Section43Row {
  employeeName: string;
  training: string;
  organizer: string;
  type: string;
  date: string;
  format: string;
  hours: string;
  meetsAuditGoal: string;
  sharedKnowledge: string;
}

export interface RichTextContent {
  id: string;
  type: "bullet" | "image";
  text?: string;
  dataUrl?: string;
  width?: number;
  height?: number;
}

export interface RichTextItem {
  id: string;
  title: string;
  bullets: string[];
  images?: { id: string; dataUrl: string; width: number; height?: number }[];
  contents?: RichTextContent[];
}

export interface Section14Row {
  title: string;
  productType: string;
  savedDays: string;
  group: "new" | "used";
  employeeName?: string;
}

export interface KpiSubSection {
  id: string;
  groupLabel: string;
  type?:
    | "kpi"
    | "dashboard"
    | "section2table"
    | "section14table"
    | "richtextlist"
    | "section23table"
    | "section24table"
    | "section33table"
    | "section34table"
    | "section42knowledge"
    | "section43trainings";
  rows: KpiRow[];
  dashboardRows?: DashboardRow[];
  section2Rows?: Section2TaskRow[];
  section14Rows?: Section14Row[];
  section14Text?: string;
  richTextRows?: RichTextItem[];
  section23Rows?: Section23Row[];
  section24Rows?: Section2TaskRow[];
  section33Rows?: Section23Row[];
  section34Rows?: Section23Row[];
  section42Rows?: Section42Row[];
  section43Rows?: Section43Row[];
}

export interface SectionReport {
  content: string;
  achievements: string;
  issues: string;
  score: string;
  kpiTable?: KpiSubSection[];
  s2kpiTable?: KpiSubSection[];
  s3kpiTable?: KpiSubSection[];
  s4kpiTable?: KpiSubSection[];
}

// ─── Default data ─────────────────────────────────────────────────────────────

export const DEFAULT_S1_KPI: KpiSubSection[] = [
  {
    id: "1.1",
    groupLabel: "Санхүүгийн төлөв байдал",
    rows: [
      {
        indicator:
          "Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал:",
        weight: 10,
        score: "",
        evaluatedBy: "Аудитын хорооны дарга үнэлэх:",
      },
      {
        indicator:
          "Дата анализын үр дүнгээр аудитын нөөц, цаг хугацаа хэмнэсэн байдал:",
        weight: 10,
        score: "",
        evaluatedBy: "Аудитын хорооны дарга үнэлэх:",
      },
    ],
  },
  {
    id: "1.2",
    groupLabel:
      "Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал",
    type: "dashboard",
    rows: [],
    dashboardRows: [],
  },
  {
    id: "1.3",
    groupLabel:
      "Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулах ажил",
    type: "section2table",
    rows: [],
    section2Rows: [],
  },
  {
    id: "1.4",
    groupLabel:
      "Дата анализийн үр дүнгээр аудитын нөөц, цаг хугацаа хэмнэсэн байдал:",
    type: "section14table",
    rows: [],
    section14Rows: [],
    section14Text: "",
  },
];

export const DEFAULT_S2_KPI: KpiSubSection[] = [
  {
    id: "2.1",
    groupLabel: "Харилцагчийн төлөв байдал (KPI)",
    rows: [
      {
        indicator: "АудитСолюшн төслийн хэрэгжилт, үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
      {
        indicator: "RPA технологи ашиглан автоматжуулсан ажлын чанар, үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "",
      },
      {
        indicator:
          "Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын чанар, үр дүн",
        weight: 10,
        score: "",
        evaluatedBy: "",
      },
      {
        indicator: "Дашбоард хөгжүүлэлтийн чанар, үр дүн",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
    ],
  },
  {
    id: "2.2",
    groupLabel: "",
    type: "richtextlist" as const,
    rows: [],
    richTextRows: [],
  },
  {
    id: "2.3",
    groupLabel: "Шинээр хөгжүүлсэн өгөгдөл боловсруулалтын чанар, үр дүн",
    type: "section23table" as const,
    rows: [],
    section23Rows: [],
  },
  {
    id: "2.4",
    groupLabel: "Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар үр дүн",
    type: "section24table" as const,
    rows: [],
    section24Rows: [],
  },
];

// ─── Default S3 KPI (Дотоод үйл ажиллагааны төлөв байдал) ─────────────────────

export const DEFAULT_S3_KPI: KpiSubSection[] = [
  {
    id: "s3g1",
    groupLabel: "Дотоод үйл ажиллагааны төлөв байдал",
    rows: [
      {
        indicator: "Үйл ажиллагааны төлөвлөгөөний гүйцэтгэл",
        weight: 10,
        score: "",
        evaluatedBy: "",
      },
      {
        indicator:
          "Өгөгдөл боловсруулалт, автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал",
        weight: 5,
        score: "",
        evaluatedBy: "",
      },
      {
        indicator: "Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал",
        weight: 5,
        score: "",
        evaluatedBy: "",
      },
    ],
  },
  {
    id: "3.2",
    groupLabel: "Үйл ажиллагааны төлөвлөгөөний гүйцэтгэл",
    type: "richtextlist" as const,
    rows: [],
    richTextRows: [],
  },
  {
    id: "3.3",
    groupLabel:
      "Өгөгдөл боловсруулалт, автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал",
    type: "section33table" as const,
    rows: [],
    section33Rows: [],
  },
  {
    id: "3.4",
    groupLabel: "Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал",
    type: "section34table" as const,
    rows: [],
    section34Rows: [],
  },
];

// ─── Default S4 KPI (Сургалт, хөгжлийн төлөв байдал) ────────────────────────

export const DEFAULT_S4_KPI: KpiSubSection[] = [
  {
    id: "s4g1",
    groupLabel: "Сургалт, хөгжлийн төлөв байдал",
    rows: [
      {
        indicator:
          "Нэгжийн зорилго, зорилт биелүүлэх чиглэлд сургалтад хамрагдсан байдал болон ДАГ-ын ажилтнуудыг дата анализын ашиглах чиглэлд сургалт, мэдлэгээр хангасан байдал үр дүн",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
    ],
  },
  {
    id: "4.2",
    groupLabel: "Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал",
    type: "richtextlist" as const,
    rows: [],
    richTextRows: [],
  },
  {
    id: "4.3",
    groupLabel: "",
    type: "section43trainings" as const,
    rows: [],
    section43Rows: [],
  },
];

// ─── Default Нэгтгэл KPI (БҮХ-НЫ НЭГТГЭЛ full breakdown table) ──────────────

export const DEFAULT_NEGTGEL_KPI: KpiSubSection[] = [
  {
    id: "n1",
    groupLabel: "ТУЗ болон АХ-ны төлөв байдал",
    rows: [
      {
        indicator:
          "Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал:",
        weight: 10,
        score: "",
        evaluatedBy: "Аудитын хорооны дарга үнэлэх:",
      },
      {
        indicator:
          "Дата анализын үр дүнгээр аудитын нөөц, цаг хугацаа хэмнэсэн байдал.",
        weight: 10,
        score: "",
        evaluatedBy: "Аудитын хорооны дарга үнэлэх:",
      },
    ],
  },
  {
    id: "n2",
    groupLabel: "Харилцагчийн төлөв байдал",
    rows: [
      {
        indicator: "АудитСолюшн төслийн хэрэгжилт, үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
      {
        indicator: "RPA технологи ашиглан автоматжуулсан ажлын чанар, үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
      {
        indicator:
          "Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын чанар, үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
      {
        indicator: "Дашбоард хөгжүүлэлтийн чанар, үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
      {
        indicator:
          "Шинэ тутам үүсэж буй эрсдэлийг тодорхойлох анализ болон ахисан түвшний дата анализийн ажлийн чанар, үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
    ],
  },
  {
    id: "n3",
    groupLabel: "Дотоод үйл ажиллагааны төлөв байдал",
    rows: [
      {
        indicator: "Үйл ажиллагааны төлөвлөгөөний гүйцэтгэл.",
        weight: 10,
        score: "",
        evaluatedBy: "",
      },
      {
        indicator:
          "Өгөгдөл боловсруулалт, автоматжуулалтын шүүг хугацааны гүйцэтгэлсэн байдал.",
        weight: 5,
        score: "",
        evaluatedBy: "",
      },
      {
        indicator: "Дашбоардын хэвийн ажиллагааг хангаж ажиллассан байдал.",
        weight: 5,
        score: "",
        evaluatedBy: "",
      },
    ],
  },
  {
    id: "n4",
    groupLabel: "Сургалт, хөгжлийн төлөв байдал",
    rows: [
      {
        indicator:
          "Нэгжийн зорилго, зорилт биелүүлэх чиглэлд сургалтад хамрагдсан байдал болон ДАГ-ын ажилтуудын дата анализын ашиглах чиглэлд сургалт, мэдлэгэр хангасан байдал үр дүн.",
        weight: 10,
        score: "",
        evaluatedBy: "ДАГ-ын захирал үнэлэх:",
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge loaded KPI subsections with defaults.
 * - Preserves loaded data for matching ids
 * - Ensures every default subsection is present (adds missing ones)
 * - Appends any extra loaded subsections not in defaults
 */
export function mergeKpi(
  loaded: KpiSubSection[] | undefined | null,
  defaults: KpiSubSection[],
): KpiSubSection[] {
  if (!loaded || loaded.length === 0) return defaults;
  const loadedMap = new Map(loaded.map((s) => [s.id, s]));
  const inDefaults = new Set(defaults.map((s) => s.id));
  const extras = loaded.filter((s) => !inDefaults.has(s.id));
  return [...defaults.map((s) => loadedMap.get(s.id) ?? s), ...extras];
}

/**
 * Like mergeKpi but also merges rows within each section by indicator text.
 * This ensures newly added default rows appear even if the section already
 * exists in saved data.
 */
export function mergeKpiWithRows(
  loaded: KpiSubSection[] | undefined | null,
  defaults: KpiSubSection[],
): KpiSubSection[] {
  const sections = mergeKpi(loaded, defaults);
  if (!loaded || loaded.length === 0) return sections;
  const loadedMap = new Map(loaded.map((s) => [s.id, s]));
  const defaultsMap = new Map(defaults.map((s) => [s.id, s]));
  return sections.map((sec) => {
    const loadedSec = loadedMap.get(sec.id);
    const defSec = defaultsMap.get(sec.id);
    if (!loadedSec || !defSec) return sec;
    const loadedIndicators = new Set(loadedSec.rows.map((r) => r.indicator));
    const missingRows = defSec.rows.filter(
      (r) => !loadedIndicators.has(r.indicator),
    );
    if (missingRows.length === 0) return sec;
    return { ...sec, rows: [...sec.rows, ...missingRows] };
  });
}

export const emptySection = (): SectionReport => ({
  content: "",
  achievements: "",
  issues: "",
  score: "",
});

export function scoreLabel(n: number): string {
  if (n >= 4.5) return "Маш сайн";
  if (n >= 3.5) return "Сайн";
  if (n >= 2.5) return "Хангалттай";
  if (n >= 1.5) return "Дунд";
  return "Хангалтгүй";
}
