"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { tailanApi } from "@/lib/api";
import {
  Plus,
  Trash2,
  Download,
  Send,
  Save,
  ChevronLeft,
  Loader2,
  GripVertical,
  Check,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────────────
interface PlannedTask {
  _id: string;
  order: number;
  title: string;
  completion: number;
  startDate: string;
  endDate: string;
  description: string;
}
interface DynSection {
  _id: string;
  order: number;
  title: string;
  content: string;
}
interface TeamActivity {
  _id: string;
  name: string;
  date: string;
}
interface Section2Task {
  _id: string;
  order: number;
  title: string;
  result: string;
  period: string;
  completion: string;
}
interface Section3AutoTask {
  _id: string;
  order: number;
  title: string;
  value: string;
  rating: string;
}
interface Section3Dashboard {
  _id: string;
  order: number;
  dashboard: string;
  value: string;
  rating: string;
}
interface Section4Training {
  _id: string;
  order: number;
  training: string;
  organizer: string;
  type: string;
  date: string;
  format: string;
  hours: string;
  meetsAuditGoal: string;
  sharedKnowledge: string;
}
interface Section5Task {
  _id: string;
  order: number;
  taskType: string;
  completedWork: string;
}
interface Section6Activity {
  _id: string;
  order: number;
  date: string;
  activity: string;
  initiative: string;
}

interface TailanImage {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  blobUrl?: string;
}

const uid = () => Math.random().toString(36).slice(2);
const getCurrentYear = () => new Date().getFullYear();
const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);

// ─── Rich text helpers ───────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]*\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function parseContent(text: string, tc: { n: number }): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Pipe table
    if (line.trim().startsWith("|")) {
      const tLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tLines.push(lines[i]);
        i++;
      }
      const dataRows = tLines
        .filter((l) => !/^\s*\|[\s\-|]+\|\s*$/.test(l))
        .map((l) =>
          l
            .split("|")
            .filter(Boolean)
            .map((c) => c.trim()),
        );
      if (dataRows.length > 0) {
        tc.n++;
        const n = tc.n;
        nodes.push(
          <div key={`tbl-${i}`} style={{ marginBottom: "8pt" }}>
            <div
              style={{
                fontSize: "9pt",
                fontStyle: "italic",
                marginBottom: "2pt",
              }}
            >
              Хүснэгт {n}.
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "9.5pt",
              }}
            >
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr
                    key={ri}
                    style={
                      ri === 0 ? { background: "#1F3864", color: "#fff" } : {}
                    }
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{ border: "1px solid #888", padding: "3px 5px" }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }
    // Bullet list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul
          key={`ul-${i}`}
          style={{
            marginLeft: "20pt",
            marginBottom: "4pt",
            listStyleType: "disc",
          }}
        >
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: "2pt" }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} style={{ marginLeft: "20pt", marginBottom: "4pt" }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: "2pt" }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    // Normal paragraph
    nodes.push(
      <div
        key={i}
        style={{ textAlign: "justify" as const, marginBottom: "4pt" }}
      >
        {line ? renderInline(line) : "\u00A0"}
      </div>,
    );
    i++;
  }
  return <>{nodes}</>;
}

function RichToolbar({
  value,
  onChange,
  rows = 4,
  placeholder = "",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const apply = (before: string, after = "") => {
    const el = taRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = value.slice(s, e);
    const newVal = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(newVal);
    const cursor = s + before.length + sel.length + after.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };
  const btnCls =
    "px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition select-none";
  return (
    <div>
      <div className="flex gap-1 mb-1 flex-wrap">
        <button
          type="button"
          className={btnCls}
          title="Тод"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("**", "**");
          }}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={btnCls}
          title="Цэглэсэн жагсаалт"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("\n- ");
          }}
        >
          •
        </button>
        <button
          type="button"
          className={btnCls}
          title="Дугаарлалттай жагсаалт"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("\n1. ");
          }}
        >
          1.
        </button>
        <button
          type="button"
          className={btnCls}
          title="Хүснэгт оруулах"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("\n|Гарчиг 1|Гарчиг 2|\n|---|---|\n|Утга|Утга|\n");
          }}
        >
          ⊞
        </button>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}

// ─── Word-like Preview ──────────────────────────────────────────────────────
const ROMAN_NUMS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function deptAbbrevMn(dept: string): string {
  const MAP: Record<string, string> = {
    "Дата анализын алба": "ДАА",
    "Ерөнхий аудитын хэлтэс": "ЕАХ",
    "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ЗАГЧБХ",
    "Мэдээллийн технологийн аудитын хэлтэс": "МТАХ",
    Удирдлага: "ДАГ",
  };
  if (MAP[dept]) return MAP[dept];
  return (dept || "").split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase();
}

