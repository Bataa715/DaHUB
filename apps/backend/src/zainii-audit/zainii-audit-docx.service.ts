import { Injectable } from "@nestjs/common";
import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
  ShadingType,
  TableLayoutType,
} from "docx";
import type { IImageOptions, ITableBordersOptions } from "docx";
import { ExpenseReportData } from "./zainii-audit.types";

// [FIX] `layout` анхдагчаар "autofit" тул Word эсийн агуулгаас хамааруулж
// баганын өргөнийг ДАХИН тооцоолдог — тэгэхээр % өргөнөөрөө биш, урт
// текст/тоо агуулсан баганаараа хэт нарийсаж (эсрэгээрээ бусад багана хэт
// өргөсч) мөр давхар "гарч", хуудас тоо олширдог байсан (3 хуудас болсон
// гэсэн алдааны шалтгаан). `layout: FIXED` + бодит DXA (твип) баганын
// өргөнийг тодорхой зааж өгснөөр Word % харьцааг үнэн зөв дагана.
// Word-ийн "Narrow" margin (0.5in = 720 twip тал бүр) ашигласан тул
// ашиглах өргөн ихэссэн — A4-ийн 11906 twip-ээс хоёр захын margin-ийг
// хассан (11906-1440=10466) утганд аюулгүй буферээр ойртуулав.
const CONTENT_WIDTH_DXA = 10300;
function dxaWidths(pcts: number[]): number[] {
  return pcts.map((p) => Math.round((p / 100) * CONTENT_WIDTH_DXA));
}

// Зураг/хүснэгт бүрийн ард саарал хүрээ (frame) — эсийн margin (нэг тал).
const FRAME_PAD = 100;

// [AUDIT] Word тайлангийн style helper-үүд tailan-docx.service.ts-ийн
// загварыг давтдаг ч тэдгээр нь тухайн файлын private метод тул шууд
// импортлох боломжгүй (§5.3-тай ижил зарчим — модуль хоорондоо дотоод
// файлаа шүүрхийлэхгүй) — иймд энд бие даан давтав.
//
// [DESIGN] Анх банкны бодит "Гүйлгээний анализын тайлан"-тай яг адилхан
// харагдахаар (зөвхөн ХАР гарчиг, нэг ногоон гамма) хатуу тохируулсан
// байсан. Хэрэглэгчийн зөвшөөрлөөр (2026-09) илүү өнгөлөг/инфографик
// загвар руу шилжүүлэв — категори тус бүр өөрийн өнгөтэй, KPI хайрцаг,
// шинэ хэсгүүд (Холбоотой/Хамааралтай худалдан авалт, Эрхийн матриц
// зөрчил) нэмэгдсэн. Тоог en-US таслалын бүлэглэлтэй (16,626.6) хэвээр
// харуулна.
const TABLE_HEADER_BG = "B9CCC0"; // намуухан бүдэг ногоон (хүснэгтийн толгой)
const TABLE_BORDER = "404040";
const GRAY_BOX = "F2F2F2";
const GRAY_BOX_BORDER = "D9D9D9";
const CHECK_GREEN = "1B4332";
// Хүснэгт/зураг/диаграмын ард — цагаанаас бага зэрэг саарал (өмнө нь цэвэр
// цагаан байсан).
const CONTENT_BG = "F4F5F4";
// Мөр ээлжлэн (zebra) сүүдэрлэх өнгө — толгойгоос илүү цайвар.
const ZEBRA_BG = "EEF1EF";

// Дугуй диаграмын гамма — категори тус бүр ялгаатай өнгөтэй (эхний хувилбар
// зөвхөн ногоон-муж байсныг илүү олон өнгөт болгов).
const DONUT_RAMP = [
  "2D6A4F", // ногоон
  "1D4ED8", // цэнхэр
  "B45309", // улбар шар
  "7C3AED", // ягаан-нил
  "0E7490", // хөх ногоон
  "BE123C", // час улаан
  "CA8A04", // шар
  "9E9E9E", // "Тодорхойгүй" ангилалд зориулсан саарал
];

// KPI хайрцгийн 4 өнгөт tile — ногоон/цэнхэр/индиго/час улаан.
const KPI_TILE_COLORS = ["2D6A4F", "1D4ED8", "6D28D9", "BE123C"];

