import { BadRequestException, Injectable } from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import {
  RelatedPartyTransactionsDto,
  ExpenseOverviewDto,
  ExpensePaymentRequestsDto,
  ExpenseAttachmentsDto,
  ExpenseBudgetChangesDto,
  ExpenseTotalDto,
  GenerateExpenseReportDto,
  ExpenseRelationsDto,
} from "./dto/zainii-audit.dto";
import {
  MatchedAccountRow,
  RelatedPartyTxRow,
  RelatedPartySummaryRow,
  RelatedPartyResult,
  MAX_TX_ROWS,
  ExpenseTxRow,
  ExpenseOverviewResult,
  ExpenseTotalTxRow,
  ExpenseGroupBreakdown,
  ExpenseTotalResult,
  ExpensePaymentRequestRow,
  ExpenseAttachmentRow,
  ExpenseBudgetChangeRow,
  MAX_EXPENSE_TX_ROWS,
  MAX_EXPENSE_TOTAL_ROWS,
  MAX_EXPENSE_DRILLDOWN_ROWS,
  MAX_EXPENSE_SIDE_ROWS,
  MAX_RELATIONS_ROWS,
  DEFAULT_MIN_AMOUNT,
  HamaaralRow,
  ExpenseRelationsResult,
  ExpenseReportTop5Row,
  ExpenseReportCategoryCustomerRow,
  ExpenseReportCategory,
  ExpenseReportData,
  toBreakdown,
} from "./zainii-audit.types";
import { ZainiiAuditVerificationService } from "./zainii-audit-verification.service";

