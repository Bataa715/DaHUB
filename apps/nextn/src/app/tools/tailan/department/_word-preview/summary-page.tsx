"use client";

import React from "react";
import { type KpiSubSection } from "../_types";
import { bigTitle, thKpi, tdKpi } from "./styles";

// ─────────────────────────────────────────────────────────────
//  2-р хуудасны "Нэгтгэл" хэсэг (нэгтгэлийн KPI хүснэгт + гарын үсэг).
//  _WordPreview.tsx-с гаргаж авсан — JSX болон логик бүрэн ижил хэвээр,
//  зөвхөн sections["sig"]?.content нь sigContent prop болж өөрчлөгдсөн.
// ─────────────────────────────────────────────────────────────
export function SummaryPage({
  year,
  qName,
  negtgelKpi,
  sigContent,
}: {
  year: number;
  qName: string;
  negtgelKpi: KpiSubSection[];
  sigContent?: string;
}) {
  return (
    <>
      {/* ══ НЭГТГЭЛ ХЭСЭГ ══ */}
      <div data-page-break>
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
                    const rowColors = [
                      "#dde8f5",
                      "#f5e5d0",
                      "#d8f0e8",
                      "#e8e5f8",
                    ];
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
                            <td
                              style={tdKpi({ width: "38%", background: rowBg })}
                            >
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
                  sig = JSON.parse(sigContent || "{}");
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
    </>
  );
}
