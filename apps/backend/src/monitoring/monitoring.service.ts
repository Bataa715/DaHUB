import { BadRequestException, Injectable } from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { RelatedPartyTransactionsDto } from "./dto/monitoring.dto";

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
}
