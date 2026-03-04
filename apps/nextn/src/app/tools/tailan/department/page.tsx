"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft, Download, Save,
  BarChart3, Users2, Settings, BookOpen, Award,
} from "lucide-react";
import Link from "next/link";
import { tailanApi } from "@/lib/api";

import {
  SECTION_DEFS, Q_NAMES, SectionReport,
  getCurrentYear, getCurrentQuarter,
  DEFAULT_S1_KPI, DEFAULT_S2_KPI,
  emptySection, scoreLabel,
  DashboardRow, Section2TaskRow, Section14Row,
} from "./_types";
import { SectionEditor } from "./_SectionEditor";
import { WordPreview } from "./_WordPreview";

// ─── Tab style maps ───────────────────────────────────────────────────────────

const COLOR_TAB_ACTIVE: Record<string, string> = {
  blue:    "bg-blue-500/20 border border-blue-500/40 text-blue-300",
  emerald: "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300",
  amber:   "bg-amber-500/20 border border-amber-500/40 text-amber-300",
  purple:  "bg-purple-500/20 border border-purple-500/40 text-purple-300",
};
const COLOR_ICON: Record<string, string> = {
  blue: "text-blue-400", emerald: "text-emerald-400",
  amber: "text-amber-400", purple: "text-purple-400",
};

function SectionIcon({ icon, cls }: { icon: string; cls: string }) {
  if (icon === "bar")      return <BarChart3  className={cls} />;
  if (icon === "users")    return <Users2     className={cls} />;
  if (icon === "settings") return <Settings   className={cls} />;
  if (icon === "book")     return <BookOpen   className={cls} />;
  return null;
}

// ─── Word export ──────────────────────────────────────────────────────────────