// [AUDIT] docx ImageRun(type:"svg") нь SVG рендер хийхгүй хуучин Word-д зориулж
// заавал fallback зураг шаарддаг — бид зөвхөн орчин үеийн Word дээр SVG
// харагдахыг л хүсдэг тул fallback-ыг 1x1 тунгалаг PNG-ээр орлуулна.
const BLANK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/** Эх загварт en-US бүлэглэлт (16,626.6) ашигласан тул mn-MN биш үүнийг баримтална. */
function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(n || 0),
  );
}

function fmtMillion(n: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format((n || 0) / 1_000_000);
}

/** Гэрээ/дүн байхгүй бол "-" — сөрөг тооцоолсон утга ("0 - төлсөн дүн") бүү харуул. */
function fmtMillionOrDash(n: number): string {
  return n > 0 ? fmtMillion(n) : "-";
}

/** ISO (YYYY-MM-DD) огноог тайлангийн уламжлалт "YYYY.MM.DD" форматруу
 *  хөрвүүлнэ. Хадгалалт (ClickHouse/DTO validation) dash хэвээр — зөвхөн
 *  Word тайлан дээрх ХАРУУЛАЛТЫГ л цэгтэй болгоно. */
function fmtDotDate(iso: string): string {
  const s = (iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return s.slice(0, 10).replace(/-/g, ".");
}

/** Hex өнгө цайвар эсэхийг (relative luminance) тодорхойлно — текстийн контраст сонгоход. */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

function toXY(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Дугуй (donut) диаграмын нэг хэсгийн SVG зам — гадна/дотор радиустай цагираг. */
function donutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = toXY(cx, cy, outerR, startAngle);
  const endOuter = toXY(cx, cy, outerR, endAngle);
  const startInner = toXY(cx, cy, innerR, endAngle);
  const endInner = toXY(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Категори тус бүрийн дүнгээс дугуй (donut) диаграм үүсгэнэ — хувийн шошготой. */
function buildDonutSvg(slices: { value: number }[], size = 320): string | null {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.55;

  const nonZero = slices
    .map((s, i) => ({
      value: Math.max(0, s.value),
      color: DONUT_RAMP[i % DONUT_RAMP.length],
    }))
    .filter((s) => s.value > 0);

  if (nonZero.length === 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#${nonZero[0].color}" />
      <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#FFFFFF" />
    </svg>`;
  }

  let angle = 0;
  const parts: string[] = [];
  for (const slice of nonZero) {
    const sweep = (slice.value / total) * 360;
    const mid = angle + sweep / 2;
    const path = donutSlicePath(cx, cy, outerR, innerR, angle, angle + sweep);
    parts.push(`<path d="${path}" fill="#${slice.color}" />`);
    const pct = (slice.value / total) * 100;
    // Диаграм жижиг үед (size < 200) хувийн шошго уншигдахааргүй жижиг
    // болдог тул огт зурахгүй — легенд хүснэгтэд аль хэдийн дүн харагдаж
    // байгаа тул мэдээлэл алдагдахгүй.
    if (pct >= 4 && size >= 200) {
      const labelR = (outerR + innerR) / 2;
      const pos = toXY(cx, cy, labelR, mid);
      // Цайвар хэсэгт хар текст, бараан хэсэгт цагаан текст — эсрэгээр бол
      // цайвар ногоон дэвсгэр дээр цагаан тоо уншигдахгүй болно.
      const textColor = isLightColor(slice.color) ? "1B5E20" : "FFFFFF";
      const fontSize = Math.round(size * 0.0406);
      parts.push(
        `<text x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}" font-family="Times New Roman" font-size="${fontSize}" fill="#${textColor}" text-anchor="middle" dominant-baseline="middle">${pct.toFixed(0)}%</text>`,
      );
    }
    angle += sweep;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${parts.join("")}</svg>`;
}

type Align = "left" | "center" | "right";

@Injectable()
export class ZainiiAuditDocxService {
  async buildExpenseReportDocx(data: ExpenseReportData): Promise<Buffer> {
    const children: (Paragraph | Table)[] = [];

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `ГҮЙЛГЭЭНИЙ АНАЛИЗЫН ТАЙЛАН №${data.reportNumber}`,
            bold: true,
            size: 26,
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `Тайлант хугацаа: ${fmtDotDate(data.startDate)} — ${fmtDotDate(data.endDate)}`,
            size: 18,
            italics: true,
            font: "Times New Roman",
          }),
        ],
      }),
    );

    // Хамрах хүрээ: тайлбар текст + 1..N ангиллын жагсаалт НЭГ хайрцагт.
    children.push(
      this.grayBox(
        [
          {
            text: "Хамрах хүрээ: Тайлант хугацаанд хийгдсэн анхаарал хандуулах шаардлагатай, өндөр дүнтэй дараах төрлийн гүйлгээнүүдийг баталгаажуулав.",
            italics: true,
          },
        ],
        [this.twoColumnList(data.scopeCategoryNames, CONTENT_WIDTH_DXA - 320)],
      ),
    );

    // ── KPI хайрцаг мөр — тайлангийн ерөнхий дүр зургийг нэг харцаар. ──────
    children.push(
      this.kpiRow([
        {
          label: "Тэнцсэн харилцагчийн тоо",
          value: fmtInt(data.qualifyingCount),
          color: KPI_TILE_COLORS[0],
        },
        {
          label: "Нийт дүн (сая.₮)",
          value: fmtMillion(data.qualifyingTotalDebit),
          color: KPI_TILE_COLORS[1],
        },
        {
          label: "Холбоотой/Хамааралтай худалдан авалт (сая.₮)",
          value: fmtMillion(
            data.relatedPurchaseTotal + data.connectedPurchaseTotal,
          ),
          color: KPI_TILE_COLORS[2],
        },
        {
          label: "Эрхийн матриц зөрчсөн гүйлгээ",
          value: fmtInt(data.authorityViolations.length),
          color: KPI_TILE_COLORS[3],
        },
      ]),
    );

    // ── I. ГҮЙЛГЭЭНИЙ АНГИЛАЛ ──────────────────────────────────────────────
    children.push(this.bigHeading("I. ГҮЙЛГЭЭНИЙ АНГИЛАЛ:"));

    const pieSlices = [
      ...data.categories.map((c) => ({ label: c.name, value: c.totalAmount })),
      ...(data.uncategorizedTotal > 0
        ? [{ label: "Тодорхойгүй", value: data.uncategorizedTotal }]
        : []),
    ];
    // [FIX] Диаграм "дарагдаж" (давхцаж/тасарч) харагдаж байсны жинхэнэ
    // шалтгаан: зурган баганын DXA өргөн нь зурган ХЭМЖЭЭнээс (px→EMU→dxa)
    // БАГА байсан тул Word зургийг баганынхаа хилээс давуулж, зэргэлдээх
    // легенд дээр давхцуулж зурсан — Word зургийг эсийн өргөнд автоматаар
    // багасгадаггүй. Тиймээс зурган баганыг px хэмжээнээс тооцоолсон DXA-
    // аар (+бага зэрэг захын зай) ЗААВАЛ тэнцүү буюу том байлгана.
    const DONUT_PX = 92;
    const donutColWidthDxa = Math.ceil((DONUT_PX * 9525) / 635) + 200;
    // [FIX] SVG-ийн native хэмжээг ЯГ DONUT_PX-тэй тэнцүү өгнө — Word зарим
    // үед `transformation`-ийг үл тоомсорлож native хэмжээгээр зурдаг тул
    // хоёул адилхан байвал аль ч тохиолдолд зөв (жижиг) хэмжээтэй гарна.
    const svg = buildDonutSvg(pieSlices, DONUT_PX);

    // [FIX] Диаграм ба легенд хоёрыг НЭГ мөрөнд, ХОЁР ДАВХАР үүрлэсэн
    // хүснэгтгүйгээр (диаграм-легенд дотоод хүснэгт → frame → sectionIRow-
    // ийн эс) ЯГ НЭГ гадаад мөрийн 3 ЭС болгож шууд зэрэгцүүлэв — давхар
    // үүрлэлт зарим Word-д "дээр-доор" (stack) харагдах шалтгаан болж
    // байсан тул хамгийн энгийн, найдвартай бүтэц рүү шилжүүлэв.
    const legendColDxa = Math.round(CONTENT_WIDTH_DXA * 0.35);
    const top5ColDxa = CONTENT_WIDTH_DXA - donutColWidthDxa - legendColDxa;
    const donutColPct = Math.round(
      (donutColWidthDxa / CONTENT_WIDTH_DXA) * 100,
    );
    const legendColPct = Math.round((legendColDxa / CONTENT_WIDTH_DXA) * 100);
    const top5ColPct = 100 - donutColPct - legendColPct;

    // [FIX] Хүрээг (frame) дотоод хүснэгтэд биш ГАДААД эсэд ШУУД зурснаар
    // Word мөрийн 3 эсийг АВТОМААР ижил өндөртэй болгодог (нэг мөрийн бүх
    // эс адил өндөртэй байх нь хүснэгтийн үндсэн зарчим) — дотоод frame()
    // зөвхөн өөрийн агуулгынхаа өндрөөр хүрээлдэг байсан тул 3 хэсэг өөр
    // өндөртэй (доод ирмэг зэрэгцээгүй) харагдаж байв. Топ-5-ын дээрх
    // тусдаа гарчгийг мөн хассан — эс бүр НЭГ түвшинд шууд эхэлж, ирмэг
    // яг тэнцүү болно.
    const cellBoxMargins = {
      top: FRAME_PAD,
      bottom: FRAME_PAD,
      left: FRAME_PAD,
      right: FRAME_PAD,
    };
    const sectionIRow = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [donutColWidthDxa, legendColDxa, top5ColDxa],
      borders: this.noBorders(),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: donutColPct, type: WidthType.PERCENTAGE },
              borders: this.border(GRAY_BOX_BORDER),
              shading: { type: ShadingType.SOLID, color: CONTENT_BG },
              margins: cellBoxMargins,
              verticalAlign: "top",
              children: [
                svg
                  ? new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          type: "svg",
                          data: Buffer.from(svg),
                          fallback: {
                            type: "png",
                            data: Buffer.from(BLANK_PNG_BASE64, "base64"),
                          },
                          transformation: { width: DONUT_PX, height: DONUT_PX },
                        } satisfies IImageOptions),
                      ],
                    })
                  : this.bodyPara("Мэдээлэл алга"),
              ],
            }),
            new TableCell({
              width: { size: legendColPct, type: WidthType.PERCENTAGE },
              borders: this.border(GRAY_BOX_BORDER),
              shading: { type: ShadingType.SOLID, color: CONTENT_BG },
              margins: cellBoxMargins,
              verticalAlign: "top",
              children: [
                this.legendTable(pieSlices, legendColDxa - FRAME_PAD * 2, 18),
              ],
            }),
            new TableCell({
              width: { size: top5ColPct, type: WidthType.PERCENTAGE },
              borders: this.border(GRAY_BOX_BORDER),
              shading: { type: ShadingType.SOLID, color: CONTENT_BG },
              margins: cellBoxMargins,
              verticalAlign: "top",
              children: [
                this.dataTable(
                  ["№", "Харилцагч", "Дүн (сая.₮)", "Гүйлгээний зориулалт"],
                  [5, 30, 14, 51],
                  ["center", "left", "right", "left"],
                  data.top5.map((r, i) => [
                    String(i + 1),
                    r.customer_name || r.customer_code,
                    fmtMillion(r.debit_amount),
                    r.description,
                  ]),
                  undefined,
                  16,
                  top5ColDxa - FRAME_PAD * 2,
                ),
              ],
            }),
          ],
        }),
      ],
    });
    children.push(sectionIRow);

    // ── II. ГҮЙЛГЭЭНИЙ БАТАЛГААЖУУЛАЛТ ──────────────────────────────────────
    children.push(this.bigHeading("II. ГҮЙЛГЭЭНИЙ БАТАЛГААЖУУЛАЛТ:"));
    children.push(
      this.grayBox(
        [
          `Гүйлгээний шалгуур: Харилцагчийн нийт дүнгээр ${fmtMillion(data.minAmount)} сая төгрөг болон түүнээс дээш дүнгээр хийгдсэн гүйлгээг хамруулав.`,
          `Гүйлгээний тоо: ${fmtInt(data.qualifyingCount)}`,
          `Гүйлгээний нийт дүн: ${fmtMillion(data.qualifyingTotalDebit)} сая.₮`,
        ].map((text) => ({ text, italics: true })),
      ),
    );

    data.categories.forEach((cat, idx) => {
      children.push(
        this.subHeading(`2.${idx + 1}. ${cat.name.toUpperCase()}:`, 20),
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: "/сая.₮/",
              italics: true,
              size: 18,
              font: "Times New Roman",
            }),
          ],
        }),
      );

      // Валютаар бүлэглэнэ — MNT-ээс өөр валюттай гэрээг тусдаа дэд
      // хүснэгт болгож харуулна (нэг ерөнхий "Нийт" мөрөнд MNT бус
      // дүнг MNT-той хольж нэмбэл утгагүй болно).
      const byCurrency = new Map<string, typeof cat.customers>();
      for (const c of cat.customers) {
        const cur = c.contract_currency || "MNT";
        const bucket = byCurrency.get(cur);
        if (bucket) bucket.push(c);
        else byCurrency.set(cur, [c]);
      }
      const currencies = Array.from(byCurrency.keys()).sort((a, b) =>
        a === "MNT" ? -1 : b === "MNT" ? 1 : a.localeCompare(b),
      );

      for (const currency of currencies) {
        const customers = byCurrency.get(currency)!;
        if (currency !== "MNT") {
          children.push(this.subHeading(`${cat.name} (${currency}):`, 18));
        }

        const totals = customers.reduce(
          (acc, c) => ({
            contract:
              acc.contract +
              (c.contract_total_amount > 0 ? c.contract_total_amount : 0),
            paid: acc.paid + c.paid_amount,
            remaining:
              acc.remaining +
              (c.contract_total_amount > 0 ? c.remaining_amount : 0),
          }),
          { contract: 0, paid: 0, remaining: 0 },
        );

        const rowCount = customers.length;
        const fontSize = rowCount > 15 ? 16 : 18;
        children.push(
          this.frame(
            this.dataTable(
              [
                "Харилцагч",
                "Төлбөрийн зориулалт",
                "Гэрээний огноо",
                "Гэрээний нийт дүн",
                "Тайлант хугацаанд төлсөн дүн",
                "Үлдэгдэл дүн",
                "Төсөв",
              ],
              [16, 22, 10, 13, 15, 12, 12],
              ["left", "left", "center", "right", "right", "right", "center"],
              customers.map((c) => [
                c.customer_name || c.customer_code,
                c.description,
                fmtDotDate(c.contract_date) || "-",
                fmtMillionOrDash(c.contract_total_amount),
                fmtMillion(c.paid_amount),
                c.contract_total_amount > 0
                  ? fmtMillion(c.remaining_amount)
                  : "-",
                c.budget_type ? `✓ ${c.budget_type}` : "-",
              ]),
              [
                "Нийт",
                "",
                "",
                fmtMillion(totals.contract),
                fmtMillion(totals.paid),
                fmtMillion(totals.remaining),
                "",
              ],
              fontSize,
              CONTENT_WIDTH_DXA - FRAME_PAD * 2,
              true,
            ),
            CONTENT_WIDTH_DXA,
          ),
        );
      }
    });

    // ── IV. ХОЛБООТОЙ/ХАМААРАЛТАЙ ЭТГЭЭДЭЭС ХИЙСЭН ХУДАЛДАН АВАЛТ ──────────
    children.push(
      this.bigHeading("IV. ХОЛБООТОЙ/ХАМААРАЛТАЙ ЭТГЭЭДЭЭС ХИЙСЭН ХУДАЛДАН АВАЛТ:"),
    );
    children.push(
      this.kpiRow([
        {
          label: "Хамааралтай харилцагчаас хийсэн худалдан авалт (сая.₮)",
          value: fmtMillion(data.relatedPurchaseTotal),
          color: KPI_TILE_COLORS[0],
        },
        {
          label: "Холбоотой харилцагчаас хийсэн худалдан авалт (сая.₮)",
          value: fmtMillion(data.connectedPurchaseTotal),
          color: KPI_TILE_COLORS[1],
        },
      ]),
    );

    // ── V. ЭРХИЙН МАТРИЦ ЗӨРЧСӨН ГҮЙЛГЭЭ ────────────────────────────────────
    children.push(this.bigHeading("V. ЭРХИЙН МАТРИЦ ЗӨРЧСӨН ГҮЙЛГЭЭ:"));
    if (data.authorityViolations.length === 0) {
      children.push(this.bodyPara("Илэрсэн зөрчил байхгүй."));
    } else {
      children.push(
        this.frame(
          this.dataTable(
            ["Харилцагч", "Баримтын дугаар", "Дүн (сая.₮)", "Тайлбар"],
            [24, 16, 15, 45],
            ["left", "left", "right", "left"],
            data.authorityViolations.map((v) => [
              v.customer_name || v.customer_code,
              v.book_number,
              fmtMillion(v.debit_amount),
              v.comment || "-",
            ]),
            undefined,
            18,
            CONTENT_WIDTH_DXA - FRAME_PAD * 2,
            true,
          ),
          CONTENT_WIDTH_DXA,
        ),
      );
    }

    // ── VI. ДҮГНЭЛТ ─────────────────────────────────────────────────────────
    children.push(this.bigHeading("VI. ДҮГНЭЛТ"));
    const conclusionLines = (data.conclusionText || "")
      .split("\n")
      .filter((l) => l.trim() !== "");
    if (conclusionLines.length === 0) {
      children.push(this.bulletPara("Дүгнэлт оруулаагүй байна."));
    } else {
      for (const line of conclusionLines) children.push(this.bulletPara(line));
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 18 },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
      sections: [
        {
          properties: {
            // Word-ийн "Narrow" margin (0.5in = 720 twip тал бүр).
            page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
          },
          children,
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  private noBorders() {
    const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    return {
      top: none,
      bottom: none,
      left: none,
      right: none,
      insideH: none,
      insideV: none,
    };
  }

  private border(color = TABLE_BORDER) {
    return {
      top: { style: BorderStyle.SINGLE, size: 4, color },
      bottom: { style: BorderStyle.SINGLE, size: 4, color },
      left: { style: BorderStyle.SINGLE, size: 4, color },
      right: { style: BorderStyle.SINGLE, size: 4, color },
    };
  }

  private bigHeading(text: string) {
    return new Paragraph({
      spacing: { before: 340, after: 140 },
      children: [
        new TextRun({ text, bold: true, size: 24, font: "Times New Roman" }),
      ],
    });
  }

  private subHeading(text: string, size = 24) {
    return new Paragraph({
      spacing: { before: 220, after: 60 },
      children: [
        new TextRun({ text, bold: true, size, font: "Times New Roman" }),
      ],
    });
  }

  private bodyPara(text: string) {
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100, line: 276 },
      children: [new TextRun({ text, size: 18, font: "Times New Roman" })],
    });
  }

  private bulletPara(text: string) {
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100, line: 276 },
      bullet: { level: 0 },
      children: [new TextRun({ text, size: 18, font: "Times New Roman" })],
    });
  }

  /**
   * Саарал хүрээтэй мэдээллийн хайрцаг (Хамрах хүрээ / Шалгуур). `extra`
   * өгвөл тэдгээрийг (жишээ нь 2 баганатай жагсаалт) ЯГ ЛУУ хайрцагны
   * дотор, текстийн доор нэмнэ — тусдаа блок биш, нэг хайрцагт.
   */
  private grayBox(
    lines: { text: string; italics?: boolean }[],
    extra: (Paragraph | Table)[] = [],
  ) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: dxaWidths([100]),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: this.border(GRAY_BOX_BORDER),
              shading: { type: ShadingType.SOLID, color: GRAY_BOX },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: [
                ...lines.map(
                  (l, i) =>
                    new Paragraph({
                      spacing: {
                        before: i === 0 ? 0 : 40,
                        after: 0,
                        line: 260,
                      },
                      children: [
                        new TextRun({
                          text: l.text,
                          italics: l.italics,
                          size: 18,
                          font: "Times New Roman",
                        }),
                      ],
                    }),
                ),
                ...extra,
              ],
            }),
          ],
        }),
      ],
    });
  }

  /**
   * KPI хайрцаг мөр — өнгөт tile бүр 1 үзүүлэлт (тоо/дүн) харуулна.
   * Инфографик загварын нэг хэсэг (§ 2026-09 "илүү өнгөлөг" шинэчлэл).
   */
  private kpiRow(tiles: { label: string; value: string; color: string }[]) {
    const colDxa = Math.floor(CONTENT_WIDTH_DXA / tiles.length);
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: tiles.map(() => colDxa),
      borders: this.noBorders(),
      rows: [
        new TableRow({
          children: tiles.map(
            (tile) =>
              new TableCell({
                width: {
                  size: Math.floor(100 / tiles.length),
                  type: WidthType.PERCENTAGE,
                },
                borders: this.border(GRAY_BOX_BORDER),
                shading: { type: ShadingType.SOLID, color: CONTENT_BG },
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 40 },
                    children: [
                      new TextRun({
                        text: tile.value,
                        bold: true,
                        size: 26,
                        color: tile.color,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: tile.label,
                        size: 15,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
      ],
    });
  }

  /**
   * Зураг/хүснэгт бүрийн ард саарал хүрээ (frame) — хэрэглэгчийн хүссэн
   * "бүх зураг, хүснэгтийн ард саарал хүрээ" загвар. `content`-ийн дотоод
   * баганын өргөнийг дуудагч тал FRAME_PAD*2-оор багасгасан байх ёстой.
   */
  private frame(content: Table | Paragraph, widthDxa: number) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [widthDxa],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: this.border(GRAY_BOX_BORDER),
              shading: { type: ShadingType.SOLID, color: CONTENT_BG },
              margins: {
                top: FRAME_PAD,
                bottom: FRAME_PAD,
                left: FRAME_PAD,
                right: FRAME_PAD,
              },
              children: [content],
            }),
          ],
        }),
      ],
    });
  }

  /** Хамрах хүрээний 1..N жагсаалтыг 2 баганаар харуулна (эх загвартай адил). */
  private twoColumnList(items: string[], containerWidthDxa: number) {
    const half = Math.ceil(items.length / 2);
    const left = items.slice(0, half);
    const right = items.slice(half);
    const rowCount = Math.max(left.length, right.length);
    const rows: TableRow[] = [];
    for (let i = 0; i < rowCount; i++) {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: this.noBorders(),
              margins: { top: 40, bottom: 0, left: 0, right: 80 },
              children: [
                left[i] != null
                  ? this.plainCellText(`${i + 1}. ${left[i]}`)
                  : this.plainCellText(""),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: this.noBorders(),
              margins: { top: 40, bottom: 0, left: 80, right: 0 },
              children: [
                right[i] != null
                  ? this.plainCellText(`${half + i + 1}. ${right[i]}`)
                  : this.plainCellText(""),
              ],
            }),
          ],
        }),
      );
    }
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [
        Math.round(containerWidthDxa / 2),
        Math.round(containerWidthDxa / 2),
      ],
      borders: this.noBorders(),
      rows,
    });
  }

  /**
   * Дугуй диаграмын өнгөт легенд — SVG дотор текст найдваргүй тул тусдаа
   * хүснэгт. `containerWidthDxa` — эцэг эсийн (nested table) бодит DXA
   * өргөн, багана тэнд харьцангуй тооцогдоно.
   */
  private legendTable(
    slices: { label: string; value: number }[],
    containerWidthDxa: number,
    fontSize = 18,
  ) {
    const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
    const nonZero = slices.filter((s) => s.value > 0);

    const headerRow = new TableRow({
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          borders: this.noBorders(),
          children: [
            this.plainCellText("", false, AlignmentType.LEFT, fontSize),
          ],
        }),
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
          },
          children: [
            this.plainCellText("Ангилал", true, AlignmentType.LEFT, fontSize),
          ],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
          },
          children: [
            this.plainCellText(
              "Дүн (сая.₮)",
              true,
              AlignmentType.RIGHT,
              fontSize,
            ),
          ],
        }),
      ],
    });

    const rows = nonZero.map((s, i) => {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: this.noBorders(),
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: "●",
                    color: DONUT_RAMP[i % DONUT_RAMP.length],
                    size: fontSize,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: this.noBorders(),
            children: [
              this.plainCellText(s.label, false, AlignmentType.LEFT, fontSize),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: this.noBorders(),
            children: [
              this.plainCellText(
                fmtMillion(s.value),
                false,
                AlignmentType.RIGHT,
                fontSize,
              ),
            ],
          }),
        ],
      });
    });

    const totalRow = new TableRow({
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
          },
          children: [
            this.plainCellText("", false, AlignmentType.LEFT, fontSize),
          ],
        }),
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
          },
          children: [
            this.plainCellText("Нийт", true, AlignmentType.LEFT, fontSize),
          ],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
          },
          children: [
            this.plainCellText(
              fmtMillion(total),
              true,
              AlignmentType.RIGHT,
              fontSize,
            ),
          ],
        }),
      ],
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [10, 60, 30].map((p) =>
        Math.round((p / 100) * containerWidthDxa),
      ),
      borders: this.noBorders(),
      rows:
        rows.length > 0
          ? [headerRow, ...rows, totalRow]
          : [
              headerRow,
              new TableRow({
                children: [
                  new TableCell({
                    borders: this.noBorders(),
                    children: [this.plainCellText("Мэдээлэл алга")],
                  }),
                ],
              }),
            ],
    });
  }

  private plainCellText(
    text: string,
    bold = false,
    alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
    fontSize = 18,
  ) {
    return new Paragraph({
      alignment,
      spacing: { before: 30, after: 30 },
      children: [
        new TextRun({ text, bold, size: fontSize, font: "Times New Roman" }),
      ],
    });
  }

  private alignmentOf(align: Align) {
    if (align === "right") return AlignmentType.RIGHT;
    if (align === "center") return AlignmentType.CENTER;
    return AlignmentType.LEFT;
  }

  private tcNoB(
    text: string,
    widthPct: number,
    align: Align,
    fontSize: number,
    bold = false,
    bgColor?: string,
  ) {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      margins: { top: 30, bottom: 30, left: 60, right: 60 },
      ...(bgColor
        ? { shading: { type: ShadingType.SOLID, color: bgColor } }
        : {}),
      children: [
        new Paragraph({
          alignment: this.alignmentOf(align),
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text,
              bold,
              size: fontSize,
              font: "Times New Roman",
              color: text.startsWith("✓") ? CHECK_GREEN : undefined,
            }),
          ],
        }),
      ],
    });
  }

  private gridBorders(): ITableBordersOptions {
    return {
      top: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
      left: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
      right: { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER },
      // [AUDIT] docx-ийн түлхүүр нь insideHorizontal/insideVertical — өмнө нь
      // insideH/insideV гэж бичээд `as any`-гаар нуусан тул дотоод шугам гардаггүй байв.
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 2,
        color: TABLE_BORDER,
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 2,
        color: TABLE_BORDER,
      },
    };
  }

  /**
   * Ерөнхий хүснэгт — мөр 15-аас давбал фонт багасгана (уян хатан, §Plan
   * C3: "бүгдийг жагсаах, фонт/мөр багасгах"). `totalsRow` өгвөл сүүлд бас
   * тод "Нийт" мөр нэмнэ (эх загвартай адил).
   */
  private dataTable(
    headers: string[],
    colWidths: number[],
    aligns: Align[],
    dataRows: string[][],
    totalsRow?: string[],
    fontSize = 18,
    containerWidthDxa: number = CONTENT_WIDTH_DXA,
    zebra = false,
  ) {
    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(
        (lbl, i) =>
          new TableCell({
            width: { size: colWidths[i], type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: TABLE_HEADER_BG },
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: lbl,
                    bold: true,
                    size: fontSize,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
      ),
    });
    const rows =
      dataRows.length > 0
        ? dataRows.map(
            (row, ri) =>
              new TableRow({
                children: row.map((cell, ci) =>
                  this.tcNoB(
                    cell,
                    colWidths[ci],
                    aligns[ci] ?? "left",
                    fontSize,
                    false,
                    zebra && ri % 2 === 1 ? ZEBRA_BG : undefined,
                  ),
                ),
              }),
          )
        : [
            new TableRow({
              children: colWidths.map((w) =>
                this.tcNoB(" ", w, "center", fontSize),
              ),
            }),
          ];
    const totalRows = totalsRow
      ? [
          new TableRow({
            children: totalsRow.map((cell, ci) =>
              this.tcNoB(
                cell,
                colWidths[ci],
                aligns[ci] ?? "left",
                fontSize,
                true,
              ),
            ),
          }),
        ]
      : [];
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: colWidths.map((p) =>
        Math.round((p / 100) * containerWidthDxa),
      ),
      borders: this.gridBorders(),
      rows: [headerRow, ...rows, ...totalRows],
    });
  }
}
