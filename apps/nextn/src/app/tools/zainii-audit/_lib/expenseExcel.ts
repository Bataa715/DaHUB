import type ExcelJS from "exceljs";
import type {
  ExpenseTxRow,
  ExpenseTotalTxRow,
  ExpenseGroupBreakdown,
} from "@/lib/api";

/**
 * Зайны аудит — Excel экспорт.
 *
 * Загварыг "Салбарын эрсдэлийн үнэлгээ"-ний тайлантай (risk-assessment/tailan/
 * _CsvExportModal.tsx) нэг ижил хэлээр барьсан: цайвар neutral толгой,
 * нимгэн саарал хүрээ, мөр хооронд цэгэн шугам, зебра судал, тоон баганад
 * мянгатын таслал. Ингэснээр аудитын бүх гаралт нэг гэр бүл шиг харагдана.
 */

// ── Өнгөний палитр (эрсдэлийн үнэлгээний тайлантай ижил) ────────────────────
const C = {
  ink: "FF1F2933",
  muted: "FF6B7480",
  line: "FFC9CFD4",
  lineSoft: "FFDCE1E4",
  white: "FFFFFFFF",
  zebra: "FFF7F8F9",

  titleBg: "FFF5F6F8",
  headerNeutral: "FFEEF1F4",
  bannerNeutral: "FFE3E7EB",

  // Утга бүхий тэмдэглэгээ — веб дэх өнгөтэй тохирсон pastel
  okHdr: "FFB7EAD9",
  ok: "FFDEF5ED", // emerald — байгаа / хэвийн
  warnHdr: "FFFCE2B6",
  warn: "FFFEF1DD", // amber — анхаарах
  badHdr: "FFFCC5CF",
  bad: "FFFDE4E8", // rose — байхгүй / зөрчилтэй
  infoHdr: "FFB7E4F8",
  info: "FFDDF2FC", // sky — мэдээлэл
  amountHdr: "FFD0D1FB",
  amount: "FFE9EAFD", // indigo — дүнгийн багана
} as const;

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: C.line } },
  left: { style: "thin", color: { argb: C.line } },
  bottom: { style: "thin", color: { argb: C.line } },
  right: { style: "thin", color: { argb: C.line } },
};

const BORDER_SOFT: Partial<ExcelJS.Borders> = {
  top: { style: "dashed", color: { argb: C.lineSoft } },
  left: { style: "dashed", color: { argb: C.lineSoft } },
  bottom: { style: "dashed", color: { argb: C.lineSoft } },
  right: { style: "dashed", color: { argb: C.lineSoft } },
};

const MONEY_FMT = '#,##0;[Red]-#,##0;"—"';
const FONT = "Calibri";

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function styleHeaderCell(
  cell: ExcelJS.Cell,
  value: string,
  fillArgb: string = C.headerNeutral,
) {
  cell.value = value;
  cell.fill = solidFill(fillArgb);
  cell.font = { bold: true, color: { argb: C.ink }, size: 9, name: FONT };
  cell.border = BORDER;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

/** Баримтын толгой: гарчиг + шүүлтүүрийн мөр. Дараагийн чөлөөт мөрийг буцаана. */
function writeDocHeader(
  ws: ExcelJS.Worksheet,
  colCount: number,
  title: string,
  metaLines: string[],
): number {
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.fill = solidFill(C.titleBg);
  titleCell.font = { bold: true, size: 13, color: { argb: C.ink }, name: FONT };
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  ws.getRow(1).height = 30;

  let row = 2;
  for (const line of metaLines) {
    ws.mergeCells(row, 1, row, colCount);
    const cell = ws.getCell(row, 1);
    cell.value = line;
    cell.font = { size: 9, color: { argb: C.muted }, name: FONT };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(row).height = 15;
    row++;
  }
  return row + 1;
}

/** Хэсгийн банер (жишээ нь "Ерөнхий дэвтрийн бүлгээр"). */
function writeSectionBanner(
  ws: ExcelJS.Worksheet,
  row: number,
  colCount: number,
  text: string,
): number {
  ws.mergeCells(row, 1, row, colCount);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.fill = solidFill(C.bannerNeutral);
  cell.font = { bold: true, size: 10, color: { argb: C.ink }, name: FONT };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cell.border = BORDER;
  ws.getRow(row).height = 22;
  return row + 1;
}

interface ColSpec<T> {
  header: string;
  width: number;
  /** Толгойн өнгө — утга бүхий баганад тодруулна */
  headerFill?: string;
  /** Мөрийн нүдний суурь өнгө (зебрагийн оронд) */
  cellFill?: (row: T) => string | undefined;
  value: (row: T) => string | number | null;
  money?: boolean;
  align?: "left" | "center" | "right";
}

/** Толгой + өгөгдлийн мөрүүдийг бичнэ. Дараагийн чөлөөт мөрийг буцаана. */
function writeTable<T>(
  ws: ExcelJS.Worksheet,
  startRow: number,
  cols: ColSpec<T>[],
  rows: T[],
): number {
  // Толгой
  const headerRow = ws.getRow(startRow);
  cols.forEach((col, i) => {
    styleHeaderCell(
      headerRow.getCell(i + 1),
      col.header,
      col.headerFill ?? C.headerNeutral,
    );
  });
  headerRow.height = 28;

  // Өгөгдөл
  rows.forEach((row, r) => {
    const excelRow = ws.getRow(startRow + 1 + r);
    const zebra = r % 2 === 1;
    cols.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      const v = col.value(row);
      cell.value = v === null || v === "" ? "—" : v;
      cell.font = { size: 9, color: { argb: C.ink }, name: FONT };
      cell.border = BORDER_SOFT;
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? (col.money ? "right" : "left"),
        wrapText: false,
        indent: col.align === "left" || !col.align ? 1 : 0,
      };
      if (col.money) cell.numFmt = MONEY_FMT;

      const custom = col.cellFill?.(row);
      const fill = custom ?? (zebra ? C.zebra : C.white);
      cell.fill = solidFill(fill);
    });
    excelRow.height = 16;
  });

  // Баганын өргөн
  cols.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  return startRow + 1 + rows.length;
}