function buildWordHtml(year: number, quarter: number, sections: Record<string, SectionReport>): string {
  const qName = Q_NAMES[(quarter - 1) % 4];
  const today = new Date();
  const dateStr = `${today.getFullYear()} оны ${today.getMonth() + 1} сарын ${today.getDate()}-ны өдөр`;
  const td0 = "border:0.5px solid #000;padding:4px 6px;font-size:11pt";

  const sectionHtml = SECTION_DEFS.map((def) => {
    const sec = sections[def.id] ?? emptySection();
    const hasContent = sec.content.trim() || sec.achievements.trim() || sec.issues.trim();
    const subtitle = "subtitle" in def ? (def as { subtitle?: string }).subtitle : undefined;

    if (def.id === "s1") {
      const kpiData = sec.kpiTable && sec.kpiTable.length > 0 ? sec.kpiTable : DEFAULT_S1_KPI;
      const tablesHtml = kpiData.map((sub) => {
        if (sub.type === "section14table") {
          const all14 = sub.section14Rows ?? [];
          const newRows = all14.filter(r => r.group === "new");
          const usedRows = all14.filter(r => r.group === "used");
          const newTotal = newRows.reduce((s, r) => s + (parseFloat(r.savedDays) || 0), 0);
          const usedTotal = usedRows.reduce((s, r) => s + (parseFloat(r.savedDays) || 0), 0);
          const thS14 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f59e0b;font-size:11pt;color:#fff;text-align:center`;
          const renderGroup14Html = (rows: Section14Row[], label: string, total: number) => {
            const rowsHtml = rows.map((row, ri) => `<tr>
              <td style="${td0};text-align:center;width:5%">${ri + 1}</td>
              <td style="${td0};width:55%">${row.title}</td>
              <td style="${td0};width:25%">${row.productType}</td>
              <td style="${td0};text-align:center;font-weight:bold;color:${row.savedDays ? "#1d4ed8" : "#aaa"};width:15%">${row.savedDays || "–"}</td>
            </tr>`).join("");
            return `<tr><td colspan="4" style="${td0};font-weight:bold;text-align:center;background:#f0f4f8">${label}</td></tr>
              ${rows.length === 0 ? `<tr><td colspan="4" style="${td0};color:#bbb;font-style:italic;text-align:center">— Мэдээлэл байхгүй —</td></tr>` : rowsHtml}
              <tr><td colspan="3" style="${td0};font-weight:bold;text-align:center;background:#e8eef6">НИЙТ</td>
                <td style="${td0};font-weight:bold;text-align:center;background:#e8eef6">${total > 0 ? total : "–"}</td></tr>`;
          };
          return `<div style="margin-bottom:8pt;padding-left:6pt">
            <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt;color:#1e3a5f">${sub.id}. ${sub.groupLabel}</div>
            ${sub.section14Text ? `<div style="font-size:11pt;line-height:1.7;white-space:pre-wrap;margin-bottom:8pt">${sub.section14Text}</div>` : ""}
            <table style="width:100%;border-collapse:collapse;font-size:11pt">
              <thead><tr>
                <th style="${thS14};width:5%">№</th>
                <th style="${thS14};width:55%">ДАТА БҮТЭЭГДЭХҮҮН</th>
                <th style="${thS14};width:25%">БҮТЭЭГДЭХҮҮНИЙ ТӨРӨЛ</th>
                <th style="${thS14};width:15%">ХЭМНЭСЭН ХҮН/ӨДӨР</th>
              </tr></thead>
              <tbody>
                ${renderGroup14Html(newRows, "Тайлант хугацаанд шинээр нэвтрүүлсэн дата бүтээгдэхүүн", newTotal)}
                ${renderGroup14Html(usedRows, "Тайлант хугацаанд аудитын үйл ажиллагаанд ашигласан дата бүтээгдэхүүн", usedTotal)}
              </tbody>
            </table>
          </div>`;
        }
        if (sub.type === "section2table") {
          const s2Rows = sub.section2Rows ?? [];
          const thS2 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f59e0b;font-size:11pt;color:#fff;text-align:center`;
          const rowsHtml = s2Rows.map((row, ri) => `<tr>
            <td style="${td0};text-align:center;width:5%">${ri + 1}</td>
            <td style="${td0};width:35%">${row.title}</td>
            <td style="${td0};text-align:center;font-weight:bold;color:${row.result ? "#1d4ed8" : "#aaa"};width:10%">${row.result || ""}</td>
            <td style="${td0};width:20%">${row.completion}</td>
            <td style="${td0};width:15%">${row.period}</td>
            <td style="${td0};width:15%">${row.employeeName ?? ""}</td>
          </tr>`).join("");
          return `<div style="margin-bottom:8pt;padding-left:6pt">
            <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt;color:#1e3a5f">${sub.id}. ${sub.groupLabel}</div>
            ${s2Rows.length === 0 ? "<div style=\"font-size:11pt;color:#bbb;font-style:italic\">— Ажил байхгүй —</div>" :
              `<table style="width:100%;border-collapse:collapse;font-size:11pt">
                <thead><tr>
                  <th style="${thS2};width:5%">№</th><th style="${thS2};width:35%">АЖЛЫН НЭР</th>
                  <th style="${thS2};width:10%">ГҮЙЦЭТГЭЛ %</th><th style="${thS2};width:20%">ГҮЙЦЭТГЭЛ /ТОВЧ/</th>
                  <th style="${thS2};width:15%">ХУГАЦАА</th><th style="${thS2};width:15%">АЖИЛТАН</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table>`}
          </div>`;
        }
        if (sub.type === "dashboard") {
          const dashRows = sub.dashboardRows ?? [];
          const tasksHtml = dashRows.map((row, ri) => {
            const imgsHtml = (row.images ?? []).map(img =>
              `<div style="text-align:center;margin:6pt 0"><img src="${img.dataUrl}" alt="" style="width:${img.width}%;max-width:100%;display:inline-block" /></div>`
            ).join("");
            return `<div style="margin-bottom:8pt">
              <div style="font-weight:bold;font-size:11pt;margin-bottom:2pt">${ri + 1}. ${row.title}</div>
              ${row.description ? `<div style="font-size:11pt;line-height:1.7;white-space:pre-wrap;padding-left:12pt">${row.description}</div>` : ""}
              ${imgsHtml}
            </div>`;
          }).join("");
          return `<div style="margin-bottom:8pt;padding-left:6pt">
            <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt;color:#1e3a5f">${sub.id}. ${sub.groupLabel}</div>
            ${dashRows.length === 0 ? "<div style=\"font-size:11pt;color:#bbb;font-style:italic\">— Ажил байхгүй —</div>" : tasksHtml}
          </div>`;
        }
        const totalW = sub.rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
        const thK = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f59e0b;font-size:11pt;color:#fff;text-align:center`;
        const rowsHtml = sub.rows.map((row, ri) => `<tr>
          ${ri === 0 ? `<td rowspan="${sub.rows.length}" style="${td0};font-weight:bold;text-align:center;background:#dbeafe;vertical-align:middle;width:14%">${sub.groupLabel}</td>` : ""}
          <td style="${td0};width:40%">${row.indicator}</td>
          <td style="${td0};text-align:center;width:8%">${row.weight}</td>
          <td style="${td0};text-align:center;font-weight:bold;color:${row.score ? "#1d4ed8" : "#aaa"};width:10%">${row.score || ""}</td>
          <td style="${td0};color:#555;width:28%">${row.evaluatedBy}</td>
        </tr>`).join("");
        return `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
          <thead><tr>
            <th style="${thK}"></th><th style="${thK}">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
            <th style="${thK}">ХУВЬ</th><th style="${thK}">ҮНЭЛГЭЭ</th><th style="${thK}">ҮНЭЛСЭН ТАЙЛБАР</th>
          </tr></thead>
          <tbody>${rowsHtml}
            <tr style="background:#dbeafe">
              <td style="${td0}"></td>
              <td style="${td0};text-align:center;font-weight:bold">Нийт</td>
              <td style="${td0};text-align:center;font-weight:bold">${totalW}</td>
              <td style="${td0}" colspan="2"></td>
            </tr>
          </tbody>
        </table>`;
      }).join("");
      return `<div style="margin-bottom:10pt">
        <div style="font-weight:bold;font-size:11pt;margin-top:14pt;margin-bottom:3pt;text-align:center;letter-spacing:0.5px">${def.num}. ${def.heading}</div>
        ${subtitle ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:8pt;color:#333;text-align:center">(${subtitle})</div>` : ""}
        ${tablesHtml}
      </div>`;
    }

    if (def.id === "s2") {
      const s2kpiData = sec.s2kpiTable && sec.s2kpiTable.length > 0 ? sec.s2kpiTable : DEFAULT_S2_KPI;
      const thK2 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f59e0b;font-size:11pt;color:#fff;text-align:center`;
      const s2TablesHtml = s2kpiData.map((sub) => {
        const totalW = sub.rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
        const rowsHtml = sub.rows.map((row, ri) => `<tr>
          ${ri === 0 ? `<td rowspan="${sub.rows.length}" style="${td0};font-weight:bold;text-align:center;background:#dbeafe;vertical-align:middle;width:14%">${sub.groupLabel}</td>` : ""}
          <td style="${td0};width:40%">${row.indicator}</td>
          <td style="${td0};text-align:center;width:8%">${row.weight}</td>
          <td style="${td0};text-align:center;font-weight:bold;color:${row.score ? "#1d4ed8" : "#aaa"};width:10%">${row.score || ""}</td>
          <td style="${td0};color:#555;width:28%">${row.evaluatedBy}</td>
        </tr>`).join("");
        return `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
          <thead><tr>
            <th style="${thK2}"></th><th style="${thK2}">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
            <th style="${thK2}">ХУВЬ</th><th style="${thK2}">ҮНЭЛГЭЭ</th><th style="${thK2}">ҮНЭЛСЭН ТАЙЛБАР</th>
          </tr></thead>
          <tbody>${rowsHtml}
            <tr style="background:#dbeafe">
              <td style="${td0}"></td>
              <td style="${td0};text-align:center;font-weight:bold">Нийт</td>
              <td style="${td0};text-align:center;font-weight:bold">${totalW}</td>
              <td style="${td0}" colspan="2"></td>
            </tr>
          </tbody>
        </table>`;
      }).join("");
      const contentHtml = sec.content.trim()
        ? `<div style="font-weight:bold;font-size:11pt;color:#1e3a5f;margin-top:8pt;margin-bottom:4pt">Ахисан түвшний дата анализын ажлын чанар, үр дүн:</div><div style="font-size:11pt;line-height:1.7;white-space:pre-wrap">${sec.content}</div>`
        : "";
      return `<div style="margin-bottom:10pt">
        <div style="font-weight:bold;font-size:11pt;margin-top:14pt;margin-bottom:3pt;text-align:center;letter-spacing:0.5px">${def.num}. ${def.heading}</div>
        ${s2TablesHtml}${contentHtml}
      </div>`;
    }

    return `<div style="margin-bottom:10pt">
      <div style="font-weight:bold;font-size:11pt;margin-top:14pt;margin-bottom:3pt;text-align:center;letter-spacing:0.5px">${def.num}. ${def.heading}</div>
      ${subtitle ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:5pt;color:#333;text-align:center">(${subtitle})</div>` : ""}
      ${!hasContent
        ? `<div style="font-size:11pt;color:#bbb;font-style:italic;padding-left:9pt">— Тайлан оруулаагүй —</div>`
        : `<div style="padding-left:9pt">
            ${sec.content.trim() ? `<div style="font-weight:bold;font-size:11pt;color:#374151;margin-top:7pt">Тайлбар:</div><div style="font-size:11pt;line-height:1.7;white-space:pre-wrap">${sec.content}</div>` : ""}
            ${sec.achievements.trim() ? `<div style="font-weight:bold;font-size:11pt;color:#374151;margin-top:7pt">Амжилт, давуу тал:</div><div style="font-size:11pt;line-height:1.7;white-space:pre-wrap">${sec.achievements}</div>` : ""}
            ${sec.issues.trim() ? `<div style="font-weight:bold;font-size:11pt;color:#374151;margin-top:7pt">Бэрхшээл, сорилт:</div><div style="font-size:11pt;line-height:1.7;white-space:pre-wrap">${sec.issues}</div>` : ""}
          </div>`}
    </div>`;
  }).join("");

  const tw = SECTION_DEFS.reduce((sum, d) => {
    const sc = parseFloat(sections[d.id]?.score ?? "");
    return sum + (!isNaN(sc) ? (sc * d.weight) / 100 : 0);
  }, 0);
  const summaryRows = SECTION_DEFS.map((def, idx) => {
    const sec = sections[def.id] ?? emptySection();
    const sc = parseFloat(sec.score);
    const ws = !isNaN(sc) ? (sc * def.weight) / 100 : null;
    return `<tr>
      <td style="border:0.5px solid #bbb;padding:3px 5px;text-align:center">${idx + 1}</td>
      <td style="border:0.5px solid #bbb;padding:3px 5px">${def.heading}</td>
      <td style="border:0.5px solid #bbb;padding:3px 5px;text-align:center">${def.weight}%</td>
      <td style="border:0.5px solid #bbb;padding:3px 5px;text-align:center;font-weight:bold;color:#1d4ed8">${sec.score || "–"}</td>
      <td style="border:0.5px solid #bbb;padding:3px 5px;text-align:center;font-weight:bold;color:#1d4ed8">${ws !== null ? ws.toFixed(3) : "–"}</td>
      <td style="border:0.5px solid #bbb;padding:3px 5px;font-style:italic">${!isNaN(sc) ? scoreLabel(sc) : "–"}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:'Times New Roman',serif;font-size:11pt;color:#000;margin:0}@page{size:A4;margin:16mm 18mm 14mm}</style>
</head><body>
  <div style="text-align:center;font-weight:bold;font-size:11pt;letter-spacing:1px;margin-bottom:3pt">ДАТА АНАЛИЗЫН АЛБАНЫ ${year} ОНЫ ${qName} УЛИРЛЫН</div>
  <div style="text-align:center;font-weight:bold;font-size:11pt;letter-spacing:1px;margin-bottom:12pt">БҮХ-НЫ ТАЙЛАН, ҮНЭЛГЭЭ</div>
  <div style="font-size:11pt;color:#333;margin-bottom:16pt">${dateStr}</div>
  ${sectionHtml}
  <div style="page-break-before:always"></div>
  <div style="text-align:center;font-weight:bold;font-size:11pt;margin-bottom:3pt">ДАТА АНАЛИЗИЙН АЛБА</div>
  <div style="text-align:center;font-weight:bold;font-size:11pt;margin-bottom:12pt">${year} ОНЫ ${qName} УЛИРЛЫН БҮХ НИЙТИЙН НЭГТГЭЛ</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14pt;font-size:11pt">
    <thead><tr style="background:#f0f4f8">
      ${["№","Тэлэв байдал","Жин %","Оноо","Жинлэсэн оноо","Үнэлгээ"].map(h =>
        `<th style="border:0.5px solid #bbb;padding:3px 5px;text-align:center;font-weight:bold">${h}</th>`).join("")}
    </tr></thead>
    <tbody>${summaryRows}
      <tr style="background:#e8eef6">
        <td colspan="2" style="border:0.5px solid #bbb;padding:3px 5px;text-align:right;font-weight:bold">НИЙТ ТҮЗ ОНОО:</td>
        <td style="border:0.5px solid #bbb;padding:3px 5px;text-align:center;font-weight:bold">100%</td>
        <td style="border:0.5px solid #bbb;padding:3px 5px"></td>
        <td style="border:0.5px solid #bbb;padding:3px 5px;text-align:center;font-weight:bold;color:#1d4ed8;font-size:11pt">${tw > 0 ? tw.toFixed(3) : "–"}</td>
        <td style="border:0.5px solid #bbb;padding:3px 5px;font-weight:bold">${tw > 0 ? scoreLabel(tw) : "–"}</td>
      </tr>
    </tbody>
  </table>
  ${tw > 0 ? `<p style="font-size:11pt;line-height:1.7">Дата анализийн алба ${year} оны ${qName} улирлын тэнцвэртэй үнэлгээний зургалалын нийт оноо <strong>${tw.toFixed(3)}</strong> байгаа нь <strong>«${scoreLabel(tw)}»</strong> үнэлгээтэй тохирч байна.</p>` : ""}
</body></html>`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TailanBscPage() {
  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);
  const [activeTab, setActiveTab] = useState<string>("s1");
  const [sections, setSections] = useState<Record<string, SectionReport>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const updateSection = (id: string, updated: SectionReport) =>
    setSections((p) => ({ ...p, [id]: updated }));

  const handleS1ApiLoad = async (_si: number): Promise<DashboardRow[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) => (r.plannedTasks ?? []).map((t: any) => ({
        title: t.title ?? "", description: t.description ?? "",
        images: (t.images ?? []).map((img: any) => ({ id: img.id ?? "", dataUrl: img.dataUrl ?? "", width: img.width ?? 80 })),
      })));
    } catch { alert("API-аас татахад алдаа гарлаа."); return []; }
  };

  const handleS1_13ApiLoad = async (_si: number): Promise<Section2TaskRow[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section2Tasks ?? []).map((t: any, idx: number) => ({
          order: t.order ?? idx + 1, title: t.title ?? "", result: t.result ?? "",
          period: t.period ?? "", completion: t.completion ?? "",
          employeeName: r.cyrillicName ?? r.employeeName ?? "",
          images: (t.images ?? []).map((img: any) => ({ id: img.id ?? "", dataUrl: img.dataUrl ?? "", width: img.width ?? 80 })),
        }))
      );
    } catch { alert("API-аас татахад алдаа гарлаа."); return []; }
  };

  const handleS1_14ApiLoad = async (_si: number): Promise<Section14Row[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      const newRows: Section14Row[] = [];
      const usedRows: Section14Row[] = [];
      for (const r of reports as any[]) {
        const emp = r.cyrillicName ?? r.employeeName ?? "";
        for (const t of (r.section2Tasks ?? []))
          newRows.push({ title: t.title ?? "", productType: "Өгөгдөл боловсруулалт", savedDays: t.result ?? "", group: "new", employeeName: emp });
        for (const t of (r.section1Dashboards ?? []))
          newRows.push({ title: t.title ?? "", productType: "Дашбоард", savedDays: "", group: "new", employeeName: emp });
        for (const t of (r.plannedTasks ?? []))
          usedRows.push({ title: t.title ?? "", productType: "Өгөгдөл боловсруулалт", savedDays: "", group: "used", employeeName: emp });
      }
      return [...newRows, ...usedRows];
    } catch { alert("API-аас татахад алдаа гарлаа."); return []; }
  };

  useEffect(() => {
    tailanApi.getDeptBsc(year, quarter).then((data) => {
      if (data?.sections) {
        setSections(data.sections as Record<string, SectionReport>);
        setLastSaved(data.updatedAt ?? null);
      } else { setSections({}); setLastSaved(null); }
    }).catch(() => {});
  }, [year, quarter]);

  const handleDbSave = async () => {
    setSaving(true);
    try {
      await tailanApi.saveDeptBsc(year, quarter, sections as Record<string, unknown>);
      setLastSaved(new Date().toISOString().replace("T", " ").substring(0, 19));
    } catch { alert("Хадгалахад алдаа гарлала."); }
    finally { setSaving(false); }
  };

  const handleWordExport = () => {
    const html = buildWordHtml(year, quarter, sections);
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tailan_${year}_Q${quarter}.doc`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalWS = SECTION_DEFS.reduce((sum, d) => {
    const sc = parseFloat(sections[d.id]?.score ?? "");
    return sum + (!isNaN(sc) ? (sc * d.weight) / 100 : 0);
  }, 0);

  const isEval = activeTab === "eval";
  const activeDef = SECTION_DEFS.find((d) => d.id === activeTab);
  const qName = Q_NAMES[(quarter - 1) % 4];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-sm shrink-0">
        <Link href="/tools/tailan" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="text-slate-600 text-sm">|</span>
        <span className="text-slate-200 text-sm font-medium">Хэлтсийн улирлийн тайлан</span>
        {totalWS > 0 && (
          <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${totalWS >= 4 ? "bg-emerald-500/20 text-emerald-300" : totalWS >= 3 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"}`}>
            {totalWS.toFixed(3)} — {scoreLabel(totalWS)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select value={year} onChange={(e) => setYear(+e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none">
            {Array.from({ length: getCurrentYear() + 100 - 2020 + 1 }, (_, i) => 2020 + i).map((y) => <option key={y} value={y}>{y} он</option>)}
          </select>
          <select value={quarter} onChange={(e) => setQuarter(+e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none">
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}-р улирал</option>)}
          </select>
          {lastSaved && <span className="text-[10px] text-slate-500 whitespace-nowrap">Сүүлд: {lastSaved.slice(11, 16)}</span>}
          <button onClick={handleDbSave} disabled={saving} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
            <Save className="h-3.5 w-3.5" />{saving ? "Хадгалаж байна..." : "Хадгалах"}
          </button>
          <button onClick={handleWordExport} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5" />Word татах
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-60 shrink-0 border-r border-slate-700/50 bg-slate-900/50 p-3 flex flex-col gap-1.5 overflow-y-auto">
          {SECTION_DEFS.map((def) => {
            const active = activeTab === def.id;
            return (
              <button key={def.id} onClick={() => setActiveTab(def.id)}
                className={`flex items-start gap-2.5 w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 text-xs ${active ? COLOR_TAB_ACTIVE[def.color] : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
              >
                <SectionIcon icon={def.icon} cls={`h-4 w-4 shrink-0 mt-0.5 ${active ? COLOR_ICON[def.color] : "text-slate-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-tight truncate">{def.num}. {def.label}</div>
                  {sections[def.id]?.score && (
                    <span className={`text-[10px] font-bold ${active ? "" : "text-amber-400"}`}>{sections[def.id]!.score} оноо</span>
                  )}
                </div>
              </button>
            );
          })}
          <div className="border-t border-slate-700/50 pt-1.5 mt-1">
            <button onClick={() => setActiveTab("eval")}
              className={`flex items-start gap-2.5 w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 text-xs ${isEval ? "bg-rose-500/20 border border-rose-500/40 text-rose-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
            >
              <Award className={`h-4 w-4 shrink-0 mt-0.5 ${isEval ? "text-rose-400" : "text-slate-500"}`} />
              <div>
                <div className="font-semibold leading-tight">Нэгтгэл / Дүгнэлт</div>
                <div className="text-[10px] opacity-70 mt-0.5">{totalWS > 0 ? `Нийт оноо: ${totalWS.toFixed(3)}` : "Бүх тэлэвийн нэгтгэл"}</div>
              </div>
            </button>
          </div>
          {totalWS > 0 && (
            <div className="mt-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700/40">
              <div className={`text-lg font-bold ${totalWS >= 4 ? "text-emerald-400" : totalWS >= 3 ? "text-amber-400" : "text-rose-400"}`}>{totalWS.toFixed(3)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{scoreLabel(totalWS)}</div>
            </div>
          )}
        </div>

        {!isEval ? (
          <div className="flex-1 overflow-y-auto p-5">
            {activeDef && (
              <SectionEditor
                def={activeDef}
                report={sections[activeDef.id] ?? emptySection()}
                onChange={(updated) => updateSection(activeDef.id, updated)}
                onApiLoad={activeDef.id === "s1" ? handleS1ApiLoad : undefined}
                onS2TableApiLoad={activeDef.id === "s1" ? handleS1_13ApiLoad : undefined}
                onS14TableApiLoad={activeDef.id === "s1" ? handleS1_14ApiLoad : undefined}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="text-sm font-bold text-white mb-4">Нэгтгэл — Дата Анализийн Алба {year} оны {qName} улирал</div>
            <div className="rounded-xl border border-slate-700/50 overflow-hidden mb-5">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300">
                    {["Тэлэв байдал","Жин %","Оноо","Жинлэсэн оноо","Үнэлгээ"].map((h) => (
                      <th key={h} className="border border-slate-700/50 px-2 py-2 text-center font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTION_DEFS.map((def) => {
                    const sec = sections[def.id] ?? emptySection();
                    const sc = parseFloat(sec.score);
                    const ws = !isNaN(sc) ? (sc * def.weight) / 100 : null;
                    return (
                      <tr key={def.id} className="hover:bg-white/[0.02]">
                        <td className="border border-slate-700/50 px-3 py-2">{def.num}. {def.heading}</td>
                        <td className="border border-slate-700/50 px-2 py-2 text-center">{def.weight}%</td>
                        <td className="border border-slate-700/50 px-2 py-2 text-center font-bold text-amber-400">{sec.score || "–"}</td>
                        <td className="border border-slate-700/50 px-2 py-2 text-center font-bold text-blue-400">{ws !== null ? ws.toFixed(3) : "–"}</td>
                        <td className="border border-slate-700/50 px-2 py-2 text-center text-slate-300">{!isNaN(sc) ? scoreLabel(sc) : "–"}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-800/60 font-bold">
                    <td className="border border-slate-700/50 px-3 py-2 text-white">НИЙТ</td>
                    <td className="border border-slate-700/50 px-2 py-2 text-center text-white">100%</td>
                    <td className="border border-slate-700/50 px-2 py-2"></td>
                    <td className="border border-slate-700/50 px-2 py-2 text-center text-blue-300 text-sm">{totalWS > 0 ? totalWS.toFixed(3) : "–"}</td>
                    <td className={`border border-slate-700/50 px-2 py-2 text-center font-bold ${totalWS >= 4 ? "text-emerald-400" : totalWS >= 3 ? "text-amber-400" : totalWS > 0 ? "text-rose-400" : "text-slate-500"}`}>
                      {totalWS > 0 ? scoreLabel(totalWS) : "–"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Оноогоор дүгнэх шалгуур</div>
            <div className="rounded-xl border border-slate-700/50 overflow-hidden w-fit">
              {[["5","≥ 100%","Маш сайн","text-green-400"],["4","90 – 99%","Сайн","text-emerald-400"],["3","75 – 89%","Хангалттай","text-amber-400"],["2","60 – 74%","Дунд","text-orange-400"],["1","< 60%","Хангалтгүй","text-rose-400"]].map(([sc, pct, lbl, cls]) => (
                <div key={sc} className="flex items-center gap-4 px-4 py-1.5 border-b border-slate-700/30 last:border-0 text-xs">
                  <span className={`font-bold w-4 text-center ${cls}`}>{sc}</span>
                  <span className="text-slate-400 w-20">{pct}</span>
                  <span className={cls}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-[300px] border-l border-slate-700/50 overflow-y-auto bg-slate-950/40">
          <div className="px-3 py-2 border-b border-slate-700/30 text-[11px] text-slate-400 font-semibold tracking-wide uppercase">Урьдчилан харах</div>
          <WordPreview year={year} quarter={quarter} sections={sections} />
        </div>
      </div>
    </div>
  );
}
