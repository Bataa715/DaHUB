// ============================================================
//  _WordPreview.tsx
//  Энэ файл нь "Word Preview" буюу баруун талд харагдах
//  цаасан хуудасны урьдчилан харах (preview) компонент юм.
//
//  ЮУ ХААНА БАЙГААГ ТОЙМЛОБОЛ:
//  ┌─────────────────────────────────────────────────────┐
//  │  1-р хуудас  →  SECTION_DEFS дотрох бүх хэсгийн    │
//  │                 KPI хүснэгт + тайлбар текст         │
//  │  2-р хуудас  →  negtgelKpi нэгтгэлийн хүснэгт      │
//  └─────────────────────────────────────────────────────┘
//
//  ӨНГӨ СОЛИХ ЗААВАР (бүх хэсгийн өнгийг хаанаас солих):
//  ──────────────────────────────────────────────────────
//  ХҮСНЭГТИЙН HEADER ӨНГ (оранж шугам):
//    → thKpi дотрох  background: "#f29447"   ← s1, s2 header
//    → s3/s4 header: background: "#f29447"   ← шар-оранж
//    → 2-р хуудас header: background: "#f29447"
//
//  S1 (Дата Бүтээгдэхүүний KPI) МӨРИЙН ӨНГ:
//    → background: "#dde8f5"  ← цэнхэр
//
//  S2 (Харилцагчийн төлөв байдал) МӨРИЙН ӨНГ:
//    → background: "#f5e5d0"  ← цайвар оранж
//
//  S3 (Үйл ажиллагааны KPI) МӨРИЙН ӨНГ:
//    → background: "#d8f0e8"  ← цайвар ногоон
//
//  S4 (Сургалт, хөгжил) МӨРИЙН ӨНГ:
//    → background: "#e8e5f8"  ← цайвар нил ягаан
//
//  2-р хуудас нэгтгэлийн МӨРИЙН ӨНГ:
//    → background: "#fef3c7"  ← цайвар шар
//
//  НИЙТ мөрийн өнгө (бүх хэсэгт):
//    → background: "#fff"  ← цагаан
// ============================================================

import React, { useRef, useState, useEffect } from "react";
import {
  SECTION_DEFS,
  Q_NAMES,
  SectionReport,
  Section14Row,
  DEFAULT_S1_KPI,
  DEFAULT_S2_KPI,
  DEFAULT_S3_KPI,
  DEFAULT_S4_KPI,
  Section42Row,
  Section43Row,
  KpiSubSection,
  emptySection,
  scoreLabel,
  mergeKpi,
} from "./_types";

