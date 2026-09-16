// Зайны аудит — хариуны төрөл, мөрийн хязгаар, анхдагч тохиргоо.

export interface MatchedAccountRow {
  CIF_ID: string;
  FORACID: string;
  ACID: string;
  ACCT_NAME: string;
  SCHM_CODE: string;
}

export interface RelatedPartyTxRow {
  TRAN_DATE: string;
  TRAN_ID: string;
  DTH_INIT_SOL_ID: string;
  ENTRY_DATE: string;
  ENTRY_USER_ID: string;
  PSTD_DATE: string;
  PSTD_USER_ID: string;
  VFD_DATE: string;
  VFD_USER_ID: string;
  TRAN_TYPE: string;
  TRAN_SUB_TYPE: string;
  FROM_CIF: string;
  FROM_ACCOUNT: string;
  FROM_NAME: string;
  FROM_SCHM_CODE: string;
  TO_CIF: string;
  TO_ACCOUNT: string;
  TO_NAME: string;
  TO_SCHM_CODE: string;
  TRAN_AMOUNT: number;
  AMOUNT_MNT: number;
  CURRENCY: string;
  CHANNEL_ID: string;
  BANK: string;
  BANK_TYPE: string;
  A_TRAN_ID: string;
  SOL_ID: string;
  GL_SUB_HEAD_CODE: string;
  ACCT_PRTY_NUMBER: string;
  REF_NUM: string;
  DEBIT_PARTICULAR: string;
  CREDIT_PARTICULAR: string;
  DEBIT_RMKS: string;
  CREDIT_RMKS: string;
}

export interface RelatedPartySummaryRow {
  FROM_CIF: string;
  TO_CIF: string;
  CURRENCY: string;
  TOTAL_AMOUNT: number;
  TX_COUNT: number;
}

export interface RelatedPartyResult {
  accounts: MatchedAccountRow[];
  transactions: RelatedPartyTxRow[];
  summary: RelatedPartySummaryRow[];
  /** [AUDIT] Мөрийн тааз (MAX_TX_ROWS) давсан тул үр дүн тайрагдсан. */
  truncated?: boolean;
}

// [AUDIT] Node санах ой руу ачаалах мөрийн дээд хязгаар — том CIF хос,
// урт хугацааны query OOM үүсгэхээс сэргийлнэ.
export const MAX_TX_ROWS = 50_000;

// ─── Зайны аудит: "Зардлын хяналт" ─────────────────────────────────────
export interface ExpenseQualifyingCustomer {
  customer_code: string;
  customer_name: string;
  total_debit: number;
}

export interface ExpenseTxRow {
  load_date: string;
  book_date: string;
  customer_code: string;
  customer_name: string;
  account_name: string;
  account_code: string;
  currency_code: string;
  debit_amount: number;
  description: string;
  book_number: string;
  department_code: string;
  department_name: string;
  co_a_group_code: string;
  co_a_group_name: string;
  recievable_type_code: string;
  recievable_type_name: string;
  has_payment_request: 0 | 1;
  /** Харилцагчид тухайн хугацаанд ямар нэг tulbur мөр байгаа (шууд book_number тааралдаагүй ч). */
  has_customer_payment_request: 0 | 1;
  has_verification: 0 | 1;
  verification_type: string;
  contract_total_amount: number;
  contract_date: string;
  contract_number: string;
  /** Аудитор гараар оруулсан үлдэгдэл төлбөр (0 = оруулаагүй/бүрэн төлөгдсөн). */
  remaining_amount: number;
  verification_status: string;
  comment: string;
  /** Хамгийн сүүлийн холбогдох budget мөрийн description (эсвэл "" —
   *  төлбөрийн хүсэлтгүй бол ч, төлбөрийн хүсэлттэй ч budget мөргүй бол ч ""). */
  budget_type: string;
}

