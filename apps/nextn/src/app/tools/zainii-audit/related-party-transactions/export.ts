import type { RelatedPartyResult, RelatedPartyTxRow } from "@/lib/api";

/**
 * Client-side .xlsx export — builds the workbook directly from the already
 * fetched `result` (no second server round-trip / re-query).
 */
export async function downloadRelatedPartyWorkbook(
  result: RelatedPartyResult,
  startDate: string,
  endDate: string,
) {
  // [PERF] lazy-load exceljs — keep it out of this route's initial JS.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "FROM_CIF", key: "FROM_CIF", width: 16 },
    { header: "TO_CIF", key: "TO_CIF", width: 16 },
    { header: "CURRENCY", key: "CURRENCY", width: 10 },
    { header: "TOTAL_AMOUNT", key: "TOTAL_AMOUNT", width: 18 },
    { header: "TX_COUNT", key: "TX_COUNT", width: 10 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  result.summary.forEach((row) => summarySheet.addRow(row));

  const accSheet = workbook.addWorksheet("Accounts");
  accSheet.columns = [
    { header: "CIF_ID", key: "CIF_ID", width: 16 },
    { header: "FORACID", key: "FORACID", width: 18 },
    { header: "ACID", key: "ACID", width: 14 },
    { header: "ACCT_NAME", key: "ACCT_NAME", width: 28 },
    { header: "SCHM_CODE", key: "SCHM_CODE", width: 12 },
  ];
  accSheet.getRow(1).font = { bold: true };
  result.accounts.forEach((row) => accSheet.addRow(row));

  const txSheet = workbook.addWorksheet("Transactions");
  const txColumns: {
    header: string;
    key: keyof RelatedPartyTxRow;
    width: number;
  }[] = [
    { header: "TRAN_DATE", key: "TRAN_DATE", width: 12 },
    { header: "TRAN_ID", key: "TRAN_ID", width: 14 },
    { header: "DTH_INIT_SOL_ID", key: "DTH_INIT_SOL_ID", width: 14 },
    { header: "ENTRY_DATE", key: "ENTRY_DATE", width: 18 },
    { header: "ENTRY_USER_ID", key: "ENTRY_USER_ID", width: 14 },
    { header: "PSTD_DATE", key: "PSTD_DATE", width: 18 },
    { header: "PSTD_USER_ID", key: "PSTD_USER_ID", width: 14 },
    { header: "VFD_DATE", key: "VFD_DATE", width: 18 },
    { header: "VFD_USER_ID", key: "VFD_USER_ID", width: 14 },
    { header: "TRAN_TYPE", key: "TRAN_TYPE", width: 12 },
    { header: "TRAN_SUB_TYPE", key: "TRAN_SUB_TYPE", width: 14 },
    { header: "FROM_CIF", key: "FROM_CIF", width: 14 },
    { header: "FROM_ACCOUNT", key: "FROM_ACCOUNT", width: 16 },
    { header: "FROM_NAME", key: "FROM_NAME", width: 24 },
    { header: "FROM_SCHM_CODE", key: "FROM_SCHM_CODE", width: 14 },
    { header: "TO_CIF", key: "TO_CIF", width: 14 },
    { header: "TO_ACCOUNT", key: "TO_ACCOUNT", width: 16 },
    { header: "TO_NAME", key: "TO_NAME", width: 24 },
    { header: "TO_SCHM_CODE", key: "TO_SCHM_CODE", width: 14 },
    { header: "TRAN_AMOUNT", key: "TRAN_AMOUNT", width: 16 },
    { header: "AMOUNT_MNT", key: "AMOUNT_MNT", width: 16 },
    { header: "CURRENCY", key: "CURRENCY", width: 10 },
    { header: "CHANNEL_ID", key: "CHANNEL_ID", width: 12 },
    { header: "BANK", key: "BANK", width: 12 },
    { header: "BANK_TYPE", key: "BANK_TYPE", width: 12 },
    { header: "A_TRAN_ID", key: "A_TRAN_ID", width: 16 },
    { header: "SOL_ID", key: "SOL_ID", width: 10 },
    { header: "GL_SUB_HEAD_CODE", key: "GL_SUB_HEAD_CODE", width: 16 },
    { header: "ACCT_PRTY_NUMBER", key: "ACCT_PRTY_NUMBER", width: 16 },
    { header: "REF_NUM", key: "REF_NUM", width: 16 },
    { header: "DEBIT_PARTICULAR", key: "DEBIT_PARTICULAR", width: 22 },
    { header: "CREDIT_PARTICULAR", key: "CREDIT_PARTICULAR", width: 22 },
    { header: "DEBIT_RMKS", key: "DEBIT_RMKS", width: 20 },
    { header: "CREDIT_RMKS", key: "CREDIT_RMKS", width: 20 },
  ];
  txSheet.columns = txColumns;
  txSheet.getRow(1).font = { bold: true };
  result.transactions.forEach((row) => txSheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `harilcsan-guilgee-${startDate}_${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
