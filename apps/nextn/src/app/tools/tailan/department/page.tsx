"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { tailanApi } from "@/lib/api";
import {
  ChevronLeft,
  Download,
  Users,
  Loader2,
  Check,
  Clock,
  Trash2,
  Eye,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportRow {
  id: string;
  userId: string;
  userName: string;
  status: string;
  updatedAt: string;
}
interface MergedTask {
  _id: string;
  memberName: string;
  order: number;
  title: string;
  completion: number;
  startDate: string;
  endDate: string;
  description: string;
}
interface MergedSection {
  _id: string;
  title: string;
  entries: { _id: string; memberName: string; content: string }[];
}
interface OtherEntry {
  _id: string;
  memberName: string;
  content: string;
}
interface Activity {
  _id: string;
  memberName: string;
  name: string;
  date: string;
}

const uid = () => Math.random().toString(36).slice(2);
const getCurrentYear = () => new Date().getFullYear();
const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);
const qNames = ["I", "II", "III", "IV"];

interface DeptImage {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  blobUrl?: string;
}

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
  rows = 3,
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

// ─── Word-style Preview ───────────────────────────────────────────────────────
function DeptWordPreview({
  year,
  quarter,
  tasks,
  sections,
  otherEntries,
  activities,
  images,
}: {
  year: number;
  quarter: number;
  tasks: MergedTask[];
  sections: MergedSection[];
  otherEntries: OtherEntry[];
  activities: Activity[];
  images: DeptImage[];
}) {
  const qName = qNames[(quarter - 1) % 4];
  let secNum = 2;
  const validOther = otherEntries.filter((e) => e.content.trim());
  const tableCounter = { n: 1 };
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
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "13pt",
          marginBottom: "18pt",
        }}
      >
        ХЭЛТСИЙН НЭГТГЭЛ: {year} ОНЫ {qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН
      </div>
      {tasks.length > 0 && (
        <>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginTop: "14pt",
              marginBottom: "6pt",
            }}
          >
            1. Ажлын гүйцэтгэлийн хүснэгт
          </div>
          <div
            style={{
              fontSize: "9pt",
              fontStyle: "italic",
              marginBottom: "2pt",
            }}
          >
            Хүснэгт 1.
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9pt",
              marginBottom: "10pt",
            }}
          >
            <thead>
              <tr style={{ background: "#1F3864", color: "#fff" }}>
                {[
                  "№",
                  "Нэр",
                  "Төлөвлөгөөт ажил",
                  "Гүйц %",
                  "Эхлэх",
                  "Дуусах",
                  "Гүйцэтгэл /товч/",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      border: "1px solid #888",
                      padding: "4px 5px",
                      textAlign: "center",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t._id}>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 4px",
                      textAlign: "center",
                      width: "4%",
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 4px",
                      width: "11%",
                    }}
                  >
                    {t.memberName}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 4px",
                      width: "23%",
                    }}
                  >
                    {t.title}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 4px",
                      textAlign: "center",
                      width: "8%",
                    }}
                  >
                    {t.completion}%
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 4px",
                      textAlign: "center",
                      width: "11%",
                    }}
                  >
                    {t.startDate}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 4px",
                      textAlign: "center",
                      width: "11%",
                    }}
                  >
                    {t.endDate}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 4px",
                      width: "32%",
                    }}
                  >
                    {t.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {sections.map((sec) => {
        const n = secNum++;
        return (
          <div key={sec._id}>
            <div
              style={{
                fontWeight: "bold",
                fontSize: "12pt",
                marginTop: "14pt",
                marginBottom: "6pt",
              }}
            >
              {n}. {sec.title}
            </div>
            {sec.entries.map((e) => (
              <div key={e._id} style={{ marginBottom: "8pt" }}>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "10.5pt",
                    color: "#000",
                    marginBottom: "2pt",
                  }}
                >
                  {e.memberName}
                </div>
                {parseContent(e.content, tableCounter)}
              </div>
            ))}
          </div>
        );
      })}
      {validOther.length > 0 && (
        <div>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginTop: "14pt",
              marginBottom: "6pt",
            }}
          >
            {secNum++}. Бусад ажлууд
          </div>
          {validOther.map((e) => (
            <div key={e._id} style={{ marginBottom: "8pt" }}>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "10.5pt",
                  color: "#000",
                  marginBottom: "2pt",
                }}
              >
                {e.memberName}
              </div>
              {e.content.split("\n").map((l, i) => (
                <div
                  key={i}
                  style={{ textAlign: "justify", marginBottom: "3pt" }}
                >
                  {l || "\u00A0"}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {activities.length > 0 && (
        <div>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginTop: "14pt",
              marginBottom: "6pt",
            }}
          >
            {secNum}. Хамт олны ажил
          </div>
          {activities.map((a) => (
            <div
              key={a._id}
              style={{ marginLeft: "18pt", marginBottom: "3pt" }}
            >
              <span style={{ fontWeight: "bold" }}>{a.memberName}:</span>{" "}
              {a.name}
              {a.date ? ` – ${a.date}` : ""}
            </div>
          ))}
        </div>
      )}

      {/* Зургийн хавсралт */}
      {images.length > 0 && (
        <>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginTop: "14pt",
              marginBottom: "6pt",
            }}
          >
            {secNum + 1}. Зургийн хавсралт
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
                  style={{
                    maxWidth: "100%",
                    maxHeight: "200pt",
                    objectFit: "contain",
                  }}
                />
              )}
              <div
                style={{
                  fontSize: "9pt",
                  fontStyle: "italic",
                  marginTop: "4pt",
                }}
              >
                Зураг {idx + 1}. {img.filename}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TailanDepartmentPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);
  const [overview, setOverview] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [tasks, setTasks] = useState<MergedTask[]>([]);
  const [sections, setSections] = useState<MergedSection[]>([]);
  const [otherEntries, setOtherEntries] = useState<OtherEntry[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Images
  const [deptImages, setDeptImages] = useState<DeptImage[]>([]);
  const [deptUploading, setDeptUploading] = useState(false);
  const deptImgFileRef = useRef<HTMLInputElement>(null);

  const mergeReports = (sub: any[]) => {
    setTasks(
      sub.flatMap((r) =>
        (r.plannedTasks ?? []).map((t: any) => ({
          _id: uid(),
          memberName: r.userName,
          order: t.order ?? 1,
          title: t.title ?? "",
          completion: t.completion ?? 0,
          startDate: t.startDate ?? "",
          endDate: t.endDate ?? "",
          description: t.description ?? "",
        })),
      ),
    );
    const secMap = new Map<string, MergedSection>();
    for (const r of sub) {
      for (const s of r.dynamicSections ?? []) {
        if (!secMap.has(s.title))
          secMap.set(s.title, { _id: uid(), title: s.title, entries: [] });
        secMap.get(s.title)!.entries.push({
          _id: uid(),
          memberName: r.userName,
          content: s.content ?? "",
        });
      }
    }
    setSections(Array.from(secMap.values()));
    setOtherEntries(
      sub
        .filter((r) => r.otherWork?.trim())
        .map((r) => ({
          _id: uid(),
          memberName: r.userName,
          content: r.otherWork,
        })),
    );
    setActivities(
      sub.flatMap((r) =>
        (r.teamActivities ?? []).map((a: any) => ({
          _id: uid(),
          memberName: r.userName,
          name: a.name ?? "",
          date: a.date ?? "",
        })),
      ),
    );
  };

  const load = async () => {
    setLoading(true);
    try {
      const [ov, sub] = await Promise.all([
        tailanApi.getDeptOverview(year, quarter),
        tailanApi.getDeptReports(year, quarter),
      ]);
      setOverview(ov);
      mergeReports(sub);
    } catch (e: any) {
      if (e?.response?.status === 403) router.push("/tools/tailan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadDeptImages();
  }, [year, quarter]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      setDeptImages((prev) => {
        prev.forEach((img) => {
          if (img.blobUrl) URL.revokeObjectURL(img.blobUrl);
        });
        return prev;
      });
    };
  }, []);

  const loadDeptImages = async () => {
    try {
      const list = await tailanApi.getDeptImages(year, quarter);
      const withUrls: DeptImage[] = await Promise.all(
        list.map(async (img) => {
          try {
            const blobUrl = await tailanApi.fetchImageDataUrl(img.id);
            return { ...img, blobUrl };
          } catch {
            return img;
          }
        }),
      );
      setDeptImages(withUrls);
    } catch {}
  };

  const handleDeptImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeptUploading(true);
    try {
      const saved = await tailanApi.uploadImage(year, quarter, file);
      const blobUrl = URL.createObjectURL(file);
      setDeptImages((prev) => [
        ...prev,
        {
          id: saved.id,
          userId: "",
          filename: file.name,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
          blobUrl,
        },
      ]);
    } catch {
    } finally {
      setDeptUploading(false);
      if (deptImgFileRef.current) deptImgFileRef.current.value = "";
    }
  };

  const handleDeleteDeptImage = async (id: string) => {
    try {
      await tailanApi.deleteImage(id);
      setDeptImages((prev) => {
        const img = prev.find((i) => i.id === id);
        if (img?.blobUrl) URL.revokeObjectURL(img.blobUrl);
        return prev.filter((i) => i.id !== id);
      });
    } catch {}
  };

  const toPayload = () => ({
    year,
    quarter,
    tasks: tasks.map(({ _id, ...t }) => t),
    sections: sections.map(({ _id, ...s }) => ({
      ...s,
      entries: s.entries.map(({ _id: _, ...e }) => e),
    })),
    otherEntries: otherEntries.map(({ _id, ...e }) => e),
    activities: activities.map(({ _id, ...a }) => a),
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await tailanApi.generateDeptWord(toPayload());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Хэлтсийн-тайлан-${year}-Q${quarter}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setSavedMsg("Татагдлаа ✓");
      setTimeout(() => setSavedMsg(""), 2500);
    } finally {
      setDownloading(false);
    }
  };

  const updateTask = (id: string, f: keyof MergedTask, v: any) =>
    setTasks((p) => p.map((t) => (t._id === id ? { ...t, [f]: v } : t)));
  const removeTask = (id: string) =>
    setTasks((p) => p.filter((t) => t._id !== id));
  const updateSectionTitle = (id: string, v: string) =>
    setSections((p) => p.map((s) => (s._id === id ? { ...s, title: v } : s)));
  const updateEntry = (sid: string, eid: string, v: string) =>
    setSections((p) =>
      p.map((s) =>
        s._id === sid
          ? {
              ...s,
              entries: s.entries.map((e) =>
                e._id === eid ? { ...e, content: v } : e,
              ),
            }
          : s,
      ),
    );
  const removeSection = (id: string) =>
    setSections((p) => p.filter((s) => s._id !== id));
  const updateOther = (id: string, v: string) =>
    setOtherEntries((p) =>
      p.map((e) => (e._id === id ? { ...e, content: v } : e)),
    );
  const updateActivity = (id: string, f: keyof Activity, v: string) =>
    setActivities((p) => p.map((a) => (a._id === id ? { ...a, [f]: v } : a)));
  const removeActivity = (id: string) =>
    setActivities((p) => p.filter((a) => a._id !== id));

  const inputCls =
    "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";
  const submittedCount = overview.filter(
    (r) => r.status === "submitted",
  ).length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* ─── LEFT: Editor ─────────────────────────────────────────── */}
      <div className="flex flex-col w-1/2 border-r border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-slate-900/90 backdrop-blur border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/tools/tailan"
              className="text-slate-400 hover:text-white transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-semibold text-white text-sm">
                Хэлтсийн тайлан
              </h1>
              <p className="text-xs text-slate-400">
                Нэгтгэсэн тайлан засварлагч
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  {q}-р улирал
                </option>
              ))}
            </select>
            <button
              onClick={handleDownload}
              disabled={downloading || tasks.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Татах
            </button>
            {savedMsg && (
              <span className="text-xs text-emerald-400">{savedMsg}</span>
            )}
          </div>
        </div>

        {/* Scrollable editor body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-white">
                {overview.length}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Нийт ажилтан</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-emerald-400">
                {submittedCount}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Илгээсэн</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-amber-400">
                {overview.length - submittedCount}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Хүлээгдэж буй</div>
            </div>
          </div>

          {/* Member status list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : (
            overview.length > 0 && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-700/50 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-white">
                    {year} он — {qNames[quarter - 1]}-р улирлын ажилтнууд
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-4 py-2 text-slate-400 font-medium">
                        Ажилтан
                      </th>
                      <th className="text-left px-4 py-2 text-slate-400 font-medium">
                        Статус
                      </th>
                      <th className="px-4 py-2 text-slate-400 font-medium text-right">
                        Шинэчлэгдсэн
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition"
                      >
                        <td className="px-4 py-2 text-white font-medium">
                          {row.userName}
                        </td>
                        <td className="px-4 py-2">
                          {row.status === "submitted" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <Check className="h-2.5 w-2.5" /> Илгээсэн
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              <Clock className="h-2.5 w-2.5" /> Хүлээгдэж буй
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-400 text-right">
                          {row.updatedAt
                            ? new Date(row.updatedAt).toLocaleDateString(
                                "mn-MN",
                              )
                            : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Section 1: Planned Tasks ── */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                1. Аудитын үйл ажиллагааны ажлууд
              </span>
              <button
                onClick={() =>
                  setTasks((p) => [
                    ...p,
                    {
                      _id: uid(),
                      memberName: "",
                      order: p.length + 1,
                      title: "",
                      completion: 0,
                      startDate: "",
                      endDate: "",
                      description: "",
                    },
                  ])
                }
                className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
              >
                + Нэмэх
              </button>
            </div>
            {tasks.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                Тайлан байхгүй
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {tasks.map((t) => (
                  <div
                    key={t._id}
                    className="px-4 py-3 grid grid-cols-12 gap-2 items-start"
                  >
                    <div className="col-span-1">
                      <label className={labelCls}>№</label>
                      <input
                        type="number"
                        value={t.order}
                        onChange={(e) =>
                          updateTask(t._id, "order", Number(e.target.value))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className={labelCls}>Нэр</label>
                      <input
                        type="text"
                        value={t.memberName}
                        onChange={(e) =>
                          updateTask(t._id, "memberName", e.target.value)
                        }
                        placeholder="Ажилтны нэр"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-4">
                      <label className={labelCls}>Ажил</label>
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) =>
                          updateTask(t._id, "title", e.target.value)
                        }
                        placeholder="Ажлын нэр"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelCls}>%</label>
                      <input
                        type="number"
                        value={t.completion}
                        onChange={(e) =>
                          updateTask(
                            t._id,
                            "completion",
                            Number(e.target.value),
                          )
                        }
                        className={inputCls}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelCls}>Эхлэх</label>
                      <input
                        type="text"
                        value={t.startDate}
                        onChange={(e) =>
                          updateTask(t._id, "startDate", e.target.value)
                        }
                        placeholder="MM/DD"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelCls}>Дуусах</label>
                      <input
                        type="text"
                        value={t.endDate}
                        onChange={(e) =>
                          updateTask(t._id, "endDate", e.target.value)
                        }
                        placeholder="MM/DD"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end pb-0.5">
                      <button
                        onClick={() => removeTask(t._id)}
                        className="text-rose-500 hover:text-rose-400 transition p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Dynamic Sections ── */}
          {sections.map((sec) => (
            <div
              key={sec._id}
              className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-slate-700/50 flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) => updateSectionTitle(sec._id, e.target.value)}
                  className="flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder-slate-500"
                  placeholder="Хэсгийн нэр"
                />
                <button
                  onClick={() => removeSection(sec._id)}
                  className="text-rose-500 hover:text-rose-400 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-700/30">
                {sec.entries.map((e) => (
                  <div key={e._id} className="px-4 py-3 space-y-1">
                    <label className={labelCls}>{e.memberName}</label>
                    <RichToolbar
                      value={e.content}
                      onChange={(v) => updateEntry(sec._id, e._id, v)}
                      rows={3}
                      placeholder="Агуулга..."
                      className={inputCls + " resize-y"}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* ── Бусад ажлууд ── */}
          {otherEntries.length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-700/50">
                <span className="text-xs font-semibold text-white">
                  Бусад ажлууд
                </span>
              </div>
              <div className="divide-y divide-slate-700/30">
                {otherEntries.map((e) => (
                  <div key={e._id} className="px-4 py-3 space-y-1">
                    <label className={labelCls}>{e.memberName}</label>
                    <RichToolbar
                      value={e.content}
                      onChange={(v) => updateOther(e._id, v)}
                      rows={2}
                      className={inputCls + " resize-y"}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Хамт олны ажил ── */}
          {activities.length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Хамт олны ажил
                </span>
                <button
                  onClick={() =>
                    setActivities((p) => [
                      ...p,
                      { _id: uid(), memberName: "", name: "", date: "" },
                    ])
                  }
                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  + Нэмэх
                </button>
              </div>
              <div className="divide-y divide-slate-700/30">
                {activities.map((a) => (
                  <div
                    key={a._id}
                    className="px-4 py-3 grid grid-cols-12 gap-2 items-end"
                  >
                    <div className="col-span-3">
                      <label className={labelCls}>Нэр</label>
                      <input
                        type="text"
                        value={a.memberName}
                        onChange={(e) =>
                          updateActivity(a._id, "memberName", e.target.value)
                        }
                        placeholder="Ажилтны нэр"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-6">
                      <label className={labelCls}>Үйл ажиллагаа</label>
                      <input
                        type="text"
                        value={a.name}
                        onChange={(e) =>
                          updateActivity(a._id, "name", e.target.value)
                        }
                        placeholder="Үйл ажиллагааны нэр"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Огноо</label>
                      <input
                        type="text"
                        value={a.date}
                        onChange={(e) =>
                          updateActivity(a._id, "date", e.target.value)
                        }
                        placeholder="MM/DD"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeActivity(a._id)}
                        className="text-rose-500 hover:text-rose-400 transition p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* ── Зурагнуудаа — pinned at bottom ── */}
        <div
          className="flex-shrink-0 border-t border-slate-700/50 bg-slate-900/80"
          style={{ height: "210px" }}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-white">
                Зурагнуудаа (Альбом)
              </span>
            </div>
            <button
              onClick={() => deptImgFileRef.current?.click()}
              disabled={deptUploading}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
            >
              {deptUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Зураг нэмэх
            </button>
            <input
              ref={deptImgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleDeptImageUpload}
            />
          </div>
          <div className="overflow-y-auto" style={{ height: "162px" }}>
            {deptImages.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                Зураг байхгүй байна
              </div>
            ) : (
              <div className="p-3 grid grid-cols-4 gap-2">
                {deptImages.map((img) => (
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
                        onClick={() => handleDeleteDeptImage(img.id)}
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
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Live Preview ───────────────────────────────────── */}
      <div className="flex flex-col w-1/2 bg-slate-800 overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/90">
          <Eye className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">
            Урьдчилан харах — {year} он {qNames[quarter - 1]}-р улирал
          </span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <DeptWordPreview
            year={year}
            quarter={quarter}
            tasks={tasks}
            sections={sections}
            otherEntries={otherEntries}
            activities={activities}
            images={deptImages}
          />
        </div>
      </div>
    </div>
  );
}
