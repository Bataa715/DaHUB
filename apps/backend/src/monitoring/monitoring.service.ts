import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import {
  RelatedPartyTransactionsDto,
  ExpenseOverviewDto,
  ExpensePaymentRequestsDto,
  ExpenseAttachmentsDto,
  ExpenseBudgetChangesDto,
  ExpenseVerificationDto,
  ExpenseTotalDto,
  CreateVerificationTypeDto,
  UpdateVerificationTypeDto,
} from "./dto/monitoring.dto";
import { nowCH } from "../clickhouse/clickhouse.service";

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
const MAX_TX_ROWS = 50_000;

// ─── Monitoring Box: "Зардлын хяналт" (expense monitoring) ────────────────
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
  has_verification: 0 | 1;
  verification_type: string;
  contract_total_amount: number;
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
  qualifyingCustomers: ExpenseQualifyingCustomer[];
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
  physical_path: string;
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

const MAX_EXPENSE_TX_ROWS = 20_000;
const MAX_EXPENSE_TOTAL_ROWS = 30_000;
const MAX_EXPENSE_DRILLDOWN_ROWS = 5_000;
const MAX_EXPENSE_SIDE_ROWS = 1_000;
const DEFAULT_MIN_AMOUNT = 50_000_000;

// ─── Monitoring Box: "Харилцсан гүйлгээ" (related-party transactions) ─────────
// Given a set of CIF/FORACID identifiers, finds direct internal transactions
// between any two of them within a date range — flags potential related-party
// / self-dealing activity for continuous auditing.
@Injectable()
export class MonitoringService {
  constructor(private readonly clickhouse: ClickHouseService) {}

  private normalizeCustomerIds(customerIds: string[]): string[] {
    const cleaned = Array.from(
      new Set(customerIds.map((x) => String(x).trim()).filter(Boolean)),
    );
    if (cleaned.length < 2) {
      throw new BadRequestException(
        "Хамгийн багадаа 2 CIF/FORACID шаардлагатай",
      );
    }
    return cleaned;
  }

