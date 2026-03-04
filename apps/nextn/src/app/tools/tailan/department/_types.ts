// ─── Constants ────────────────────────────────────────────────────────────────

export const getCurrentYear = () => new Date().getFullYear();
export const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);
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
    id: "s1", num: "I", label: "ТУЗ болон аудитын хорооны төлөв", color: "blue", icon: "bar", weight: 30,
    heading: "ТУЗ БОЛОН АУДИТЫН ХОРООНИЙ ТӨЛӨВ БАЙДАЛ",
    subtitle: "Дата анализийн ажлын үр дүн аудитын үйл ажиллагааг дэмжсэн байдал",
  },
  {
    id: "s2", num: "II", label: "Харилцагчийн төлөв", color: "emerald", icon: "users", weight: 25,
    heading: "ХАРИЛЦАГЧИЙН ТӨЛӨВ БАЙДАЛ",
  },
  {
    id: "s3", num: "III", label: "Дотоод үйл ажиллагааны төлөв", color: "amber", icon: "settings", weight: 25,
    heading: "ДОТООД ҮЙЛ АЖИЛЛАГААНЫ ТӨЛӨВ БАЙДАЛ",
  },
  {
    id: "s4", num: "IV", label: "Сургалт хөгжлийн төлөв", color: "purple", icon: "book", weight: 20,
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
  images?: { id: string; dataUrl: string; width: number }[];
}

export interface Section2TaskRow {
  order: number;
  title: string;
  result: string;
  period: string;
  completion: string;
  employeeName?: string;
  images?: { id: string; dataUrl: string; width: number }[];
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
  type?: "kpi" | "dashboard" | "section2table" | "section14table";
  rows: KpiRow[];
  dashboardRows?: DashboardRow[];
  section2Rows?: Section2TaskRow[];
  section14Rows?: Section14Row[];
  section14Text?: string;
}

export interface SectionReport {
  content: string;
  achievements: string;
  issues: string;
  score: string;
  kpiTable?: KpiSubSection[];
  s2kpiTable?: KpiSubSection[];
}

// ─── Default data ─────────────────────────────────────────────────────────────

export const DEFAULT_S1_KPI: KpiSubSection[] = [
  {
    id: "1.1",
    groupLabel: "Санхүүгийн төлөв байдал",
    rows: [
      { indicator: "Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал.", weight: 10, score: "", evaluatedBy: "Аудитын хорооны дарга үнэлэх:" },
      { indicator: "Дата анализын үр дүнгээр аудитын нөөц, цаг хугацаа хэмнэсэн байдал.", weight: 10, score: "", evaluatedBy: "Аудитын хорооны дарга үнэлэх:" },
    ],
  },
  {
    id: "1.2",
    groupLabel: "Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал",
    type: "dashboard",
    rows: [],
    dashboardRows: [],
  },
  {
    id: "1.3",
    groupLabel: "Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулах ажил",
    type: "section2table",
    rows: [],
    section2Rows: [],
  },
  {
    id: "1.4",
    groupLabel: "Дата анализийн үр дүнгээр аудитын нөөц, цаг хугацаа хэмнэсэн байдал",
    type: "section14table",
    rows: [],
    section14Rows: [],
    section14Text: "",
  },
];

export const DEFAULT_S2_KPI: KpiSubSection[] = [
  {
    id: "2.1",
    groupLabel: "Харилцагчийн төлөв байдал",
    rows: [
      { indicator: "Шинэ тутам үүсэж буй эрсдэлийг тодорхойлох анализ болон ахисан түвшний дата анализын ажлын чанар, үр дүн.", weight: 10, score: "", evaluatedBy: "ДАГ-ын захирал үнэлэх:" },
      { indicator: "АудитСолюшн төслийн хэрэгжилт, үр дүн.", weight: 10, score: "", evaluatedBy: "ДАГ-ын захирал үнэлэх:" },
      { indicator: "RPA технологи ашиглан автоматжуулсан ажлын чанар, үр дүн.", weight: 10, score: "", evaluatedBy: "ДАГ-ын захирал үнэлэх:" },
      { indicator: "Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын чанар, үр дүн", weight: 10, score: "", evaluatedBy: "ДАГ-ын захирал үнэлэх:" },
      { indicator: "Дашбоард хөгжүүлэлтийн чанар, үр дүн", weight: 10, score: "", evaluatedBy: "ДАГ-ын захирал үнэлэх:" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const emptySection = (): SectionReport => ({
  content: "", achievements: "", issues: "", score: "",
});

export function scoreLabel(n: number): string {
  if (n >= 4.5) return "Маш сайн";
  if (n >= 3.5) return "Сайн";
  if (n >= 2.5) return "Хангалттай";
  if (n >= 1.5) return "Дунд";
  return "Хангалтгүй";
}