/** Нийлбэрийн мөр — дүнгийн баганад нийт дүнг тавина. */
function writeTotalRow<T>(
  ws: ExcelJS.Worksheet,
  row: number,
  cols: ColSpec<T>[],
  rows: T[],
  label = "НИЙТ",
): number {
  const excelRow = ws.getRow(row);
  cols.forEach((col, i) => {
    const cell = excelRow.getCell(i + 1);
    cell.fill = solidFill(C.bannerNeutral);
    cell.font = { bold: true, size: 9, color: { argb: C.ink }, name: FONT };
    cell.border = BORDER;
    if (i === 0) {
      cell.value = label;
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    } else if (col.money) {
      const sum = rows.reduce((acc, r) => {
        const v = col.value(r);
        return acc + (typeof v === "number" ? v : 0);
      }, 0);
      cell.value = sum;
      cell.numFmt = MONEY_FMT;
      cell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      cell.value = "";
    }
  });
  excelRow.height = 20;
  return row + 1;
}

// ── Нийтлэг туслахууд ───────────────────────────────────────────────────────
const yesNo = (v: 0 | 1 | undefined) => (v ? "Тийм" : "Үгүй");

const VERIF_LABEL: Record<string, string> = {
  normal: "Хэвийн",
  questionable: "Эргэлзээтэй",
  attention: "Анхаарах",
};