  private assertValidRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException("Огноо буруу байна");
    }
    if (start > end) {
      throw new BadRequestException(
        "Эхлэх огноо дуусах огнооноос хойш байж болохгүй",
      );
    }
    const maxRangeMs = 3 * 365 * 24 * 60 * 60 * 1000; // 3 years
    if (end.getTime() - start.getTime() > maxRangeMs) {
      throw new BadRequestException(
        "Огнооны хамжих хугацаа 3 жилээс хэтэрч болохгүй",
      );
    }
  }

  async findMatchedAccounts(
    customerIds: string[],
  ): Promise<MatchedAccountRow[]> {
    return this.clickhouse.query<MatchedAccountRow>(
      `
      WITH target_ids AS (
        SELECT arrayJoin({cifIds:Array(String)}) AS TARGET_ID
      )
      SELECT DISTINCT
        g.CIF_ID    AS CIF_ID,
        g.FORACID   AS FORACID,
        g.ACID      AS ACID,
        g.ACCT_NAME AS ACCT_NAME,
        g.SCHM_CODE AS SCHM_CODE
      FROM FINACLE.GAM_ACCOUNTS g
      INNER JOIN target_ids t
        ON g.CIF_ID = t.TARGET_ID OR g.FORACID = t.TARGET_ID
      ORDER BY CIF_ID, FORACID
      `,
      { cifIds: customerIds },
    );
  }

  async findRelatedPartyTransactions(
    dto: RelatedPartyTransactionsDto,
  ): Promise<RelatedPartyResult> {
    const customerIds = this.normalizeCustomerIds(dto.customerIds);
    this.assertValidRange(dto.startDate, dto.endDate);

    const accounts = await this.findMatchedAccounts(customerIds);
    if (accounts.length === 0) {
      return { accounts: [], transactions: [], summary: [] };
    }

    const transactions = await this.clickhouse.query<RelatedPartyTxRow>(
      `
      WITH
      target_ids AS (
        SELECT arrayJoin({cifIds:Array(String)}) AS TARGET_ID
      ),
      parties AS (
        SELECT DISTINCT g.ACID, g.CIF_ID, g.FORACID, g.ACCT_NAME, g.SCHM_CODE
        FROM FINACLE.GAM_ACCOUNTS g
        INNER JOIN target_ids t
          ON g.CIF_ID = t.TARGET_ID OR g.FORACID = t.TARGET_ID
      ),
      legs AS (
        SELECT
          H_TRAN_ID, H_TRAN_DATE, H_ACID, H_PART_TRAN_TYPE,
          H_TRAN_TYPE, H_TRAN_SUB_TYPE,
          H_TRAN_AMT, B_ACCT_RATE, H_TRAN_CRNCY_CODE,
          H_SOL_ID, H_DTH_INIT_SOL_ID,
          H_ENTRY_DATE, H_ENTRY_USER_ID,
          H_PSTD_DATE, H_PSTD_USER_ID,
          H_VFD_DATE, H_VFD_USER_ID,
          H_TRAN_PARTICULAR, H_TRAN_RMKS, H_REF_NUM,
          trim(A_TRAN_ID) AS A_TRAN_ID,
          B_CHANNEL_ID, B_BANK, B_TYPE,
          H_GL_SUB_HEAD_CODE, B_ACCT_PRTY_NUMBER
        FROM FINACLE.HTD_ATD
        WHERE H_TRAN_DATE BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
          AND ifNull(H_DEL_FLG, 'N') <> 'Y'

        UNION ALL

        SELECT
          H_TRAN_ID, H_TRAN_DATE, H_ACID, H_PART_TRAN_TYPE,
          H_TRAN_TYPE, H_TRAN_SUB_TYPE,
          H_TRAN_AMT, B_ACCT_RATE, H_TRAN_CRNCY_CODE,
          H_SOL_ID, H_DTH_INIT_SOL_ID,
          H_ENTRY_DATE, H_ENTRY_USER_ID,
          H_PSTD_DATE, H_PSTD_USER_ID,
          H_VFD_DATE, H_VFD_USER_ID,
          H_TRAN_PARTICULAR, H_TRAN_RMKS, H_REF_NUM,
          trim(A_TRAN_ID) AS A_TRAN_ID,
          B_CHANNEL_ID, B_BANK, B_TYPE,
          H_GL_SUB_HEAD_CODE, B_ACCT_PRTY_NUMBER
        FROM FINACLE.HTD_ATD_CURRENT
        WHERE H_TRAN_DATE BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
          AND ifNull(H_DEL_FLG, 'N') <> 'Y'
      ),
      party_legs AS (
        SELECT
          l.*,
          p.CIF_ID AS P_CIF_ID, p.FORACID AS P_FORACID,
          p.ACCT_NAME AS P_ACCT_NAME, p.SCHM_CODE AS P_SCHM_CODE
        FROM legs l
        INNER JOIN parties p ON p.ACID = l.H_ACID
      ),
      debit_legs AS (
        SELECT * FROM party_legs WHERE H_PART_TRAN_TYPE = 'D'
      ),
      credit_legs AS (
        SELECT * FROM party_legs WHERE H_PART_TRAN_TYPE = 'C'
      )
      SELECT DISTINCT
        d.H_TRAN_DATE AS TRAN_DATE,
        d.H_TRAN_ID AS TRAN_ID,
        d.H_DTH_INIT_SOL_ID AS DTH_INIT_SOL_ID,
        d.H_ENTRY_DATE AS ENTRY_DATE,
        d.H_ENTRY_USER_ID AS ENTRY_USER_ID,
        d.H_PSTD_DATE AS PSTD_DATE,
        d.H_PSTD_USER_ID AS PSTD_USER_ID,
        d.H_VFD_DATE AS VFD_DATE,
        d.H_VFD_USER_ID AS VFD_USER_ID,
        d.H_TRAN_TYPE AS TRAN_TYPE,
        d.H_TRAN_SUB_TYPE AS TRAN_SUB_TYPE,
        d.P_CIF_ID AS FROM_CIF,
        d.P_FORACID AS FROM_ACCOUNT,
        d.P_ACCT_NAME AS FROM_NAME,
        d.P_SCHM_CODE AS FROM_SCHM_CODE,
        c.P_CIF_ID AS TO_CIF,
        c.P_FORACID AS TO_ACCOUNT,
        c.P_ACCT_NAME AS TO_NAME,
        c.P_SCHM_CODE AS TO_SCHM_CODE,
        d.H_TRAN_AMT AS TRAN_AMOUNT,
        d.H_TRAN_AMT * ifNull(d.B_ACCT_RATE, 1) AS AMOUNT_MNT,
        d.H_TRAN_CRNCY_CODE AS CURRENCY,
        ifNull(toString(d.B_CHANNEL_ID), '') AS CHANNEL_ID,
        ifNull(toString(d.B_BANK), '') AS BANK,
        ifNull(toString(d.B_TYPE), '') AS BANK_TYPE,
        trim(toString(d.A_TRAN_ID)) AS A_TRAN_ID,
        d.H_SOL_ID AS SOL_ID,
        d.H_GL_SUB_HEAD_CODE AS GL_SUB_HEAD_CODE,
        d.B_ACCT_PRTY_NUMBER AS ACCT_PRTY_NUMBER,
        d.H_REF_NUM AS REF_NUM,
        toString(d.H_TRAN_PARTICULAR) AS DEBIT_PARTICULAR,
        toString(c.H_TRAN_PARTICULAR) AS CREDIT_PARTICULAR,
        toString(d.H_TRAN_RMKS) AS DEBIT_RMKS,
        toString(c.H_TRAN_RMKS) AS CREDIT_RMKS
      FROM debit_legs d
      INNER JOIN credit_legs c
        ON d.H_TRAN_ID = c.H_TRAN_ID
       AND d.H_TRAN_DATE = c.H_TRAN_DATE
       AND d.H_TRAN_AMT = c.H_TRAN_AMT
       AND d.H_TRAN_CRNCY_CODE = c.H_TRAN_CRNCY_CODE
      WHERE d.H_ACID != c.H_ACID
        AND d.P_CIF_ID != c.P_CIF_ID
      ORDER BY TRAN_DATE, TRAN_ID, FROM_CIF, TO_CIF, TRAN_AMOUNT
      LIMIT ${MAX_TX_ROWS + 1}
      `,
      { cifIds: customerIds, startDate: dto.startDate, endDate: dto.endDate },
    );

    const truncated = transactions.length > MAX_TX_ROWS;
    if (truncated) transactions.length = MAX_TX_ROWS;

    const summary = this.buildSummary(transactions);
    return { accounts, transactions, summary, truncated };
  }

  private buildSummary(
    transactions: RelatedPartyTxRow[],
  ): RelatedPartySummaryRow[] {
    const groups = new Map<string, RelatedPartySummaryRow>();
    for (const tx of transactions) {
      const key = `${tx.FROM_CIF}__${tx.TO_CIF}__${tx.CURRENCY}`;
      const existing = groups.get(key);
      const amount = Number(tx.TRAN_AMOUNT) || 0;
      if (existing) {
        existing.TOTAL_AMOUNT += amount;
        existing.TX_COUNT += 1;
      } else {
        groups.set(key, {
          FROM_CIF: tx.FROM_CIF,
          TO_CIF: tx.TO_CIF,
          CURRENCY: tx.CURRENCY,
          TOTAL_AMOUNT: amount,
          TX_COUNT: 1,
        });
      }
    }
    return Array.from(groups.values()).sort(
      (a, b) =>
        a.FROM_CIF.localeCompare(b.FROM_CIF) ||
        a.TO_CIF.localeCompare(b.TO_CIF) ||
        a.CURRENCY.localeCompare(b.CURRENCY),
    );
  }

  // ── Expense monitoring (Зардлын хяналт) ─────────────────────────────────
  async getExpenseOverview(
    dto: ExpenseOverviewDto,
  ): Promise<ExpenseOverviewResult> {
    this.assertValidRange(dto.startDate, dto.endDate);
    const minAmount = dto.minAmount ?? DEFAULT_MIN_AMOUNT;

    const qualifyingCustomers =
      await this.clickhouse.query<ExpenseQualifyingCustomer>(
        `
        SELECT
          customer_code,
          any(customer_name) AS customer_name,
          sum(debit_amount)  AS total_debit
        FROM avlaga
        WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        GROUP BY customer_code
        HAVING {minAmount:Float64} <= 0 OR total_debit >= {minAmount:Float64}
        ORDER BY total_debit DESC
        `,
        { startDate: dto.startDate, endDate: dto.endDate, minAmount },
      );

    if (qualifyingCustomers.length === 0) {
      return { qualifyingCustomers: [], transactions: [] };
    }

    const customerCodes = qualifyingCustomers.map((c) => c.customer_code);

    // [SEC] LEFT JOIN дэд query дотор DISTINCT gl_number ашиглана — үгүй бол
    // нэг book_number-тэй харгалзах tulbur мөр олон байвал avlaga мөрүүд
    // давхардаж (fan out) жагсаалт болон тоолол хоёуланг гажуудуулна.
    const transactions = await this.clickhouse.query<ExpenseTxRow>(
      `
      SELECT
        a.load_date, a.book_date, a.customer_code, a.customer_name,
        a.account_name, a.account_code, a.currency_code, a.debit_amount,
        a.description, a.book_number, a.department_code, a.department_name,
        a.CO_A_GROUP_CODE AS co_a_group_code, a.CO_A_GROUP_NAME AS co_a_group_name,
        a.RECIEVABLE_TYPE_CODE AS recievable_type_code,
        a.RECIEVABLE_TYPE_NAME AS recievable_type_name,
        (t.gl_number != '') AS has_payment_request,
        (v.bookNumber != '') AS has_verification,
        ifNull(v.verificationType, '') AS verification_type,
        ifNull(v.contractTotalAmount, 0) AS contract_total_amount,
        ifNull(v.status, '') AS verification_status,
        ifNull(v.comment, '') AS comment
      FROM avlaga a
      LEFT JOIN (
        SELECT DISTINCT gl_number FROM tulbur WHERE gl_number != ''
      ) t ON t.gl_number = a.book_number
      LEFT JOIN avlaga_verifications v FINAL ON v.bookNumber = a.book_number
      WHERE a.book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        AND a.customer_code IN {customerCodes:Array(String)}
      ORDER BY a.debit_amount DESC
      LIMIT ${MAX_EXPENSE_TX_ROWS + 1}
      `,
      { startDate: dto.startDate, endDate: dto.endDate, customerCodes },
    );

    const truncated = transactions.length > MAX_EXPENSE_TX_ROWS;
    if (truncated) transactions.length = MAX_EXPENSE_TX_ROWS;

    // [CONFIRMED RULE] "Төсөвтэй" ("has budget") := "has payment request" —
    // тодорхой асуугдаж давхар баталгаажсан бизнес дүрэм: төлбөрийн хүсэлттэй
    // ч холбогдох budget мөр байхгүй авлага ч Төсөвтэй тоонд орно.
    //
    // "Төсвийн төрөл" barchart-ын ангилалд зориулж — төлбөрийн хүсэлттэй
    // (book_number) бүрийн хамгийн сүүлийн (book_date-ээр) холбогдох budget
    // мөрийн description-г нэг query-ээр татна ("budgets давхардаж байгаа тул
    // сүүлийнхийг авна" — argMax).
    const bookNumbersWithRequest = transactions
      .filter((tx) => tx.has_payment_request)
      .map((tx) => tx.book_number);

    const budgetTypeByBookNumber = new Map<string, string>();
    if (bookNumbersWithRequest.length > 0) {
      const budgetTypes = await this.clickhouse.query<{
        book_number: string;
        budget_type: string;
      }>(
        `
        SELECT
          t.gl_number AS book_number,
          argMax(b.description, b.book_date) AS budget_type
        FROM tulbur t
        INNER JOIN budget b ON b.related_book_number = t.book_number
        WHERE t.gl_number IN {bookNumbers:Array(String)}
        GROUP BY t.gl_number
        `,
        { bookNumbers: bookNumbersWithRequest },
      );
      for (const row of budgetTypes) {
        budgetTypeByBookNumber.set(row.book_number, row.budget_type);
      }
    }
    for (const tx of transactions) {
      tx.budget_type = budgetTypeByBookNumber.get(tx.book_number) ?? "";
    }

    return { qualifyingCustomers, transactions, truncated };
  }

  async findPaymentRequestsByCustomer(
    dto: ExpensePaymentRequestsDto,
  ): Promise<{ rows: ExpensePaymentRequestRow[]; truncated?: boolean }> {
    this.assertValidRange(dto.startDate, dto.endDate);
    const rows = await this.clickhouse.query<ExpensePaymentRequestRow>(
      `
      SELECT
        load_date, invoice_id, description, request_date, employee_name,
        sol_id, employee_code, department_name, book_number, request_amount,
        book_date, account_number, bank_name, customer_code, customer_name,
        currency_code, gl_number, tender_method_name, info_name, purpose
      FROM tulbur
      WHERE customer_code = {customerCode:String}
        AND book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
      ORDER BY book_date DESC, request_amount DESC
      LIMIT ${MAX_EXPENSE_DRILLDOWN_ROWS + 1}
      `,
      {
        customerCode: dto.customerCode,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    );
    const truncated = rows.length > MAX_EXPENSE_DRILLDOWN_ROWS;
    if (truncated) rows.length = MAX_EXPENSE_DRILLDOWN_ROWS;
    return { rows, truncated };
  }

  async findAttachmentsByInvoice(
    dto: ExpenseAttachmentsDto,
  ): Promise<{ rows: ExpenseAttachmentRow[] }> {
    const rows = await this.clickhouse.query<ExpenseAttachmentRow>(
      `
      SELECT invoice_id, book_number, customer_code, customer_name,
        content_id, file_name, file_extension, physical_path, full_url
      FROM havsralt
      WHERE invoice_id = {invoiceId:String}
      ORDER BY file_name
      LIMIT ${MAX_EXPENSE_SIDE_ROWS}
      `,
      { invoiceId: dto.invoiceId },
    );
    return { rows };
  }

  async findBudgetChangesByBookNumber(
    dto: ExpenseBudgetChangesDto,
  ): Promise<{ rows: ExpenseBudgetChangeRow[] }> {
    const rows = await this.clickhouse.query<ExpenseBudgetChangeRow>(
      `
      SELECT load_date, book_date, book_number, employee_name, sol_id,
        employee_code, department_name, request_amount, description,
        total_amount, to_activity_name, from_activity_name,
        from_activity_dtl_name, to_activity_dtl_name, amount,
        related_book_number, from_employee_name, purpose
      FROM budget
      WHERE related_book_number = {bookNumber:String}
      ORDER BY book_date DESC
      LIMIT ${MAX_EXPENSE_SIDE_ROWS}
      `,
      { bookNumber: dto.bookNumber },
    );
    return { rows };
  }

  /** "Нийт зардал" — харилцагч/босго-гүй, зөвхөн сонгосон хугацааны бүх avlaga
   *  мөр. Ерөнхий дэвтэр (CO_A_GROUP) болон авлагын төрлөөр (RECIEVABLE_TYPE)
   *  задаргааг тусдаа SQL GROUP BY-аар тооцоолно (жагсаалтын LIMIT-ээс үл
   *  хамааран нийт өгөгдөл дээр үнэн зөв байх учиртай). */
  async getExpenseTotal(dto: ExpenseTotalDto): Promise<ExpenseTotalResult> {
    this.assertValidRange(dto.startDate, dto.endDate);
    const params = { startDate: dto.startDate, endDate: dto.endDate };

    const [transactions, byGlGroup, byReceivableType] = await Promise.all([
      this.clickhouse.query<ExpenseTotalTxRow>(
        `
        SELECT load_date, book_date, customer_code, customer_name,
          account_name, account_code, currency_code, debit_amount,
          description, book_number, department_code, department_name,
          CO_A_GROUP_CODE AS co_a_group_code, CO_A_GROUP_NAME AS co_a_group_name,
          RECIEVABLE_TYPE_CODE AS recievable_type_code,
          RECIEVABLE_TYPE_NAME AS recievable_type_name
        FROM avlaga
        WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        ORDER BY debit_amount DESC
        LIMIT ${MAX_EXPENSE_TOTAL_ROWS + 1}
        `,
        params,
      ),
      this.clickhouse.query<ExpenseGroupBreakdown>(
        `
        SELECT CO_A_GROUP_CODE AS code, any(CO_A_GROUP_NAME) AS name,
          count() AS count, sum(debit_amount) AS total
        FROM avlaga
        WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        GROUP BY CO_A_GROUP_CODE
        ORDER BY total DESC
        `,
        params,
      ),
      this.clickhouse.query<ExpenseGroupBreakdown>(
        `
        SELECT RECIEVABLE_TYPE_CODE AS code, any(RECIEVABLE_TYPE_NAME) AS name,
          count() AS count, sum(debit_amount) AS total
        FROM avlaga
        WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        GROUP BY RECIEVABLE_TYPE_CODE
        ORDER BY total DESC
        `,
        params,
      ),
    ]);

    const truncated = transactions.length > MAX_EXPENSE_TOTAL_ROWS;
    if (truncated) transactions.length = MAX_EXPENSE_TOTAL_ROWS;

    const totalAmount = byGlGroup.reduce((sum, g) => sum + g.total, 0);

    return { transactions, byGlGroup, byReceivableType, totalAmount, truncated };
  }

  // ── Verification types (admin-managed) ──────────────────────────────────
  async listVerificationTypes(
    activeOnly: boolean,
  ): Promise<ExpenseVerificationTypeRow[]> {
    return this.clickhouse.query<ExpenseVerificationTypeRow>(
      `SELECT id, name, isActive FROM expense_verification_types FINAL
       ${activeOnly ? "WHERE isActive = 1" : ""}
       ORDER BY name`,
    );
  }

  async createVerificationType(
    dto: CreateVerificationTypeDto,
  ): Promise<ExpenseVerificationTypeRow> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Төрлийн нэр хоосон байж болохгүй");
    }
    const id = randomUUID();
    const now = nowCH();
    await this.clickhouse.insert("expense_verification_types", [
      { id, name, isActive: 1, createdAt: now, updatedAt: now },
    ]);
    return { id, name, isActive: 1 };
  }

  async updateVerificationType(
    id: string,
    dto: UpdateVerificationTypeDto,
  ): Promise<ExpenseVerificationTypeRow> {
    const existing = await this.clickhouse.query<
      ExpenseVerificationTypeRow & { createdAt: string }
    >(
      `SELECT * FROM expense_verification_types FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    const current = existing[0];
    if (!current) {
      throw new NotFoundException("Төрөл олдсонгүй");
    }
    const name =
      dto.name !== undefined ? dto.name.trim() || current.name : current.name;
    const isActive: 0 | 1 =
      dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : current.isActive;

    await this.clickhouse.insert("expense_verification_types", [
      {
        id,
        name,
        isActive,
        createdAt: current.createdAt,
        updatedAt: nowCH(),
      },
    ]);
    return { id, name, isActive };
  }

  async deleteVerificationType(id: string): Promise<{ success: true }> {
    await this.clickhouse.exec(
      `ALTER TABLE expense_verification_types DELETE WHERE id = {id:String}`,
      { id },
    );
    return { success: true };
  }

  /** Баталгаажуулалтын дэлгэц (тайлбар/төрөл/гэрээний дүн/статус) — тус
   *  тусдаа тохируулах боломжтой, ирсэн талбаруудыг л шинэчилнэ. Тухайн
   *  book_number-д одоо байгаа мөрийг уншиж, ирээгүй талбаруудыг хэвээр
   *  үлдээгээд ReplacingMergeTree-д дахин insert хийнэ. */
  async upsertVerification(
    dto: ExpenseVerificationDto,
    user: { userId: string; name: string },
  ): Promise<ExpenseVerificationRow> {
    if (
      dto.comment === undefined &&
      dto.verificationType === undefined &&
      dto.contractTotalAmount === undefined &&
      dto.status === undefined
    ) {
      throw new BadRequestException(
        "Тайлбар, төрөл, гэрээний дүн, статусын аль нэгийг дамжуулна уу",
      );
    }

    const existing = await this.clickhouse.query<ExpenseVerificationRow>(
      `SELECT * FROM avlaga_verifications FINAL WHERE bookNumber = {bookNumber:String} LIMIT 1`,
      { bookNumber: dto.bookNumber },
    );
    const current = existing[0];

    const row: ExpenseVerificationRow = {
      bookNumber: dto.bookNumber,
      comment: dto.comment !== undefined ? dto.comment : (current?.comment ?? ""),
      verificationType:
        dto.verificationType !== undefined
          ? dto.verificationType
          : (current?.verificationType ?? ""),
      contractTotalAmount:
        dto.contractTotalAmount !== undefined
          ? dto.contractTotalAmount
          : (current?.contractTotalAmount ?? 0),
      status: dto.status !== undefined ? dto.status : (current?.status ?? ""),
      updatedBy: user.userId,
      updatedByName: user.name,
      updatedAt: nowCH(),
    };

    await this.clickhouse.insert("avlaga_verifications", [{ ...row }]);
    return row;
  }
}
