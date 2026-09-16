// Эрсдэлийн тайлангийн Excel — өнгө, хүрээ, эрэмбэлэх туслах функцүүд.
import type ExcelJS from "exceljs";

export const C = {
  ink: "FF1F2933",
  muted: "FF6B7680",
  line: "FFC9CFD4",
  lineSoft: "FFDCE1E4",
  white: "FFFFFFFF",
  zebra: "FFF7F8F9",

  // Төвийг сахисан (neutral) гарчиг/банер өнгө — веб дэх header-үүд шиг цайвар цэвэр.
  headerNeutral: "FFEEF1F4",
  bannerNeutral: "FFE3E7EB",
  titleBg: "FFF5F6F8",

  ub: "FFDDE8F5", // цайвар цэнхэр — УБ бүлгийн өнгө
  ubSoft: "FFEEF4FA",
  on: "FFD8F0E8", // цайвар ногоон — ОН бүлгийн өнгө
  onSoft: "FFEEF7F3",

  // Веб дэх S1–S4 / J / Total баганын өнгөтэй яг тохирсон pastel хос
  // (header = арай тод, өгөгдлийн нүд = маш цайвар tint).
  s1Hdr: "FFB7E4F8",
  s1: "FFDDF2FC", // sky
  s2Hdr: "FFDCCEFC",
  s2: "FFEFE8FE", // violet
  s3Hdr: "FFFCE2B6",
  s3: "FFFEF1DD", // amber
  s4Hdr: "FFB7EAD9",
  s4: "FFDEF5ED", // emerald
  jHdr: "FFFCC5CF",
  j: "FFFDE4E8", // rose
  totalHdr: "FFD0D1FB",
  total: "FFE9EAFD", // indigo

  // Эрсдэлийн түвшин — riskLevelClass-тай ижил rose/amber/emerald гэр бүл
  high: "FFFDE4E8", // Өндөр — rose
  mid: "FFFEF1DD", // Дунд — amber
  low: "FFDEF5ED", // Бага — emerald

  up: "FF8B3A3A", // өсөлт
  down: "FF2F5233", // бууралт
  prevHdr: "FFE8E5F8", // цайвар нил ягаан — өмнөх үзүүлэлт
} as const;

export const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: C.line } },
  left: { style: "thin", color: { argb: C.line } },
  bottom: { style: "thin", color: { argb: C.line } },
  right: { style: "thin", color: { argb: C.line } },
};

// Мөр хоорондын дотоод шугам — цэгэн (dashed), Голомтын стандарт хүснэгтийн
// загвартай (docx тайлан) ижил.
export const BORDER_SOFT: Partial<ExcelJS.Borders> = {
  top: { style: "dashed", color: { argb: C.lineSoft } },
  left: { style: "dashed", color: { argb: C.lineSoft } },
  bottom: { style: "dashed", color: { argb: C.lineSoft } },
  right: { style: "dashed", color: { argb: C.lineSoft } },
};

export function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function applyBorder(cell: ExcelJS.Cell, soft = false) {
  cell.border = soft ? BORDER_SOFT : BORDER;
}

export function styleHeaderCell(
  cell: ExcelJS.Cell,
  value: string | number,
  fillArgb: string = C.headerNeutral,
) {
  cell.value = value;
  cell.fill = solidFill(fillArgb);
  // Дэвсгэр нь цайвар (гэгээлгэн) тул текст бараан бичигтэй байна.
  cell.font = { bold: true, color: { argb: C.ink }, size: 9, name: "Calibri" };
  cell.border = BORDER;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

export function levelFill(level: string): ExcelJS.Fill | undefined {
  const map: Record<string, string> = {
    Өндөр: C.high,
    Дунд: C.mid,
    Бага: C.low,
  };
  const argb = map[level];
  return argb ? solidFill(argb) : undefined;
}

export function solidSortKey(solid: string): number {
  const digits = String(solid ?? "").replace(/\D/g, "");
  if (!digits) return Number.MAX_SAFE_INTEGER;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

export function compareSolid(a: string, b: string): number {
  const na = solidSortKey(a);
  const nb = solidSortKey(b);
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), "mn", { numeric: true });
}

export function pct(w: number): string {
  return `${(w * 100).toFixed(0)}%`;
}