function verifFill(status: string): string | undefined {
  if (status === "normal") return C.ok;
  if (status === "questionable") return C.bad;
  if (status === "attention") return C.warn;
  return undefined;
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fileStamp(): string {
  return nowStamp().replace(/[: ]/g, "-");
}

/** ExcelJS-ийг зөвхөн хэрэгтэй үед ачаална (эхний bundle-ыг хөнгөн байлгана). */
async function loadExcel() {
  const mod = await import("exceljs");
  return (mod.default ?? mod) as typeof ExcelJS;
}

function applyDefaults(wb: ExcelJS.Workbook) {
  wb.creator = "Голомт банк — Дотоод аудит";
  wb.created = new Date();
}

function finishSheet(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  colCount: number,
) {
  // Толгойн мөрийг царцаана — урт жагсаалт гүйлгэхэд багана нь харагдана
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: colCount },
  };
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    },
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ── 1) Зардлын хяналт ───────────────────────────────────────────────────────
export async function downloadExpenseOverviewXlsx(opts: {
  rows: ExpenseTxRow[];
  startDate: string;
  endDate: string;
  minAmount: number;
  searchTerm?: string;
  qualifyingCount?: number;
  qualifyingTotalDebit?: number;
}) {
  const Excel = await loadExcel();
  const wb = new Excel.Workbook();
  applyDefaults(wb);
  const ws = wb.addWorksheet("Зардлын хяналт", {
    views: [{ state: "frozen" }],
  });

  const cols: ColSpec<ExpenseTxRow>[] = [
    {
      header: "Гүйлгээний огноо",
      width: 13,
      value: (r) => r.book_date,
      align: "center",
    },
    { header: "Харилцагчийн код", width: 15, value: (r) => r.customer_code },
    { header: "Харилцагчийн нэр", width: 30, value: (r) => r.customer_name },
    { header: "Дансны нэр", width: 24, value: (r) => r.account_name },
    { header: "Дансны код", width: 12, value: (r) => r.account_code },
    {
      header: "Валют",
      width: 8,
      value: (r) => r.currency_code,
      align: "center",
    },
    {
      header: "Дебет дүн",
      width: 16,
      money: true,
      headerFill: C.amountHdr,
      cellFill: () => C.amount,
      value: (r) => r.debit_amount,
    },
    { header: "Гүйлгээний дугаар", width: 16, value: (r) => r.book_number },
    { header: "Гүйлгээний утга", width: 38, value: (r) => r.description },
    { header: "Нэгжийн нэр", width: 26, value: (r) => r.department_name },
    {
      header: "Ерөнхий дэвтрийн бүлэг",
      width: 24,
      value: (r) => r.co_a_group_name,
    },
    {
      header: "Авлагын төрөл",
      width: 22,
      value: (r) => r.recievable_type_name,
    },
    {
      header: "Төлбөрийн хүсэлт",
      width: 12,
      align: "center",
      headerFill: C.okHdr,
      cellFill: (r) => (r.has_payment_request ? C.ok : C.bad),
      value: (r) => yesNo(r.has_payment_request),
    },
    {
      header: "Харилцагчийн хүсэлт",
      width: 13,
      align: "center",
      headerFill: C.infoHdr,
      cellFill: (r) => (r.has_customer_payment_request ? C.ok : undefined),
      value: (r) => yesNo(r.has_customer_payment_request),
    },
    { header: "Төсвийн төрөл", width: 24, value: (r) => r.budget_type },
    {
      header: "Баталгаажсан",
      width: 12,
      align: "center",
      headerFill: C.warnHdr,
      cellFill: (r) => verifFill(r.verification_status),
      value: (r) => yesNo(r.has_verification),
    },
    {
      header: "Баталгаажуулалтын төрөл",
      width: 22,
      value: (r) => r.verification_type,
    },
    {
      header: "Гэрээний дүн",
      width: 16,
      money: true,
      headerFill: C.amountHdr,
      cellFill: () => C.amount,
      value: (r) => r.contract_total_amount,
    },
    {
      header: "Төлөв",
      width: 13,
      align: "center",
      cellFill: (r) => verifFill(r.verification_status),
      value: (r) => VERIF_LABEL[r.verification_status] ?? "",
    },
    { header: "Тайлбар", width: 34, value: (r) => r.comment },
  ];

  const meta = [
    `Хугацаа: ${opts.startDate} – ${opts.endDate}`,
    `Доод дүнгийн шүүлтүүр: ${opts.minAmount.toLocaleString("mn-MN")} ₮`,
    opts.qualifyingCount !== undefined
      ? `Шүүлтүүрт нийцсэн харилцагч: ${opts.qualifyingCount.toLocaleString("mn-MN")} · нийт дүн: ${(opts.qualifyingTotalDebit ?? 0).toLocaleString("mn-MN")} ₮`
      : "",
    opts.searchTerm ? `Хүснэгтийн хайлт: "${opts.searchTerm}"` : "",
    `Мөрийн тоо: ${opts.rows.length.toLocaleString("mn-MN")} · Татсан: ${nowStamp()}`,
  ].filter(Boolean);

  const headerRow = writeDocHeader(
    ws,
    cols.length,
    "ЗАЙНЫ АУДИТ — ЗАРДЛЫН ХЯНАЛТ",
    meta,
  );
  const afterTable = writeTable(ws, headerRow, cols, opts.rows);
  writeTotalRow(ws, afterTable, cols, opts.rows);
  finishSheet(ws, headerRow, cols.length);

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: XLSX_MIME }),
    `Зардлын-хяналт_${opts.startDate}_${opts.endDate}_${fileStamp()}.xlsx`,
  );
}