// ──────────────────────────────────────────────────────────────
//  Props тайлбар:
//    year           → жил (жнэ: 2026)
//    quarter        → улирал (1–4)
//    sections       → s1..s5 секцүүдийн агуулга (page.tsx-с ирнэ)
//    negtgelKpi     → 2-р хуудасны нэгтгэл KPI өгөгдөл
//    onUpdateSection → Preview дотор шууд засварлах үед
//                      state-г page.tsx руу буцааж хадгалах callback
// ──────────────────────────────────────────────────────────────
export function WordPreview({
  year,
  quarter,
  sections,
  negtgelKpi,
  onUpdateSection,
}: {
  year: number;
  quarter: number;
  sections: Record<string, SectionReport>;
  negtgelKpi: KpiSubSection[];
  onUpdateSection?: (id: string, updated: SectionReport) => void;
}) {
  // containerRef → хуудасны хэмжээг хянах div
  const containerRef = useRef<HTMLDivElement>(null);
  // scale → хуудсыг дэлгэцийн өргөнд тохируулан жижигрүүлэх хэмжүүр
  const [scale, setScale] = useState(1);

  // Дэлгэцийн өргөн өөрчлөгдөх бүрт хуудсыг дахин хэмжих
  // 834px = A4 хуудасны пикселийн өргөн
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const s = Math.min(1, el.clientWidth / 834);
      setScale(Math.round(s * 1000) / 1000);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Q_NAMES → ["I-Р", "II-Р", "III-Р", "IV-Р"] гэсэн массив
  // _types.ts дотор тодорхойлогдсон
  const qName = Q_NAMES[(quarter - 1) % 4];

  // ──────────────────────────────────────────────────────────
  //  ДИЗАЙН СТИЛЬ ТОДОРХОЙЛОЛТУУД
  //  Эдгээрийг өөрчлөхөд бүх хуудсанд нөлөөлнө
  // ──────────────────────────────────────────────────────────

  // page → A4 цаасны стиль. padding, width, font өөрчлөхөд
  //        бүх хуудасны layout өөрчлөгдөнө
  const page: React.CSSProperties = {
    background: "#fff",
    width: "210mm", // A4 өргөн
    margin: "0 auto 20px",
    padding: "16mm 18mm 14mm", // дотор зай: дээш, хажуу, доош
    boxSizing: "border-box",
    fontFamily: "'Times New Roman', serif", // фонт өөрчлөх бол энд
    fontSize: "11pt", // үндсэн хэмжээ. энд өөрчлөхөд бүх текст өөрчлөгдөнө
    color: "#000",
    boxShadow: "0 2px 14px rgba(0,0,0,0.25)",
  };

  // bigTitle → хуудасны дээд гарчиг (том үсэг)
  // Жнэ: "ДАТА АНАЛИЗЫН АЛБАНЫ 2026 ОНЫ I-Р УЛИРЛЫН"
  const bigTitle: React.CSSProperties = {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "11pt",
    letterSpacing: "1px",
    marginBottom: "3pt",
  };

  // secH → секцийн гарчиг (1., 2., 3. гэх мэт)
  // Жнэ: "1. ДАТА БҮТЭЭГДЭХҮҮНИЙ ҮЙЛ АЖИЛЛАГАА"
  const secH: React.CSSProperties = {
    fontWeight: "bold",
    fontSize: "11pt",
    marginTop: "16pt",
    marginBottom: "4pt",
    textAlign: "center",
    letterSpacing: "0.5px",
  };

  // secSub → секцийн дэд гарчиг (хаалтан дотор байдаг)
  // Жнэ: "(Харилцагчийн үйлчилгээ...)"
  const secSub: React.CSSProperties = {
    fontWeight: "bold",
    fontSize: "11pt",
    marginBottom: "7pt",
    color: "#000",
    textAlign: "center",
  };

  // thKpi → KPI хүснэгтийн HEADER нүдний стиль
  // ⚠️  background: "#f29447"  ← s1, s2 header-ийн оранж өнгө
  //    Энийг өөрчлөхөд s1 болон s2 хүснэгтийн header өнгө өөрчлөгдөнө
  //    s3, s4 header нь доор тус тусдаа { ...thKpi, background: "#f29447" }
  //    гэж override хийгддэг тул тэдгээрт нөлөөлөхгүй
  const thKpi: React.CSSProperties = {
    border: "0.5px solid #000",
    padding: "4px 6px",
    fontWeight: "bold",
    background: "#f29447", // ← S1, S2 HEADER ОРАНЖ ӨНГ — энд солих
    fontSize: "10pt", // ← хүснэгтийн header 10pt
    color: "#000",
    textAlign: "center",
  };

  // tdKpi → KPI хүснэгтийн МЭДЭЭЛЛИЙН нүдний үндсэн стиль
  // ex параметрээр нэмэлт стилийг давхарлана (spread)
  // Жнэ: tdKpi({ background: "#dde8f5" }) → цэнхэр фон нэмсэн нүд
  const tdKpi = (ex?: React.CSSProperties): React.CSSProperties => ({
    border: "0.5px solid #000",
    padding: "3px 5px",
    fontSize: "10pt", // ← хүснэгт дотор 10pt
    verticalAlign: "middle",
    color: "#000",
    ...ex,
  });

  // labelSt → тайлбар текстийн дэд гарчгийн стиль
  // Жнэ: "Тайлбар:", "Амжилт, давуу тал:" гэх мэт
  const labelSt: React.CSSProperties = {
    fontWeight: "bold",
    fontSize: "11pt",
    color: "#000",
    marginBottom: "2pt",
    marginTop: "7pt",
  };

  // bodyTxt → тайлбар текстийн биеийн стиль
  const bodyTxt: React.CSSProperties = {
    fontSize: "11pt",
    lineHeight: "1.7",
    textAlign: "justify",
    color: "#000",
    whiteSpace: "pre-wrap",
  };

  return (
    // Гадна wrapper → саарал дэвсгэр
    <div
      ref={containerRef}
      style={{ background: "#d8d8d8", minHeight: "100%", overflow: "hidden" }}
    >
      {/* zoom → хуудсыг дэлгэцэд багтай болгох scale */}
      <div
        style={{
          zoom: scale,
          padding: "20px",
          width: "fit-content",
          minWidth: "100%",
        }}
      >
        {/* ══════════════════════════════════════════════════
            1-Р ХУУДАС
            Бүх секцүүдийн (s1–s5) KPI хүснэгт болон
            тайлбар текст энд харагдана
        ══════════════════════════════════════════════════ */}
        <div style={page}>
          {/* 1-р хуудасны дээд гарчиг — жил, улирал автоматаар орно */}
          <div style={bigTitle}>
            ДАТА АНАЛИЗЫН АЛБАНЫ {year} ОНЫ {qName} УЛИРЛЫН
          </div>
          <div style={{ ...bigTitle, marginBottom: "12pt" }}>
            БҮХ-НЫ ТАЙЛАН, ҮНЭЛГЭЭ
          </div>

          {/* Огноо — автоматаар өнөөдрийн огноо авна */}
          <div
            style={{ fontSize: "11pt", color: "#000", marginBottom: "11pt" }}
          >
            {new Date().getFullYear()} оны {new Date().getMonth() + 1} сарын{" "}
            {new Date().getDate()}-ны өдөр
          </div>

          {/* ── SECTION_DEFS дахь бүх секцийг тоолон гаргах ──
              SECTION_DEFS нь _types.ts дотор тодорхойлогдсон,
              s1, s2, s3, s4, s5 гэх мэт id-тай объектуудын массив.
              Тус бүрийн def.id-аар sections[def.id] утгыг авна.            */}
          {SECTION_DEFS.map((def) => {
            // Тухайн секцийн мэдэгдэл — байхгүй бол хоосон emptySection()
            const sec = sections[def.id] ?? emptySection();

            // hasContent → KPI хүснэгтгүй секцүүдэд текст байгаа эсэхийг шалгана
            const hasContent =
              sec.content.trim() ||
              sec.achievements.trim() ||
              sec.issues.trim() ||
              sec.score.trim();

            // ── KPI өгөгдлийг тодорхойлох ──
            // kpiData    → s1 секцийн хүснэгтийн өгөгдөл (цэнхэр өнгө)
            // s2kpiData  → s2 секцийн хүснэгтийн өгөгдөл (оранж өнгө)
            // s3kpiData  → s3 секцийн хүснэгтийн өгөгдөл (ногоон өнгө)
            // s4kpiData  → s4 секцийн хүснэгтийн өгөгдөл (нил ягаан өнгө)
            // Хэрэв хэрэглэгч өгөгдөл оруулаагүй бол DEFAULT_Sx_KPI ашиглана

            const kpiData =
              def.id === "s1" ? mergeKpi(sec.kpiTable, DEFAULT_S1_KPI) : null;

            const s2kpiData =
              def.id === "s2" ? mergeKpi(sec.s2kpiTable, DEFAULT_S2_KPI) : null;

            const s3kpiData =
              def.id === "s3" ? mergeKpi(sec.s3kpiTable, DEFAULT_S3_KPI) : null;

            const s4kpiData =
              def.id === "s4" ? mergeKpi(sec.s4kpiTable, DEFAULT_S4_KPI) : null;

            return (
              <div key={def.id} style={{ marginBottom: "8pt" }}>
                {/* Секцийн дугаар + гарчиг */}
                <div style={secH}>
                  {def.num}. {def.heading}
                </div>

                {/* Дэд гарчиг (зарим секцэнд байдаг, зарим нь байхгүй) */}
                {"subtitle" in def &&
                  (def as { subtitle?: string }).subtitle && (
                    <div style={secSub}>
                      ({(def as { subtitle?: string }).subtitle})
                    </div>
                  )}

                {/* ════════════════════════════════════════════════
                    S1 KPI ХҮСНЭГТ
                    Секц: "Дата Бүтээгдэхүүний Үйл Ажиллагаа"
                    Мөрийн ӨНГ: #dde8f5 (цайвар цэнхэр)
                    ⚠️  Энд background: "#dde8f5" гэж тааралдах бүрт
                        тэрхүү нүдний өнгийг солино
                    Header өнгө: thKpi дотрох "#f29447" (дээрх тодорхойлолт)
                ════════════════════════════════════════════════ */}
                {kpiData ? (
                  <div>
                    {kpiData.map((sub) => {
                      // ── Section 1.4: Дата бүтээгдэхүүний тусгай хүснэгт ──
                      // Энэ төрлийн мөр нь "шинээр нэвтрүүлсэн" болон
                      // "ашигласан" гэсэн 2 бүлэгтэй тусгай хүснэгт
                      if (sub.type === "section14table") {
                        const all14 = sub.section14Rows ?? [];
                        const newRows = all14.filter((r) => r.group === "new");
                        const usedRows = all14.filter(
                          (r) => r.group === "used",
                        );
                        const newTotal = newRows.reduce(
                          (s, r) => s + (parseFloat(r.savedDays) || 0),
                          0,
                        );
                        const usedTotal = usedRows.reduce(
                          (s, r) => s + (parseFloat(r.savedDays) || 0),
                          0,
                        );

                        // grpHd → бүлгийн гарчгийн нүдний стиль (өнгөгүй)
                        const grpHd: React.CSSProperties = {
                          ...tdKpi({
                            fontWeight: "bold",
                            textAlign: "center",
                            background: "#fff",
                            fontSize: "10pt",
                          }),
                        };

                        // totRw → НИЙТ мөрийн нүдний стиль (өнгөгүй)
                        const totRw: React.CSSProperties = {
                          ...tdKpi({
                            fontWeight: "bold",
                            textAlign: "center",
                            background: "#fff",
                          }),
                        };

                        // Бүлгийн мөрүүдийг рендэрлэх дотоод функц
                        const renderGroup14 = (
                          rows: Section14Row[],
                          label: string,
                          total: number,
                        ) => (
                          <>
                            <tr>
                              <td colSpan={4} style={grpHd}>
                                {label}
                              </td>
                            </tr>
                            {rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={4}
                                  style={tdKpi({
                                    color: "#bbb",
                                    fontStyle: "italic",
                                    textAlign: "center",
                                  })}
                                >
                                  — Мэдээлэл байхгүй —
                                </td>
                              </tr>
                            ) : (
                              rows.map((row, ri) => (
                                <tr key={ri}>
                                  <td
                                    style={tdKpi({
                                      textAlign: "center",
                                      width: "5%",
                                    })}
                                  >
                                    {ri + 1}
                                  </td>
                                  <td style={tdKpi({ width: "55%" })}>
                                    {row.title}
                                  </td>
                                  <td style={tdKpi({ width: "25%" })}>
                                    {row.productType}
                                  </td>
                                  {/* Хэмнэсэн өдөр — гараас оруулна (contentEditable) */}
                                  <td
                                    contentEditable
                                    suppressContentEditableWarning
                                    style={tdKpi({
                                      textAlign: "center",
                                      width: "15%",
                                      fontWeight: "bold",
                                      color: "#000",
                                      outline: "none",
                                      cursor: "text",
                                    })}
                                    onBlur={(e) => {
                                      if (!onUpdateSection) return;
                                      const newVal =
                                        e.currentTarget.innerText.trim();
                                      const origIndex = all14.findIndex(
                                        (r) => r === row,
                                      );
                                      if (origIndex < 0) return;
                                      onUpdateSection(def.id, {
                                        ...sec,
                                        kpiTable: (sec.kpiTable &&
                                        sec.kpiTable.length
                                          ? sec.kpiTable
                                          : DEFAULT_S1_KPI
                                        ).map((s) =>
                                          s.id === sub.id
                                            ? {
                                                ...s,
                                                section14Rows: all14.map(
                                                  (r, idx) =>
                                                    idx === origIndex
                                                      ? {
                                                          ...r,
                                                          savedDays: newVal,
                                                        }
                                                      : r,
                                                ),
                                              }
                                            : s,
                                        ),
                                      });
                                    }}
                                  >
                                    {row.savedDays || ""}
                                  </td>
                                </tr>
                              ))
                            )}
                            {/* Бүлгийн нийт мөр */}
                            <tr>
                              <td colSpan={3} style={totRw}>
                                НИЙТ
                              </td>
                              <td style={totRw}>{total > 0 ? total : "–"}</td>
                            </tr>
                          </>
                        );

                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000", // ← дэд гарчгийн өнгө
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {sub.section14Text && (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  lineHeight: "1.7",
                                  whiteSpace: "pre-wrap",
                                  marginBottom: "8pt",
                                  color: "#000",
                                }}
                              >
                                {sub.section14Text}
                              </div>
                            )}
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                marginBottom: "4pt",
                                fontSize: "11pt",
                              }}
                            >
                              <thead>
                                <tr>
                                  {/* section14table header — өнгөгүй цагаан */}
                                  <th style={{ ...thKpi, background: "#fff" }}>
                                    №
                                  </th>
                                  <th style={{ ...thKpi, background: "#fff" }}>
                                    Дата бүтээгдэхүүн
                                  </th>
                                  <th style={{ ...thKpi, background: "#fff" }}>
                                    Бүтээгдэхүүн төрөл
                                  </th>
                                  <th style={{ ...thKpi, background: "#fff" }}>
                                    Хэмнэсэн хүн/өдөр
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {renderGroup14(
                                  newRows,
                                  "Тайлант хугацаанд шинээр нэвтрүүлсэн дата бүтээгдэхүүн",
                                  newTotal,
                                )}
                                {renderGroup14(
                                  usedRows,
                                  "Тайлант хугацаанд аудитын үйл ажиллагаанд ашигласан дата бүтээгдэхүүн",
                                  usedTotal,
                                )}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // ── Section 1.2: Ажлын жагсаалтын хүснэгт ──
                      // Гүйцэтгэл, хугацаа, ажилтантай хүснэгт
                      if (sub.type === "section2table") {
                        const s2Rows = sub.section2Rows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {s2Rows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Ажил байхгүй —
                              </div>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  marginBottom: "4pt",
                                  fontSize: "11pt",
                                }}
                              >
                                <thead>
                                  <tr>
                                    {/* section2table header — өнгөгүй цагаан */}
                                    <th
                                      style={{ ...thKpi, background: "#fff" }}
                                    >
                                      №
                                    </th>
                                    <th
                                      style={{ ...thKpi, background: "#fff" }}
                                    >
                                      Төлөвлөгөөт ажил (Дууссан ажлууд)
                                    </th>
                                    <th
                                      style={{ ...thKpi, background: "#fff" }}
                                    >
                                      Ажлын гүйцэтгэл
                                    </th>
                                    <th
                                      style={{ ...thKpi, background: "#fff" }}
                                    >
                                      Хийгдсэн хугацаа
                                    </th>
                                    <th
                                      style={{ ...thKpi, background: "#fff" }}
                                    >
                                      Гүйцэтгэл /товч/
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s2Rows.map((row, ri) => (
                                    <tr key={ri}>
                                      <td
                                        style={tdKpi({
                                          textAlign: "center",
                                          width: "5%",
                                        })}
                                      >
                                        {ri + 1}
                                      </td>
                                      <td style={tdKpi({ width: "20%" })}>
                                        {row.title}
                                      </td>
                                      {/* Гүйцэтгэл % → утга байвал цэнхэр, байхгүй бол саарал */}
                                      <td
                                        style={tdKpi({
                                          textAlign: "center",
                                          fontWeight: "bold",
                                          color: row.result
                                            ? "#030407"
                                            : "#bbb",
                                          width: "10%",
                                        })}
                                      >
                                        {row.result ? `${row.result}%` : ""}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "13%",
                                          whiteSpace: "nowrap",
                                          textAlign: "center",
                                        })}
                                      >
                                        {(() => {
                                          const parts = (
                                            row.period ?? ""
                                          ).split(/\s*–\s*/);
                                          if (parts.length === 2)
                                            return (
                                              <>
                                                {parts[0]}–<br />
                                                {parts[1]}
                                              </>
                                            );
                                          return <>{row.period}</>;
                                        })()}
                                      </td>
                                      <td style={tdKpi({ width: "25%" })}>
                                        {row.completion}
                                      </td>
                                    </tr>
                                  ))}
                                  {(() => {
                                    const nums = s2Rows
                                      .map((r) => parseFloat(r.result))
                                      .filter((n) => !isNaN(n));
                                    const avg =
                                      nums.length > 0
                                        ? nums.reduce((a, b) => a + b, 0) /
                                          nums.length
                                        : null;
                                    return (
                                      <tr>
                                        <td style={tdKpi({ width: "5%" })}></td>
                                        <td
                                          style={tdKpi({
                                            width: "20%",
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          Дундаж
                                        </td>
                                        <td
                                          style={tdKpi({
                                            width: "10%",
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          {avg !== null
                                            ? `${avg.toFixed(1)}%`
                                            : "–"}
                                        </td>
                                        <td
                                          style={tdKpi({ width: "13%" })}
                                        ></td>
                                        <td
                                          style={tdKpi({ width: "25%" })}
                                        ></td>
                                      </tr>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            )}
                            {s2Rows
                              .flatMap((r) => r.images ?? [])
                              .map((img) => (
                                <div
                                  key={img.id}
                                  style={{
                                    textAlign: "center",
                                    margin: "6pt 0",
                                  }}
                                >
                                  <img
                                    src={img.dataUrl}
                                    alt=""
                                    style={{
                                      width: `${img.width ?? 80}%`,
                                      height:
                                        img.height && img.height > 0
                                          ? `${img.height}px`
                                          : "auto",
                                      maxWidth: "100%",
                                      display: "inline-block",
                                    }}
                                  />
                                </div>
                              ))}
                          </div>
                        );
                      }

                      // ── Dashboard хэсэг (зураг + тайлбартай) ──
                      if (sub.type === "dashboard") {
                        const dashRows = sub.dashboardRows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {dashRows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Ажил байхгүй —
                              </div>
                            ) : (
                              dashRows.map((row, ri) => (
                                <div key={ri} style={{ marginBottom: "8pt" }}>
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "11pt",
                                      marginBottom: "2pt",
                                    }}
                                  >
                                    {ri + 1}. {row.title}
                                  </div>
                                  {row.description && (
                                    <div
                                      style={{
                                        fontSize: "11pt",
                                        lineHeight: "1.7",
                                        whiteSpace: "pre-wrap",
                                        paddingLeft: "12pt",
                                        color: "#000",
                                      }}
                                    >
                                      {row.description}
                                    </div>
                                  )}
                                  {/* Upload хийсэн зургуудыг харуулах */}
                                  {(row.images ?? []).map((img) => (
                                    <div
                                      key={img.id}
                                      style={{
                                        textAlign: "center",
                                        margin: "6pt 0",
                                      }}
                                    >
                                      <img
                                        src={img.dataUrl}
                                        alt=""
                                        style={{
                                          width: `${img.width}%`,
                                          height:
                                            img.height && img.height > 0
                                              ? `${img.height}px`
                                              : "auto",
                                          maxWidth: "100%",
                                          display: "inline-block",
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ))
                            )}
                          </div>
                        );
                      }

                      // ── S1 KPI ХҮСНЭГТ (ердийн KPI мөрүүд) ──
                      // 5 багана: [Бүлэг] | [Үзүүлэлт] | [Хувь] | [Үнэлгээ] | [Тайлбар]
                      // Мөрийн өнгө: #dde8f5 (цайвар цэнхэр)
                      // ⚠️  Өнгийг өөрчлөхөд: background: "#dde8f5" → шинэ өнгө
                      const totalW = sub.rows.reduce(
                        (s, r) => s + (Number(r.weight) || 0),
                        0,
                      );
                      return (
                        <table
                          key={sub.id}
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            marginBottom: "8pt",
                          }}
                        >
                          <thead>
                            <tr>
                              {/* Header: thKpi → "#f29447" оранж (дээр тодорхойлсон) */}
                              <th style={thKpi}></th>
                              <th style={thKpi}>ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
                              <th style={thKpi}>ХУВЬ</th>
                              <th style={thKpi}>ҮНЭЛГЭЭ</th>
                              <th style={thKpi}>ҮНЭЛСЭН ТАЙЛБАР</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.rows.map((row, ri) => (
                              <tr key={ri}>
                                {/* Бүлгийн нэр → зөвхөн эхний мөрт, rowSpan-аар бүлэг мөрүүдийг нэгтгэнэ */}
                                {ri === 0 && (
                                  <td
                                    style={tdKpi({
                                      fontWeight: "bold",
                                      textAlign: "center",
                                      background: "#dde8f5", // ← S1 бүлгийн нүдний цэнхэр өнгө
                                      width: "14%",
                                    })}
                                    rowSpan={sub.rows.length}
                                  >
                                    {sub.groupLabel}
                                  </td>
                                )}

                                {/* Түлхүүр үзүүлэлт нүд — contentEditable тул preview дотор шууд засварлах боломжтой
                                    onBlur: засвар хийгдэхэд page.tsx руу state буцаана (kpiTable дотор хадгалагдана) */}
                                <td
                                  contentEditable
                                  suppressContentEditableWarning
                                  style={tdKpi({
                                    width: "40%",
                                    background: "#dde8f5", // ← S1 үзүүлэлтийн нүдний цэнхэр өнгө
                                    outline: "none",
                                    cursor: "text",
                                  })}
                                  onBlur={(e) => {
                                    if (!onUpdateSection) return;
                                    const newVal =
                                      e.currentTarget.innerText.trim();
                                    const base = mergeKpi(
                                      sec.kpiTable,
                                      DEFAULT_S1_KPI,
                                    );
                                    // kpiTable → s1-ийн state-д хадгалагдана
                                    onUpdateSection(def.id, {
                                      ...sec,
                                      kpiTable: base.map((s) =>
                                        s.id === sub.id
                                          ? {
                                              ...s,
                                              rows: s.rows.map((r, rj) =>
                                                rj === ri
                                                  ? { ...r, indicator: newVal }
                                                  : r,
                                              ),
                                            }
                                          : s,
                                      ),
                                    });
                                  }}
                                >
                                  {row.indicator}
                                </td>

                                {/* Хувь (жин) нүд */}
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "8%",
                                    background: "#dde8f5", // ← S1 хувийн нүдний цэнхэр өнгө
                                  })}
                                >
                                  {row.weight}
                                </td>

                                {/* Үнэлгээ нүд — утга байвал цэнхэр тоо, байхгүй бол саарал */}
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "10%",
                                    fontWeight: "bold",
                                    background: "#dde8f5", // ← S1 үнэлгээний нүдний цэнхэр өнгө
                                    color: row.score ? "#374151" : "#bbb",
                                  })}
                                >
                                  {row.score || ""}
                                </td>

                                {/* Үнэлсэн тайлбар нүд */}
                                <td
                                  style={tdKpi({
                                    width: "28%",
                                    color: "#000",
                                    background: "#dde8f5", // ← S1 тайлбарын нүдний цэнхэр өнгө
                                  })}
                                >
                                  {row.evaluatedBy}
                                </td>
                              </tr>
                            ))}

                            {/* Нийт мөр — бүлгийн хувийг нийлүүлэн харуулна
                                ⚠️  Өнгө: background "#fff" (цагаан) — хар текст, ердийн жин
                                colSpan=2 → 1-р, 2-р баганыг нэгтгэж "Нийт" гарчиг */}
                            <tr style={{ background: "#fff" }}>
                              <td
                                colSpan={2}
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                Нийт
                              </td>
                              <td
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                {totalW}
                              </td>
                              <td style={tdKpi()}></td>
                              <td style={tdKpi()}></td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })}
                  </div>
                ) : null}

                {/* ════════════════════════════════════════════════
                    S2 KPI ХҮСНЭГТ
                    Секц: "Харилцагчийн төлөв байдал"
                    Мөрийн ӨНГ: #f5e5d0 (цайвар оранж)
                    ⚠️  Бүх нүдэнд background: "#f5e5d0" байгааг
                        өөрчлөхөд s2 секцийн мөрийн өнгө өөрчлөгдөнө
                    evaluatedBy нүд: fontWeight: "bold" (bold тайлбар)
                    Header: thKpi → "#f29447" оранж (s1-тэй адил)
                ════════════════════════════════════════════════ */}
                {s2kpiData ? (
                  <div style={{ paddingLeft: "6pt" }}>
                    {s2kpiData.map((sub) => {
                      // ── 2.2 Дэлгэрэнгүй тайлбар (richtextlist) ──
                      if (sub.type === "richtextlist") {
                        const items = sub.richTextRows ?? [];
                        return (
                          <div key={sub.id} style={{ marginBottom: "8pt" }}>
                            {items.map((item, ii) => (
                              <div
                                key={item.id}
                                style={{ marginBottom: "8pt" }}
                              >
                                <div
                                  style={{
                                    fontWeight: "bold",
                                    fontSize: "11pt",
                                    marginBottom: "3pt",
                                    color: "#000",
                                  }}
                                >
                                  {ii + 1}. {item.title}
                                </div>
                                {(() => {
                                  // unified contents (new) or fall back to bullets+images
                                  const contents =
                                    item.contents && item.contents.length > 0
                                      ? item.contents
                                      : ([
                                          ...item.bullets.map((b, i) => ({
                                            id: `b${i}`,
                                            type: "bullet" as const,
                                            text: b,
                                          })),
                                          ...(item.images ?? []).map((img) => ({
                                            id: img.id,
                                            type: "image" as const,
                                            dataUrl: img.dataUrl,
                                            width: img.width,
                                            height: img.height,
                                          })),
                                        ] as import("./_types").RichTextContent[]);
                                  const bulletGroup: import("./_types").RichTextContent[] =
                                    [];
                                  const rendered: React.ReactNode[] = [];
                                  const flushBullets = () => {
                                    if (bulletGroup.length === 0) return;
                                    rendered.push(
                                      <ul
                                        key={`ul_${rendered.length}`}
                                        style={{
                                          margin: "0 0 4pt 20pt",
                                          padding: 0,
                                          listStyleType: "disc",
                                        }}
                                      >
                                        {bulletGroup.map((c) => (
                                          <li
                                            key={c.id}
                                            style={{
                                              fontSize: "11pt",
                                              color: "#000",
                                              lineHeight: "1.7",
                                            }}
                                          >
                                            {c.text}
                                          </li>
                                        ))}
                                      </ul>,
                                    );
                                    bulletGroup.length = 0;
                                  };
                                  contents.forEach((c) => {
                                    if (c.type === "bullet") {
                                      bulletGroup.push(c);
                                    } else {
                                      flushBullets();
                                      rendered.push(
                                        <div
                                          key={c.id}
                                          style={{
                                            textAlign: "center",
                                            margin: "6pt 0",
                                          }}
                                        >
                                          <img
                                            src={c.dataUrl}
                                            alt=""
                                            style={{
                                              width: `${c.width ?? 80}%`,
                                              height:
                                                c.height && c.height > 0
                                                  ? `${c.height}px`
                                                  : "auto",
                                              maxWidth: "100%",
                                              display: "inline-block",
                                            }}
                                          />
                                        </div>,
                                      );
                                    }
                                  });
                                  flushBullets();
                                  return rendered;
                                })()}
                              </div>
                            ))}
                          </div>
                        );
                      }

                      // ── 2.3 Өгөгдөл боловсруулалтын хүснэгт ──
                      if (sub.type === "section23table") {
                        const s23Rows = sub.section23Rows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {s23Rows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Ажил байхгүй —
                              </div>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  marginBottom: "4pt",
                                  fontSize: "10pt",
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "5%",
                                      }}
                                    >
                                      №
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "30%",
                                      }}
                                    >
                                      Өгөгдөл боловсруулалт
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "40%",
                                      }}
                                    >
                                      Өгөгдөл боловсруулалтийн ажлийн ач
                                      холбогдол хэрэглээ
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "25%",
                                      }}
                                    >
                                      Хэрэглэгч нэгжийн өгсөн үнэлгээ
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s23Rows.map((row, ri) => (
                                    <tr key={ri}>
                                      <td
                                        style={tdKpi({
                                          textAlign: "center",
                                          width: "5%",
                                        })}
                                      >
                                        {ri + 1}
                                      </td>
                                      <td style={tdKpi({ width: "30%" })}>
                                        {row.title}
                                      </td>
                                      <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={tdKpi({
                                          width: "40%",
                                          outline: "none",
                                          cursor: "text",
                                        })}
                                        onBlur={(e) => {
                                          if (!onUpdateSection) return;
                                          const newVal =
                                            e.currentTarget.innerText.trim();
                                          const base = mergeKpi(
                                            sec.s2kpiTable,
                                            DEFAULT_S2_KPI,
                                          );
                                          onUpdateSection(def.id, {
                                            ...sec,
                                            s2kpiTable: base.map((s) =>
                                              s.id === sub.id
                                                ? {
                                                    ...s,
                                                    section23Rows: (
                                                      s.section23Rows ?? []
                                                    ).map((r, rj) =>
                                                      rj === ri
                                                        ? {
                                                            ...r,
                                                            usage: newVal,
                                                          }
                                                        : r,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          });
                                        }}
                                      >
                                        {row.usage}
                                      </td>
                                      <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={tdKpi({
                                          width: "25%",
                                          outline: "none",
                                          cursor: "text",
                                          textAlign: "center",
                                        })}
                                        onBlur={(e) => {
                                          if (!onUpdateSection) return;
                                          const newVal =
                                            e.currentTarget.innerText.trim();
                                          const base = mergeKpi(
                                            sec.s2kpiTable,
                                            DEFAULT_S2_KPI,
                                          );
                                          onUpdateSection(def.id, {
                                            ...sec,
                                            s2kpiTable: base.map((s) =>
                                              s.id === sub.id
                                                ? {
                                                    ...s,
                                                    section23Rows: (
                                                      s.section23Rows ?? []
                                                    ).map((r, rj) =>
                                                      rj === ri
                                                        ? {
                                                            ...r,
                                                            clientScore: newVal,
                                                          }
                                                        : r,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          });
                                        }}
                                      >
                                        {row.clientScore}
                                      </td>
                                    </tr>
                                  ))}
                                  {(() => {
                                    const nums = s23Rows
                                      .map((r) => parseFloat(r.clientScore))
                                      .filter((n) => !isNaN(n));
                                    const avg =
                                      nums.length > 0
                                        ? nums.reduce((a, b) => a + b, 0) /
                                          nums.length
                                        : null;
                                    return (
                                      <tr>
                                        <td
                                          colSpan={3}
                                          style={tdKpi({
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          Дундаж
                                        </td>
                                        <td
                                          style={tdKpi({
                                            width: "25%",
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          {avg !== null ? avg.toFixed(1) : "–"}
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      }

                      // ── 2.4 Dashboard хүснэгт ──
                      if (sub.type === "section24table") {
                        const s24Rows = sub.section24Rows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {s24Rows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Ажил байхгүй —
                              </div>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  marginBottom: "4pt",
                                  fontSize: "10pt",
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "5%",
                                      }}
                                    >
                                      №
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "30%",
                                      }}
                                    >
                                      Төлөвлөгөөт ажил
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "10%",
                                      }}
                                    >
                                      Ажлын гүйцэтгэл
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "18%",
                                      }}
                                    >
                                      Хийгдсэн хугацаа
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "37%",
                                      }}
                                    >
                                      Гүйцэтгэл /товч/
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s24Rows.map((row, ri) => (
                                    <tr key={ri}>
                                      <td
                                        style={tdKpi({
                                          textAlign: "center",
                                          width: "5%",
                                        })}
                                      >
                                        {ri + 1}
                                      </td>
                                      <td style={tdKpi({ width: "30%" })}>
                                        {row.title}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          textAlign: "center",
                                          fontWeight: "bold",
                                          color: "#000",
                                          width: "10%",
                                        })}
                                      >
                                        {row.result ? `${row.result}%` : ""}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "18%",
                                          whiteSpace: "nowrap",
                                          textAlign: "center",
                                        })}
                                      >
                                        {(() => {
                                          const parts = (
                                            row.period ?? ""
                                          ).split(/\s*–\s*/);
                                          if (parts.length === 2)
                                            return (
                                              <>
                                                {parts[0]}–<br />
                                                {parts[1]}
                                              </>
                                            );
                                          return <>{row.period}</>;
                                        })()}
                                      </td>
                                      <td style={tdKpi({ width: "37%" })}>
                                        {row.completion}
                                      </td>
                                    </tr>
                                  ))}
                                  {(() => {
                                    const nums = s24Rows
                                      .map((r) => parseFloat(r.result))
                                      .filter((n) => !isNaN(n));
                                    const avg =
                                      nums.length > 0
                                        ? nums.reduce((a, b) => a + b, 0) /
                                          nums.length
                                        : null;
                                    return (
                                      <tr>
                                        <td style={tdKpi({ width: "5%" })}></td>
                                        <td
                                          style={tdKpi({
                                            width: "30%",
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          Дундаж
                                        </td>
                                        <td
                                          style={tdKpi({
                                            width: "10%",
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          {avg !== null
                                            ? `${avg.toFixed(1)}%`
                                            : "–"}
                                        </td>
                                        <td
                                          style={tdKpi({ width: "18%" })}
                                        ></td>
                                        <td
                                          style={tdKpi({ width: "37%" })}
                                        ></td>
                                      </tr>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            )}
                            {s24Rows
                              .flatMap((r) => r.images ?? [])
                              .map((img) => (
                                <div
                                  key={img.id}
                                  style={{
                                    textAlign: "center",
                                    margin: "6pt 0",
                                  }}
                                >
                                  <img
                                    src={img.dataUrl}
                                    alt=""
                                    style={{
                                      width: `${img.width ?? 80}%`,
                                      height:
                                        img.height && img.height > 0
                                          ? `${img.height}px`
                                          : "auto",
                                      maxWidth: "100%",
                                      display: "inline-block",
                                    }}
                                  />
                                </div>
                              ))}
                          </div>
                        );
                      }

                      const totalW = sub.rows.reduce(
                        (s, r) => s + (Number(r.weight) || 0),
                        0,
                      );
                      return (
                        <table
                          key={sub.id}
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            marginBottom: "8pt",
                          }}
                        >
                          <thead>
                            <tr>
                              {/* Header: thKpi → "#f29447" оранж — s1-тэй адилхан */}
                              <th style={thKpi}></th>
                              <th style={thKpi}>ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
                              <th style={thKpi}>ХУВЬ</th>
                              <th style={thKpi}>ҮНЭЛГЭЭ</th>
                              <th style={thKpi}>ҮНЭЛСЭН ТАЙЛБАР</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.rows.map((row, ri) => (
                              <tr key={ri}>
                                {/* Бүлгийн нүд — rowSpan-аар дарааллах мөрүүдийг нэгтгэнэ */}
                                {ri === 0 && (
                                  <td
                                    style={tdKpi({
                                      fontWeight: "bold",
                                      textAlign: "center",
                                      background: "#f5e5d0", // ← S2 бүлгийн нүдний ОРАНЖ өнгө
                                      width: "14%",
                                      verticalAlign: "middle",
                                    })}
                                    rowSpan={sub.rows.length}
                                  >
                                    {sub.groupLabel}
                                  </td>
                                )}

                                {/* Түлхүүр үзүүлэлт нүд — contentEditable (шууд засварлах)
                                    onBlur: s2kpiTable state-д хадгалагдана */}
                                <td
                                  contentEditable
                                  suppressContentEditableWarning
                                  style={tdKpi({
                                    width: "40%",
                                    background: "#f5e5d0", // ← S2 үзүүлэлтийн нүдний ОРАНЖ өнгө
                                    outline: "none",
                                    cursor: "text",
                                  })}
                                  onBlur={(e) => {
                                    if (!onUpdateSection) return;
                                    const newVal =
                                      e.currentTarget.innerText.trim();
                                    const base = mergeKpi(
                                      sec.s2kpiTable,
                                      DEFAULT_S2_KPI,
                                    );
                                    // s2kpiTable → s2-ийн state-д хадгалагдана
                                    onUpdateSection(def.id, {
                                      ...sec,
                                      s2kpiTable: base.map((s) =>
                                        s.id === sub.id
                                          ? {
                                              ...s,
                                              rows: s.rows.map((r, rj) =>
                                                rj === ri
                                                  ? { ...r, indicator: newVal }
                                                  : r,
                                              ),
                                            }
                                          : s,
                                      ),
                                    });
                                  }}
                                >
                                  {row.indicator}
                                </td>

                                {/* Хувь нүд */}
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "8%",
                                    background: "#f5e5d0", // ← S2 хувийн нүдний ОРАНЖ өнгө
                                  })}
                                >
                                  {row.weight}
                                </td>

                                {/* Үнэлгээ нүд */}
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "10%",
                                    fontWeight: "bold",
                                    background: "#f5e5d0", // ← S2 үнэлгээний нүдний ОРАНЖ өнгө
                                    color: row.score ? "#374151" : "#bbb",
                                  })}
                                >
                                  {row.score || ""}
                                </td>

                                {/* Үнэлсэн тайлбар нүд
                                    ⚠️  fontWeight: "bold" → S2 дээр тайлбар BOLD байна
                                        S1, S3, S4 дээр энэ байхгүй (ердийн жин)
                                        Bold болгохгүй бол fontWeight: "bold" устгана */}
                                <td
                                  style={tdKpi({
                                    width: "28%",
                                    color: "#000",
                                    fontWeight: "bold", // ← S2-д тайлбар bold
                                    background: "#f5e5d0", // ← S2 тайлбарын нүдний ОРАНЖ өнгө
                                  })}
                                >
                                  {row.evaluatedBy}
                                </td>
                              </tr>
                            ))}

                            {/* Нийт мөр — цагаан фон, хар текст */}
                            <tr style={{ background: "#fff" }}>
                              <td
                                colSpan={2}
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                Нийт
                              </td>
                              <td
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                {totalW}
                              </td>
                              <td style={tdKpi()}></td>
                              <td style={tdKpi()}></td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })}

                    {/* S2 секцийн нэмэлт тайлбар текст (байвал харуулна) */}
                  </div>
                ) : s3kpiData ? (
                  /* ════════════════════════════════════════════════
                      S3 KPI ХҮСНЭГТ
                      Секц: "Үйл ажиллагааны KPI"
                      Мөрийн ӨНГ: #d8f0e8 (цайвар ногоон)
                      Header ӨНГ: #f29447 (шар-оранж)
                      ⚠️  Header өнгийг өөрчлөхөд:
                          { ...thKpi, background: "#f29447" } дахь "#f29447"
                      ⚠️  Мөрийн өнгийг өөрчлөхөд:
                          background: "#d8f0e8" → шинэ өнгө
                  ════════════════════════════════════════════════ */
                  <div style={{ paddingLeft: "6pt" }}>
                    {s3kpiData.map((sub) => {
                      // ── 3.2 Үйл ажиллагааны төлөвлөгөөний гүйцэтгэл (richtextlist) ──
                      if (sub.type === "richtextlist") {
                        const items = sub.richTextRows ?? [];
                        return (
                          <div key={sub.id} style={{ marginBottom: "8pt" }}>
                            {sub.groupLabel && (
                              <div
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "11pt",
                                  marginBottom: "3pt",
                                  color: "#000",
                                }}
                              >
                                {sub.groupLabel}
                              </div>
                            )}
                            {items.map((item, ii) => {
                              const contents =
                                item.contents && item.contents.length > 0
                                  ? item.contents
                                  : ([
                                      ...item.bullets.map((b, i) => ({
                                        id: `b${i}`,
                                        type: "bullet" as const,
                                        text: b,
                                      })),
                                      ...(item.images ?? []).map((img) => ({
                                        id: img.id,
                                        type: "image" as const,
                                        dataUrl: img.dataUrl,
                                        width: img.width,
                                        height: img.height,
                                      })),
                                    ] as import("./_types").RichTextContent[]);
                              const bulletGroup: import("./_types").RichTextContent[] =
                                [];
                              const rendered: React.ReactNode[] = [];
                              const flushBullets = () => {
                                if (bulletGroup.length === 0) return;
                                rendered.push(
                                  <ul
                                    key={`ul_${rendered.length}`}
                                    style={{
                                      margin: "0 0 4pt 20pt",
                                      padding: 0,
                                      listStyleType: "disc",
                                    }}
                                  >
                                    {bulletGroup.map((c) => (
                                      <li
                                        key={c.id}
                                        style={{
                                          fontSize: "11pt",
                                          color: "#000",
                                          lineHeight: "1.7",
                                        }}
                                      >
                                        {c.text}
                                      </li>
                                    ))}
                                  </ul>,
                                );
                                bulletGroup.length = 0;
                              };
                              contents.forEach((c) => {
                                if (c.type === "bullet") {
                                  bulletGroup.push(c);
                                } else {
                                  flushBullets();
                                  rendered.push(
                                    <div
                                      key={c.id}
                                      style={{
                                        textAlign: "center",
                                        margin: "6pt 0",
                                      }}
                                    >
                                      <img
                                        src={c.dataUrl}
                                        alt=""
                                        style={{
                                          width: `${c.width ?? 80}%`,
                                          height:
                                            c.height && c.height > 0
                                              ? `${c.height}px`
                                              : "auto",
                                          maxWidth: "100%",
                                          display: "inline-block",
                                        }}
                                      />
                                    </div>,
                                  );
                                }
                              });
                              flushBullets();
                              return (
                                <div
                                  key={item.id}
                                  style={{ marginBottom: "8pt" }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "11pt",
                                      marginBottom: "3pt",
                                      color: "#000",
                                    }}
                                  >
                                    {ii + 1}. {item.title}
                                  </div>
                                  {rendered}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      // ── 3.3 Өгөгдөл боловсруулалт, автоматжуулалт ──
                      if (sub.type === "section33table") {
                        const s33Rows = sub.section33Rows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {s33Rows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Өгөгдөл байхгүй —
                              </div>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  marginBottom: "4pt",
                                  fontSize: "10pt",
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "5%",
                                      }}
                                    >
                                      №
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "30%",
                                      }}
                                    >
                                      Тогтмол хийгддэг өгөгдөл боловсруулалт
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "40%",
                                      }}
                                    >
                                      Өгөгдөл боловсруулалтийн ажлын ач
                                      холбогдол хэрэглээ
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "25%",
                                      }}
                                    >
                                      Хэрэглэгч нэгжийн өгсөн үнэлгээ
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s33Rows.map((row, ri) => (
                                    <tr key={ri}>
                                      <td
                                        style={tdKpi({
                                          textAlign: "center",
                                          width: "5%",
                                        })}
                                      >
                                        {ri + 1}
                                      </td>
                                      <td style={tdKpi({ width: "30%" })}>
                                        {row.title}
                                      </td>
                                      <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={tdKpi({
                                          width: "40%",
                                          outline: "none",
                                          cursor: "text",
                                        })}
                                        onBlur={(e) => {
                                          if (!onUpdateSection) return;
                                          const newVal =
                                            e.currentTarget.innerText.trim();
                                          const base = mergeKpi(
                                            sec.s3kpiTable,
                                            DEFAULT_S3_KPI,
                                          );
                                          onUpdateSection(def.id, {
                                            ...sec,
                                            s3kpiTable: base.map((s) =>
                                              s.id === sub.id
                                                ? {
                                                    ...s,
                                                    section33Rows: (
                                                      s.section33Rows ?? []
                                                    ).map((r, rj) =>
                                                      rj === ri
                                                        ? {
                                                            ...r,
                                                            usage: newVal,
                                                          }
                                                        : r,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          });
                                        }}
                                      >
                                        {row.usage}
                                      </td>
                                      <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={tdKpi({
                                          width: "25%",
                                          outline: "none",
                                          cursor: "text",
                                          textAlign: "center",
                                        })}
                                        onBlur={(e) => {
                                          if (!onUpdateSection) return;
                                          const newVal =
                                            e.currentTarget.innerText.trim();
                                          const base = mergeKpi(
                                            sec.s3kpiTable,
                                            DEFAULT_S3_KPI,
                                          );
                                          onUpdateSection(def.id, {
                                            ...sec,
                                            s3kpiTable: base.map((s) =>
                                              s.id === sub.id
                                                ? {
                                                    ...s,
                                                    section33Rows: (
                                                      s.section33Rows ?? []
                                                    ).map((r, rj) =>
                                                      rj === ri
                                                        ? {
                                                            ...r,
                                                            clientScore: newVal,
                                                          }
                                                        : r,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          });
                                        }}
                                      >
                                        {row.clientScore}
                                      </td>
                                    </tr>
                                  ))}
                                  {(() => {
                                    const nums = s33Rows
                                      .map((r) => parseFloat(r.clientScore))
                                      .filter((n) => !isNaN(n));
                                    const avg =
                                      nums.length > 0
                                        ? nums.reduce((a, b) => a + b, 0) /
                                          nums.length
                                        : null;
                                    return (
                                      <tr>
                                        <td
                                          colSpan={3}
                                          style={tdKpi({
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          Дундаж
                                        </td>
                                        <td
                                          style={tdKpi({
                                            width: "25%",
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          {avg !== null ? avg.toFixed(1) : "–"}
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      }

                      // ── 3.4 Dashboard-ийн хэвийн ажиллагаа ──
                      if (sub.type === "section34table") {
                        const s34Rows = sub.section34Rows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {s34Rows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Өгөгдөл байхгүй —
                              </div>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  marginBottom: "4pt",
                                  fontSize: "10pt",
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "5%",
                                      }}
                                    >
                                      №
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "30%",
                                      }}
                                    >
                                      Dashboard
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "40%",
                                      }}
                                    >
                                      Dashboard-ийн ач холбогдол хэрэглээ
                                    </th>
                                    <th
                                      style={{
                                        ...thKpi,
                                        background: "#fff",
                                        width: "25%",
                                      }}
                                    >
                                      Хэрэглэгч нэгжийн өгсөн үнэлгээ
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s34Rows.map((row, ri) => (
                                    <tr key={ri}>
                                      <td
                                        style={tdKpi({
                                          textAlign: "center",
                                          width: "5%",
                                        })}
                                      >
                                        {ri + 1}
                                      </td>
                                      <td style={tdKpi({ width: "30%" })}>
                                        {row.title}
                                      </td>
                                      <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={tdKpi({
                                          width: "40%",
                                          outline: "none",
                                          cursor: "text",
                                        })}
                                        onBlur={(e) => {
                                          if (!onUpdateSection) return;
                                          const newVal =
                                            e.currentTarget.innerText.trim();
                                          const base = mergeKpi(
                                            sec.s3kpiTable,
                                            DEFAULT_S3_KPI,
                                          );
                                          onUpdateSection(def.id, {
                                            ...sec,
                                            s3kpiTable: base.map((s) =>
                                              s.id === sub.id
                                                ? {
                                                    ...s,
                                                    section34Rows: (
                                                      s.section34Rows ?? []
                                                    ).map((r, rj) =>
                                                      rj === ri
                                                        ? {
                                                            ...r,
                                                            usage: newVal,
                                                          }
                                                        : r,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          });
                                        }}
                                      >
                                        {row.usage}
                                      </td>
                                      <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={tdKpi({
                                          width: "25%",
                                          outline: "none",
                                          cursor: "text",
                                          textAlign: "center",
                                        })}
                                        onBlur={(e) => {
                                          if (!onUpdateSection) return;
                                          const newVal =
                                            e.currentTarget.innerText.trim();
                                          const base = mergeKpi(
                                            sec.s3kpiTable,
                                            DEFAULT_S3_KPI,
                                          );
                                          onUpdateSection(def.id, {
                                            ...sec,
                                            s3kpiTable: base.map((s) =>
                                              s.id === sub.id
                                                ? {
                                                    ...s,
                                                    section34Rows: (
                                                      s.section34Rows ?? []
                                                    ).map((r, rj) =>
                                                      rj === ri
                                                        ? {
                                                            ...r,
                                                            clientScore: newVal,
                                                          }
                                                        : r,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          });
                                        }}
                                      >
                                        {row.clientScore}
                                      </td>
                                    </tr>
                                  ))}
                                  {(() => {
                                    const nums = s34Rows
                                      .map((r) => parseFloat(r.clientScore))
                                      .filter((n) => !isNaN(n));
                                    const avg =
                                      nums.length > 0
                                        ? nums.reduce((a, b) => a + b, 0) /
                                          nums.length
                                        : null;
                                    return (
                                      <tr>
                                        <td
                                          colSpan={3}
                                          style={tdKpi({
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          Дундаж
                                        </td>
                                        <td
                                          style={tdKpi({
                                            width: "25%",
                                            fontWeight: "bold",
                                            textAlign: "center",
                                          })}
                                        >
                                          {avg !== null ? avg.toFixed(1) : "–"}
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      }

                      const totalW = sub.rows.reduce(
                        (s, r) => s + (Number(r.weight) || 0),
                        0,
                      );
                      return (
                        <table
                          key={sub.id}
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            marginBottom: "8pt",
                          }}
                        >
                          <thead>
                            <tr>
                              {/* ⚠️  S3 header: thKpi-г override хийж "#f29447" шар-оранж болгоно */}
                              <th
                                style={{ ...thKpi, background: "#f29447" }}
                              ></th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ТҮЛХҮҮР ҮЗҮҮЛЭЛТ
                              </th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ХУВЬ
                              </th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ҮНЭЛГЭЭ
                              </th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ҮНЭЛСЭН ТАЙЛБАР
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.rows.map((row, ri) => (
                              <tr key={ri}>
                                {ri === 0 && (
                                  <td
                                    style={tdKpi({
                                      fontWeight: "bold",
                                      textAlign: "center",
                                      background: "#d8f0e8", // ← S3 бүлгийн нүдний НОГООН өнгө
                                      width: "14%",
                                      verticalAlign: "middle",
                                    })}
                                    rowSpan={sub.rows.length}
                                  >
                                    {sub.groupLabel}
                                  </td>
                                )}

                                {/* Түлхүүр үзүүлэлт — contentEditable
                                    s3kpiTable state-д хадгалагдана */}
                                <td
                                  contentEditable
                                  suppressContentEditableWarning
                                  style={tdKpi({
                                    width: "40%",
                                    background: "#d8f0e8", // ← S3 үзүүлэлтийн НОГООН өнгө
                                    outline: "none",
                                    cursor: "text",
                                  })}
                                  onBlur={(e) => {
                                    if (!onUpdateSection) return;
                                    const newVal =
                                      e.currentTarget.innerText.trim();
                                    const base = mergeKpi(
                                      sec.s3kpiTable,
                                      DEFAULT_S3_KPI,
                                    );
                                    onUpdateSection(def.id, {
                                      ...sec,
                                      s3kpiTable: base.map((s) =>
                                        s.id === sub.id
                                          ? {
                                              ...s,
                                              rows: s.rows.map((r, rj) =>
                                                rj === ri
                                                  ? { ...r, indicator: newVal }
                                                  : r,
                                              ),
                                            }
                                          : s,
                                      ),
                                    });
                                  }}
                                >
                                  {row.indicator}
                                </td>
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "8%",
                                    background: "#d8f0e8", // ← S3 хувийн НОГООН өнгө
                                  })}
                                >
                                  {row.weight}
                                </td>
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "10%",
                                    fontWeight: "bold",
                                    background: "#d8f0e8", // ← S3 үнэлгээний НОГООН өнгө
                                    color: row.score ? "#374151" : "#bbb",
                                  })}
                                >
                                  {row.score || ""}
                                </td>
                                <td
                                  style={tdKpi({
                                    width: "28%",
                                    color: "#000",
                                    background: "#d8f0e8", // ← S3 тайлбарын НОГООН өнгө
                                  })}
                                >
                                  {row.evaluatedBy}
                                </td>
                              </tr>
                            ))}

                            {/* Нийт мөр */}
                            <tr style={{ background: "#fff" }}>
                              <td
                                colSpan={2}
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                Нийт
                              </td>
                              <td
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                {totalW}
                              </td>
                              <td style={tdKpi()}></td>
                              <td style={tdKpi()}></td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })}
                  </div>
                ) : s4kpiData ? (
                  /* ════════════════════════════════════════════════
                      S4 KPI ХҮСНЭГТ
                      Секц: "Сургалт, Хөгжил"
                      Мөрийн ӨНГ: #e8e5f8 (цайвар нил ягаан)
                      Header ӨНГ: #f29447 (s3-тэй адил шар-оранж)
                      ⚠️  Мөрийн өнгийг өөрчлөхөд:
                          background: "#e8e5f8" → шинэ өнгө
                  ════════════════════════════════════════════════ */
                  <div style={{ paddingLeft: "6pt" }}>
                    {s4kpiData.map((sub) => {
                      // ── 4.2 richtextlist (Сургалтаас олж авсан мэдлэг) ──
                      if (sub.type === "richtextlist") {
                        const items = sub.richTextRows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            {sub.groupLabel && (
                              <div
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "11pt",
                                  marginBottom: "5pt",
                                  color: "#000",
                                }}
                              >
                                {sub.groupLabel}
                              </div>
                            )}
                            {items.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Өгөгдөл байхгүй —
                              </div>
                            ) : (
                              items.map((item, ii) => {
                                const contents =
                                  item.contents && item.contents.length > 0
                                    ? item.contents
                                    : ([
                                        ...item.bullets.map((b, i) => ({
                                          id: `b${i}`,
                                          type: "bullet" as const,
                                          text: b,
                                        })),
                                        ...(item.images ?? []).map((img) => ({
                                          id: img.id,
                                          type: "image" as const,
                                          dataUrl: img.dataUrl,
                                          width: img.width,
                                          height: img.height,
                                        })),
                                      ] as import("./_types").RichTextContent[]);
                                const bulletGroup: import("./_types").RichTextContent[] =
                                  [];
                                const rendered: React.ReactNode[] = [];
                                const flushBullets = () => {
                                  if (bulletGroup.length === 0) return;
                                  rendered.push(
                                    <ul
                                      key={`ul_${rendered.length}`}
                                      style={{
                                        margin: "0 0 4pt 20pt",
                                        padding: 0,
                                        listStyleType: "disc",
                                      }}
                                    >
                                      {bulletGroup.map((c) => (
                                        <li
                                          key={c.id}
                                          style={{
                                            fontSize: "11pt",
                                            color: "#000",
                                            lineHeight: "1.7",
                                          }}
                                        >
                                          {c.text}
                                        </li>
                                      ))}
                                    </ul>,
                                  );
                                  bulletGroup.length = 0;
                                };
                                contents.forEach((c) => {
                                  if (c.type === "bullet") {
                                    bulletGroup.push(c);
                                  } else {
                                    flushBullets();
                                    rendered.push(
                                      <div
                                        key={c.id}
                                        style={{
                                          textAlign: "center",
                                          margin: "6pt 0",
                                        }}
                                      >
                                        <img
                                          src={c.dataUrl}
                                          alt=""
                                          style={{
                                            width: `${c.width ?? 80}%`,
                                            height:
                                              c.height && c.height > 0
                                                ? `${c.height}px`
                                                : "auto",
                                            maxWidth: "100%",
                                            display: "inline-block",
                                          }}
                                        />
                                      </div>,
                                    );
                                  }
                                });
                                flushBullets();
                                return (
                                  <div
                                    key={item.id}
                                    style={{ marginBottom: "8pt" }}
                                  >
                                    <div
                                      style={{
                                        fontWeight: "bold",
                                        fontSize: "11pt",
                                        marginBottom: "3pt",
                                        color: "#000",
                                      }}
                                    >
                                      {ii + 1}. {item.title}
                                    </div>
                                    {rendered}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      }
                      // ── 4.2 legacy section42knowledge (backwards compat) ──
                      if (sub.type === "section42knowledge") {
                        const s42Rows = sub.section42Rows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {s42Rows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Өгөгдөл байхгүй —
                              </div>
                            ) : (
                              s42Rows.map((row, ri) => (
                                <div key={ri} style={{ marginBottom: "6pt" }}>
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "11pt",
                                      color: "#000",
                                      marginBottom: "2pt",
                                    }}
                                  >
                                    {row.employeeName}
                                  </div>
                                  <ul
                                    style={{
                                      margin: "0 0 4pt 20pt",
                                      padding: 0,
                                      listStyleType: "disc",
                                    }}
                                  >
                                    {(row.text || "")
                                      .split("\n")
                                      .filter((l) => l.trim())
                                      .map((line, li) => (
                                        <li
                                          key={li}
                                          style={{
                                            fontSize: "11pt",
                                            color: "#000",
                                            lineHeight: "1.7",
                                          }}
                                        >
                                          {line.trim()}
                                        </li>
                                      ))}
                                  </ul>
                                </div>
                              ))
                            )}
                          </div>
                        );
                      }

                      // ── 4.3 Хамрагдсан сургалт ──
                      if (sub.type === "section43trainings") {
                        const s43Rows = sub.section43Rows ?? [];
                        return (
                          <div
                            key={sub.id}
                            style={{ marginBottom: "8pt", paddingLeft: "6pt" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11pt",
                                marginBottom: "5pt",
                                color: "#000",
                              }}
                            >
                              {sub.groupLabel}
                            </div>
                            {s43Rows.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "11pt",
                                  color: "#bbb",
                                  fontStyle: "italic",
                                }}
                              >
                                — Өгөгдөл байхгүй —
                              </div>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  marginBottom: "4pt",
                                  fontSize: "9pt",
                                }}
                              >
                                <thead>
                                  <tr>
                                    {[
                                      { label: "Ажилтан", w: "12%" },
                                      { label: "Сургалтын нэр", w: "20%" },
                                      { label: "Зохион байгуулагч", w: "10%" },
                                      { label: "Төрөл", w: "7%" },
                                      { label: "Огноо", w: "8%" },
                                      { label: "Хэлбэр", w: "7%" },
                                      { label: "Цаг /цаг/", w: "7%" },
                                      {
                                        label: "Аудитын зорилготой холбогдсон",
                                        w: "10%",
                                      },
                                      {
                                        label: "Мэдлэг хуваалцсан",
                                        w: "19%",
                                      },
                                    ].map(({ label, w }) => (
                                      <th
                                        key={label}
                                        style={{
                                          ...thKpi,
                                          background: "#fff",
                                          width: w,
                                        }}
                                      >
                                        {label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {s43Rows.map((row, ri) => (
                                    <tr key={ri}>
                                      <td style={tdKpi({ width: "12%" })}>
                                        {row.employeeName}
                                      </td>
                                      <td style={tdKpi({ width: "20%" })}>
                                        {row.training}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "10%",
                                          textAlign: "center",
                                        })}
                                      >
                                        {row.organizer}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "7%",
                                          textAlign: "center",
                                        })}
                                      >
                                        {row.type}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "8%",
                                          textAlign: "center",
                                        })}
                                      >
                                        {row.date}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "7%",
                                          textAlign: "center",
                                        })}
                                      >
                                        {row.format}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "7%",
                                          textAlign: "center",
                                        })}
                                      >
                                        {row.hours}
                                      </td>
                                      <td
                                        style={tdKpi({
                                          width: "10%",
                                          textAlign: "center",
                                        })}
                                      >
                                        {row.meetsAuditGoal}
                                      </td>
                                      <td style={tdKpi({ width: "19%" })}>
                                        {row.sharedKnowledge}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      }

                      const totalW = sub.rows.reduce(
                        (s, r) => s + (Number(r.weight) || 0),
                        0,
                      );
                      return (
                        <table
                          key={sub.id}
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            marginBottom: "8pt",
                          }}
                        >
                          <thead>
                            <tr>
                              {/* ⚠️  S4 header: "#f29447" — S3-тэй адилхан шар-оранж */}
                              <th
                                style={{ ...thKpi, background: "#f29447" }}
                              ></th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ТҮЛХҮҮР ҮЗҮҮЛЭЛТ
                              </th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ХУВЬ
                              </th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ҮНЭЛГЭЭ
                              </th>
                              <th style={{ ...thKpi, background: "#f29447" }}>
                                ҮНЭЛСЭН ТАЙЛБАР
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.rows.map((row, ri) => (
                              <tr key={ri}>
                                {ri === 0 && (
                                  <td
                                    style={tdKpi({
                                      fontWeight: "bold",
                                      textAlign: "center",
                                      background: "#e8e5f8", // ← S4 бүлгийн нил ягаан өнгө
                                      width: "14%",
                                      verticalAlign: "middle",
                                    })}
                                    rowSpan={sub.rows.length}
                                  >
                                    {sub.groupLabel}
                                  </td>
                                )}

                                {/* Түлхүүр үзүүлэлт — contentEditable
                                    s4kpiTable state-д хадгалагдана */}
                                <td
                                  contentEditable
                                  suppressContentEditableWarning
                                  style={tdKpi({
                                    width: "40%",
                                    background: "#e8e5f8", // ← S4 үзүүлэлтийн нил ягаан өнгө
                                    outline: "none",
                                    cursor: "text",
                                  })}
                                  onBlur={(e) => {
                                    if (!onUpdateSection) return;
                                    const newVal =
                                      e.currentTarget.innerText.trim();
                                    const base = mergeKpi(
                                      sec.s4kpiTable,
                                      DEFAULT_S4_KPI,
                                    );
                                    onUpdateSection(def.id, {
                                      ...sec,
                                      s4kpiTable: base.map((s) =>
                                        s.id === sub.id
                                          ? {
                                              ...s,
                                              rows: s.rows.map((r, rj) =>
                                                rj === ri
                                                  ? { ...r, indicator: newVal }
                                                  : r,
                                              ),
                                            }
                                          : s,
                                      ),
                                    });
                                  }}
                                >
                                  {row.indicator}
                                </td>
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "8%",
                                    background: "#e8e5f8", // ← S4 хувийн нил ягаан өнгө
                                  })}
                                >
                                  {row.weight}
                                </td>
                                <td
                                  style={tdKpi({
                                    textAlign: "center",
                                    width: "10%",
                                    fontWeight: "bold",
                                    background: "#e8e5f8", // ← S4 үнэлгээний нил ягаан өнгө
                                    color: row.score ? "#374151" : "#bbb",
                                  })}
                                >
                                  {row.score || ""}
                                </td>
                                <td
                                  style={tdKpi({
                                    width: "28%",
                                    color: "#000",
                                    background: "#e8e5f8", // ← S4 тайлбарын нил ягаан өнгө
                                  })}
                                >
                                  {row.evaluatedBy}
                                </td>
                              </tr>
                            ))}

                            {/* Нийт мөр */}
                            <tr style={{ background: "#fff" }}>
                              <td
                                colSpan={2}
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                Нийт
                              </td>
                              <td
                                style={tdKpi({
                                  textAlign: "center",
                                  fontWeight: "normal",
                                  color: "#000",
                                })}
                              >
                                {totalW}
                              </td>
                              <td style={tdKpi()}></td>
                              <td style={tdKpi()}></td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })}

                    {/* S4 секцийн нэмэлт тайлбар */}
                    {sec.content.trim() && (
                      <div style={{ marginBottom: "8pt" }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: "11pt",
                            marginBottom: "4pt",
                            color: "#000",
                          }}
                        >
                          Сургалт, хөгжлийн төлөв байдалын дэлгэрэнгүй тайлбар:
                        </div>
                        <div
                          style={{
                            fontSize: "11pt",
                            lineHeight: "1.7",
                            whiteSpace: "pre-wrap",
                            color: "#000",
                          }}
                        >
                          {sec.content}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !hasContent /* KPI хүснэгт ч үгүй, текст ч үгүй бол юу ч харуулахгүй */ ? null : (
                  /* KPI хүснэгтгүй секцүүдийн текст тайлбар хэсэг
                     (Тайлбар, Амжилт, Бэрхшээл, Оноо) */
                  <div style={{ paddingLeft: "9pt", marginBottom: "8pt" }}>
                    {sec.content.trim() && (
                      <>
                        <div style={labelSt}>Тайлбар:</div>
                        <div style={bodyTxt}>{sec.content}</div>
                      </>
                    )}
                    {sec.achievements.trim() && (
                      <>
                        <div style={labelSt}>Амжилт, давуу тал:</div>
                        <div style={bodyTxt}>{sec.achievements}</div>
                      </>
                    )}
                    {sec.issues.trim() && (
                      <>
                        <div style={labelSt}>Бэрхшээл, сорилт:</div>
                        <div style={bodyTxt}>{sec.issues}</div>
                      </>
                    )}
                    {sec.score.trim() && (
                      <div style={{ marginTop: "5pt" }}>
                        <span style={{ fontWeight: "bold", fontSize: "11pt" }}>
                          Оноо:{" "}
                        </span>
                        {/* Оноог цэнхэр тоогоор харуулна */}
                        <span
                          style={{
                            fontWeight: "bold",
                            color: "#374151",
                            fontSize: "11pt",
                          }}
                        >
                          {sec.score}
                        </span>
                        {/* Тоон оноог үгэн утгаар хөрвүүлж харуулна (scoreLabel функц) */}
                        {!isNaN(parseFloat(sec.score)) && (
                          <span
                            style={{
                              fontSize: "11pt",
                              color: "#000",
                              marginLeft: "6pt",
                              fontStyle: "italic",
                            }}
                          >
                            — {scoreLabel(parseFloat(sec.score))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* ══ 1-Р ХУУДАС ТӨГСӨВ ══ */}

        {/* ══════════════════════════════════════════════════
            2-Р ХУУДАС: НЭГТГЭЛ
            negtgelKpi өгөгдлийг харуулна.
            negtgelKpi нь page.tsx дотор _types.ts-ын
            DEFAULT_NEGTGEL_KPI-аас эхлэн state-д хадгалагдана.

            ДИЗАЙН ТАЙЛБАР:
            Header ӨНГ: #e9965b (тод оранж) — 1-р хуудаснаас ялгаатай
            Мөрийн ӨНГ: #fef3c7 (цайвар шар)
            Нийт мөр: цагаан фон

            ⚠️  Header өнгийг өөрчлөхөд: background: "#e6823b"
            ⚠️  Мөрийн өнгийг өөрчлөхөд: background: "#fef3c7"
        ══════════════════════════════════════════════════ */}
        <div style={page}>
          {/* 2-р хуудасны дээд гарчиг */}
          <div style={{ ...bigTitle, marginBottom: "6pt" }}>
            ДАТА АНАЛИЗЫН АЛБА {year} ОНЫ {qName}-Р УЛИРЛЫН БҮХ-НЫ НЭГТГЭЛ
          </div>

          {/* Огноо — YYYY.MM.DD форматаар харуулна */}
          <div
            style={{
              fontSize: "11pt",
              color: "#000",
              marginBottom: "12pt",
            }}
          >
            {new Date().getFullYear()}.
            {String(new Date().getMonth() + 1).padStart(2, "0")}.
            {String(new Date().getDate()).padStart(2, "0")}
          </div>

          {/* ── Нэгтгэлийн KPI хүснэгт ── */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "14pt",
              fontSize: "11pt",
            }}
          >
            <thead>
              <tr>
                {/* ⚠️  2-р хуудас header өнгө: "#f29447" → энд солих */}
                {[
                  "",
                  "ТҮЛХҮҮР ҮЗҮҮЛЭЛТ",
                  "ХУВЬ",
                  "ҮНЭЛГЭЭ",
                  "ҮНЭЛГЭЭНИЙ ТАЙЛБАР",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...thKpi,
                      background: "#f29447", // ← 2-р хуудас header тод оранж
                      color: "#000",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* negtgelKpi бүлэг тус бүрийг тоолно
                  gi индексээр s1→s4 өнгийг ээлжлэн хэрэглэнэ:
                  0→цэнхэр(s1), 1→оранж(s2), 2→ногоон(s3), 3→нил ягаан(s4) */}
              {negtgelKpi.map((group, gi) => {
                // Бүлгийн индексээр тохирох өнгийг сонгох
                const rowColors = ["#dde8f5", "#f5e5d0", "#d8f0e8", "#e8e5f8"];
                const rowBg = rowColors[gi % rowColors.length];

                // Бүлгийн нийт хувийг тооцно
                const totalW = group.rows.reduce(
                  (s, r) => s + (Number(r.weight) || 0),
                  0,
                );
                return (
                  <React.Fragment key={group.id}>
                    {/* Бүлгийн мөрүүд */}
                    {group.rows.map((row, ri) => (
                      <tr key={ri}>
                        {/* Бүлгийн нэр нүд — rowSpan-аар бүлгийн бүх мөрийг нэгтгэнэ
                            ⚠️  rowSpan={group.rows.length} — зөвхөн мэдээллийн мөрүүдийг нэгтгэнэ,
                                Нийт мөрийг НЭГТГЭХГҮй (+ 1 хийхгүй!) */}
                        {ri === 0 && (
                          <td
                            style={tdKpi({
                              fontWeight: "bold",
                              textAlign: "center",
                              background: rowBg, // ← бүлгийн өнгө gi-аар тодорхойлогдоно
                              width: "20%",
                              verticalAlign: "middle",
                            })}
                            rowSpan={group.rows.length}
                          >
                            {group.groupLabel}
                          </td>
                        )}
                        {/* Үзүүлэлт нүд — мөн ижил rowBg өнгөтэй */}
                        <td style={tdKpi({ width: "38%", background: rowBg })}>
                          {row.indicator}
                        </td>
                        <td
                          style={tdKpi({
                            textAlign: "center",
                            width: "7%",
                            background: rowBg,
                          })}
                        >
                          {row.weight}
                        </td>
                        {/* Үнэлгээ — утга байвал цэнхэр */}
                        <td
                          style={tdKpi({
                            textAlign: "center",
                            width: "7%",
                            fontWeight: "bold",
                            background: rowBg,
                            color: row.score ? "#374151" : "#bbb",
                          })}
                        >
                          {row.score || ""}
                        </td>
                        <td
                          style={tdKpi({
                            width: "28%",
                            color: "#000",
                            background: rowBg,
                          })}
                        >
                          {row.evaluatedBy}
                        </td>
                      </tr>
                    ))}

                    {/* Бүлгийн Нийт мөр — цагаан фон */}
                    <tr style={{ background: "#fff" }}>
                      <td
                        colSpan={2}
                        style={tdKpi({
                          textAlign: "center",
                          fontWeight: "normal",
                          color: "#000",
                        })}
                      >
                        Нийт
                      </td>
                      <td
                        style={tdKpi({
                          textAlign: "center",
                          fontWeight: "normal",
                          color: "#000",
                        })}
                      >
                        {totalW}
                      </td>
                      <td style={tdKpi()}></td>
                      <td style={tdKpi()}></td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* ── Хамгийн сүүлийн НИЙТ мөр ──
                  Бүх бүлгийн нийт дүн = 100%
                  colSpan=2 → эхний 2 баганыг нэгтгэж "НИЙТ" гарчиг
                  эцсийн 2 багана → colSpan=2-ээр нэгтгэсэн хоосон нүд */}
              <tr style={{ background: "#fff" }}>
                <td
                  colSpan={2}
                  style={tdKpi({
                    color: "#000",
                    fontWeight: "bold",
                    textAlign: "center",
                  })}
                >
                  НИЙТ
                </td>
                <td
                  style={tdKpi({
                    color: "#000",
                    fontWeight: "bold",
                    textAlign: "center",
                  })}
                >
                  100
                </td>
                {/* Эцсийн 2 баганыг нэгтгэсэн хоосон нүд */}
                <td style={tdKpi()} colSpan={2}></td>
              </tr>
            </tbody>
          </table>

          {/* ── Гарын үсэг ── */}
          {(() => {
            let sig: Record<string, string> = {};
            try {
              sig = JSON.parse(sections["sig"]?.content || "{}");
            } catch {}
            const p1n = sig.p1n || "";
            const p1t = sig.p1t || "";
            const p2n = sig.p2n || "";
            const p2t = sig.p2t || "";
            const p3n = sig.p3n || "";
            const p3t = sig.p3t || "";
            const sigFont: React.CSSProperties = {
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: "11pt",
              fontWeight: "bold",
              fontStyle: "normal",
            };
            const tdL: React.CSSProperties = {
              width: "50%",
              padding: "6pt 12pt 2pt",
              verticalAlign: "top",
              textAlign: "left",
              ...sigFont,
            };
            const tdR: React.CSSProperties = {
              width: "50%",
              padding: "6pt 12pt 2pt",
              verticalAlign: "top",
              textAlign: "left",
              ...sigFont,
            };
            return (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "28pt",
                  ...sigFont,
                }}
              >
                <tbody>
                  <tr>
                    <td style={tdL}>
                      <div style={sigFont}>БОЛОВСРУУЛСАН:</div>
                    </td>
                    <td style={tdR}>
                      {p1n && <div style={sigFont}>{p1n}</div>}
                      {p1t && <div style={sigFont}>/{p1t}/</div>}
                    </td>
                  </tr>
                  <tr>
                    <td style={tdL}>
                      <div style={sigFont}>ҮНЭЛЖ, БАТАЛГААЖУУЛСАН:</div>
                    </td>
                    <td style={tdR}>
                      {p2n && <div style={sigFont}>{p2n}</div>}
                      {p2t && <div style={sigFont}>/{p2t}/</div>}
                    </td>
                  </tr>
                  <tr>
                    <td style={tdL}>
                      <div style={sigFont}>ҮНЭЛЖ, БАТАЛГААЖУУЛСАН:</div>
                    </td>
                    <td style={tdR}>
                      {p3n && <div style={sigFont}>{p3n}</div>}
                      {p3t && <div style={sigFont}>/{p3t}/</div>}
                    </td>
                  </tr>
                </tbody>
              </table>
            );
          })()}
          {/* ══ 2-Р ХУУДАС ТӨГСӨВ ══ */}
        </div>
      </div>
    </div>
  );
}