export interface ExpenseVerificationRow {
  bookNumber: string;
  comment: string;
  verificationType: string;
  contractTotalAmount: number;
  contractDate: string;
  contractNumber: string;
  remainingAmount: number;
  status: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

export interface ExpenseVerificationTypeRow {
  id: string;
  name: string;
  isActive: 0 | 1;
}

export interface ExpenseOverviewResult {
  /** KPI — бүх тэнцсэн харилцагчийн тоо (жагсаалт илгээдэггүй). */
  qualifyingCount: number;
  qualifyingTotalDebit: number;
  transactions: ExpenseTxRow[];
  truncated?: boolean;
}

export interface ExpenseTotalTxRow {
  load_date: string;
  book_date: string;
  customer_code: string;
  customer_name: string;
  account_name: string;
  account_code: string;
  currency_code: string;
  debit_amount: number;
  description: string;
  book_number: string;
  department_code: string;
  department_name: string;
  co_a_group_code: string;
  co_a_group_name: string;
  recievable_type_code: string;
  recievable_type_name: string;
  /** Зардлын хяналттай ЯГ ИЖИЛ логик — эс тэгвээс нэг гүйлгээ хоёр
   *  дэлгэц дээр өөр төлөвтэй харагдана. */
  has_payment_request: 0 | 1;
  has_customer_payment_request: 0 | 1;
}

export interface ExpenseGroupBreakdown {
  code: string;
  name: string;
  count: number;
  total: number;
}

export interface ExpenseTotalResult {
  transactions: ExpenseTotalTxRow[];
  byGlGroup: ExpenseGroupBreakdown[];
  byReceivableType: ExpenseGroupBreakdown[];
  totalAmount: number;
  truncated?: boolean;
}

export interface ExpensePaymentRequestRow {
  load_date: string;
  invoice_id: string;
  description: string;
  request_date: string;
  employee_name: string;
  sol_id: string;
  employee_code: string;
  department_name: string;
  book_number: string;
  request_amount: number;
  book_date: string;
  account_number: string;
  bank_name: string;
  customer_code: string;
  customer_name: string;
  currency_code: string;
  gl_number: string;
  tender_method_name: string;
  info_name: string;
  purpose: string;
}

export interface ExpenseAttachmentRow {
  invoice_id: string;
  book_number: string;
  customer_code: string;
  customer_name: string;
  content_id: string;
  file_name: string;
  file_extension: string;
  full_url: string;
}

export interface ExpenseBudgetChangeRow {
  load_date: string;
  book_date: string;
  book_number: string;
  employee_name: string;
  sol_id: string;
  employee_code: string;
  department_name: string;
  request_amount: number;
  description: string;
  total_amount: number;
  to_activity_name: string;
  from_activity_name: string;
  from_activity_dtl_name: string;
  to_activity_dtl_name: string;
  amount: number;
  related_book_number: string;
  from_employee_name: string;
  purpose: string;
}

export const MAX_EXPENSE_TX_ROWS = 20_000;
export const MAX_EXPENSE_TOTAL_ROWS = 10_000;
export const MAX_EXPENSE_DRILLDOWN_ROWS = 5_000;
export const MAX_EXPENSE_SIDE_ROWS = 1_000;
export const MAX_RELATIONS_ROWS = 5_000;
export const DEFAULT_MIN_AMOUNT = 50_000_000;

// ─── Хамааралтай / Холбоотой (hamaaral / holbootoi — гадны ETL хүснэгт) ────
export interface HamaaralRow {
  cif: string;
  cifname: string;
  empid: string;
  empname: string;
  typename: string;
  status: string;
}

export interface ExpenseRelationsResult {
  hamaaral: Record<string, HamaaralRow[]>;
  holbootoi: string[];
}

// ─── Зардлын хяналтын Word тайлан ───────────────────────────────────────────
export interface ExpenseReportTop5Row {
  customer_name: string;
  customer_code: string;
  debit_amount: number;
  description: string;
}

export interface ExpenseReportCategoryCustomerRow {
  customer_code: string;
  customer_name: string;
  description: string;
  contract_date: string;
  contract_number: string;
  contract_total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  budget_type: string;
}

export interface ExpenseReportCategory {
  name: string;
  totalAmount: number;
  customers: ExpenseReportCategoryCustomerRow[];
}

export interface ExpenseReportData {
  reportNumber: string;
  conclusionText: string;
  startDate: string;
  endDate: string;
  minAmount: number;
  scopeCategoryNames: string[];
  qualifyingCount: number;
  qualifyingTotalDebit: number;
  top5: ExpenseReportTop5Row[];
  categories: ExpenseReportCategory[];
  uncategorizedTotal: number;
}

/** ClickHouse JSON often serializes UInt64/Float64 as strings — coerce for charts. */
export function toBreakdown(
  rows: ExpenseGroupBreakdown[],
): ExpenseGroupBreakdown[] {
  return rows.map((r) => ({
    code: r.code == null ? "" : String(r.code),
    name: r.name == null ? "" : String(r.name),
    count: Number(r.count) || 0,
    total: Number(r.total) || 0,
  }));
}

// ─── Зайны аудит: "Харилцсан гүйлгээ" (related-party transactions) ─────────
// Given a set of CIF/FORACID identifiers, finds direct internal transactions
// between any two of them within a date range — flags potential related-party
// / self-dealing activity for continuous auditing.
export interface ZainiiAuditSettings {
  /** Зардлын хяналтын "доод дүн" шүүлтүүрийн анхдагч утга (₮) */
  defaultMinAmount: number;
  /** Хайлтын анхдагч хугацаа — өнөөдрөөс хойш хэдэн ХОНОГ ухрахыг заана */
  defaultDaysBack: number;
}

export const ZAINII_AUDIT_SETTING_DEFAULTS: ZainiiAuditSettings = {
  defaultMinAmount: 50_000_000,
  defaultDaysBack: 7,
};