// ── 2) Нийт зардал ──────────────────────────────────────────────────────────
export async function downloadExpenseTotalXlsx(opts: {
  rows: ExpenseTotalTxRow[];
  byGlGroup: ExpenseGroupBreakdown[];
  byReceivableType: ExpenseGroupBreakdown[];
  totalAmount: number;
  startDate: string;
  endDate: string;
  minAmount?: number;
  searchTerm?: string;
}) {
  const Excel = await loadExcel();
  const wb = new Excel.Workbook();
  applyDefaults(wb);

  // ── Хуудас 1: Хураангуй (задаргаанууд) ────────────────────────────────
  const sum = wb.addWorksheet("Хураангуй");
  const groupCols: ColSpec<ExpenseGroupBreakdown>[] = [
    { header: "Код", width: 14, value: (r) => r.code },
    { header: "Нэр", width: 46, value: (r) => r.name },
    { header: "Гүйлгээний тоо", width: 14, money: true, value: (r) => r.count },
    {
      header: "Нийт дүн",
      width: 20,
      money: true,
      headerFill: C.amountHdr,
      cellFill: () => C.amount,
      value: (r) => r.total,
    },
  ];

  let row = writeDocHeader(sum, groupCols.length, "ЗАЙНЫ АУДИТ — НИЙТ ЗАРДАЛ", [
    `Хугацаа: ${opts.startDate} – ${opts.endDate}`,
    `Нийт дүн: ${opts.totalAmount.toLocaleString("mn-MN")} ₮`,
    `Татсан: ${nowStamp()}`,
  ]);

  row = writeSectionBanner(
    sum,
    row,
    groupCols.length,
    "Ерөнхий дэвтрийн бүлгээр",
  );
  const glHeader = row;
  row = writeTable(sum, row, groupCols, opts.byGlGroup);
  row = writeTotalRow(sum, row, groupCols, opts.byGlGroup);
  row += 1;

  row = writeSectionBanner(sum, row, groupCols.length, "Авлагын төрлөөр");
  row = writeTable(sum, row, groupCols, opts.byReceivableType);
  row = writeTotalRow(sum, row, groupCols, opts.byReceivableType);

  groupCols.forEach((c, i) => {
    sum.getColumn(i + 1).width = c.width;
  });
  sum.views = [{ state: "frozen", ySplit: glHeader }];
  sum.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1 };

  // ── Хуудас 2: Гүйлгээний жагсаалт ─────────────────────────────────────
  const ws = wb.addWorksheet("Гүйлгээ");
  const cols: ColSpec<ExpenseTotalTxRow>[] = [
    {
      header: "Гүйлгээний огноо",
      width: 13,
      value: (r) => r.book_date,
      align: "center",
    },
    { header: "Харилцагчийн код", width: 15, value: (r) => r.customer_code },
    { header: "Харилцагчийн нэр", width: 30, value: (r) => r.customer_name },
    { header: "Дансны нэр", width: 24, value: (r) => r.account_name },
    { header: "Дансны код", width: 12, value: (r) => r.account_code },
    {
      header: "Валют",
      width: 8,
      value: (r) => r.currency_code,
      align: "center",
    },
    {
      header: "Дебет дүн",
      width: 16,
      money: true,
      headerFill: C.amountHdr,
      cellFill: () => C.amount,
      value: (r) => r.debit_amount,
    },
    { header: "Гүйлгээний дугаар", width: 16, value: (r) => r.book_number },
    { header: "Гүйлгээний утга", width: 38, value: (r) => r.description },
    { header: "Нэгжийн нэр", width: 26, value: (r) => r.department_name },
    {
      header: "Ерөнхий дэвтрийн бүлэг",
      width: 24,
      value: (r) => r.co_a_group_name,
    },
    {
      header: "Авлагын төрөл",
      width: 22,
      value: (r) => r.recievable_type_name,
    },
  ];

  const meta = [
    `Хугацаа: ${opts.startDate} – ${opts.endDate}`,
    opts.minAmount
      ? `Доод дүнгийн шүүлтүүр: ${opts.minAmount.toLocaleString("mn-MN")} ₮`
      : "",
    opts.searchTerm ? `Хүснэгтийн хайлт: "${opts.searchTerm}"` : "",
    `Мөрийн тоо: ${opts.rows.length.toLocaleString("mn-MN")} · Татсан: ${nowStamp()}`,
  ].filter(Boolean);

  const headerRow = writeDocHeader(
    ws,
    cols.length,
    "ЗАЙНЫ АУДИТ — НИЙТ ЗАРДЛЫН ГҮЙЛГЭЭ",
    meta,
  );
  const afterTable = writeTable(ws, headerRow, cols, opts.rows);
  writeTotalRow(ws, afterTable, cols, opts.rows);
  finishSheet(ws, headerRow, cols.length);

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: XLSX_MIME }),
    `Нийт-зардал_${opts.startDate}_${opts.endDate}_${fileStamp()}.xlsx`,
  );
}