function WordPreview({
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
}: {
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
}) {
  const qName = ROMAN_NUMS[(quarter - 1) % 4] ?? "I";
  const deptCode = deptAbbrevMn(userDepartment ?? "");
  const posUpper = (userPosition ?? "").toUpperCase();
  const nameUpper = (userName ?? "").toUpperCase();
  const titleText = `${deptCode ? `${deptCode}-НЫ ` : ""}${posUpper}${posUpper && nameUpper ? " " : ""}${nameUpper} ${year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`;

  // Хүснэгт counter starts at 1 (planned tasks), user pipe tables continue from 2
  const tableCounter = { n: 1 };

  // Roman numeral index for dynamic sections: I=0,II=1,III=2 are fixed → dynamic starts at IV=3
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

      {/* ── Section I: Data analysis ── */}
      <div style={headingStyle}>
        I. ӨГӨГДӨЛ ШИНЖИЛГЭЭГЭЭР АУДИТЫН ҮЙЛ АЖИЛЛАГААГ ДЭМЖСЭН БАЙДАЛ
      </div>

      {/* I.1 – numbered text list */}
      <div style={subHeadingStyle}>
        I.1 Data шинжилгээний үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал
      </div>
      {plannedTasks.filter((t) => t.title?.trim()).length === 0 ? (
        <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
      ) : (
        <div style={{ marginBottom: "8pt" }}>
          {plannedTasks.filter((t) => t.title?.trim()).map((t, idx) => (
            <div key={t._id} style={{ marginBottom: "6pt" }}>
              <span style={{ fontWeight: "bold" }}>{idx + 1}. </span>
              {t.title}
              {t.description?.trim() && (
                <div style={{ marginLeft: "16pt", marginTop: "2pt", color: "#333" }}>
                  {t.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* I.2 – dashboard table */}
      <div style={subHeadingStyle}>
        I.2 Шинээр хөгжүүлсэн dashboard хөгжүүлэлтийн чанар, үр дүн
      </div>
      <div style={{ fontSize: "9pt", fontStyle: "italic", marginBottom: "2pt" }}>
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
            {["№", "Төлөвлөгөөт ажил", "Ажлын гүйцэтгэл", "Хийгдсэн хугацаа", "Гүйцэтгэл"].map((h) => (
              <th
                key={h}
                style={{
                  border: "1px solid #888",
                  padding: "4px 6px",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plannedTasks.length === 0 ? (
            <tr>
              {[4, 30, 20, 20, 26].map((w, i) => (
                <td key={i} style={{ border: "1px solid #ccc", padding: "3px 5px", width: `${w}%` }}>&nbsp;</td>
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

      {/* ── Section II: Өгөгдөл боловсруулах ажил ── */}
      <div style={headingStyle}>
        II. АУДИТЫН ҮЙЛ АЖИЛЛАГААНД ШААРДЛАГАТАЙ ӨГӨГДӨЛ БОЛОВСРУУЛАХ АЖИЛ
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Төлөвлөгөөт ажлууд", "Ажлын гүйцэтгэл", "Хийгдсэн хугацаа", "Гүйцэтгэл"].map((h) => (
              <th key={h} style={{ border: "1px dashed #888", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section2Tasks.length === 0 ? (
            <tr>{[5,30,20,20,25].map((w,i) => <td key={i} style={{ border: "1px dashed #aaa", padding: "3px 5px", width: `${w}%` }}>&nbsp;</td>)}</tr>
          ) : (
            section2Tasks.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "5%" }}>{idx + 1}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "30%" }}>{t.title}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "20%" }}>{t.result}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "20%" }}>{t.period}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "25%" }}>{t.completion}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section III: Тогтмол хийгддэг ажлууд ── */}
      <div style={headingStyle}>III. ТОГТМОЛ ХИЙГДДЭГ АЖЛУУД</div>

      {/* III.1 */}
      <div style={subHeadingStyle}>
        III.1 Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Тогтмол хийгддэг өгөгдөл боловсруулалт/автоматжуулалт", "Өгөгдөл боловсруулалтын ажлын ач холбогдол/хэрэглээ", "Хэрэглэгчийн нэгжийн өгсөн үнэлгээ"].map((h) => (
              <th key={h} style={{ border: "1px dashed #888", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section3AutoTasks.length === 0 ? (
            <tr>{[5,40,35,20].map((w,i) => <td key={i} style={{ border: "1px dashed #aaa", padding: "3px 5px", width: `${w}%` }}>&nbsp;</td>)}</tr>
          ) : (
            section3AutoTasks.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "5%" }}>{idx + 1}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "40%" }}>{t.title}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "35%" }}>{t.value}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "20%" }}>{t.rating}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* III.2 */}
      <div style={subHeadingStyle}>
        III.2 Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Dashboard", "Дашбоардын ач холбогдол/хэрэглээ", "Хэрэглэгч нэгжийн өгсөн үнэлгээ"].map((h) => (
              <th key={h} style={{ border: "1px dashed #888", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section3Dashboards.length === 0 ? (
            <tr>{[5,35,40,20].map((w,i) => <td key={i} style={{ border: "1px dashed #aaa", padding: "3px 5px", width: `${w}%` }}>&nbsp;</td>)}</tr>
          ) : (
            section3Dashboards.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "5%" }}>{idx + 1}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "35%" }}>{t.dashboard}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "40%" }}>{t.value}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "20%" }}>{t.rating}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section IV: Хамрагдсан сургалт ── */}
      <div style={headingStyle}>IV. ХАМРАГДСАН СУРГАЛТ</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Хамрагдсан сургалт", "Зохион байгуулагч", "Сургалтын төрөл", "Хэзээ", "Сургалтын хэлбэр", "Цаг", "Аудитын зорилгод нийцсэн эсэх", "Мэдлэгээ хуваалцсан эсэх"].map((h) => (
              <th key={h} style={{ border: "1px dashed #888", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section4Trainings.length === 0 ? (
            <tr>{[5,25,15,12,10,10,7,8,8].map((w,i) => <td key={i} style={{ border: "1px dashed #aaa", padding: "3px 5px", width: `${w}%` }}>&nbsp;</td>)}</tr>
          ) : (
            section4Trainings.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "5%" }}>{idx + 1}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "25%" }}>{t.training}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "15%" }}>{t.organizer}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "12%" }}>{t.type}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "10%" }}>{t.date}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "10%" }}>{t.format}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "7%" }}>{t.hours}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "8%" }}>{t.meetsAuditGoal}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "8%" }}>{t.sharedKnowledge}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={subHeadingStyle}>IV.1 Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал</div>
      {section4KnowledgeText?.trim() ? (
        <div style={{ marginBottom: "8pt", whiteSpace: "pre-wrap" }}>{section4KnowledgeText}</div>
      ) : (
        <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
      )}

      {/* ── Section V: Үүрэг даалгаварын биелэлт ── */}
      <div style={headingStyle}>V. ҮҮРЭГ ДААЛГАВАРЫН БИЕЛЭЛТ</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Ажлын төрөл", "Хийгдсэн ажил"].map((h) => (
              <th key={h} style={{ border: "1px dashed #888", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section5Tasks.length === 0 ? (
            <tr>{[5,35,60].map((w,i) => <td key={i} style={{ border: "1px dashed #aaa", padding: "3px 5px", width: `${w}%` }}>&nbsp;</td>)}</tr>
          ) : (
            section5Tasks.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "5%" }}>{idx + 1}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "35%" }}>{t.taskType}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "60%" }}>{t.completedWork}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section VI: Хамт олны ажил ── */}
      <div style={headingStyle}>VI. ХАМТ ОЛНЫ АЖИЛ</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10pt", fontFamily: "'Times New Roman', serif", border: "2px solid #000" }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            {["№", "Огноо", "Хамт олны ажил", "Санаачилга"].map((h) => (
              <th key={h} style={{ border: "1px dashed #888", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section6Activities.length === 0 ? (
            <tr>{[5,20,50,25].map((w,i) => <td key={i} style={{ border: "1px dashed #aaa", padding: "3px 5px", width: `${w}%` }}>&nbsp;</td>)}</tr>
          ) : (
            section6Activities.map((t, idx) => (
              <tr key={t._id}>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "5%" }}>{idx + 1}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", textAlign: "center", width: "20%" }}>{t.date}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "50%" }}>{t.activity}</td>
                <td style={{ border: "1px dashed #aaa", padding: "3px 5px", width: "25%" }}>{t.initiative}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Section VII: Шинэ санал санаачилга ── */}
      <div style={headingStyle}>VII. ШИНЭ САНАЛ САНААЧИЛГА</div>
      {section7Text?.trim() ? (
        <div style={{ marginBottom: "8pt", whiteSpace: "pre-wrap" }}>{section7Text}</div>
      ) : (
        <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
      )}

      {/* ── Dynamic sections VIII, IX, … ── */}
      {dynamicSections.map((sec, idx) => (
        <div key={sec._id}>
          <div style={headingStyle}>
            {ROMAN_NUMS[dynStartRomIdx + idx] ?? `${dynStartRomIdx + idx + 1}`}. {(sec.title ?? "").toUpperCase()}
          </div>
          {parseContent(sec.content, tableCounter)}
        </div>
      ))}

      {/* Зургийн хавсралт */}
      {images.length > 0 && (
        <>
          <div style={headingStyle}>
            {ROMAN_NUMS[dynStartRomIdx + dynamicSections.length] ?? `${dynStartRomIdx + dynamicSections.length + 1}`}. ЗУРГИЙН ХАВСРАЛТ
          </div>
          {images.map((img, idx) => (
            <div
              key={img.id}
              style={{ marginBottom: "14pt", textAlign: "center", pageBreakInside: "avoid" }}
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

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function TailanMinePage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([
    {
      _id: uid(),
      order: 1,
      title: "",
      completion: 100,
      startDate: "",
      endDate: "",
      description: "",
    },
  ]);
  const [dynamicSections, setDynamicSections] = useState<DynSection[]>([
    { _id: uid(), order: 2, title: "Ажлын агуулга", content: "" },
  ]);
  const [section2Tasks, setSection2Tasks] = useState<Section2Task[]>([
    { _id: uid(), order: 1, title: "", result: "", period: "", completion: "" },
  ]);
  const [section3AutoTasks, setSection3AutoTasks] = useState<Section3AutoTask[]>([
    { _id: uid(), order: 1, title: "", value: "", rating: "" },
  ]);
  const [section3Dashboards, setSection3Dashboards] = useState<Section3Dashboard[]>([
    { _id: uid(), order: 1, dashboard: "", value: "", rating: "" },
  ]);
  const [section4Trainings, setSection4Trainings] = useState<Section4Training[]>([
    { _id: uid(), order: 1, training: "", organizer: "", type: "", date: "", format: "", hours: "", meetsAuditGoal: "", sharedKnowledge: "" },
  ]);
  const [section4KnowledgeText, setSection4KnowledgeText] = useState("");
  const [section5Tasks, setSection5Tasks] = useState<Section5Task[]>([
    { _id: uid(), order: 1, taskType: "", completedWork: "" },
  ]);
  const [section6Activities, setSection6Activities] = useState<Section6Activity[]>([
    { _id: uid(), order: 1, date: "", activity: "", initiative: "" },
  ]);
  const [section7Text, setSection7Text] = useState("");

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [cyrillicName, setCyrillicName] = useState<string>("");

  // Images
  const [images, setImages] = useState<TailanImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  // Load existing report
  useEffect(() => {
    tailanApi
      .getMyReport(year, quarter)
      .then((r) => {
        if (!r) return;
        if (r.plannedTasks?.length)
          setPlannedTasks(
            r.plannedTasks.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.dynamicSections?.length)
          setDynamicSections(
            r.dynamicSections.map((s: any) => ({ ...s, _id: uid() })),
          );
        if (r.section2Tasks?.length)
          setSection2Tasks(r.section2Tasks.map((t: any) => ({ ...t, _id: uid() })));
        if (r.section3AutoTasks?.length)
          setSection3AutoTasks(r.section3AutoTasks.map((t: any) => ({ ...t, _id: uid() })));
        if (r.section3Dashboards?.length)
          setSection3Dashboards(r.section3Dashboards.map((t: any) => ({ ...t, _id: uid() })));
        if (r.section4Trainings?.length)
          setSection4Trainings(r.section4Trainings.map((t: any) => ({ ...t, _id: uid() })));
        if (r.section4KnowledgeText) setSection4KnowledgeText(r.section4KnowledgeText);
        if (r.section5Tasks?.length)
          setSection5Tasks(r.section5Tasks.map((t: any) => ({ ...t, _id: uid() })));
        if (r.section6Activities?.length)
          setSection6Activities(r.section6Activities.map((t: any) => ({ ...t, _id: uid() })));
        if (r.section7Text) setSection7Text(r.section7Text);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    loadImages();
  }, [year, quarter]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      setImages((prev) => {
        prev.forEach((img) => {
          if (img.blobUrl) URL.revokeObjectURL(img.blobUrl);
        });
        return prev;
      });
    };
  }, []);

  const loadImages = async () => {
    try {
      const list = await tailanApi.getImages(year, quarter);
      const withUrls: TailanImage[] = await Promise.all(
        list.map(async (img) => {
          try {
            const blobUrl = await tailanApi.fetchImageDataUrl(img.id);
            return { ...img, blobUrl };
          } catch {
            return img;
          }
        }),
      );
      setImages(withUrls);
    } catch {}
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const saved = await tailanApi.uploadImage(year, quarter, file);
      const blobUrl = URL.createObjectURL(file);
      setImages((prev) => [
        ...prev,
        {
          id: saved.id,
          filename: file.name,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
          blobUrl,
        },
      ]);
    } catch {
    } finally {
      setUploading(false);
      if (imgFileRef.current) imgFileRef.current.value = "";
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      await tailanApi.deleteImage(id);
      setImages((prev) => {
        const img = prev.find((i) => i.id === id);
        if (img?.blobUrl) URL.revokeObjectURL(img.blobUrl);
        return prev.filter((i) => i.id !== id);
      });
    } catch {}
  };

  const toDto = () => ({
    year,
    quarter,
    plannedTasks: plannedTasks.map(({ _id, ...t }) => t),
    dynamicSections: dynamicSections.map(({ _id, ...s }) => s),
    section2Tasks: section2Tasks.map(({ _id, ...t }) => t),
    section3AutoTasks: section3AutoTasks.map(({ _id, ...t }) => t),
    section3Dashboards: section3Dashboards.map(({ _id, ...t }) => t),
    section4Trainings: section4Trainings.map(({ _id, ...t }) => t),
    section4KnowledgeText,
    section5Tasks: section5Tasks.map(({ _id, ...t }) => t),
    section6Activities: section6Activities.map(({ _id, ...t }) => t),
    section7Text,
    otherWork: "",
    teamActivities: [],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await tailanApi.saveDraft({ ...toDto(), status: "draft" });
      setSavedMsg("Хадгаллаа ✓");
      setTimeout(() => setSavedMsg(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm("Тайланг хэлтсийн ахлагч руу илгээх үү?")) return;
    setSubmitting(true);
    try {
      await tailanApi.saveDraft({ ...toDto(), status: "submitted" });
      await tailanApi.submitReport(year, quarter);
      setSavedMsg("Илгээгдлээ ✓");
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await tailanApi.downloadMyWord(
        year,
        quarter,
        cyrillicName.trim() || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Тайлан-${cyrillicName.trim() || (user?.name ?? "mine")}-${year}-Q${quarter}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // ─── Planned tasks ──────────────────────────────────────────────────────
  const addTask = () =>
    setPlannedTasks((prev) => [
      ...prev,
      {
        _id: uid(),
        order: prev.length + 1,
        title: "",
        completion: 100,
        startDate: "",
        endDate: "",
        description: "",
      },
    ]);

  const removeTask = (id: string) =>
    setPlannedTasks((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );

  const updateTask = (id: string, field: keyof PlannedTask, value: any) =>
    setPlannedTasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // ─── Section 2 tasks ───────────────────────────────────────────────────
  const addSection2Task = () =>
    setSection2Tasks((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, title: "", result: "", period: "", completion: "" },
    ]);
  const removeSection2Task = (id: string) =>
    setSection2Tasks((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection2Task = (id: string, field: keyof Section2Task, value: any) =>
    setSection2Tasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ─── Section 3 auto tasks ──────────────────────────────────────────────
  const addSection3AutoTask = () =>
    setSection3AutoTasks((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, title: "", value: "", rating: "" },
    ]);
  const removeSection3AutoTask = (id: string) =>
    setSection3AutoTasks((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection3AutoTask = (id: string, field: keyof Section3AutoTask, value: any) =>
    setSection3AutoTasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ─── Section 3 dashboards ──────────────────────────────────────────────
  const addSection3Dashboard = () =>
    setSection3Dashboards((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, dashboard: "", value: "", rating: "" },
    ]);
  const removeSection3Dashboard = (id: string) =>
    setSection3Dashboards((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection3Dashboard = (id: string, field: keyof Section3Dashboard, value: any) =>
    setSection3Dashboards((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ─── Section 4 trainings ───────────────────────────────────────────────
  const addSection4Training = () =>
    setSection4Trainings((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, training: "", organizer: "", type: "", date: "", format: "", hours: "", meetsAuditGoal: "", sharedKnowledge: "" },
    ]);
  const removeSection4Training = (id: string) =>
    setSection4Trainings((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection4Training = (id: string, field: keyof Section4Training, value: any) =>
    setSection4Trainings((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ─── Section 5 tasks ───────────────────────────────────────────────────
  const addSection5Task = () =>
    setSection5Tasks((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, taskType: "", completedWork: "" },
    ]);
  const removeSection5Task = (id: string) =>
    setSection5Tasks((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection5Task = (id: string, field: keyof Section5Task, value: any) =>
    setSection5Tasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ─── Section 6 activities ──────────────────────────────────────────────
  const addSection6Activity = () =>
    setSection6Activities((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, date: "", activity: "", initiative: "" },
    ]);
  const removeSection6Activity = (id: string) =>
    setSection6Activities((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection6Activity = (id: string, field: keyof Section6Activity, value: any) =>
    setSection6Activities((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ─── Dynamic sections ───────────────────────────────────────────────────
  const addSection = () =>
    setDynamicSections((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 2, title: "Шинэ хэсэг", content: "" },
    ]);

  const removeSection = (id: string) =>
    setDynamicSections((prev) =>
      prev.filter((s) => s._id !== id).map((s, i) => ({ ...s, order: i + 2 })),
    );

  const updateSection = (id: string, field: keyof DynSection, value: any) =>
    setDynamicSections((prev) =>
      prev.map((s) => (s._id === id ? { ...s, [field]: value } : s)),
    );

  const inputCls =
    "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* ─── LEFT: Editor ─── */}
      <div className="flex flex-col w-1/2 border-r border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href="/tools/tailan"
              className="text-slate-400 hover:text-white transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="font-semibold text-white text-sm">
              Өөрийн тайлан
            </span>
          </div>

          <div className="flex items-center gap-2">
            {savedMsg && (
              <span className="text-emerald-400 text-xs flex items-center gap-1">
                <Check className="h-3 w-3" /> {savedMsg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Хадгалах
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Word татах
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Илгээх
            </button>
          </div>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Year & Quarter & Name */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className={labelCls}>Нэр (кириллицээр)</label>
              <input
                value={cyrillicName}
                onChange={(e) => setCyrillicName(e.target.value)}
                placeholder="Жшээ овогтойгоо бичнэ"
                className={inputCls}
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className={labelCls}>Он</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={inputCls}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Улирал</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className={inputCls}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {q}-р улирал
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 1: Planned tasks */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                1. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын
                ажил
              </h3>
              <button
                onClick={addTask}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Мөр нэмэх
              </button>
            </div>

            <div className="space-y-3">
              {plannedTasks.map((t, idx) => (
                <div
                  key={t._id}
                  className="bg-slate-700/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      #{t.order}
                    </span>
                    <button
                      onClick={() => removeTask(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>Ажлын нэр</label>
                      <input
                        value={t.title}
                        onChange={(e) =>
                          updateTask(t._id, "title", e.target.value)
                        }
                        placeholder="Ажлын нэр..."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Гүйцэтгэл %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={t.completion}
                        onChange={(e) =>
                          updateTask(
                            t._id,
                            "completion",
                            Number(e.target.value),
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Эхлэх огноо</label>
                      <input
                        value={t.startDate}
                        onChange={(e) =>
                          updateTask(t._id, "startDate", e.target.value)
                        }
                        placeholder="2025.10.01"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Дуусах огноо</label>
                      <input
                        value={t.endDate}
                        onChange={(e) =>
                          updateTask(t._id, "endDate", e.target.value)
                        }
                        placeholder="2025.12.31"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Гүйцэтгэл /товч/</label>
                      <textarea
                        value={t.description}
                        onChange={(e) =>
                          updateTask(t._id, "description", e.target.value)
                        }
                        placeholder="Гүйцэтгэлийн товч тайлбар..."
                        rows={2}
                        className={inputCls + " resize-none"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section II: Өгөгдөл боловсруулах ажил */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                II. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулах ажил
              </h3>
              <button
                onClick={addSection2Task}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Мөр нэмэх
              </button>
            </div>
            <div className="space-y-2">
              {section2Tasks.map((t) => (
                <div key={t._id} className="bg-slate-700/30 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">{t.order}</span>
                    <input
                      value={t.title}
                      onChange={(e) => updateSection2Task(t._id, "title", e.target.value)}
                      placeholder="Төлөвлөгөөт ажлын нэр..."
                      className={inputCls + " flex-1"}
                    />
                    <button onClick={() => removeSection2Task(t._id)} className="text-red-400/70 hover:text-red-400 transition shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pl-6">
                    <input
                      value={t.result}
                      onChange={(e) => updateSection2Task(t._id, "result", e.target.value)}
                      placeholder="Ажлын гүйцэтгэл..."
                      className={inputCls}
                    />
                    <input
                      value={t.period}
                      onChange={(e) => updateSection2Task(t._id, "period", e.target.value)}
                      placeholder="Хийгдсэн хугацаа..."
                      className={inputCls}
                    />
                    <input
                      value={t.completion}
                      onChange={(e) => updateSection2Task(t._id, "completion", e.target.value)}
                      placeholder="Гүйцэтгэл..."
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section III: Тогтмол хийгддэг ажлууд */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              III. Тогтмол хийгддэг ажлууд
            </h3>

            {/* III.1 – Автоматжуулалт */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-300">
                  III.1 Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал
                </p>
                <button
                  onClick={addSection3AutoTask}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Мөр
                </button>
              </div>
              <div className="space-y-2">
                {section3AutoTasks.map((t) => (
                  <div key={t._id} className="bg-slate-700/30 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 w-5 shrink-0 text-center">{t.order}</span>
                      <input
                        value={t.title}
                        onChange={(e) => updateSection3AutoTask(t._id, "title", e.target.value)}
                        placeholder="Тогтмол хийгддэг автоматжуулалт..."
                        className={inputCls + " flex-1"}
                      />
                      <button onClick={() => removeSection3AutoTask(t._id)} className="text-red-400/70 hover:text-red-400 transition shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pl-6">
                      <input
                        value={t.value}
                        onChange={(e) => updateSection3AutoTask(t._id, "value", e.target.value)}
                        placeholder="Ач холбогдол/хэрэглээ..."
                        className={inputCls}
                      />
                      <input
                        value={t.rating}
                        onChange={(e) => updateSection3AutoTask(t._id, "rating", e.target.value)}
                        placeholder="Хэрэглэгчийн үнэлгээ..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* III.2 – Dashboard */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-300">
                  III.2 Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал
                </p>
                <button
                  onClick={addSection3Dashboard}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Мөр
                </button>
              </div>
              <div className="space-y-2">
                {section3Dashboards.map((t) => (
                  <div key={t._id} className="bg-slate-700/30 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 w-5 shrink-0 text-center">{t.order}</span>
                      <input
                        value={t.dashboard}
                        onChange={(e) => updateSection3Dashboard(t._id, "dashboard", e.target.value)}
                        placeholder="Dashboard нэр..."
                        className={inputCls + " flex-1"}
                      />
                      <button onClick={() => removeSection3Dashboard(t._id)} className="text-red-400/70 hover:text-red-400 transition shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pl-6">
                      <input
                        value={t.value}
                        onChange={(e) => updateSection3Dashboard(t._id, "value", e.target.value)}
                        placeholder="Ач холбогдол/хэрэглээ..."
                        className={inputCls}
                      />
                      <input
                        value={t.rating}
                        onChange={(e) => updateSection3Dashboard(t._id, "rating", e.target.value)}
                        placeholder="Хэрэглэгч нэгжийн үнэлгээ..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Dynamic sections */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                Том хэсгүүд (VIII, IX, …)
              </h3>
              <button
                onClick={addSection}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Том хэсэг нэмэх
              </button>
            </div>
            <div className="space-y-3">
              {dynamicSections.map((sec, idx) => (
                <div
                  key={sec._id}
                  className="bg-slate-700/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium w-8 shrink-0">
                      {ROMAN_NUMS[idx + 7] ?? `${idx + 8}`}.
                    </span>
                    <input
                      value={sec.title}
                      onChange={(e) =>
                        updateSection(sec._id, "title", e.target.value)
                      }
                      className={inputCls + " flex-1"}
                      placeholder="Хэсгийн гарчиг..."
                    />
                    <button
                      onClick={() => removeSection(sec._id)}
                      className="text-red-400/70 hover:text-red-400 transition flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <RichToolbar
                    value={sec.content}
                    onChange={(v) => updateSection(sec._id, "content", v)}
                    rows={4}
                    placeholder="Хэсгийн агуулга..."
                    className={inputCls + " resize-y"}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Section IV: Хамрагдсан сургалт */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">IV. Хамрагдсан сургалт</h3>
              <button onClick={addSection4Training} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition">
                <Plus className="h-3.5 w-3.5" /> Мөр нэмэх
              </button>
            </div>
            <div className="space-y-2">
              {section4Trainings.map((t) => (
                <div key={t._id} className="bg-slate-700/30 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">{t.order}</span>
                    <input value={t.training} onChange={(e) => updateSection4Training(t._id, "training", e.target.value)} placeholder="Сургалтын нэр..." className={inputCls + " flex-1"} />
                    <button onClick={() => removeSection4Training(t._id)} className="text-red-400/70 hover:text-red-400 transition shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pl-6">
                    <input value={t.organizer} onChange={(e) => updateSection4Training(t._id, "organizer", e.target.value)} placeholder="Зохион байгуулагч" className={inputCls} />
                    <input value={t.type} onChange={(e) => updateSection4Training(t._id, "type", e.target.value)} placeholder="Онлайн / Танхим" className={inputCls} />
                    <input value={t.date} onChange={(e) => updateSection4Training(t._id, "date", e.target.value)} placeholder="Хэзээ (огноо)" className={inputCls} />
                    <input value={t.format} onChange={(e) => updateSection4Training(t._id, "format", e.target.value)} placeholder="Сургалтын хэлбэр" className={inputCls} />
                    <input value={t.hours} onChange={(e) => updateSection4Training(t._id, "hours", e.target.value)} placeholder="Цаг" className={inputCls} />
                    <input value={t.meetsAuditGoal} onChange={(e) => updateSection4Training(t._id, "meetsAuditGoal", e.target.value)} placeholder="Нийцсэн / Нийцээгүй" className={inputCls} />
                    <input value={t.sharedKnowledge} onChange={(e) => updateSection4Training(t._id, "sharedKnowledge", e.target.value)} placeholder="Хуваалцсан / Хуваалцаагүй" className={inputCls + " col-span-2"} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-300 mb-1">IV.1 Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал</p>
              <RichToolbar value={section4KnowledgeText} onChange={setSection4KnowledgeText} rows={3} placeholder="Мэдлэгээ ашиглаж буй байдлаа тайлбарлана уу..." className={inputCls + " resize-y"} />
            </div>
          </section>

          {/* Section V: Үүрэг даалгаварын биелэлт */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">V. Үүрэг даалгаварын биелэлт</h3>
              <button onClick={addSection5Task} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition">
                <Plus className="h-3.5 w-3.5" /> Мөр нэмэх
              </button>
            </div>
            <div className="space-y-2">
              {section5Tasks.map((t) => (
                <div key={t._id} className="bg-slate-700/30 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">{t.order}</span>
                    <input value={t.taskType} onChange={(e) => updateSection5Task(t._id, "taskType", e.target.value)} placeholder="Ажлын төрөл..." className={inputCls + " flex-1"} />
                    <button onClick={() => removeSection5Task(t._id)} className="text-red-400/70 hover:text-red-400 transition shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="pl-6">
                    <textarea value={t.completedWork} onChange={(e) => updateSection5Task(t._id, "completedWork", e.target.value)} placeholder="Хийгдсэн ажил..." rows={2} className={inputCls + " resize-none"} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section VI: Хамт олны ажил */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">VI. Хамт олны ажил</h3>
              <button onClick={addSection6Activity} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition">
                <Plus className="h-3.5 w-3.5" /> Мөр нэмэх
              </button>
            </div>
            <div className="space-y-2">
              {section6Activities.map((t) => (
                <div key={t._id} className="bg-slate-700/30 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">{t.order}</span>
                    <input value={t.activity} onChange={(e) => updateSection6Activity(t._id, "activity", e.target.value)} placeholder="Хамт олны ажил..." className={inputCls + " flex-1"} />
                    <button onClick={() => removeSection6Activity(t._id)} className="text-red-400/70 hover:text-red-400 transition shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pl-6">
                    <input value={t.date} onChange={(e) => updateSection6Activity(t._id, "date", e.target.value)} placeholder="Огноо" className={inputCls} />
                    <input value={t.initiative} onChange={(e) => updateSection6Activity(t._id, "initiative", e.target.value)} placeholder="Санаачилга" className={inputCls} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section VII: Шинэ санал санаачилга */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">VII. Шинэ санал санаачилга</h3>
            <RichToolbar value={section7Text} onChange={setSection7Text} rows={4} placeholder="Санал санаачилгаа энд бичнэ үү..." className={inputCls + " resize-y"} />
          </section>

          {/* Зурагнуудaa */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-slate-400" />
                Зурагнуудaa
              </h3>
              <button
                onClick={() => imgFileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Зураг нэмэх
              </button>
              <input
                ref={imgFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
            {images.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Зураг байхгүй байна
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-lg overflow-hidden bg-slate-700/40 aspect-square"
                  >
                    {img.blobUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.blobUrl}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-slate-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-white truncate px-1.5 py-0.5">
                      {img.filename}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ─── RIGHT: Live Word Preview ─── */}
      <div className="flex flex-col w-1/2 bg-slate-600 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-500/50 text-xs font-medium text-slate-300 flex items-center gap-2 flex-shrink-0 bg-slate-700/50">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Realtime preview — Word баримт
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          <WordPreview
            userName={mounted ? cyrillicName.trim() || (user?.name ?? "") : ""}
            userPosition={user?.position}
            userDepartment={user?.department}
            year={year}
            quarter={quarter}
            plannedTasks={plannedTasks}
            section2Tasks={section2Tasks}
            section3AutoTasks={section3AutoTasks}
            section3Dashboards={section3Dashboards}
            dynamicSections={dynamicSections}
            section4Trainings={section4Trainings}
            section4KnowledgeText={section4KnowledgeText}
            section5Tasks={section5Tasks}
            section6Activities={section6Activities}
            section7Text={section7Text}
            images={images}
          />
        </div>
      </div>
    </div>
  );
}
