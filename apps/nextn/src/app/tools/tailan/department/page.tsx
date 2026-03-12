"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  BarChart3,
  Users2,
  Settings,
  BookOpen,
  Award,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import { tailanApi } from "@/lib/api";

import {
  SECTION_DEFS,
  Q_NAMES,
  SectionReport,
  getCurrentYear,
  getCurrentQuarter,
  DEFAULT_S1_KPI,
  DEFAULT_S2_KPI,
  DEFAULT_S3_KPI,
  DEFAULT_S4_KPI,
  DEFAULT_NEGTGEL_KPI,
  emptySection,
  scoreLabel,
  mergeKpi,
  mergeKpiWithRows,
  DashboardRow,
  Section2TaskRow,
  Section14Row,
  Section23Row,
  Section42Row,
  Section43Row,
  RichTextItem,
  KpiSubSection,
  KpiRow,
} from "./_types";
import { SectionEditor } from "./_SectionEditor";
import { WordPreview } from "./_WordPreview";
import { AutoTextarea } from "./_KpiTableEditor";

// ─── Tab style maps ───────────────────────────────────────────────────────────

const COLOR_TAB_ACTIVE: Record<string, string> = {
  blue: "bg-blue-500/20 border border-blue-500/40 text-blue-300",
  emerald: "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300",
  amber: "bg-amber-500/20 border border-amber-500/40 text-amber-300",
  purple: "bg-purple-500/20 border border-purple-500/40 text-purple-300",
};
const COLOR_ICON: Record<string, string> = {
  blue: "text-blue-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  purple: "text-purple-400",
};

function SectionIcon({ icon, cls }: { icon: string; cls: string }) {
  if (icon === "bar") return <BarChart3 className={cls} />;
  if (icon === "users") return <Users2 className={cls} />;
  if (icon === "settings") return <Settings className={cls} />;
  if (icon === "book") return <BookOpen className={cls} />;
  return null;
}

// ─── Word export ──────────────────────────────────────────────────────────────

