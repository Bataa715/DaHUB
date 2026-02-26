"use client";

import React from "react";
import { parseContent } from "./RichEditor";
import type {
  PlannedTask,
  DynSection,
  Section2Task,
  Section3AutoTask,
  Section3Dashboard,
  Section4Training,
  Section5Task,
  Section6Activity,
  TailanImage,
} from "./tailan.types";

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
  const MAP: Record<string, string> = {
    "Дата анализын алба": "ДАА",
    "Ерөнхий аудитын хэлтэс": "ЕАХ",
    "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ЗАГЧБХ",
    "Мэдээллийн технологийн аудитын хэлтэс": "МТАХ",
    Удирдлага: "ДАГ",
  };
  if (MAP[dept]) return MAP[dept];
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
  dynamicSections,
  section4Trainings,
  section4KnowledgeText,
  section5Tasks,
  section6Activities,
  section7Text,
  images,
}: WordPreviewProps) {
  const qName = ROMAN_NUMS[(quarter - 1) % 4] ?? "I";
  const deptCode = deptAbbrevMn(userDepartment ?? "");
  const posUpper = (userPosition ?? "").toUpperCase();
  const nameUpper = (userName ?? "").toUpperCase();
  const titleText = `${deptCode ? `${deptCode}-НЫ ` : ""}${posUpper}${posUpper && nameUpper ? " " : ""}${nameUpper} ${year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`;

  const tableCounter = { n: 1 };
  const dynStartRomIdx = 7;

  const headingStyle: React.CSSProperties = {
    fontWeight: "bold",
    fontSize: "11pt",
    marginTop: "14pt",
    marginBottom: "6pt",
    textTransform: "uppercase",
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
    border: "1px dashed #888",
    padding: "4px 6px",
    textAlign: "center",
    fontWeight: "bold",
  };
  const tdStyle = (width?: string): React.CSSProperties => ({
    border: "1px dashed #aaa",
    padding: "3px 5px",
    width,
  });

  return (
    <div
      className="bg-white shadow-2xl mx-auto"
      style={{
        width: "100%",
        maxWidth: "210mm",
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
        I. ӨГӨГДӨЛ ШИНЖИЛГЭЭГЭЭР АУДИТЫН ҮЙЛ АЖИЛЛАГААГ ДЭМЖСЭН БАЙДАЛ
      </div>
      <div style={subHeadingStyle}>
        I.1 Data шинжилгээний үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал
      </div>
      {plannedTasks.filter((t) => t.title?.trim()).length === 0 ? (
        <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
      ) : (
        <div style={{ marginBottom: "8pt" }}>
          {plannedTasks
            .filter((t) => t.title?.trim())
            .map((t, idx) => (
              <div key={t._id} style={{ marginBottom: "6pt" }}>
                <span style={{ fontWeight: "bold" }}>{idx + 1}. </span>
                {t.title}
                {t.description?.trim() && (
                  <div
                    style={{
                      marginLeft: "16pt",
                      marginTop: "2pt",
                      color: "#333",
                    }}
                  >
                    {t.description}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      <div style={subHeadingStyle}>
        I.2 Шинээр хөгжүүлсэн dashboard хөгжүүлэлтийн чанар, үр дүн
      </div>
      <div
        style={{ fontSize: "9pt", fontStyle: "italic", marginBottom: "2pt" }}
      >
        Хүснэгт 1.
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "9.5pt",
          marginBottom: "10pt",
          fontFamily: "'Times New Roman', serif",
        }}
      >
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {[
              "№",
              "Төлөвлөгөөт ажил",
              "Ажлын гүйцэтгэл",
              "Хийгдсэн хугацаа",
              "Гүйцэтгэл",
            ].map((h) => (
              <th key={h} style={{ border: "1px solid #888", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plannedTasks.length === 0 ? (
            <tr>
              {[4, 30, 20, 20, 26].map((w, i) => (
                <td key={i} style={{ border: "1px solid #ccc", padding: "3px 5px", width: `${w}%` }}>
                  &nbsp;
                </td>
              ))}
            </tr>
          ) : (
            plannedTasks.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ border: "1px solid #ccc", padding: "3px 5px", textAlign: "center", width: "4%" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #ccc", padding: "3px 5px", width: "30%" }}>{t.title}</td>
                <td style={{ border: "1px solid #ccc", padding: "3px 5px", textAlign: "center", width: "20%" }}>{t.completion}%</td>
                <td style={{ border: "1px solid #ccc", padding: "3px 5px", textAlign: "center", width: "20%" }}>
                  {t.startDate}{t.startDate && t.endDate ? " – " : ""}{t.endDate}
                </td>
                <td style={{ border: "1px solid #ccc", padding: "3px 5px", width: "26%" }}>{t.description}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section II ── */}
      <div style={headingStyle}>
        II. АУДИТЫН ҮЙЛ АЖИЛЛАГААНД ШААРДЛАГАТАЙ ӨГӨГДӨЛ БОЛОВСРУУЛАХ АЖИЛ
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Төлөвлөгөөт ажлууд", "Ажлын гүйцэтгэл", "Хийгдсэн хугацаа", "Гүйцэтгэл"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section2Tasks.length === 0 ? (
            <tr>{[5, 30, 20, 20, 25].map((w, i) => <td key={i} style={tdStyle(`${w}%`)}>&nbsp;</td>)}</tr>
          ) : (
            section2Tasks.map((t, idx) => (
              <tr key={t._id}>
                <td style={tdStyle("5%")} className="text-center">{idx + 1}</td>
                <td style={tdStyle("30%")}>{t.title}</td>
                <td style={tdStyle("20%")}>{t.result}</td>
                <td style={{ ...tdStyle("20%"), textAlign: "center" }}>{t.period}</td>
                <td style={tdStyle("25%")}>{t.completion}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section III ── */}
      <div style={headingStyle}>III. ТОГТМОЛ ХИЙГДДЭГ АЖЛУУД</div>
      <div style={subHeadingStyle}>
        III.1 Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Тогтмол хийгддэг өгөгдөл боловсруулалт/автоматжуулалт", "Өгөгдөл боловсруулалтын ажлын ач холбогдол/хэрэглээ", "Хэрэглэгчийн нэгжийн өгсөн үнэлгээ"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section3AutoTasks.length === 0 ? (
            <tr>{[5, 40, 35, 20].map((w, i) => <td key={i} style={tdStyle(`${w}%`)}>&nbsp;</td>)}</tr>
          ) : (
            section3AutoTasks.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ ...tdStyle("5%"), textAlign: "center" }}>{idx + 1}</td>
                <td style={tdStyle("40%")}>{t.title}</td>
                <td style={tdStyle("35%")}>{t.value}</td>
                <td style={{ ...tdStyle("20%"), textAlign: "center" }}>{t.rating}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={subHeadingStyle}>
        III.2 Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Dashboard", "Дашбоардын ач холбогдол/хэрэглээ", "Хэрэглэгч нэгжийн өгсөн үнэлгээ"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section3Dashboards.length === 0 ? (
            <tr>{[5, 35, 40, 20].map((w, i) => <td key={i} style={tdStyle(`${w}%`)}>&nbsp;</td>)}</tr>
          ) : (
            section3Dashboards.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ ...tdStyle("5%"), textAlign: "center" }}>{idx + 1}</td>
                <td style={tdStyle("35%")}>{t.dashboard}</td>
                <td style={tdStyle("40%")}>{t.value}</td>
                <td style={{ ...tdStyle("20%"), textAlign: "center" }}>{t.rating}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section IV ── */}
      <div style={headingStyle}>IV. ХАМРАГДСАН СУРГАЛТ</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Хамрагдсан сургалт", "Зохион байгуулагч", "Сургалтын төрөл", "Хэзээ", "Сургалтын хэлбэр", "Цаг", "Аудитын зорилгод нийцсэн эсэх", "Мэдлэгээ хуваалцсан эсэх"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section4Trainings.length === 0 ? (
            <tr>{[5, 25, 15, 12, 10, 10, 7, 8, 8].map((w, i) => <td key={i} style={tdStyle(`${w}%`)}>&nbsp;</td>)}</tr>
          ) : (
            section4Trainings.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ ...tdStyle("5%"), textAlign: "center" }}>{idx + 1}</td>
                <td style={tdStyle("25%")}>{t.training}</td>
                <td style={tdStyle("15%")}>{t.organizer}</td>
                <td style={{ ...tdStyle("12%"), textAlign: "center" }}>{t.type}</td>
                <td style={{ ...tdStyle("10%"), textAlign: "center" }}>{t.date}</td>
                <td style={{ ...tdStyle("10%"), textAlign: "center" }}>{t.format}</td>
                <td style={{ ...tdStyle("7%"), textAlign: "center" }}>{t.hours}</td>
                <td style={{ ...tdStyle("8%"), textAlign: "center" }}>{t.meetsAuditGoal}</td>
                <td style={{ ...tdStyle("8%"), textAlign: "center" }}>{t.sharedKnowledge}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={subHeadingStyle}>
        IV.1 Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал
      </div>
      {section4KnowledgeText?.trim() ? (
        <div style={{ marginBottom: "8pt", whiteSpace: "pre-wrap" }}>
          {section4KnowledgeText}
        </div>
      ) : (
        <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
      )}

      {/* ── Section V ── */}
      <div style={headingStyle}>V. ҮҮРЭГ ДААЛГАВАРЫН БИЕЛЭЛТ</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Ажлын төрөл", "Хийгдсэн ажил"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section5Tasks.length === 0 ? (
            <tr>{[5, 35, 60].map((w, i) => <td key={i} style={tdStyle(`${w}%`)}>&nbsp;</td>)}</tr>
          ) : (
            section5Tasks.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ ...tdStyle("5%"), textAlign: "center" }}>{idx + 1}</td>
                <td style={tdStyle("35%")}>{t.taskType}</td>
                <td style={tdStyle("60%")}>{t.completedWork}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section VI ── */}
      <div style={headingStyle}>VI. ХАМТ ОЛНЫ АЖИЛ</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Огноо", "Хамт олны ажил", "Санаачилга"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section6Activities.length === 0 ? (
            <tr>{[5, 20, 50, 25].map((w, i) => <td key={i} style={tdStyle(`${w}%`)}>&nbsp;</td>)}</tr>
          ) : (
            section6Activities.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ ...tdStyle("5%"), textAlign: "center" }}>{idx + 1}</td>
                <td style={{ ...tdStyle("20%"), textAlign: "center" }}>{t.date}</td>
                <td style={tdStyle("50%")}>{t.activity}</td>
                <td style={tdStyle("25%")}>{t.initiative}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section VII ── */}
      <div style={headingStyle}>VII. ШИНЭ САНАЛ САНААЧИЛГА</div>
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
            {ROMAN_NUMS[dynStartRomIdx + idx] ?? `${dynStartRomIdx + idx + 1}`}.{" "}
            {(sec.title ?? "").toUpperCase()}
          </div>
          {parseContent(sec.content, tableCounter)}
        </div>
      ))}

      {/* Зургийн хавсралт */}
      {images.length > 0 && (
        <>
          <div style={headingStyle}>
            {ROMAN_NUMS[dynStartRomIdx + dynamicSections.length] ??
              `${dynStartRomIdx + dynamicSections.length + 1}`}
            . ЗУРГИЙН ХАВСРАЛТ
          </div>
          {images.map((img, idx) => (
            <div
              key={img.id}
              style={{
                marginBottom: "14pt",
                textAlign: "center",
                pageBreakInside: "avoid",
              }}
            >
              {img.blobUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.blobUrl}
                  alt={img.filename}
                  style={{ maxWidth: "100%", maxHeight: "200pt", objectFit: "contain" }}
                />
              )}
              <div style={{ fontSize: "9pt", fontStyle: "italic", marginTop: "4pt" }}>
                Зураг {idx + 1}. {img.filename}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
