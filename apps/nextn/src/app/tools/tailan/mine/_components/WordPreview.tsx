"use client";

import React from "react";
import { parseContent } from "./RichEditor";
import type {
  PlannedTask,
  DynSection,
  Section2Task,
  Section3AutoTask,
  Section3Dashboard,
  Section1Dashboard,
  Section4Training,
  Section5Task,
  Section6Activity,
  TailanImage,
} from "./tailan.types";

// Format stored "YYYY-MM-DD – YYYY-MM-DD" → "YYYY.MM.DD-YYYY.MM.DD"
function fmtPeriod(period: string): string {
  const [s, e] = period.split(" \u2013 ");
  const fmt = (d?: string) => (d ? d.replace(/-/g, ".") : "");
  if (!s && !e) return "";
  if (!e) return fmt(s);
  return `${fmt(s)}-${fmt(e)}`;
}

export const ROMAN_NUMS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
];

export function deptAbbrevMn(dept: string): string {
  // Lower-cased keys for case-insensitive lookup
  const MAP: Record<string, string> = {
    "дата анализын алба": "ДАА",
    "ерөнхий аудитын хэлтэс": "ЕАХ",
    "зайны аудит чанарын баталгаажуулалтын хэлтэс": "ЗАЧБХ",
    "мэдээллийн технологийн аудитын хэлтэс": "МТАХ",
    удирдлага: "ДАГ",
  };
  const key = (dept || "").toLowerCase();
  if (MAP[key]) return MAP[key];
  return (dept || "")
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

interface WordPreviewProps {
  userName: string;
  userPosition?: string;
  userDepartment?: string;
  year: number;
  quarter: number;
  plannedTasks: PlannedTask[];
  section2Tasks: Section2Task[];
  section3AutoTasks: Section3AutoTask[];
  section3Dashboards: Section3Dashboard[];
  section1Dashboards: Section1Dashboard[];
  dynamicSections: DynSection[];
  section4Trainings: Section4Training[];
  section4KnowledgeText: string;
  section5Tasks: Section5Task[];
  section6Activities: Section6Activity[];
  section7Text: string;
  images: TailanImage[];
}

export function WordPreview({
  userName,
  userPosition,
  userDepartment,
  year,
  quarter,
  plannedTasks,
  section2Tasks,
  section3AutoTasks,
  section3Dashboards,
  section1Dashboards,
  dynamicSections,
  section4Trainings,
  section4KnowledgeText,
  section5Tasks,
  section6Activities,
  section7Text,
  images,
}: WordPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
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

  const qName = ROMAN_NUMS[(quarter - 1) % 4] ?? "I";
  const deptCode = deptAbbrevMn(userDepartment ?? "");
  const posUpper = (userPosition ?? "").toUpperCase();
  const nameUpper = (userName ?? "").toUpperCase();
  const titleText = `${deptCode ? `${deptCode}-НЫ ` : ""}${posUpper}${posUpper && nameUpper ? " " : ""}${nameUpper} ${year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`;

  const tableCounter = { n: 1 };
  const imgCounter = { n: 1 };
  const dynStartRomIdx = 7;

  const headingStyle: React.CSSProperties = {
    fontWeight: "bold",
    fontSize: "11pt",
    marginTop: "14pt",
    marginBottom: "6pt",
    fontFamily: "'Times New Roman', serif",
  };
  const subHeadingStyle: React.CSSProperties = {
    fontWeight: "bold",
    fontSize: "11pt",
    marginTop: "10pt",
    marginBottom: "5pt",
    fontFamily: "'Times New Roman', serif",
  };
  const thStyle: React.CSSProperties = {
    border: "0.5px dotted #bbb",
    padding: "4px 6px",
    textAlign: "center",
    fontWeight: "bold",
  };
  const tdStyle = (width?: string): React.CSSProperties => ({
    border: "0.5px dotted #ccc",
    padding: "3px 5px",
    width,
  });

  // render: outer grey container → zoom wrapper → A4 page
  return (
    <div
      ref={containerRef}
      style={{
        background: "#d8d8d8",
        minHeight: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          zoom: scale,
          padding: "20px",
          width: "fit-content",
          minWidth: "100%",
        }}
      >
        <div
          className="bg-white shadow-2xl mx-auto"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "15.9mm 19mm 22.2mm 25.4mm",
            fontFamily: "'Times New Roman', serif",
            fontSize: "11pt",
            lineHeight: "1.5",
            color: "#000",
          }}
        >
          {/* Title */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "20pt",
              fontWeight: "bold",
              fontSize: "11pt",
              textTransform: "uppercase",
              fontFamily: "'Times New Roman', serif",
            }}
          >
            {titleText}
          </div>

          {/* ── Section I ── */}
          <div style={headingStyle}>
            I. Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал:
          </div>
          {plannedTasks.filter((t) => t.title?.trim()).length === 0 ? (
            <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
          ) : (
            <div style={{ marginBottom: "8pt" }}>
              {plannedTasks
                .filter((t) => t.title?.trim())
                .map((t, idx) => (
                  <div key={t._id} style={{ marginBottom: "6pt" }}>
                    <span style={{ fontWeight: "bold" }}>
                      {idx + 1}. {t.title}
                    </span>
                    {t.description?.trim() && (
                      <div
                        style={{
                          marginLeft: "16pt",
                          marginTop: "2pt",
                          color: "#080808",
                        }}
                      >
                        {parseContent(t.description, tableCounter)}
                      </div>
                    )}
                    {t.images?.length > 0 && (
                      <div style={{ marginTop: "6pt" }}>
                        {t.images.map((img) => (
                          <div
                            key={img.id}
                            style={{
                              textAlign: "center",
                              marginBottom: "8pt",
                              pageBreakInside: "avoid",
                            }}
                          >
                            <img
                              src={img.dataUrl}
                              alt=""
                              style={{
                                width: `${img.width}%`,
                                maxWidth: "100%",
                                display: "inline-block",
                              }}
                            />
                            <div
                              style={{
                                fontSize: "9pt",
                                fontStyle: "italic",
                                marginTop: "3pt",
                              }}
                            >
                              Зураг {imgCounter.n++}.
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          <div style={subHeadingStyle}>
            Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9.5pt",
              marginBottom: "10pt",
              fontFamily: "'Times New Roman', serif",
              border: "1px solid #000",
            }}
          >
            <thead>
              <tr style={{ background: "#fff", color: "#000" }}>
                {[
                  "№",
                  "Төлөвлөгөөт ажил",
                  "Ажлын гүйцэтгэл",
                  "Хийгдсэн хугацаа",
                  "Гүйцэтгэл /товч/",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section1Dashboards.length === 0 ? (
                <tr>
                  {[5, 30, 15, 20, 30].map((w, i) => (
                    <td key={i} style={tdStyle(`${w}%`)}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ) : (
                <>
                  {section1Dashboards.map((t, idx) => (
                    <tr key={t._id}>
                      <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                        {idx + 1}
                      </td>
                      <td style={tdStyle("30%")}>{t.title}</td>
                      <td style={{ ...tdStyle("15%"), textAlign: "center" }}>
                        {t.completion}
                        {t.completion !== "" ? "%" : ""}
                      </td>
                      <td
                        style={{
                          ...tdStyle("20%"),
                          textAlign: "center",
                          fontSize: "8.5pt",
                        }}
                      >
                        {(() => {
                          const [s, e] = (t.period || "").split(" \u2013 ");
                          const fmt = (d?: string) =>
                            d ? d.replace(/-/g, ".") : "";
                          if (!s && !e) return "";
                          if (!e) return fmt(s);
                          return (
                            <>
                              {fmt(s)}-<br />
                              {fmt(e)}
                            </>
                          );
                        })()}
                      </td>
                      <td style={tdStyle("30%")}>
                        {t.summary ? parseContent(t.summary, tableCounter) : ""}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        ...tdStyle("35%"),
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Дундаж гүйцэтгэл
                    </td>
                    <td
                      style={{
                        ...tdStyle("15%"),
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        const nums = section1Dashboards
                          .map((t) => parseFloat(t.completion))
                          .filter((n) => !isNaN(n));
                        if (nums.length === 0) return "";
                        const avg = Math.round(
                          nums.reduce((a, b) => a + b, 0) / nums.length,
                        );
                        return `${avg}%`;
                      })()}
                    </td>
                    <td style={tdStyle("20%")}>&nbsp;</td>
                    <td style={tdStyle("30%")}>&nbsp;</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {/* Row images for I.2 */}
          {section1Dashboards.some((t) => t.images?.length > 0) && (
            <div style={{ marginBottom: "8pt" }}>
              {section1Dashboards
                .filter((t) => t.images?.length > 0)
                .map((t) =>
                  t.images.map((img) => (
                    <div
                      key={img.id}
                      style={{
                        textAlign: "center",
                        marginBottom: "10pt",
                        pageBreakInside: "avoid",
                      }}
                    >
                      <img
                        src={img.dataUrl}
                        alt=""
                        style={{
                          width: `${img.width}%`,
                          maxWidth: "100%",
                          display: "inline-block",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "9pt",
                          fontStyle: "italic",
                          marginTop: "3pt",
                        }}
                      >
                        Зураг {imgCounter.n++}.
                      </div>
                    </div>
                  )),
                )}
            </div>
          )}
          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              marginBottom: "2pt",
              textAlign: "center",
            }}
          >
            Хүснэгт {tableCounter.n++}.
          </div>
          {/* ── Section II ── */}
          <div style={headingStyle}>
            II. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын
            ажил:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9.5pt",
              marginBottom: "10pt",
              fontFamily: "'Times New Roman', serif",
              border: "1px solid #000",
            }}
          >
            <thead>
              <tr style={{ background: "#fff", color: "#000" }}>
                {[
                  "№",
                  <span>
                    Төлөвлөгөөт ажлууд
                    <br />
                    (Дууссан ажлууд)
                  </span>,
                  "Ажлын гүйцэтгэл",
                  "Хийгдсэн хугацаа",
                  "Гүйцэтгэл/товч/",
                ].map((h, i) => (
                  <th key={i} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section2Tasks.length === 0 ? (
                <tr>
                  {[5, 30, 20, 20, 25].map((w, i) => (
                    <td key={i} style={tdStyle(`${w}%`)}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ) : (
                section2Tasks.map((t, idx) => (
                  <tr key={t._id}>
                    <td style={tdStyle("5%")} className="text-center">
                      {idx + 1}
                    </td>
                    <td style={tdStyle("30%")}>{t.title}</td>
                    <td style={{ ...tdStyle("20%"), textAlign: "center" }}>
                      {t.result}
                      {t.result !== "" ? "%" : ""}
                    </td>
                    <td
                      style={{
                        ...tdStyle("20%"),
                        textAlign: "center",
                        fontSize: "8.5pt",
                      }}
                    >
                      {(() => {
                        const [s, e] = (t.period || "").split(" \u2013 ");
                        const fmt = (d?: string) =>
                          d ? d.replace(/-/g, ".") : "";
                        if (!s && !e) return "";
                        if (!e) return fmt(s);
                        return (
                          <>
                            {fmt(s)}-<br />
                            {fmt(e)}
                          </>
                        );
                      })()}
                    </td>
                    <td style={tdStyle("25%")}>{t.completion}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {/* Row images for II */}
          {section2Tasks.some((t) => t.images?.length > 0) && (
            <div style={{ marginBottom: "8pt" }}>
              {section2Tasks
                .filter((t) => t.images?.length > 0)
                .map((t) =>
                  t.images.map((img) => (
                    <div
                      key={img.id}
                      style={{
                        textAlign: "center",
                        marginBottom: "10pt",
                        pageBreakInside: "avoid",
                      }}
                    >
                      <img
                        src={img.dataUrl}
                        alt=""
                        style={{
                          width: `${img.width}%`,
                          maxWidth: "100%",
                          display: "inline-block",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "9pt",
                          fontStyle: "italic",
                          marginTop: "3pt",
                        }}
                      >
                        Зураг {imgCounter.n++}.
                      </div>
                    </div>
                  )),
                )}
            </div>
          )}
          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              textAlign: "center",
              marginBottom: "2pt",
            }}
          >
            Хүснэгт {tableCounter.n++}.
          </div>

          {/* ── Section III ── */}
          <div style={headingStyle}>III. Тогтмол хийгддэг ажлууд</div>
          <div style={subHeadingStyle}>
            Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн
            байдал:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9.5pt",
              marginBottom: "10pt",
              fontFamily: "'Times New Roman', serif",
              border: "1px solid #000",
            }}
          >
            <thead>
              <tr style={{ background: "#fff", color: "#000" }}>
                {[
                  "№",
                  "Тогтмол хийгддэг өгөгдөл боловсруулалт",
                  "Өгөгдөл боловсруулалтын ажлын ач холбогдол,хэрэглээ",
                  "Хэрэглэгчийн нэгжийн өгсөн үнэлгээ",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section3AutoTasks.length === 0 ? (
                <tr>
                  {[5, 40, 35, 20].map((w, i) => (
                    <td key={i} style={tdStyle(`${w}%`)}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ) : (
                <>
                  {section3AutoTasks.map((t, idx) => (
                    <tr key={t._id}>
                      <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                        {idx + 1}
                      </td>
                      <td style={tdStyle("40%")}>{t.title}</td>
                      <td style={tdStyle("35%")}>{t.value}</td>
                      <td style={{ ...tdStyle("20%"), textAlign: "center" }}>
                        {t.rating}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        ...tdStyle("80%"),
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Дундаж үнэлгээ
                    </td>
                    <td
                      style={{
                        ...tdStyle("20%"),
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        const nums = section3AutoTasks
                          .map((t) => parseFloat(t.rating))
                          .filter((n) => !isNaN(n));
                        if (nums.length === 0) return "";
                        const avg = Math.round(
                          nums.reduce((a, b) => a + b, 0) / nums.length,
                        );
                        return `${avg}%`;
                      })()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              textAlign: "center",
              marginBottom: "2pt",
            }}
          >
            Хүснэгт {tableCounter.n++}.
          </div>
          <div style={subHeadingStyle}>
            Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9.5pt",
              marginBottom: "10pt",
              fontFamily: "'Times New Roman', serif",
              border: "1px solid #000",
            }}
          >
            <thead>
              <tr style={{ background: "#fff", color: "#000" }}>
                {[
                  "№",
                  "Дашбоард",
                  "Дашбоардын ач холбогдол,хэрэглээ",
                  "Хэрэглэгч нэгжийн өгсөн үнэлгээ",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section3Dashboards.length === 0 ? (
                <tr>
                  {[5, 35, 40, 20].map((w, i) => (
                    <td key={i} style={tdStyle(`${w}%`)}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ) : (
                <>
                  {section3Dashboards.map((t, idx) => (
                    <tr key={t._id}>
                      <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                        {idx + 1}
                      </td>
                      <td style={tdStyle("35%")}>{t.dashboard}</td>
                      <td style={tdStyle("40%")}>{t.value}</td>
                      <td style={{ ...tdStyle("20%"), textAlign: "center" }}>
                        {t.rating}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        ...tdStyle("80%"),
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Дундаж үнэлгээ
                    </td>
                    <td
                      style={{
                        ...tdStyle("20%"),
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        const nums = section3Dashboards
                          .map((t) => parseFloat(t.rating))
                          .filter((n) => !isNaN(n));
                        if (nums.length === 0) return "";
                        const avg = Math.round(
                          nums.reduce((a, b) => a + b, 0) / nums.length,
                        );
                        return `${avg}%`;
                      })()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              textAlign: "center",
              marginBottom: "2pt",
            }}
          >
            Хүснэгт {tableCounter.n++}.
          </div>
          {/* ── Section IV ── */}
          <div style={headingStyle}>IV. Хамрагдсан сургалт</div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9.5pt",
              marginBottom: "10pt",
              fontFamily: "'Times New Roman', serif",
              border: "1px solid #000",
            }}
          >
            <thead>
              <tr style={{ background: "#fff", color: "#000" }}>
                {[
                  "№",
                  "Хамрагдсан сургалт",
                  "Зохион байгуулагч",
                  "Сургалтын төрөл",
                  "Хэзээ",
                  "Сургалтын хэлбэр",
                  "Цаг",
                  "Аудитын зорилгод нийцсэн эсэх",
                  "Мэдлэгээ хуваалцсан эсэх",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section4Trainings.length === 0 ? (
                <tr>
                  {[5, 25, 15, 12, 10, 10, 7, 8, 8].map((w, i) => (
                    <td key={i} style={tdStyle(`${w}%`)}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ) : (
                section4Trainings.map((t, idx) => (
                  <tr key={t._id}>
                    <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                      {idx + 1}
                    </td>
                    <td style={tdStyle("25%")}>{t.training}</td>
                    <td style={{ ...tdStyle("15%"), textAlign: "center" }}>
                      {t.organizer}
                    </td>
                    <td style={{ ...tdStyle("12%"), textAlign: "center" }}>
                      {t.type}
                    </td>
                    <td style={{ ...tdStyle("10%"), textAlign: "center" }}>
                      {t.date ? t.date.replace(/-/g, ".") : ""}
                    </td>
                    <td style={{ ...tdStyle("10%"), textAlign: "center" }}>
                      {t.format}
                    </td>
                    <td style={{ ...tdStyle("7%"), textAlign: "center" }}>
                      {t.hours ? `${t.hours} цаг` : ""}
                    </td>
                    <td style={{ ...tdStyle("8%"), textAlign: "center" }}>
                      {t.meetsAuditGoal}
                    </td>
                    <td style={{ ...tdStyle("8%"), textAlign: "center" }}>
                      {t.sharedKnowledge}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              textAlign: "center",
              marginBottom: "2pt",
            }}
          >
            Хүснэгт {tableCounter.n++}.
          </div>
          <div style={subHeadingStyle}>
            Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал:
          </div>
          {section4KnowledgeText?.trim() ? (
            <div style={{ marginBottom: "8pt", whiteSpace: "pre-wrap" }}>
              {section4KnowledgeText}
            </div>
          ) : (
            <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
          )}

          {/* ── Section V ── */}
          <div style={headingStyle}>V. Үүрэг даалгаварын биелэлт</div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9.5pt",
              marginBottom: "10pt",
              fontFamily: "'Times New Roman', serif",
              border: "1px solid #000",
            }}
          >
            <thead>
              <tr style={{ background: "#fff", color: "#000" }}>
                {["№", "Ажлын төрөл", "Хийгдсэн ажил"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section5Tasks.length === 0 ? (
                <tr>
                  {[5, 35, 60].map((w, i) => (
                    <td key={i} style={tdStyle(`${w}%`)}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ) : (
                section5Tasks.map((t, idx) => (
                  <tr key={t._id}>
                    <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                      {idx + 1}
                    </td>
                    <td style={tdStyle("35%")}>{t.taskType}</td>
                    <td style={tdStyle("60%")}>
                      {t.completedWork
                        ? parseContent(t.completedWork, tableCounter)
                        : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              textAlign: "center",
              marginBottom: "2pt",
            }}
          >
            Хүснэгт {tableCounter.n++}.
          </div>
          {/* ── Section VI ── */}
          <div style={headingStyle}>VI. Хамт олны ажил</div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9.5pt",
              marginBottom: "10pt",
              fontFamily: "'Times New Roman', serif",
              border: "1px solid #000",
            }}
          >
            <thead>
              <tr style={{ background: "#fff", color: "#000" }}>
                {["№", "Огноо", "Хамт олны ажил", "Санаачилга"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section6Activities.length === 0 ? (
                <tr>
                  {[5, 20, 50, 25].map((w, i) => (
                    <td key={i} style={tdStyle(`${w}%`)}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ) : (
                section6Activities.map((t, idx) => (
                  <tr key={t._id}>
                    <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                      {idx + 1}
                    </td>
                    <td style={{ ...tdStyle("20%"), textAlign: "center" }}>
                      {t.date ? t.date.replace(/-/g, ".") : ""}
                    </td>
                    <td style={tdStyle("50%")}>{t.activity}</td>
                    <td style={tdStyle("25%")}>{t.initiative}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              textAlign: "center",
              marginBottom: "2pt",
            }}
          >
            Хүснэгт {tableCounter.n++}.
          </div>
          {/* ── Section VII ── */}
          <div style={headingStyle}>VII. Шинэ санал санаачилга</div>
          {section7Text?.trim() ? (
            <div style={{ marginBottom: "8pt", whiteSpace: "pre-wrap" }}>
              {section7Text}
            </div>
          ) : (
            <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
          )}

          {/* ── Dynamic sections VIII, IX, … ── */}
          {dynamicSections.map((sec, idx) => (
            <div key={sec._id}>
              <div style={headingStyle}>
                {ROMAN_NUMS[dynStartRomIdx + idx] ??
                  `${dynStartRomIdx + idx + 1}`}
                . {sec.title ?? ""}
              </div>
              {parseContent(sec.content, tableCounter)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