function buildWordHtml(
  year: number,
  quarter: number,
  sections: Record<string, SectionReport>,
): string {
  const qName = Q_NAMES[(quarter - 1) % 4];
  const today = new Date();
  const dateStr = `${today.getFullYear()} оны ${today.getMonth() + 1} сарын ${today.getDate()}-ны өдөр`;
  const td0 = "border:0.5px solid #000;padding:3px 5px;font-size:10pt";
  // usable page width: A4 210mm − 18mm left − 18mm right = 174mm ≈ 658px @ 96dpi
  // Same math as inlineImageParas backend. Word uses the HTML width= attribute (px)
  // over CSS style, so we emit both for maximum compatibility.
  const imgAttrs = (w: number | undefined, h: number | undefined) => {
    const pct = w ?? 80;
    const wpx = Math.round((pct * 658) / 100);
    const wcm = `${((pct * 17.4) / 100).toFixed(1)}cm`;
    const styleStr =
      h && h > 0
        ? `width:${wcm};height:${((h * 2.54) / 96).toFixed(1)}cm`
        : `width:${wcm}`;
    const hAttr = h && h > 0 ? ` height="${h}"` : "";
    return `style="${styleStr}" width="${wpx}"${hAttr}`;
  };

  const sectionHtml = SECTION_DEFS.map((def) => {
    const sec = sections[def.id] ?? emptySection();
    const hasContent =
      sec.content.trim() || sec.achievements.trim() || sec.issues.trim();
    const subtitle =
      "subtitle" in def ? (def as { subtitle?: string }).subtitle : undefined;

    if (def.id === "s1") {
      const kpiData = mergeKpi(sec.kpiTable, DEFAULT_S1_KPI);
      const tablesHtml = kpiData
        .map((sub) => {
          if (sub.type === "section14table") {
            const all14 = sub.section14Rows ?? [];
            const newRows = all14.filter((r) => r.group === "new");
            const usedRows = all14.filter((r) => r.group === "used");
            const newTotal = newRows.reduce(
              (s, r) => s + (parseFloat(r.savedDays) || 0),
              0,
            );
            const usedTotal = usedRows.reduce(
              (s, r) => s + (parseFloat(r.savedDays) || 0),
              0,
            );
            const thS14 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#fff;font-size:10pt;color:#000;text-align:center`;
            const renderGroup14Html = (
              rows: Section14Row[],
              label: string,
              total: number,
            ) => {
              const rowsHtml = rows
                .map(
                  (row, ri) => `<tr>
              <td style="${td0};text-align:center;width:5%">${ri + 1}</td>
              <td style="${td0};width:55%">${row.title}</td>
              <td style="${td0};width:25%">${row.productType}</td>
              <td style="${td0};text-align:center;font-weight:bold;color:#000;width:15%">${row.savedDays || "–"}</td>
            </tr>`,
                )
                .join("");
              return `<tr><td colspan="4" style="${td0};font-weight:bold;text-align:center;background:#fff">${label}</td></tr>
              ${rows.length === 0 ? `<tr><td colspan="4" style="${td0};color:#bbb;font-style:italic;text-align:center">— Мэдээлэл байхгүй —</td></tr>` : rowsHtml}
              <tr><td colspan="3" style="${td0};font-weight:bold;text-align:center;background:#fff">НИЙТ</td>
                <td style="${td0};font-weight:bold;text-align:center;background:#fff">${total > 0 ? total : "–"}</td></tr>`;
            };
            return `<div style="margin-bottom:8pt;padding-left:6pt">
            <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt;color:#000">${sub.groupLabel}</div>
            ${sub.section14Text ? `<div style="font-size:11pt;line-height:1.7;white-space:pre-wrap;margin-bottom:8pt">${sub.section14Text}</div>` : ""}
            <table style="width:100%;border-collapse:collapse;font-size:11pt">
              <thead><tr>
                <th style="${thS14};width:5%">№</th>
                <th style="${thS14};width:55%">Дата бүтээгдэхүүн</th>
                <th style="${thS14};width:25%">Бүтээгдэхүүн төрөл</th>
                <th style="${thS14};width:15%">Хэмнэсэн хүн/өдөр</th>
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
            const thS2 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#fff;font-size:10pt;color:#000;text-align:center`;
            const rowsHtml = s2Rows
              .map(
                (row, ri) => `<tr>
            <td style="${td0};text-align:center;width:5%">${ri + 1}</td>
            <td style="${td0};width:20%">${row.title}</td>
            <td style="${td0};text-align:center;font-weight:bold;color:${row.result ? "#000" : "#bbb"};width:10%">${row.result ? row.result + "%" : ""}</td>
            <td style="${td0};text-align:center;width:13%">${row.period}</td>
            <td style="${td0};width:25%">${row.completion}</td>
          </tr>`,
              )
              .join("");
            const nums2 = s2Rows
              .map((r) => parseFloat(r.result))
              .filter((n) => !isNaN(n));
            const avg2 =
              nums2.length > 0
                ? nums2.reduce((a, b) => a + b, 0) / nums2.length
                : null;
            const avgRow = `<tr>
              <td style="${td0};width:5%"></td>
              <td style="${td0};width:20%;font-weight:bold;text-align:center">Дундаж</td>
              <td style="${td0};width:10%;font-weight:bold;text-align:center">${avg2 !== null ? avg2.toFixed(1) + "%" : "–"}</td>
              <td style="${td0};width:13%"></td>
              <td style="${td0};width:25%"></td>
            </tr>`;
            const imgsHtml2 = s2Rows
              .flatMap((row) => row.images ?? [])
              .map(
                (img) =>
                  `<div style="text-align:center;margin:6pt 0"><img src="${img.dataUrl}" alt="" ${imgAttrs(img.width, img.height)} /></div>`,
              )
              .join("");
            return `<div style="margin-bottom:8pt;padding-left:6pt">
            <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt;color:#000">${sub.groupLabel}</div>
            ${
              s2Rows.length === 0
                ? '<div style="font-size:11pt;color:#bbb;font-style:italic">— Ажил байхгүй —</div>'
                : `<table style="width:100%;border-collapse:collapse;font-size:10pt">
                <thead><tr>
                  <th style="${thS2};width:5%">№</th><th style="${thS2};width:20%">Төлөвлөгөөт ажил (Дууссан ажлууд)</th>
                  <th style="${thS2};width:10%">Ажлын гүйцэтгэл</th><th style="${thS2};width:13%">Хийгдсэн хугацаа</th>
                  <th style="${thS2};width:25%">Гүйцэтгэл /товч/</th>
                </tr></thead>
                <tbody>${rowsHtml}${avgRow}</tbody>
              </table>${imgsHtml2}`
            }
          </div>`;
          }
          if (sub.type === "dashboard") {
            const dashRows = sub.dashboardRows ?? [];
            const tasksHtml = dashRows
              .map((row, ri) => {
                const imgsHtml = (row.images ?? [])
                  .map(
                    (img) =>
                      `<div style="text-align:center;margin:6pt 0"><img src="${img.dataUrl}" alt="" ${imgAttrs(img.width, img.height)} /></div>`,
                  )
                  .join("");
                return `<div style="margin-bottom:8pt">
              <div style="font-weight:bold;font-size:11pt;margin-bottom:2pt">${ri + 1}. ${row.title}</div>
              ${row.description ? `<div style="font-size:11pt;line-height:1.7;white-space:pre-wrap;padding-left:12pt">${row.description}</div>` : ""}
              ${imgsHtml}
            </div>`;
              })
              .join("");
            return `<div style="margin-bottom:8pt;padding-left:6pt">
            <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt;color:#000">${sub.groupLabel}</div>
            ${dashRows.length === 0 ? '<div style="font-size:11pt;color:#bbb;font-style:italic">— Ажил байхгүй —</div>' : tasksHtml}
          </div>`;
          }
          const totalW = sub.rows.reduce(
            (s, r) => s + (Number(r.weight) || 0),
            0,
          );
          const thK = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f29447;font-size:10pt;color:#000;text-align:center`;
          const rowsHtml = sub.rows
            .map(
              (row, ri) => `<tr>
          ${ri === 0 ? `<td rowspan="${sub.rows.length}" style="${td0};font-weight:bold;text-align:center;background:#dde8f5;vertical-align:middle;width:14%">${sub.groupLabel}</td>` : ""}
          <td style="${td0};width:40%;background:#dde8f5">${row.indicator}</td>
          <td style="${td0};text-align:center;width:8%;background:#dde8f5">${row.weight}</td>
          <td style="${td0};text-align:center;font-weight:bold;background:#dde8f5;color:${row.score ? "#374151" : "#bbb"};width:10%">${row.score || ""}</td>
          <td style="${td0};background:#dde8f5;width:28%">${row.evaluatedBy}</td>
        </tr>`,
            )
            .join("");
          return `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
          <thead><tr>
            <th style="${thK}"></th><th style="${thK}">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
            <th style="${thK}">ХУВЬ</th><th style="${thK}">ҮНЭЛГЭЭ</th><th style="${thK}">ҮНЭЛСЭН ТАЙЛБАР</th>
          </tr></thead>
          <tbody>${rowsHtml}
            <tr style="background:#fff">
              <td colspan="2" style="${td0};text-align:center">Нийт</td>
              <td style="${td0};text-align:center">${totalW}</td>
              <td style="${td0}"></td>
              <td style="${td0}"></td>
            </tr>
          </tbody>
        </table>`;
        })
        .join("");
      return `<div style="margin-bottom:10pt">
        <div style="font-weight:bold;font-size:11pt;margin-top:14pt;margin-bottom:3pt;text-align:center;letter-spacing:0.5px">${def.num}. ${def.heading}</div>
        ${subtitle ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:8pt;color:#333;text-align:center">(${subtitle})</div>` : ""}
        ${tablesHtml}
      </div>`;
    }

    if (def.id === "s2") {
      const s2kpiData = mergeKpi(sec.s2kpiTable, DEFAULT_S2_KPI);
      const thK2 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f29447;font-size:10pt;color:#000;text-align:center`;
      const thW2 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#fff;font-size:10pt;color:#000;text-align:center`;
      const s2TablesHtml = s2kpiData
        .map((sub) => {
          if (sub.type === "richtextlist") {
            const items = sub.richTextRows ?? [];
            if (items.length === 0) return "";
            const itemsHtml = items
              .map((item, ii) => {
                const contents =
                  item.contents && item.contents.length > 0
                    ? item.contents
                    : [
                        ...item.bullets.map((b) => ({
                          type: "bullet" as const,
                          text: b,
                          id: "",
                          dataUrl: "",
                          width: 80,
                        })),
                        ...(item.images ?? []).map((img) => ({
                          type: "image" as const,
                          id: img.id,
                          dataUrl: img.dataUrl,
                          width: img.width,
                          height: img.height,
                          text: "",
                        })),
                      ];
                const bodyParts2: string[] = [];
                let bulletsArr2: string[] = [];
                const flushB2 = () => {
                  if (!bulletsArr2.length) return;
                  bodyParts2.push(
                    `<ul style="margin:0 0 4pt 20pt;padding:0;list-style:disc">${bulletsArr2.join("")}</ul>`,
                  );
                  bulletsArr2 = [];
                };
                contents.forEach((c) => {
                  if (c.type === "bullet")
                    bulletsArr2.push(
                      `<li style="font-size:11pt;line-height:1.7">${c.text}</li>`,
                    );
                  else {
                    flushB2();
                    bodyParts2.push(
                      `<div style="text-align:center;margin:6pt 0"><img src="${c.dataUrl}" ${imgAttrs(c.width, c.height)} /></div>`,
                    );
                  }
                });
                flushB2();
                return `<div style="margin-bottom:8pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:3pt">${ii + 1}. ${item.title}</div>${bodyParts2.join("")}</div>`;
              })
              .join("");
            return `<div style="margin-bottom:8pt">${sub.groupLabel ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>` : ""}${itemsHtml}</div>`;
          }
          if (sub.type === "section23table") {
            const s23Rows = sub.section23Rows ?? [];
            if (s23Rows.length === 0)
              return `<div style="margin-bottom:8pt;padding-left:6pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div><div style="font-size:11pt;color:#bbb;font-style:italic">— Ажил байхгүй —</div></div>`;
            const s23Nums = s23Rows
              .map((r) => parseFloat(r.clientScore))
              .filter((n) => !isNaN(n));
            const s23Avg =
              s23Nums.length > 0
                ? (s23Nums.reduce((a, b) => a + b, 0) / s23Nums.length).toFixed(
                    1,
                  )
                : "–";
            const rowsHtml23 = s23Rows
              .map(
                (row, ri) =>
                  `<tr><td style="${td0};text-align:center;width:5%">${ri + 1}</td><td style="${td0};width:30%">${row.title}</td><td style="${td0};width:40%">${row.usage}</td><td style="${td0};text-align:center;width:25%">${row.clientScore}</td></tr>`,
              )
              .join("");
            const avgRow23 = `<tr><td colspan="3" style="${td0};font-weight:bold;text-align:center">Дундаж</td><td style="${td0};font-weight:bold;text-align:center">${s23Avg}</td></tr>`;
            return `<div style="margin-bottom:8pt;padding-left:6pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div><table style="width:100%;border-collapse:collapse;font-size:10pt"><thead><tr><th style="${thW2};width:5%">№</th><th style="${thW2};width:30%">Өгөгдөл боловсруулалт</th><th style="${thW2};width:40%">Өгөгдөл боловсруулалтийн ажлын ач холбогдол хэрэглээ</th><th style="${thW2};width:25%">Хэрэглэгч нэгжийн өгсөн үнэлгээ</th></tr></thead><tbody>${rowsHtml23}${avgRow23}</tbody></table></div>`;
          }
          if (sub.type === "section24table") {
            const s24Rows = sub.section24Rows ?? [];
            if (s24Rows.length === 0)
              return `<div style="margin-bottom:8pt;padding-left:6pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div><div style="font-size:11pt;color:#bbb;font-style:italic">— Ажил байхгүй —</div></div>`;
            const s24Nums = s24Rows
              .map((r) => parseFloat(r.result))
              .filter((n) => !isNaN(n));
            const s24Avg =
              s24Nums.length > 0
                ? (s24Nums.reduce((a, b) => a + b, 0) / s24Nums.length).toFixed(
                    1,
                  )
                : "–";
            const rowsHtml24 = s24Rows
              .map(
                (row, ri) =>
                  `<tr><td style="${td0};text-align:center;width:5%">${ri + 1}</td><td style="${td0};width:30%">${row.title}</td><td style="${td0};text-align:center;font-weight:bold;width:10%">${row.result ? row.result + "%" : ""}</td><td style="${td0};text-align:center;width:18%">${row.period}</td><td style="${td0};width:37%">${row.completion}</td></tr>`,
              )
              .join("");
            const avgRow24 = `<tr><td style="${td0};width:5%"></td><td style="${td0};width:30%;font-weight:bold;text-align:center">Дундаж</td><td style="${td0};width:10%;font-weight:bold;text-align:center">${s24Avg !== "–" ? s24Avg + "%" : "–"}</td><td style="${td0};width:18%"></td><td style="${td0};width:37%"></td></tr>`;
            const imgsHtml24 = s24Rows
              .flatMap((row) => row.images ?? [])
              .map(
                (img) =>
                  `<div style="text-align:center;margin:6pt 0"><img src="${img.dataUrl}" alt="" ${imgAttrs(img.width, img.height)} /></div>`,
              )
              .join("");
            return `<div style="margin-bottom:8pt;padding-left:6pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div><table style="width:100%;border-collapse:collapse;font-size:10pt"><thead><tr><th style="${thW2};width:5%">№</th><th style="${thW2};width:30%">Төлөвлөгөөт ажил</th><th style="${thW2};width:10%">Ажлын гүйцэтгэл</th><th style="${thW2};width:18%">Хийгдсэн хугацаа</th><th style="${thW2};width:37%">Гүйцэтгэл /товч/</th></tr></thead><tbody>${rowsHtml24}${avgRow24}</tbody></table>${imgsHtml24}</div>`;
          }
          const totalW = sub.rows.reduce(
            (s, r) => s + (Number(r.weight) || 0),
            0,
          );
          const rowsHtml = sub.rows
            .map(
              (row, ri) => `<tr>
          ${ri === 0 ? `<td rowspan="${sub.rows.length}" style="${td0};font-weight:bold;text-align:center;background:#f5e5d0;vertical-align:middle;width:14%">${sub.groupLabel}</td>` : ""}
          <td style="${td0};width:40%;background:#f5e5d0">${row.indicator}</td>
          <td style="${td0};text-align:center;width:8%;background:#f5e5d0">${row.weight}</td>
          <td style="${td0};text-align:center;font-weight:bold;background:#f5e5d0;color:${row.score ? "#374151" : "#bbb"};width:10%">${row.score || ""}</td>
          <td style="${td0};font-weight:bold;background:#f5e5d0;width:28%">${row.evaluatedBy}</td>
        </tr>`,
            )
            .join("");
          return `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
          <thead><tr>
            <th style="${thK2}"></th><th style="${thK2}">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
            <th style="${thK2}">ХУВЬ</th><th style="${thK2}">ҮНЭЛГЭЭ</th><th style="${thK2}">ҮНЭЛСЭН ТАЙЛБАР</th>
          </tr></thead>
          <tbody>${rowsHtml}
            <tr style="background:#fff">
              <td colspan="2" style="${td0};text-align:center">Нийт</td>
              <td style="${td0};text-align:center">${totalW}</td>
              <td style="${td0}"></td>
              <td style="${td0}"></td>
            </tr>
          </tbody>
        </table>`;
        })
        .join("");
      return `<div style="margin-bottom:10pt">
        <div style="font-weight:bold;font-size:11pt;margin-top:14pt;margin-bottom:3pt;text-align:center;letter-spacing:0.5px">${def.num}. ${def.heading}</div>
        ${s2TablesHtml}
      </div>`;
    }

    if (def.id === "s3") {
      const s3kpiData = mergeKpi(sec.s3kpiTable, DEFAULT_S3_KPI);
      const thK3 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f29447;font-size:10pt;color:#000;text-align:center`;
      const thW = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#fff;font-size:10pt;color:#000;text-align:center`;
      const s3TablesHtml = s3kpiData
        .map((sub: KpiSubSection) => {
          if (sub.type === "richtextlist") {
            const items = sub.richTextRows ?? [];
            if (items.length === 0) return "";
            const itemsHtml = items
              .map((item, ii) => {
                const contents =
                  item.contents && item.contents.length > 0
                    ? item.contents
                    : [
                        ...item.bullets.map((b) => ({
                          type: "bullet" as const,
                          text: b,
                          id: "",
                          dataUrl: "",
                          width: 80,
                        })),
                        ...(item.images ?? []).map((img) => ({
                          type: "image" as const,
                          id: img.id,
                          dataUrl: img.dataUrl,
                          width: img.width,
                          height: img.height,
                          text: "",
                        })),
                      ];
                const bodyParts3: string[] = [];
                let bulletsArr3: string[] = [];
                const flushB3 = () => {
                  if (!bulletsArr3.length) return;
                  bodyParts3.push(
                    `<ul style="margin:0 0 4pt 20pt;padding:0;list-style:disc">${bulletsArr3.join("")}</ul>`,
                  );
                  bulletsArr3 = [];
                };
                contents.forEach((c) => {
                  if (c.type === "bullet")
                    bulletsArr3.push(
                      `<li style="font-size:11pt;line-height:1.7">${c.text}</li>`,
                    );
                  else {
                    flushB3();
                    bodyParts3.push(
                      `<div style="text-align:center;margin:6pt 0"><img src="${c.dataUrl}" ${imgAttrs(c.width, c.height)} /></div>`,
                    );
                  }
                });
                flushB3();
                return `<div style="margin-bottom:8pt">
                <div style="font-weight:bold;font-size:11pt;margin-bottom:3pt">${ii + 1}. ${item.title}</div>
                ${bodyParts3.join("")}
              </div>`;
              })
              .join("");
            return `<div style="margin-bottom:8pt">
              ${sub.groupLabel ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>` : ""}
              ${itemsHtml}
            </div>`;
          }
          if (sub.type === "section33table") {
            const s33Rows = sub.section33Rows ?? [];
            if (s33Rows.length === 0)
              return `<div style="margin-bottom:8pt;padding-left:6pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div><div style="font-size:11pt;color:#bbb;font-style:italic">— Өгөгдөл байхгүй —</div></div>`;
            const rowsHtml = s33Rows
              .map(
                (row, ri) => `<tr>
              <td style="${td0};text-align:center;width:5%">${ri + 1}</td>
              <td style="${td0};width:30%">${row.title}</td>
              <td style="${td0};width:40%">${row.usage}</td>
              <td style="${td0};text-align:center;width:25%">${row.clientScore}</td>
            </tr>`,
              )
              .join("");
            const s33Nums = s33Rows
              .map((r) => parseFloat(r.clientScore))
              .filter((n) => !isNaN(n));
            const s33Avg =
              s33Nums.length > 0
                ? (s33Nums.reduce((a, b) => a + b, 0) / s33Nums.length).toFixed(
                    1,
                  )
                : "–";
            const s33AvgRow = `<tr><td colspan="3" style="${td0};font-weight:bold;text-align:center">Дундаж</td><td style="${td0};font-weight:bold;text-align:center">${s33Avg}</td></tr>`;
            return `<div style="margin-bottom:8pt;padding-left:6pt">
              <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>
              <table style="width:100%;border-collapse:collapse;font-size:10pt">
                <thead><tr>
                  <th style="${thW};width:5%">№</th>
                  <th style="${thW};width:30%">Тогтмол хийгддэг өгөгдөл боловсруулалт</th>
                  <th style="${thW};width:40%">Өгөгдөл боловсруулалтийн ажлын ач холбогдол хэрэглээ</th>
                  <th style="${thW};width:25%">Хэрэглэгч нэгжийн өгсөн үнэлгээ</th>
                </tr></thead>
                <tbody>${rowsHtml}${s33AvgRow}</tbody>
              </table></div>`;
          }
          if (sub.type === "section34table") {
            const s34Rows = sub.section34Rows ?? [];
            if (s34Rows.length === 0)
              return `<div style="margin-bottom:8pt;padding-left:6pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div><div style="font-size:11pt;color:#bbb;font-style:italic">— Өгөгдөл байхгүй —</div></div>`;
            const rowsHtml = s34Rows
              .map(
                (row, ri) => `<tr>
              <td style="${td0};text-align:center;width:5%">${ri + 1}</td>
              <td style="${td0};width:30%">${row.title}</td>
              <td style="${td0};width:40%">${row.usage}</td>
              <td style="${td0};text-align:center;width:25%">${row.clientScore}</td>
            </tr>`,
              )
              .join("");
            const s34Nums = s34Rows
              .map((r) => parseFloat(r.clientScore))
              .filter((n) => !isNaN(n));
            const s34Avg =
              s34Nums.length > 0
                ? (s34Nums.reduce((a, b) => a + b, 0) / s34Nums.length).toFixed(
                    1,
                  )
                : "–";
            const s34AvgRow = `<tr><td colspan="3" style="${td0};font-weight:bold;text-align:center">Дундаж</td><td style="${td0};font-weight:bold;text-align:center">${s34Avg}</td></tr>`;
            return `<div style="margin-bottom:8pt;padding-left:6pt">
              <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>
              <table style="width:100%;border-collapse:collapse;font-size:10pt">
                <thead><tr>
                  <th style="${thW};width:5%">№</th>
                  <th style="${thW};width:30%">Dashboard</th>
                  <th style="${thW};width:40%">Dashboard-ийн ач холбогдол хэрэглээ</th>
                  <th style="${thW};width:25%">Хэрэглэгч нэгжийн өгсөн үнэлгээ</th>
                </tr></thead>
                <tbody>${rowsHtml}${s34AvgRow}</tbody>
              </table></div>`;
          }
          const totalW = sub.rows.reduce(
            (s: number, r: KpiRow) => s + (Number(r.weight) || 0),
            0,
          );
          const rowsHtml = sub.rows
            .map(
              (row: KpiRow, ri: number) => `<tr>
          ${ri === 0 ? `<td rowspan="${sub.rows.length}" style="${td0};font-weight:bold;text-align:center;background:#d8f0e8;vertical-align:middle;width:14%">${sub.groupLabel}</td>` : ""}
          <td style="${td0};width:40%;background:#d8f0e8">${row.indicator}</td>
          <td style="${td0};text-align:center;width:8%;background:#d8f0e8">${row.weight}</td>
          <td style="${td0};text-align:center;font-weight:bold;background:#d8f0e8;color:${row.score ? "#374151" : "#bbb"};width:10%">${row.score || ""}</td>
          <td style="${td0};background:#d8f0e8;width:28%">${row.evaluatedBy}</td>
        </tr>`,
            )
            .join("");
          return `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
          <thead><tr>
            <th style="${thK3}"></th><th style="${thK3}">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
            <th style="${thK3}">ХУВЬ</th><th style="${thK3}">ҮНЭЛГЭЭ</th><th style="${thK3}">ҮНЭЛСЭН ТАЙЛБАР</th>
          </tr></thead>
          <tbody>${rowsHtml}
            <tr style="background:#fff">
              <td colspan="2" style="${td0};text-align:center">Нийт</td>
              <td style="${td0};text-align:center">${totalW}</td>
              <td style="${td0}"></td>
              <td style="${td0}"></td>
            </tr>
          </tbody>
        </table>`;
        })
        .join("");
      return `<div style="margin-bottom:10pt">
        <div style="font-weight:bold;font-size:11pt;margin-top:14pt;margin-bottom:3pt;text-align:center;letter-spacing:0.5px">${def.num}. ${def.heading}</div>
        ${s3TablesHtml}
      </div>`;
    }

    if (def.id === "s4") {
      const s4kpiData = mergeKpi(sec.s4kpiTable, DEFAULT_S4_KPI);
      const thK4 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#f29447;font-size:10pt;color:#000;text-align:center`;
      const thW4 = `border:0.5px solid #000;padding:4px 6px;font-weight:bold;background:#fff;font-size:10pt;color:#000;text-align:center`;
      const s4TablesHtml = s4kpiData
        .map((sub: KpiSubSection) => {
          if (sub.type === "richtextlist") {
            const items = sub.richTextRows ?? [];
            if (items.length === 0) return "";
            const itemsHtml = items
              .map((item, ii) => {
                const contents =
                  item.contents && item.contents.length > 0
                    ? item.contents
                    : [
                        ...item.bullets.map((b) => ({
                          type: "bullet" as const,
                          text: b,
                          id: "",
                          dataUrl: "",
                          width: 80,
                        })),
                        ...(item.images ?? []).map((img) => ({
                          type: "image" as const,
                          id: img.id,
                          dataUrl: img.dataUrl,
                          width: img.width,
                          height: img.height,
                          text: "",
                        })),
                      ];
                const bodyParts4: string[] = [];
                let bulletsArr4: string[] = [];
                const flushB4 = () => {
                  if (!bulletsArr4.length) return;
                  bodyParts4.push(
                    `<ul style="margin:0 0 4pt 20pt;padding:0;list-style:disc">${bulletsArr4.join("")}</ul>`,
                  );
                  bulletsArr4 = [];
                };
                contents.forEach((c) => {
                  if (c.type === "bullet")
                    bulletsArr4.push(
                      `<li style="font-size:11pt;line-height:1.7">${c.text}</li>`,
                    );
                  else {
                    flushB4();
                    bodyParts4.push(
                      `<div style="text-align:center;margin:6pt 0"><img src="${c.dataUrl}" ${imgAttrs(c.width, c.height)} /></div>`,
                    );
                  }
                });
                flushB4();
                return `<div style="margin-bottom:8pt">
                <div style="font-weight:bold;font-size:11pt;margin-bottom:3pt">${ii + 1}. ${item.title}</div>
                ${bodyParts4.join("")}
              </div>`;
              })
              .join("");
            return `<div style="margin-bottom:8pt;padding-left:6pt">
              ${sub.groupLabel ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>` : ""}
              ${itemsHtml}
            </div>`;
          }
          if (sub.type === "section42knowledge") {
            const s42Rows = sub.section42Rows ?? [];
            if (s42Rows.length === 0)
              return `<div style="margin-bottom:8pt;padding-left:6pt">${sub.groupLabel ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>` : ""}<div style="font-size:11pt;color:#bbb;font-style:italic">— Өгөгдөл байхгүй —</div></div>`;
            const rowsHtml42 = s42Rows
              .map((row) => {
                const bullets = (row.text || "")
                  .split("\n")
                  .filter((l) => l.trim())
                  .map((l) => `<li style="font-size:11pt;line-height:1.7">${l.trim()}</li>`)
                  .join("");
                return `<div style="margin-bottom:6pt"><div style="font-weight:bold;font-size:11pt;color:#000;margin-bottom:2pt">${row.employeeName}</div><ul style="margin:0 0 4pt 20pt;padding:0;list-style:disc">${bullets}</ul></div>`;
              })
              .join("");
            return `<div style="margin-bottom:8pt;padding-left:6pt">${sub.groupLabel ? `<div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>` : ""}${rowsHtml42}</div>`;
          }
          if (sub.type === "section43trainings") {
            const s43Rows = sub.section43Rows ?? [];
            if (s43Rows.length === 0)
              return `<div style="margin-bottom:8pt;padding-left:6pt"><div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div><div style="font-size:11pt;color:#bbb;font-style:italic">— Өгөгдөл байхгүй —</div></div>`;
            const cols = [
              { h: "Ажилтан", w: "12%", k: "employeeName" },
              { h: "Сургалтын нэр", w: "20%", k: "training" },
              { h: "Зохион байгуулагч", w: "10%", k: "organizer" },
              { h: "Төрөл", w: "7%", k: "type" },
              { h: "Огноо", w: "8%", k: "date" },
              { h: "Хэлбэр", w: "7%", k: "format" },
              { h: "Цаг /цаг/", w: "7%", k: "hours" },
              {
                h: "Аудитын зорилготой холбогдсон",
                w: "10%",
                k: "meetsAuditGoal",
              },
              { h: "Мэдлэг хуваалцсан", w: "19%", k: "sharedKnowledge" },
            ] as const;
            const theads = cols
              .map((c) => `<th style="${thW4};width:${c.w}">${c.h}</th>`)
              .join("");
            const rowsHtml = s43Rows
              .map(
                (row) =>
                  `<tr>${cols.map((c) => `<td style="${td0};width:${c.w}">${(row as any)[c.k]}</td>`).join("")}</tr>`,
              )
              .join("");
            return `<div style="margin-bottom:8pt;padding-left:6pt">
              <div style="font-weight:bold;font-size:11pt;margin-bottom:5pt">${sub.groupLabel}</div>
              <table style="width:100%;border-collapse:collapse;font-size:9pt">
                <thead><tr>${theads}</tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table></div>`;
          }
          const totalW = sub.rows.reduce(
            (s: number, r: KpiRow) => s + (Number(r.weight) || 0),
            0,
          );
          const rowsHtml = sub.rows
            .map(
              (row: KpiRow, ri: number) => `<tr>
          ${ri === 0 ? `<td rowspan="${sub.rows.length}" style="${td0};font-weight:bold;text-align:center;background:#e8e5f8;vertical-align:middle;width:14%">${sub.groupLabel}</td>` : ""}
          <td style="${td0};width:40%;background:#e8e5f8">${row.indicator}</td>
          <td style="${td0};text-align:center;width:8%;background:#e8e5f8">${row.weight}</td>
          <td style="${td0};text-align:center;font-weight:bold;background:#e8e5f8;color:${row.score ? "#374151" : "#bbb"};width:10%">${row.score || ""}</td>
          <td style="${td0};background:#e8e5f8;width:28%">${row.evaluatedBy}</td>
        </tr>`,
            )
            .join("");
          return `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
          <thead><tr>
            <th style="${thK4}"></th><th style="${thK4}">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
            <th style="${thK4}">ХУВЬ</th><th style="${thK4}">ҮНЭЛГЭЭ</th><th style="${thK4}">ҮНЭЛСЭН ТАЙЛБАР</th>
          </tr></thead>
          <tbody>${rowsHtml}
            <tr style="background:#fff">
              <td colspan="2" style="${td0};text-align:center">Нийт</td>
              <td style="${td0};text-align:center">${totalW}</td>
              <td style="${td0}"></td>
              <td style="${td0}"></td>
            </tr>
          </tbody>
        </table>`;
        })
        .join("");
      const s4ContentHtml = sec.content.trim()
        ? `<div style="font-weight:bold;font-size:11pt;color:#000;margin-top:8pt;margin-bottom:4pt">Сургалт, хөгжлийн төлөв байдалын дэлгэрэнгүй тайлбар:</div><div style="font-size:11pt;line-height:1.7;white-space:pre-wrap">${sec.content}</div>`
        : "";
      return `<div style="margin-bottom:10pt">
        <div style="font-weight:bold;font-size:11pt;margin-top:14pt;margin-bottom:3pt;text-align:center;letter-spacing:0.5px">${def.num}. ${def.heading}</div>
        ${s4TablesHtml}${s4ContentHtml}
      </div>`;
    }

    return "";
  }).join("");

  // ─── Нэгтгэл KPI table for Word export ──────────────────────────────────────
  const negtgelKpiExport: KpiSubSection[] = mergeKpiWithRows(
    sections["negtgel"]?.kpiTable,
    DEFAULT_NEGTGEL_KPI,
  );
  const tdN =
    "border:0.5px solid #000;padding:2px 4px;font-size:10pt;vertical-align:middle;color:#000";
  const thN = `border:0.5px solid #000;padding:2px 4px;font-weight:bold;background:#f29447;font-size:10pt;color:#000;text-align:center`;
  const negtRowColors = ["#dde8f5", "#f5e5d0", "#d8f0e8", "#e8e5f8"];
  const negtgelTableHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:4pt;font-size:10pt">
      <thead><tr>
        <th style="${thN};width:20%"></th>
        <th style="${thN};width:38%">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
        <th style="${thN};width:7%">ХУВЬ</th>
        <th style="${thN};width:7%">ҮНЭЛГЭЭ</th>
        <th style="${thN};width:28%">ҮНЭЛГЭЭНИЙ ТАЙЛБАР</th>
      </tr></thead>
      <tbody>
        ${negtgelKpiExport
          .map((group, gi) => {
            const rowBg = negtRowColors[gi % negtRowColors.length];
            const totalW = group.rows.reduce(
              (s, r) => s + (Number(r.weight) || 0),
              0,
            );
            const rowsHtml = group.rows
              .map(
                (row, ri) => `<tr>
                  ${ri === 0 ? `<td rowspan="${group.rows.length}" style="${tdN};font-weight:bold;text-align:center;background:${rowBg};vertical-align:middle">${group.groupLabel}</td>` : ""}
                  <td style="${tdN};background:${rowBg}">${row.indicator}</td>
                  <td style="${tdN};text-align:center;background:${rowBg}">${row.weight}</td>
                  <td style="${tdN};text-align:center;font-weight:bold;background:${rowBg};color:${row.score ? "#374151" : "#bbb"}">${row.score || ""}</td>
                  <td style="${tdN};background:${rowBg}">${row.evaluatedBy}</td>
                </tr>`,
              )
              .join("");
            return `${rowsHtml}<tr style="background:#fff"><td colspan="2" style="${tdN};text-align:center">Нийт</td><td style="${tdN};text-align:center">${totalW}</td><td style="${tdN}"></td><td style="${tdN}"></td></tr>`;
          })
          .join("")}
        <tr style="background:#fff">
          <td colspan="2" style="${tdN};font-weight:bold;text-align:center">НИЙТ</td>
          <td style="${tdN};font-weight:bold;text-align:center">100</td>
          <td style="${tdN}" colspan="2"></td>
        </tr>
      </tbody>
    </table>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Normal</w:View><w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
