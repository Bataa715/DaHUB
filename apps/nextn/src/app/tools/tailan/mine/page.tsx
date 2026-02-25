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
function WordPreview({
  userName,
  year,
  quarter,
  plannedTasks,
  dynamicSections,
  otherWork,
  teamActivities,
  images,
}: {
  userName: string;
  year: number;
  quarter: number;
  plannedTasks: PlannedTask[];
  dynamicSections: DynSection[];
  otherWork: string;
  teamActivities: TeamActivity[];
  images: TailanImage[];
}) {
  const qNames = ["I", "II", "III", "IV"];
  const qName = qNames[(quarter - 1) % 4];
  const nextNum = (dynamicSections.length ?? 0) + 2;
  // Хүснэгт 1 = planned tasks table; user pipe tables count up from 2
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
      {/* Title */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "20pt",
          fontWeight: "bold",
          fontSize: "13pt",
        }}
      >
        {userName} {year} ОНЫ {qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН
      </div>

      {/* Section 1: Planned tasks */}
      {plannedTasks.length > 0 && (
        <>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginTop: "14pt",
              marginBottom: "6pt",
            }}
          >
            1. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын ажил
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
              fontSize: "9.5pt",
              marginBottom: "10pt",
            }}
          >
            <thead>
              <tr style={{ background: "#1F3864", color: "#fff" }}>
                {[
                  "№",
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
              {plannedTasks.map((t) => (
                <tr key={t._id}>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 5px",
                      textAlign: "center",
                      width: "4%",
                    }}
                  >
                    {t.order}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 5px",
                      width: "26%",
                    }}
                  >
                    {t.title}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 5px",
                      textAlign: "center",
                      width: "8%",
                    }}
                  >
                    {t.completion}%
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 5px",
                      textAlign: "center",
                      width: "12%",
                    }}
                  >
                    {t.startDate}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 5px",
                      textAlign: "center",
                      width: "12%",
                    }}
                  >
                    {t.endDate}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "3px 5px",
                      width: "38%",
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

      {/* Dynamic sections */}
      {dynamicSections.map((sec) => (
        <div key={sec._id}>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginTop: "14pt",
              marginBottom: "6pt",
            }}
          >
            {sec.order}. {sec.title}
          </div>
          {parseContent(sec.content, tableCounter)}
        </div>
      ))}

      {/* Бусад ажлууд */}
      <div
        style={{
          fontWeight: "bold",
          fontSize: "12pt",
          marginTop: "14pt",
          marginBottom: "6pt",
        }}
      >
        {nextNum}. Бусад ажлууд
      </div>
      {parseContent(otherWork || "", tableCounter)}

      {/* Хамт олны ажил */}
      <div
        style={{
          fontWeight: "bold",
          fontSize: "12pt",
          marginTop: "14pt",
          marginBottom: "6pt",
        }}
      >
        {nextNum + 1}. Хамт олны ажил
      </div>
      {teamActivities.map((a) => (
        <div key={a._id} style={{ marginLeft: "20pt", marginBottom: "3pt" }}>
          – {a.name}
          {a.date ? ` – ${a.date}` : ""}
        </div>
      ))}

      {/* Зургийн хавсралт — auto-numbered */}
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
            {nextNum + 2}. Зургийн хавсралт
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
  const [otherWork, setOtherWork] = useState("");
  const [teamActivities, setTeamActivities] = useState<TeamActivity[]>([
    { _id: uid(), name: "", date: "" },
  ]);

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
        if (r.otherWork) setOtherWork(r.otherWork);
        if (r.teamActivities?.length)
          setTeamActivities(
            r.teamActivities.map((a: any) => ({ ...a, _id: uid() })),
          );
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
    otherWork,
    teamActivities: teamActivities.map(({ _id, ...a }) => a),
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

  // ─── Team activities ────────────────────────────────────────────────────
  const addActivity = () =>
    setTeamActivities((prev) => [...prev, { _id: uid(), name: "", date: "" }]);

  const removeActivity = (id: string) =>
    setTeamActivities((prev) => prev.filter((a) => a._id !== id));

  const updateActivity = (id: string, field: keyof TeamActivity, value: any) =>
    setTeamActivities((prev) =>
      prev.map((a) => (a._id === id ? { ...a, [field]: value } : a)),
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

          {/* Dynamic sections */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                Ажлын хэсгүүд
              </h3>
              <button
                onClick={addSection}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Хэсэг нэмэх
              </button>
            </div>
            <div className="space-y-3">
              {dynamicSections.map((sec) => (
                <div
                  key={sec._id}
                  className="bg-slate-700/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium w-5">
                      {sec.order}.
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

          {/* Бусад ажлууд */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              {dynamicSections.length + 2}. Бусад ажлууд
            </h3>
            <RichToolbar
              value={otherWork}
              onChange={setOtherWork}
              rows={4}
              placeholder="Бусад хийгдсэн ажлуудыг энд оруулна уу..."
              className={inputCls + " resize-y"}
            />
          </section>

          {/* Хамт олны ажил */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                {dynamicSections.length + 3}. Хамт олны ажил
              </h3>
              <button
                onClick={addActivity}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Нэмэх
              </button>
            </div>
            <div className="space-y-2">
              {teamActivities.map((a) => (
                <div key={a._id} className="flex gap-2 items-center">
                  <input
                    value={a.name}
                    onChange={(e) =>
                      updateActivity(a._id, "name", e.target.value)
                    }
                    placeholder="Арга хэмжээний нэр (жич: Спорт зал)"
                    className={inputCls + " flex-1"}
                  />
                  <input
                    value={a.date}
                    onChange={(e) =>
                      updateActivity(a._id, "date", e.target.value)
                    }
                    placeholder="2025.10.24"
                    className={inputCls + " w-32"}
                  />
                  <button
                    onClick={() => removeActivity(a._id)}
                    className="text-red-400/70 hover:text-red-400 transition flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
            year={year}
            quarter={quarter}
            plannedTasks={plannedTasks}
            dynamicSections={dynamicSections}
            otherWork={otherWork}
            teamActivities={teamActivities}
            images={images}
          />
        </div>
      </div>
    </div>
  );
}
