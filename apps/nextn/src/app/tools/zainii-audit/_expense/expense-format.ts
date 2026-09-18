// Зардлын хяналт — тогтмол утга, огноо/дүнгийн туслах функцүүд.
import { TranslationKey } from "@/contexts/LanguageContext";

export const DEFAULT_MIN_AMOUNT = 50_000_000;
// Серверийн тохиргоо ирэх хүртэлх түр утга (админаас өөрчилнө).
export const DEFAULT_DAYS_BACK = 7;

// [REVIEW/PERF] Сервер 20-30 мянган мөр буцааж болдог — бүгдийг зэрэг DOM-д
// зурвал browser царцана. Эхэндээ TX_PAGE мөр зурж, "Цааш үзэх" товчоор
// нэмж зурна (өгөгдөл бүрэн санах ойд байгаа тул KPI/график бүрэн хэвээр).
export const TX_PAGE = 50;
export const TX_PAGE_STEP = 50;

// Шүүлтүүр өөрчлөгдөөд дахин хайх хүртэлх хүлээлт. Огноо/дүнг шивж байхад
// завсрын утга бүрээр хүнд query явуулахгүйн тулд.
export const AUTO_SEARCH_DEBOUNCE_MS = 600;

// [AUDIT] toISOString() нь UTC тул UTC+8 бүсэд огноо буруу шилждэг —
// _RelatedPartyTool.tsx-тэй ижил локал огнооны туслах функцүүд.
export function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function today() {
  return fmtLocalDate(new Date());
}
/** Өнөөдрөөс n хоногийн өмнөх огноо (локал цагийн бүсээр). */
export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtLocalDate(d);
}

export function fmtAmount(n: number): string {
  return new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(
    n ?? 0,
  );
}

// Баталгаажуулалтын дэлгэц дэх гэрээний дүн/үлдэгдэл зэрэг "дүн бичих"
// талбаруудад зориулсан санхүүгийн формат — Word тайлангийн `fmtMillion`-тэй
// ижил en-US бүлэглэлт (16,626.6), 1 оронгийн нарийвчлал.
export function fmtMoneyInput(n: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n || 0);
}

/** fmtMoneyInput-ийн урвуу үйлдэл — таслал/зайг арилгаад тоо болгоно. */
export function parseMoneyInput(s: string): number {
  const cleaned = s.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export const CONTRACT_CURRENCIES = [
  "MNT",
  "USD",
  "EUR",
  "CNY",
  "JPY",
  "KRW",
  "RUB",
] as const;
export type ContractCurrency = (typeof CONTRACT_CURRENCIES)[number];

export type BudgetStatusOverride =
  | ""
  | "has_budget"
  | "additional_budget"
  | "no_budget";

export function rowSearchHaystack(tx: {
  book_date?: string;
  customer_code?: string;
  customer_name?: string;
  account_code?: string;
  account_name?: string;
  currency_code?: string;
  debit_amount?: number;
  description?: string;
  department_name?: string;
  co_a_group_code?: string;
  co_a_group_name?: string;
  recievable_type_code?: string;
  recievable_type_name?: string;
  book_number?: string;
  has_payment_request?: 0 | 1;
  verification_type?: string;
  verification_status?: string;
  contract_total_amount?: number;
}): string {
  return [
    tx.book_date,
    tx.customer_code,
    tx.customer_name,
    tx.account_code,
    tx.account_name,
    tx.currency_code,
    tx.debit_amount,
    fmtAmount(Number(tx.debit_amount) || 0),
    tx.description,
    tx.department_name,
    tx.co_a_group_code,
    tx.co_a_group_name,
    tx.recievable_type_code,
    tx.recievable_type_name,
    tx.book_number,
    Number(tx.has_payment_request)
      ? "төлбөрийн хүсэлттэй has payment request"
      : "төлбөрийн хүсэлтгүй no payment request",
    tx.verification_type,
    tx.verification_status,
    tx.contract_total_amount,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");
}

export const STATUS_META: Record<
  string,
  { labelKey: TranslationKey; dot: string; text: string }
> = {
  normal: {
    labelKey: "zaExpStatusNormal",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  questionable: {
    labelKey: "zaExpStatusQuestionable",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  attention: {
    labelKey: "zaExpStatusAttention",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
};

// ── "Төсөвтэй эсэх" 3-төлөвт логик (Backend-ийн getExpenseOverview-тэй
// ЯГ ижил дүрэм байх ёстой — модулийн түүхэнд яг ийм зөрүүгийн алдаа
// давтагдсан удаатай) ────────────────────────────────────────────────────
export type BudgetState = "has_budget" | "additional_budget" | "no_budget";

export function budgetState(tx: {
  has_payment_request?: 0 | 1;
  budget_type?: string;
  budget_status_override?: string;
}): BudgetState {
  const override = (tx.budget_status_override || "").trim();
  if (
    override === "has_budget" ||
    override === "additional_budget" ||
    override === "no_budget"
  ) {
    return override;
  }
  if (!Number(tx.has_payment_request)) return "no_budget";
  return (tx.budget_type || "").trim() ? "additional_budget" : "has_budget";
}

export const BUDGET_STATE_META: Record<
  BudgetState,
  { labelKey: TranslationKey; cls: string }
> = {
  has_budget: {
    labelKey: "zaExpBudgetHasBudget",
    cls: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  additional_budget: {
    labelKey: "zaExpBudgetAdditional",
    cls: "text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
  },
  no_budget: {
    labelKey: "zaExpBudgetNoBudget",
    cls: "text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
  },
};

export const CHART_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

export interface DrillSectionState<T> {
  loading: boolean;
  error: string | null;
  rows: T[] | null;
}