@page WordSection1 {
  size: 21cm 29.7cm;
  margin: 16mm 18mm 14mm 18mm;
  mso-page-orientation: portrait;
}
@page WordSection2 {
  size: 21cm 29.7cm;
  margin: 16mm 18mm 14mm 18mm;
  mso-page-orientation: portrait;
}
div.WordSection1 { page: WordSection1; }
div.WordSection2 { page: WordSection2; }
body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; }
p { margin: 0; }
</style>
</head><body>
<div class="WordSection1">
  <div style="text-align:center;font-weight:bold;font-size:11pt;letter-spacing:1px;margin-bottom:3pt">ДАТА АНАЛИЗЫН АЛБАНЫ ${year} ОНЫ ${qName} УЛИРЛЫН</div>
  <div style="text-align:center;font-weight:bold;font-size:11pt;letter-spacing:1px;margin-bottom:12pt">БҮХ-НЫ ТАЙЛАН, ҮНЭЛГЭЭ</div>
  <div style="font-size:11pt;color:#333;margin-bottom:16pt">${dateStr}</div>
  ${sectionHtml}
</div>
<br style="mso-special-character:line-break;page-break-before:always" clear="all">
<div class="WordSection2">
  <div style="text-align:center;font-weight:bold;font-size:11pt;margin-bottom:2pt">ДАТА АНАЛИЗИЙН АЛБА</div>
  <div style="text-align:center;font-weight:bold;font-size:11pt;margin-bottom:6pt">${year} ОНЫ ${qName} УЛИРЛЫН БҮХ НИЙТИЙН НЭГТГЭЛ</div>
  ${negtgelTableHtml}
  ${(() => {
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
    const sigTdL = `style="width:200pt;padding:6pt 16pt 6pt 0;vertical-align:top;text-align:left;font-family:'Times New Roman',Times,serif;font-size:11pt;font-weight:bold;font-style:normal;line-height:1.6"`;
    const sigTdR = `style="padding:6pt 0;vertical-align:top;text-align:left;font-family:'Times New Roman',Times,serif;font-size:11pt;font-weight:bold;font-style:normal;line-height:1.6"`;
    const sigRow = (label: string, name: string, title: string) =>
      `<tr><td ${sigTdL}>${label}</td><td ${sigTdR}>${name ? `<div>${name}</div>` : ""}${title ? `<div>/${title}/</div>` : ""}</td></tr>`;
    return `<p style="margin:0;line-height:1">&nbsp;</p><p style="margin:0;line-height:1">&nbsp;</p><p style="margin:0;line-height:1">&nbsp;</p><div style="text-align:center"><table style="border-collapse:collapse;font-family:'Times New Roman',Times,serif;font-size:11pt;font-weight:bold;font-style:normal;margin:0 auto">
      ${sigRow("БОЛОВСРУУЛСАН:", p1n, p1t)}
      ${sigRow("ҮНЭЛЖ, БАТАЛГААЖУУЛСАН:", p2n, p2t)}
      ${sigRow("ҮНЭЛЖ, БАТАЛГААЖУУЛСАН:", p3n, p3t)}
    </table></div>`;
  })()}