@Injectable()
export class ZainiiAuditService {
  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly verification: ZainiiAuditVerificationService,
  ) {}

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

  // ── Зардлын хяналт ──────────────────────────────────────────────────────
  async getExpenseOverview(
    dto: ExpenseOverviewDto,
  ): Promise<ExpenseOverviewResult> {
    this.assertValidRange(dto.startDate, dto.endDate);
    const minAmount = dto.minAmount ?? DEFAULT_MIN_AMOUNT;
    const params = {
      startDate: dto.startDate,
      endDate: dto.endDate,
      minAmount,
    };

    const qualifyingCte = `
      qualifying AS (
        SELECT customer_code, sum(debit_amount) AS total_debit
        FROM avlaga
        WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        GROUP BY customer_code
        HAVING {minAmount:Float64} <= 0 OR total_debit >= {minAmount:Float64}
      )`;

    const [statsRows, transactions] = await Promise.all([
      this.clickhouse.query<{
        qualifyingCount: number;
        qualifyingTotalDebit: number;
      }>(
        `
        WITH ${qualifyingCte}
        SELECT
          count() AS qualifyingCount,
          ifNull(sum(total_debit), 0) AS qualifyingTotalDebit
        FROM qualifying
        `,
        params,
      ),
      // Төсвийн төрөл + баталгаажуулалтыг нэг query-д нэгтгэсэн (өмнө нь
      // 3 дахь round-trip + 20к book_number массив + FINAL JOIN байсан).
      // tulbur/budget-ийг зөвхөн тухайн хугацааны book_number-уудаар шүүнэ.
      this.clickhouse.query<ExpenseTxRow>(
        `
        WITH
        ${qualifyingCte},
        scoped_books AS (
          SELECT DISTINCT a.book_number
          FROM avlaga a
          INNER JOIN qualifying q ON q.customer_code = a.customer_code
          WHERE a.book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
            AND a.book_number != ''
        )
        SELECT
          toString(a.load_date) AS load_date,
          toString(a.book_date) AS book_date,
          a.customer_code AS customer_code,
          a.customer_name AS customer_name,
          a.account_name AS account_name,
          a.account_code AS account_code,
          a.currency_code AS currency_code,
          a.debit_amount AS debit_amount,
          a.description AS description,
          a.book_number AS book_number,
          a.department_code AS department_code,
          a.department_name AS department_name,
          a.co_a_group_code AS co_a_group_code,
          a.co_a_group_name AS co_a_group_name,
          a.receivable_type_code AS recievable_type_code,
          a.receivable_type_name AS recievable_type_name,
          (ifNull(t.gl_number, '') != '') AS has_payment_request,
          (ifNull(tc.pay_customer, '') != '') AS has_customer_payment_request,
          (ifNull(v.bookNumber, '') != '') AS has_verification,
          ifNull(v.verificationType, '') AS verification_type,
          ifNull(v.contractTotalAmount, 0) AS contract_total_amount,
          ifNull(v.contractDate, '') AS contract_date,
          ifNull(v.contractNumber, '') AS contract_number,
          ifNull(v.remainingAmount, 0) AS remaining_amount,
          ifNull(v.status, '') AS verification_status,
          ifNull(v.comment, '') AS comment,
          if(ifNull(t.gl_number, '') = '', '', ifNull(bt.budget_type, '')) AS budget_type
        FROM avlaga AS a
        INNER JOIN qualifying AS q ON q.customer_code = a.customer_code
        LEFT JOIN (
          SELECT DISTINCT ifNull(gl_number, '') AS gl_number
          FROM tulbur
          WHERE ifNull(gl_number, '') IN (SELECT book_number FROM scoped_books)
        ) AS t ON t.gl_number = a.book_number
        LEFT JOIN (
          SELECT DISTINCT ifNull(customer_code, '') AS pay_customer
          FROM tulbur
          WHERE tulbur.book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
            AND ifNull(customer_code, '') != ''
        ) AS tc ON tc.pay_customer = a.customer_code
        LEFT JOIN (
          SELECT
            ifNull(t2.gl_number, '') AS pay_book_number,
            argMax(ifNull(b.description, ''), b.book_date) AS budget_type
          FROM tulbur AS t2
          INNER JOIN budget AS b
            ON ifNull(b.related_book_number, '') = t2.book_number
          WHERE ifNull(t2.gl_number, '') IN (SELECT book_number FROM scoped_books)
          GROUP BY ifNull(t2.gl_number, '')
        ) AS bt ON bt.pay_book_number = a.book_number
        LEFT JOIN (
          SELECT
            bookNumber,
            argMax(verificationType, updatedAt) AS verificationType,
            argMax(contractTotalAmount, updatedAt) AS contractTotalAmount,
            argMax(contractDate, updatedAt) AS contractDate,
            argMax(contractNumber, updatedAt) AS contractNumber,
            argMax(remainingAmount, updatedAt) AS remainingAmount,
            argMax(status, updatedAt) AS status,
            argMax(comment, updatedAt) AS comment
          FROM avlaga_verifications
          GROUP BY bookNumber
        ) AS v ON v.bookNumber = a.book_number
        WHERE a.book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        ORDER BY a.debit_amount DESC
        LIMIT ${MAX_EXPENSE_TX_ROWS + 1}
        `,
        params,
      ),
    ]);

    const qualifyingCount = Number(statsRows[0]?.qualifyingCount ?? 0);
    const qualifyingTotalDebit = Number(
      statsRows[0]?.qualifyingTotalDebit ?? 0,
    );

    if (qualifyingCount === 0) {
      return { qualifyingCount: 0, qualifyingTotalDebit: 0, transactions: [] };
    }

    const truncated = transactions.length > MAX_EXPENSE_TX_ROWS;
    if (truncated) transactions.length = MAX_EXPENSE_TX_ROWS;

    return {
      qualifyingCount,
      qualifyingTotalDebit,
      transactions,
      truncated,
    };
  }

  async findPaymentRequestsByCustomer(
    dto: ExpensePaymentRequestsDto,
  ): Promise<{ rows: ExpensePaymentRequestRow[]; truncated?: boolean }> {
    this.assertValidRange(dto.startDate, dto.endDate);
    const rows = await this.clickhouse.query<ExpensePaymentRequestRow>(
      `
      SELECT
        toString(load_date) AS load_date,
        toString(invoice_id) AS invoice_id,
        ifNull(description, '') AS description,
        ifNull(toString(request_date), '') AS request_date,
        ifNull(employee_name, '') AS employee_name,
        ifNull(sol_id, '') AS sol_id,
        ifNull(employee_code, '') AS employee_code,
        ifNull(department_name, '') AS department_name,
        book_number AS book_number,
        ifNull(request_amount, 0) AS request_amount,
        toString(book_date) AS book_date,
        ifNull(account_number, '') AS account_number,
        ifNull(bank_name, '') AS bank_name,
        ifNull(customer_code, '') AS customer_code,
        ifNull(customer_name, '') AS customer_name,
        ifNull(currency_code, '') AS currency_code,
        ifNull(gl_number, '') AS gl_number,
        ifNull(tender_method_name, '') AS tender_method_name,
        ifNull(info_name, '') AS info_name,
        ifNull(purpose, '') AS purpose
      FROM tulbur
      WHERE tulbur.customer_code = {customerCode:String}
        AND tulbur.book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
      ORDER BY tulbur.book_date DESC, ifNull(tulbur.request_amount, 0) DESC
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
      SELECT
        toString(havsralt.invoice_id) AS invoice_id,
        ifNull(havsralt.book_number, '') AS book_number,
        ifNull(havsralt.customer_code, '') AS customer_code,
        ifNull(havsralt.customer_name, '') AS customer_name,
        ifNull(toString(havsralt.content_id), '') AS content_id,
        ifNull(havsralt.file_name, '') AS file_name,
        ifNull(havsralt.file_extension, '') AS file_extension,
        ifNull(havsralt.full_url, '') AS full_url
      FROM havsralt
      WHERE havsralt.invoice_id = toFloat64OrZero({invoiceId:String})
      ORDER BY havsralt.file_name
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
      SELECT
        toString(load_date) AS load_date,
        toString(book_date) AS book_date,
        book_number,
        ifNull(employee_name, '') AS employee_name,
        ifNull(sol_id, '') AS sol_id,
        ifNull(employee_code, '') AS employee_code,
        ifNull(department_name, '') AS department_name,
        ifNull(request_amount, 0) AS request_amount,
        ifNull(description, '') AS description,
        ifNull(total_amount, 0) AS total_amount,
        ifNull(to_activity_name, '') AS to_activity_name,
        ifNull(from_activity_name, '') AS from_activity_name,
        ifNull(from_activity_dtl_name, '') AS from_activity_dtl_name,
        ifNull(to_activity_dtl_name, '') AS to_activity_dtl_name,
        ifNull(amount, 0) AS amount,
        ifNull(related_book_number, '') AS related_book_number,
        ifNull(from_employee_name, '') AS from_employee_name,
        ifNull(purpose, '') AS purpose
      FROM budget
      WHERE budget.related_book_number = {bookNumber:String}
      ORDER BY budget.book_date DESC
      LIMIT ${MAX_EXPENSE_SIDE_ROWS}
      `,
      { bookNumber: dto.bookNumber },
    );
    return { rows };
  }

  /** "Нийт зардал" — харилцагч/босго-гүй, зөвхөн сонгосон хугацааны бүх avlaga
   *  мөр. Ерөнхий дэвтэр (co_a_group) болон авлагын төрлөөр (receivable_type)
   *  задаргааг тусдаа SQL GROUP BY-аар тооцоолно (жагсаалтын LIMIT-ээс үл
   *  хамааран нийт өгөгдөл дээр үнэн зөв байх учиртай). */
  async getExpenseTotal(dto: ExpenseTotalDto): Promise<ExpenseTotalResult> {
    this.assertValidRange(dto.startDate, dto.endDate);
    const params = { startDate: dto.startDate, endDate: dto.endDate };

    const [transactions, byGlGroup, byReceivableType] = await Promise.all([
      this.clickhouse.query<ExpenseTotalTxRow>(
        `
        -- [FIX] Төлбөрийн хүсэлтийн төлөв нь Зардлын хяналттай ижил байх
        -- ёстой. Өмнө нь энэ query-д JOIN огт байгаагүй тул "Нийт зардал"
        -- дээр БҮХ мөр "Төлбөрийн хүсэлтгүй" гэж улаанаар харагддаг байв.
        -- JOIN-ууд нь getExpenseOverview-тэй ЯГ ижил хамрах хүрээтэй.
        WITH
        scoped_books AS (
          SELECT DISTINCT book_number
          FROM avlaga
          WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
            AND book_number != ''
        ),
        pay_books AS (
          SELECT DISTINCT ifNull(gl_number, '') AS gl_number
          FROM tulbur
          WHERE ifNull(gl_number, '') IN (SELECT book_number FROM scoped_books)
        ),
        pay_customers AS (
          SELECT DISTINCT ifNull(customer_code, '') AS pay_customer
          FROM tulbur
          WHERE tulbur.book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
            AND ifNull(customer_code, '') != ''
        )
        SELECT a.load_date AS load_date, a.book_date AS book_date,
          a.customer_code AS customer_code, a.customer_name AS customer_name,
          a.account_name AS account_name, a.account_code AS account_code,
          a.currency_code AS currency_code, a.debit_amount AS debit_amount,
          a.description AS description, a.book_number AS book_number,
          a.department_code AS department_code, a.department_name AS department_name,
          a.co_a_group_code AS co_a_group_code,
          a.co_a_group_name AS co_a_group_name,
          a.receivable_type_code AS recievable_type_code,
          a.receivable_type_name AS recievable_type_name,
          (ifNull(t.gl_number, '') != '') AS has_payment_request,
          (ifNull(tc.pay_customer, '') != '') AS has_customer_payment_request
        FROM avlaga AS a
        LEFT JOIN pay_books AS t ON t.gl_number = a.book_number
        LEFT JOIN pay_customers AS tc ON tc.pay_customer = a.customer_code
        WHERE a.book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        ORDER BY a.debit_amount DESC
        LIMIT ${MAX_EXPENSE_TOTAL_ROWS + 1}
        `,
        params,
      ),
      this.clickhouse.query<ExpenseGroupBreakdown>(
        `
        SELECT
          co_a_group_code AS code,
          co_a_group_name AS name,
          toUInt64(count()) AS count,
          sum(debit_amount) AS total
        FROM avlaga
        WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        GROUP BY co_a_group_code, co_a_group_name
        ORDER BY total DESC
        `,
        params,
      ),
      this.clickhouse.query<ExpenseGroupBreakdown>(
        `
        SELECT
          receivable_type_code AS code,
          receivable_type_name AS name,
          toUInt64(count()) AS count,
          sum(debit_amount) AS total
        FROM avlaga
        WHERE book_date BETWEEN toDate({startDate:String}) AND toDate({endDate:String})
        GROUP BY receivable_type_code, receivable_type_name
        ORDER BY total DESC
        `,
        params,
      ),
    ]);

    const truncated = transactions.length > MAX_EXPENSE_TOTAL_ROWS;
    if (truncated) transactions.length = MAX_EXPENSE_TOTAL_ROWS;

    const glGroups = toBreakdown(byGlGroup);
    const recTypes = toBreakdown(byReceivableType);
    const totalAmount = glGroups.reduce((sum, g) => sum + g.total, 0);

    return {
      transactions,
      byGlGroup: glGroups,
      byReceivableType: recTypes,
      totalAmount,
      truncated,
    };
  }

  /** Баталгаажуулалтын дэлгэц (тайлбар/төрөл/гэрээний дүн/статус) — тус
   *  тусдаа тохируулах боломжтой, ирсэн талбаруудыг л шинэчилнэ. Тухайн
   *  book_number-д одоо байгаа мөрийг уншиж, ирээгүй талбаруудыг хэвээр
   *  үлдээгээд ReplacingMergeTree-д дахин insert хийнэ. */

  // ── Зайны аудитын анхдагч тохиргоо (админаас удирдана) ──────────────────
  //
  // Өмнө нь `DEFAULT_MIN_AMOUNT = 50_000_000` нь frontend-д хатуу бичээстэй
  // байсан тул өөрчлөхийн тулд дахин build/deploy хийх шаардлагатай байв.
  // Одоо админ хуудаснаас тохируулна; хэрэглэгч tool дотроо түр өөрчилж болно.

  // ── Хамааралтай / Холбоотой (hamaaral / holbootoi — гадны ETL хүснэгт) ──
  async getExpenseRelations(
    dto: ExpenseRelationsDto,
  ): Promise<ExpenseRelationsResult> {
    const customerCodes = Array.from(new Set(dto.customerCodes.map(String)));

    const [hamaaralRows, holbootoiRows] = await Promise.all([
      this.clickhouse.query<HamaaralRow>(
        `
        SELECT
          ifNull(cif, '') AS cif,
          ifNull(cifname, '') AS cifname,
          ifNull(empid, '') AS empid,
          ifNull(empname, '') AS empname,
          ifNull(typename, '') AS typename,
          ifNull(status, '') AS status
        FROM hamaaral
        WHERE cif IN ({customerCodes:Array(String)})
        LIMIT ${MAX_RELATIONS_ROWS}
        `,
        { customerCodes },
      ),
      this.clickhouse.query<{ cif: string }>(
        `
        SELECT DISTINCT cif
        FROM holbootoi
        WHERE cif IN ({customerCodes:Array(String)})
        LIMIT ${MAX_RELATIONS_ROWS}
        `,
        { customerCodes },
      ),
    ]);

    const hamaaral: Record<string, HamaaralRow[]> = {};
    for (const row of hamaaralRows) {
      (hamaaral[row.cif] ??= []).push(row);
    }

    return {
      hamaaral,
      holbootoi: holbootoiRows.map((r) => r.cif),
    };
  }

  // ── Зардлын хяналтын Word тайлан ─────────────────────────────────────────
  /**
   * Тайлангийн бүх өгөгдлийг цуглуулна — docx үүсгэх нь тусдаа
   * ZainiiAuditDocxService-ийн үүрэг (энд зөвхөн бизнес логик/тооцоолол).
   */
  async getExpenseReportData(
    dto: GenerateExpenseReportDto,
  ): Promise<ExpenseReportData> {
    const overview = await this.getExpenseOverview({
      startDate: dto.startDate,
      endDate: dto.endDate,
      minAmount: dto.minAmount,
    });
    const activeTypes = await this.verification.listVerificationTypes(true);
    const scopeCategoryNames = activeTypes.map((t) => t.name);

    const top5: ExpenseReportTop5Row[] = overview.transactions
      .slice(0, 5)
      .map((tx) => ({
        customer_name: tx.customer_name,
        customer_code: tx.customer_code,
        debit_amount: Number(tx.debit_amount) || 0,
        description: tx.description,
      }));

    // verification_type → customer_code → тухайн харилцагчийн энэ ангилал
    // доторх бүх мөр (нэг харилцагч хэд хэдэн book_number-тэй байж болно).
    const byCategory = new Map<string, Map<string, ExpenseTxRow[]>>();
    let uncategorizedTotal = 0;

    for (const tx of overview.transactions) {
      const type = (tx.verification_type || "").trim();
      const amount = Number(tx.debit_amount) || 0;
      if (!type) {
        uncategorizedTotal += amount;
        continue;
      }
      let customerMap = byCategory.get(type);
      if (!customerMap) {
        customerMap = new Map();
        byCategory.set(type, customerMap);
      }
      const bucket = customerMap.get(tx.customer_code);
      if (bucket) bucket.push(tx);
      else customerMap.set(tx.customer_code, [tx]);
    }

    const categories: ExpenseReportCategory[] = [];
    for (const name of scopeCategoryNames) {
      const customerMap = byCategory.get(name);
      if (!customerMap || customerMap.size === 0) continue;

      let categoryTotal = 0;
      const customers: ExpenseReportCategoryCustomerRow[] = [];
      for (const [customerCode, rows] of customerMap) {
        // Нэг харилцагч тухайн ангилалд хэд хэдэн book_number-тэй байж
        // болно — гэрээний дэлгэрэнгүй (огноо/дүн/зориулалт/төсөв)-ийг хамгийн
        // сүүлийн (book_date-ээр) гүйлгээнээс авна, харин "төлсөн дүн"-г
        // БҮХ book_number-ээр нийлбэрлэнэ.
        const sorted = [...rows].sort((a, b) =>
          b.book_date.localeCompare(a.book_date),
        );
        const latest = sorted[0];
        const paidAmount = rows.reduce(
          (sum, r) => sum + (Number(r.debit_amount) || 0),
          0,
        );
        categoryTotal += paidAmount;
        const contractTotal = Number(latest.contract_total_amount) || 0;
        // Аудитор "Үлдэгдэл төлбөр"-ийг гараар оруулсан бол (жишээ нь
        // avlaga-д тусгагдаагүй төлбөр байгаа тул тооцоолсон утга бодит
        // байдалтай зөрдөг тохиолдолд) түүнийг илүүд үзнэ; эс бөгөөс
        // Гэрээний нийт дүн − Төлсөн дүн-ээр тооцоолно.
        const manualRemaining = Number(latest.remaining_amount) || 0;
        customers.push({
          customer_code: customerCode,
          customer_name: latest.customer_name,
          description: latest.description,
          contract_date: latest.contract_date,
          contract_number: latest.contract_number,
          contract_total_amount: contractTotal,
          paid_amount: paidAmount,
          remaining_amount:
            manualRemaining > 0 ? manualRemaining : contractTotal - paidAmount,
          budget_type: latest.budget_type,
        });
      }
      customers.sort((a, b) => b.paid_amount - a.paid_amount);
      categories.push({ name, totalAmount: categoryTotal, customers });
    }

    return {
      reportNumber: dto.reportNumber,
      conclusionText: dto.conclusionText ?? "",
      startDate: dto.startDate,
      endDate: dto.endDate,
      minAmount: dto.minAmount ?? DEFAULT_MIN_AMOUNT,
      scopeCategoryNames,
      qualifyingCount: overview.qualifyingCount,
      qualifyingTotalDebit: overview.qualifyingTotalDebit,
      top5,
      categories,
      uncategorizedTotal,
    };
  }
}