</div>
</body></html>`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TailanBscPage() {
  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);
  const [activeTab, setActiveTab] = useState<string>("s1");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sections, setSections] = useState<Record<string, SectionReport>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateSection = (id: string, updated: SectionReport) =>
    setSections((p) => ({ ...p, [id]: updated }));

  const negtgelKpi: KpiSubSection[] = mergeKpiWithRows(
    sections["negtgel"]?.kpiTable,
    DEFAULT_NEGTGEL_KPI,
  );

  const updateNegtgelRow = (
    gi: number,
    ri: number,
    field: keyof KpiRow,
    value: string,
  ) => {
    const updated = negtgelKpi.map((group, g) =>
      g !== gi
        ? group
        : {
            ...group,
            rows: group.rows.map((row, r) =>
              r !== ri ? row : { ...row, [field]: value },
            ),
          },
    );
    updateSection("negtgel", {
      ...(sections["negtgel"] ?? emptySection()),
      kpiTable: updated,
    });
  };

  const updateNegtgelGroupLabel = (gi: number, value: string) => {
    const updated = negtgelKpi.map((group, g) =>
      g !== gi ? group : { ...group, groupLabel: value },
    );
    updateSection("negtgel", {
      ...(sections["negtgel"] ?? emptySection()),
      kpiTable: updated,
    });
  };

  const handleS1ApiLoad = async (_si: number): Promise<DashboardRow[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.plannedTasks ?? []).map((t: any) => ({
          title: t.title ?? "",
          description: t.description ?? "",
          images: (t.images ?? []).map((img: any) => ({
            id: img.id ?? "",
            dataUrl: img.dataUrl ?? "",
            width: img.width ?? 80,
            height: img.height ?? 0,
          })),
        })),
      );
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS1_13ApiLoad = async (
    _si: number,
  ): Promise<Section2TaskRow[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section2Tasks ?? []).map((t: any, idx: number) => ({
          order: t.order ?? idx + 1,
          title: t.title ?? "",
          result: t.result ?? "",
          period: t.period ?? "",
          completion: t.completion ?? "",
          employeeName: r.userName ?? "",
          images: (t.images ?? []).map((img: any) => ({
            id: img.id ?? "",
            dataUrl: img.dataUrl ?? "",
            width: img.width ?? 80,
            height: img.height ?? 0,
          })),
        })),
      );
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS1_14ApiLoad = async (_si: number): Promise<Section14Row[]> => {
    try {
      // 1. Өгөгдөл боловсруулалт → section 1.3-ийн одоогийн мэдэгдлүүдээс
      const s1KpiTable = sections["s1"]?.kpiTable ?? [];
      const s2TableSub = s1KpiTable.find((sub) => sub.type === "section2table");
      const s2Rows = s2TableSub?.section2Rows ?? [];
      const newRows: Section14Row[] = s2Rows.map((row) => ({
        title: row.title,
        productType: "Өгөгдөл боловсруулалт",
        savedDays: "",
        group: "new",
        employeeName: row.employeeName ?? "",
      }));

      // 2. Дашбоард → хувийн тайлангийн section1Dashboards-аас
      const reports = await tailanApi.getDeptReports(year, quarter);
      const dashRows: Section14Row[] = (reports as any[]).flatMap((r: any) =>
        (r.section1Dashboards ?? []).map((t: any) => ({
          title: t.title ?? "",
          productType: "Дашбоард",
          savedDays: "",
          group: "new" as const,
          employeeName: r.userName ?? "",
        })),
      );

      // Тайлант хугацаанд аудитын үйл ажиллагаанд ашигласан дата бүтээгдэхүүн → section3AutoTasks
      const usedRows: Section14Row[] = (reports as any[]).flatMap((r: any) =>
        (r.section3AutoTasks ?? []).map((t: any) => ({
          title: t.title ?? "",
          productType: "Өгөгдөл боловсруулалт",
          savedDays: "",
          group: "used" as const,
          employeeName: r.userName ?? "",
        })),
      );

      return [...newRows, ...dashRows, ...usedRows];
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS2_23ApiLoad = async (_si: number): Promise<Section23Row[]> => {
    try {
      // 1.3 хүснэгтийн өгөгдөлөөс татна
      const s1KpiTable = sections["s1"]?.kpiTable ?? [];
      const s2TableSub = s1KpiTable.find((sub) => sub.type === "section2table");
      const s2Rows = s2TableSub?.section2Rows ?? [];
      return s2Rows.map((row) => ({
        title: row.title,
        usage: row.completion ?? "",
        clientScore: "",
        employeeName: row.employeeName ?? "",
      }));
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS2_24ApiLoad = async (
    _si: number,
  ): Promise<Section2TaskRow[]> => {
    try {
      // Хувийн тайлангийн section1Dashboards-аас татна
      // (I хэсэг, 2-р дэд хэсэг — Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн)
      const reports = await tailanApi.getDeptReports(year, quarter);
      let order = 0;
      return (reports as any[]).flatMap((r: any) =>
        (r.section1Dashboards ?? []).map((t: any) => ({
          order: ++order,
          title: t.title ?? "",
          result: t.completion ?? "", // гүйцэтгэл %
          completion: t.summary ?? "", // гүйцэтгэл /товч/
          period: t.period ?? "",
          employeeName: r.userName ?? "",
          images: (t.images ?? []).map((img: any) => ({
            id: img.id ?? "",
            dataUrl: img.dataUrl ?? "",
            width: img.width ?? 80,
            height: img.height ?? 0,
          })),
        })),
      );
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS3_33ApiLoad = async (_si: number): Promise<Section23Row[]> => {
    try {
      // Хувийн тайлангийн III. Тогтмол хийгддэг ажлууд → section3AutoTasks
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section3AutoTasks ?? []).map((t: any) => ({
          title: t.title ?? "",
          usage: t.value ?? "",
          clientScore: t.rating ?? "",
          employeeName: r.userName ?? "",
        })),
      );
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS3_34ApiLoad = async (_si: number): Promise<Section23Row[]> => {
    try {
      // Хувийн тайлангийн III. Тогтмол хийгддэг ажлууд → section3Dashboards
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section3Dashboards ?? []).map((t: any) => ({
          title: t.dashboard ?? "",
          usage: t.value ?? "",
          clientScore: t.rating ?? "",
          employeeName: r.userName ?? "",
        })),
      );
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS4_42ApiLoad = async (_si: number): Promise<RichTextItem[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[])
        .filter((r: any) => (r.section4KnowledgeText ?? "").trim())
        .map((r: any) => ({
          id: r.userId ?? r.id ?? String(Math.random()),
          title: r.userName ?? "",
          bullets: (r.section4KnowledgeText ?? "")
            .split("\n")
            .map((l: string) => l.trim())
            .filter((l: string) => l.length > 0),
          images: [],
          contents: [],
        }));
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS4_43ApiLoad = async (_si: number): Promise<Section43Row[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section4Trainings ?? []).map((t: any) => ({
          employeeName: r.userName ?? "",
          training: t.training ?? "",
          organizer: t.organizer ?? "",
          type: t.type ?? "",
          date: t.date ?? "",
          format: t.format ?? "",
          hours: t.hours ?? "",
          meetsAuditGoal: t.meetsAuditGoal ?? "",
          sharedKnowledge: t.sharedKnowledge ?? "",
        })),
      );
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  useEffect(() => {
    tailanApi
      .getDeptBsc(year, quarter)
      .then((data) => {
        if (data?.sections) {
          setSections(data.sections as Record<string, SectionReport>);
          setLastSaved(
            data.updatedAt
              ? new Date(
                  data.updatedAt.replace(" ", "T") + "Z",
                ).toLocaleTimeString("mn-MN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
          );
        } else {
          setSections({});
          setLastSaved(null);
        }
      })
      .catch(() => {});
  }, [year, quarter]);

  const handleDbSave = async () => {
    setSaving(true);
    try {
      // Нормализаци: хадгалахаас өмнө бүх KPI хүснэгтийг default-тай merge хийнэ.
      // Ингэснээр хэрэглэгч тухайн секцийг нь нээгээгүй байсан ч (3.2 гэх мэт)
      // шинээр нэмсэн subsection-үүд хадгалагдана.
      const norm = { ...sections };
      const get = (id: string) => norm[id] ?? emptySection();
      norm.s1 = {
        ...get("s1"),
        kpiTable: mergeKpi(get("s1").kpiTable, DEFAULT_S1_KPI),
      };
      norm.s2 = {
        ...get("s2"),
        s2kpiTable: mergeKpi(get("s2").s2kpiTable, DEFAULT_S2_KPI),
      };
      norm.s3 = {
        ...get("s3"),
        s3kpiTable: mergeKpi(get("s3").s3kpiTable, DEFAULT_S3_KPI),
      };
      norm.s4 = {
        ...get("s4"),
        s4kpiTable: mergeKpi(get("s4").s4kpiTable, DEFAULT_S4_KPI),
      };
      norm.negtgel = {
        ...get("negtgel"),
        kpiTable: mergeKpiWithRows(
          get("negtgel").kpiTable,
          DEFAULT_NEGTGEL_KPI,
        ),
      };
      await tailanApi.saveDeptBsc(
        year,
        quarter,
        norm as Record<string, unknown>,
      );
      setSections(norm);
      setLastSaved(
        new Date().toLocaleTimeString("mn-MN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      showToast("Тайлан амжилттай хадгалагдлаа.");
    } catch {
      alert("Хадгалахад алдаа гарлала.");
    } finally {
      setSaving(false);
    }
  };

  const handleWordExport = () => {
    const html = buildWordHtml(year, quarter, sections);
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tailan_${year}_Q${quarter}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Word файл амжилттай татагдлаа.");
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
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <span className="text-base">
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          {toast.msg}
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-sm shrink-0">
        <Link
          href="/tools/tailan"
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Буцах
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-200 text-sm font-medium">
          Хэлтсийн улирлийн тайлан
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-700/70 text-slate-300 border border-slate-600/50">
          {year} оны {qName} улирал
        </span>
        {totalWS > 0 && (
          <span
            className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${totalWS >= 4 ? "bg-emerald-500/20 text-emerald-300" : totalWS >= 3 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"}`}
          >
            {totalWS.toFixed(3)} — {scoreLabel(totalWS)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
          >
            {Array.from(
              { length: getCurrentYear() + 100 - 2020 + 1 },
              (_, i) => 2020 + i,
            ).map((y) => (
              <option key={y} value={y}>
                {y} он
              </option>
            ))}
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(+e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {q}-р улирал
              </option>
            ))}
          </select>
          {lastSaved && (
            <span className="text-[10px] text-slate-500 whitespace-nowrap">
              Сүүлд: {lastSaved}
            </span>
          )}
          <button
            onClick={handleDbSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Хадгалаж байна..." : "Хадгалах"}
          </button>
          <button
            onClick={handleWordExport}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Word татах
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`shrink-0 border-r border-slate-700/50 bg-slate-900/50 flex flex-col overflow-hidden transition-all duration-200 ${
            sidebarOpen ? "w-60" : "w-11"
          }`}
        >
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center h-9 w-full border-b border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
            title={sidebarOpen ? "Хураах" : "Дэлгэх"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {SECTION_DEFS.map((def) => {
              const active = activeTab === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => {
                    setActiveTab(def.id);
                  }}
                  title={!sidebarOpen ? `${def.num}. ${def.label}` : undefined}
                  className={`flex items-start gap-2.5 w-full text-left px-2.5 py-2.5 rounded-xl transition-all duration-150 text-xs ${
                    active
                      ? COLOR_TAB_ACTIVE[def.color]
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  <SectionIcon
                    icon={def.icon}
                    cls={`h-4 w-4 shrink-0 mt-0.5 ${active ? COLOR_ICON[def.color] : "text-slate-500"}`}
                  />
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold leading-tight">
                        {def.num}. {def.label}
                      </div>
                      {sections[def.id]?.score && (
                        <span
                          className={`text-[10px] font-bold ${active ? "" : "text-amber-400"}`}
                        >
                          {sections[def.id]!.score} оноо
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
            <div className="border-t border-slate-700/50 pt-1.5 mt-1">
              <button
                onClick={() => setActiveTab("eval")}
                title={!sidebarOpen ? "Нэгтгэл / Дүгнэлт" : undefined}
                className={`flex items-start gap-2.5 w-full text-left px-2.5 py-2.5 rounded-xl transition-all duration-150 text-xs ${
                  isEval
                    ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Award
                  className={`h-4 w-4 shrink-0 mt-0.5 ${isEval ? "text-rose-400" : "text-slate-500"}`}
                />
                {sidebarOpen && (
                  <div>
                    <div className="font-semibold leading-tight">
                      Нэгтгэл / Дүгнэлт
                    </div>
                    <div className="text-[10px] opacity-70 mt-0.5">
                      {totalWS > 0
                        ? `Нийт оноо: ${totalWS.toFixed(3)}`
                        : "Бүх төлөвийн нэгтгэл"}
                    </div>
                  </div>
                )}
              </button>
            </div>
            {sidebarOpen && totalWS > 0 && (
              <div className="mt-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700/40">
                <div
                  className={`text-lg font-bold ${
                    totalWS >= 4
                      ? "text-emerald-400"
                      : totalWS >= 3
                        ? "text-amber-400"
                        : "text-rose-400"
                  }`}
                >
                  {totalWS.toFixed(3)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {scoreLabel(totalWS)}
                </div>
              </div>
            )}
          </div>
        </div>

        {!isEval ? (
          <div className="flex-1 overflow-y-auto p-5">
            {activeDef && (
              <SectionEditor
                def={activeDef}
                report={sections[activeDef.id] ?? emptySection()}
                onChange={(updated) => updateSection(activeDef.id, updated)}
                onApiLoad={activeDef.id === "s1" ? handleS1ApiLoad : undefined}
                onS2TableApiLoad={
                  activeDef.id === "s1" ? handleS1_13ApiLoad : undefined
                }
                onS14TableApiLoad={
                  activeDef.id === "s1" ? handleS1_14ApiLoad : undefined
                }
                onS23TableApiLoad={
                  activeDef.id === "s2" ? handleS2_23ApiLoad : undefined
                }
                onS24TableApiLoad={
                  activeDef.id === "s2" ? handleS2_24ApiLoad : undefined
                }
                onS33TableApiLoad={
                  activeDef.id === "s3" ? handleS3_33ApiLoad : undefined
                }
                onS34TableApiLoad={
                  activeDef.id === "s3" ? handleS3_34ApiLoad : undefined
                }
                onS42KnowledgeApiLoad={
                  activeDef.id === "s4" ? handleS4_42ApiLoad : undefined
                }
                onS43TrainingsApiLoad={
                  activeDef.id === "s4" ? handleS4_43ApiLoad : undefined
                }
              />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="text-sm font-bold text-white mb-4">
              Нэгтгэл — Дата Анализийн Алба {year} оны {qName} улирал
            </div>

            {/* ── Detailed negtgel KPI table ── */}
            <div className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">
              Дэлгэрэнгүй үнэлгээний хүснэгт
            </div>
            <div className="rounded-xl border border-slate-700/50 overflow-hidden mb-5">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300">
                    <th className="border border-slate-700/50 px-2 py-2 text-left font-semibold w-36">
                      Бүлэг
                    </th>
                    <th className="border border-slate-700/50 px-2 py-2 text-left font-semibold">
                      Түлхүүр үзүүлэлт
                    </th>
                    <th className="border border-slate-700/50 px-2 py-2 text-center font-semibold w-10">
                      Хувь
                    </th>
                    <th className="border border-slate-700/50 px-2 py-2 text-center font-semibold w-16">
                      Үнэлгээ
                    </th>
                    <th className="border border-slate-700/50 px-2 py-2 text-left font-semibold w-48">
                      Үнэлгээний тайлбар
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {negtgelKpi.map((group, gi) => {
                    const totalW = group.rows.reduce(
                      (s, r) => s + (Number(r.weight) || 0),
                      0,
                    );
                    return (
                      <React.Fragment key={group.id}>
                        {group.rows.map((row, ri) => (
                          <tr
                            key={ri}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            {ri === 0 && (
                              <td
                                rowSpan={group.rows.length + 1}
                                className="border border-slate-700/50 px-1 py-1 align-middle bg-slate-800/50"
                              >
                                <AutoTextarea
                                  value={group.groupLabel}
                                  onChange={(e) =>
                                    updateNegtgelGroupLabel(gi, e.target.value)
                                  }
                                  className="w-full bg-transparent border border-slate-700/50 rounded px-2 py-1 text-[11px] font-semibold text-slate-200 text-center leading-snug focus:outline-none focus:border-blue-500/60 placeholder-slate-600"
                                />
                              </td>
                            )}
                            <td className="border border-slate-700/50 px-1 py-1">
                              <AutoTextarea
                                value={row.indicator}
                                onChange={(e) =>
                                  updateNegtgelRow(
                                    gi,
                                    ri,
                                    "indicator",
                                    e.target.value,
                                  )
                                }
                                placeholder="Үзүүлэлт..."
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 leading-relaxed"
                              />
                            </td>
                            <td className="border border-slate-700/50 px-1 py-1">
                              <input
                                type="number"
                                value={row.weight}
                                onChange={(e) =>
                                  updateNegtgelRow(
                                    gi,
                                    ri,
                                    "weight",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-center text-slate-300 font-semibold focus:outline-none focus:border-blue-500/60"
                                placeholder="0"
                              />
                            </td>
                            <td className="border border-slate-700/50 px-1 py-1">
                              <input
                                type="text"
                                value={row.score}
                                onChange={(e) =>
                                  updateNegtgelRow(
                                    gi,
                                    ri,
                                    "score",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-center text-amber-400 font-bold focus:outline-none focus:border-amber-500/60 placeholder-slate-600"
                                placeholder="–"
                              />
                            </td>
                            <td className="border border-slate-700/50 px-1 py-1">
                              <input
                                type="text"
                                value={row.evaluatedBy}
                                onChange={(e) =>
                                  updateNegtgelRow(
                                    gi,
                                    ri,
                                    "evaluatedBy",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500/60 placeholder-slate-600"
                                placeholder="Тайлбар..."
                              />
                            </td>
                          </tr>
                        ))}
                        {/* Total row for group */}
                        <tr className="bg-slate-800/50">
                          <td className="border border-slate-700/50 px-2 py-1.5 text-center text-slate-400 italic">
                            Нийт
                          </td>
                          <td className="border border-slate-700/50 px-2 py-1.5 text-center text-white font-bold">
                            {totalW}
                          </td>
                          <td
                            colSpan={2}
                            className="border border-slate-700/50"
                          ></td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-slate-800/80 font-bold">
                    <td className="border border-slate-700/50 px-2 py-2 text-center text-white">
                      НИЙТ
                    </td>
                    <td className="border border-slate-700/50 px-2 py-2 text-center text-white">
                      {negtgelKpi.reduce(
                        (s, g) =>
                          s +
                          g.rows.reduce(
                            (rs, r) => rs + (Number(r.weight) || 0),
                            0,
                          ),
                        0,
                      )}
                    </td>
                    <td colSpan={3} className="border border-slate-700/50"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Гарын үсэг ── */}
            {(() => {
              let sig: Record<string, string> = {};
              try {
                sig = JSON.parse(sections["sig"]?.content || "{}");
              } catch {}
              const setSig = (key: string, val: string) => {
                const next = { ...sig, [key]: val };
                updateSection("sig", {
                  ...(sections["sig"] ?? emptySection()),
                  content: JSON.stringify(next),
                });
              };
              const row = (label: string, nKey: string, tKey: string) => (
                <div key={nKey} className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold w-52 pt-2 shrink-0">
                    {label}
                  </span>
                  <input
                    value={sig[nKey] ?? ""}
                    onChange={(e) => setSig(nKey, e.target.value)}
                    placeholder="Нэр..."
                    className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1.5 text-xs text-white font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                  />
                  <input
                    value={sig[tKey] ?? ""}
                    onChange={(e) => setSig(tKey, e.target.value)}
                    placeholder="/Албан тушаал/"
                    className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                  />
                </div>
              );
              return (
                <div className="mt-4 border border-slate-700/40 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
                    Гарын үсэг
                  </div>
                  {row("БОЛОВСРУУЛСАН:", "p1n", "p1t")}
                  {row("ҮНЭЛЖ, БАТАЛГААЖУУЛСАН:", "p2n", "p2t")}
                  {row("ҮНЭЛЖ, БАТАЛГААЖУУЛСАН:", "p3n", "p3t")}
                </div>
              );
            })()}
          </div>
        )}
        <div className="flex-1 min-w-[300px] border-l border-slate-700/50 overflow-y-auto bg-slate-950/40">
          <div className="px-3 py-2 border-b border-slate-700/30 text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
            Урьдчилан харах
          </div>
          <WordPreview
            year={year}
            quarter={quarter}
            sections={sections}
            negtgelKpi={negtgelKpi}
            onUpdateSection={updateSection}
          />
        </div>
      </div>
    </div>
  );
}
