import React, { useRef, useState, useEffect } from "react";
import {
  SECTION_DEFS, Q_NAMES, SectionReport, Section14Row,
  DEFAULT_S1_KPI, DEFAULT_S2_KPI, emptySection, scoreLabel,
} from "./_types";

export function WordPreview({
  year, quarter, sections,
}: {
  year: number;
  quarter: number;
  sections: Record<string, SectionReport>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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

  const qName = Q_NAMES[(quarter - 1) % 4];

  const thS: React.CSSProperties = {
    border: "0.5px dotted #bbb", padding: "3px 5px",
    textAlign: "center", fontWeight: "bold", background: "#f0f4f8",
    fontSize: "11pt", color: "#1a1a2e",
  };
  const tdS = (ex?: React.CSSProperties): React.CSSProperties => ({
    border: "0.5px dotted #ccc", padding: "3px 5px", fontSize: "11pt", verticalAlign: "top", ...ex,
  });
  const page: React.CSSProperties = {
    background: "#fff", width: "210mm",
    margin: "0 auto 20px", padding: "16mm 18mm 14mm",
    boxSizing: "border-box", fontFamily: "'Times New Roman', serif",
    fontSize: "11pt", color: "#000",
    boxShadow: "0 2px 14px rgba(0,0,0,0.25)",
  };
  const bigTitle: React.CSSProperties = {
    textAlign: "center", fontWeight: "bold", fontSize: "11pt",
    letterSpacing: "1px", marginBottom: "3pt",
  };
  const secH: React.CSSProperties = {
    fontWeight: "bold", fontSize: "11pt", marginTop: "16pt", marginBottom: "4pt",
    textAlign: "center", letterSpacing: "0.5px",
  };
  const secSub: React.CSSProperties = {
    fontWeight: "bold", fontSize: "11pt", marginBottom: "7pt", color: "#333",
    textAlign: "center",
  };
  const thKpi: React.CSSProperties = {
    border: "0.5px solid #000", padding: "4px 6px",
    fontWeight: "bold", background: "#ea912b", fontSize: "11pt", color: "#000", textAlign: "center",
  };
  const tdKpi = (ex?: React.CSSProperties): React.CSSProperties => ({
    border: "0.5px solid #000", padding: "3px 5px", fontSize: "11pt", verticalAlign: "middle", ...ex,
  });
  const labelSt: React.CSSProperties = {
    fontWeight: "bold", fontSize: "11pt", color: "#374151", marginBottom: "2pt", marginTop: "7pt",
  };
  const bodyTxt: React.CSSProperties = {
    fontSize: "11pt", lineHeight: "1.7", textAlign: "justify", color: "#000", whiteSpace: "pre-wrap",
  };

  const totalWS = SECTION_DEFS.reduce((sum, d) => {
    const sc = parseFloat(sections[d.id]?.score ?? "");
    return sum + (!isNaN(sc) ? (sc * d.weight) / 100 : 0);
  }, 0);

  return (
    <div ref={containerRef} style={{ background: "#d8d8d8", minHeight: "100%", overflow: "hidden" }}>
      <div style={{ zoom: scale, padding: "20px", width: "fit-content", minWidth: "100%" }}>

        {/* ══ Page 1 ══ */}
        <div style={page}>
          <div style={bigTitle}>ДАТА АНАЛИЗЫН АЛБАНЫ {year} ОНЫ {qName} УЛИРЛЫН</div>
          <div style={{ ...bigTitle, marginBottom: "12pt" }}>БҮХ-НЫ ТАЙЛАН, ҮНЭЛГЭЭ</div>
          <div style={{ fontSize: "11pt", color: "#333", marginBottom: "11pt" }}>
            {new Date().getFullYear()} оны {new Date().getMonth() + 1} сарын {new Date().getDate()}-ны өдөр
          </div>

          {SECTION_DEFS.map((def) => {
            const sec = sections[def.id] ?? emptySection();
            const hasContent = sec.content.trim() || sec.achievements.trim() || sec.issues.trim() || sec.score.trim();
            const kpiData = def.id === "s1"
              ? (sec.kpiTable && sec.kpiTable.length > 0 ? sec.kpiTable : DEFAULT_S1_KPI)
              : null;
            const s2kpiData = def.id === "s2"
              ? (sec.s2kpiTable && sec.s2kpiTable.length > 0 ? sec.s2kpiTable : DEFAULT_S2_KPI)
              : null;

            return (
              <div key={def.id} style={{ marginBottom: "8pt" }}>
                <div style={secH}>{def.num}. {def.heading}</div>
                {"subtitle" in def && (def as { subtitle?: string }).subtitle && (
                  <div style={secSub}>({(def as { subtitle?: string }).subtitle})</div>
                )}

                {kpiData ? (
                  <div>
                    {kpiData.map((sub) => {
                      if (sub.type === "section14table") {
                        const all14 = sub.section14Rows ?? [];
                        const newRows = all14.filter(r => r.group === "new");
                        const usedRows = all14.filter(r => r.group === "used");
                        const newTotal = newRows.reduce((s, r) => s + (parseFloat(r.savedDays) || 0), 0);
                        const usedTotal = usedRows.reduce((s, r) => s + (parseFloat(r.savedDays) || 0), 0);
                        const grpHd: React.CSSProperties = { ...tdKpi({ fontWeight: "bold", textAlign: "center", background: "#f0f4f8", fontSize: "11pt" }) };
                        const totRw: React.CSSProperties = { ...tdKpi({ fontWeight: "bold", textAlign: "center", background: "#e8eef6" }) };
                        const renderGroup14 = (rows: Section14Row[], label: string, total: number) => (
                          <>
                            <tr><td colSpan={4} style={grpHd}>{label}</td></tr>
                            {rows.length === 0 ? (
                              <tr><td colSpan={4} style={tdKpi({ color: "#bbb", fontStyle: "italic", textAlign: "center" })}>— Мэдээлэл байхгүй —</td></tr>
                            ) : (
                              rows.map((row, ri) => (
                                <tr key={ri}>
                                  <td style={tdKpi({ textAlign: "center", width: "5%" })}>{ri + 1}</td>
                                  <td style={tdKpi({ width: "55%" })}>{row.title}</td>
                                  <td style={tdKpi({ width: "25%" })}>{row.productType}</td>
                                  <td style={tdKpi({ textAlign: "center", width: "15%", fontWeight: "bold", color: row.savedDays ? "#1d4ed8" : "#bbb" })}>{row.savedDays || "–"}</td>
                                </tr>
                              ))
                            )}
                            <tr>
                              <td colSpan={3} style={totRw}>НИЙТ</td>
                              <td style={totRw}>{total > 0 ? total : "–"}</td>
                            </tr>
                          </>
                        );
                        return (
                          <div key={sub.id} style={{ marginBottom: "8pt", paddingLeft: "6pt" }}>
                            <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "5pt", color: "#1e3a5f" }}>
                              {sub.id}. {sub.groupLabel}
                            </div>
                            {sub.section14Text && (
                              <div style={{ fontSize: "11pt", lineHeight: "1.7", whiteSpace: "pre-wrap", marginBottom: "8pt", color: "#000" }}>
                                {sub.section14Text}
                              </div>
                            )}
                            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4pt", fontSize: "11pt" }}>
                              <thead>
                                <tr>
                                  <th style={thKpi}>№</th>
                                  <th style={thKpi}>ДАТА БҮТЭЭГДЭХҮҮН</th>
                                  <th style={thKpi}>БҮТЭЭГДЭХҮҮНИЙ ТӨРӨЛ</th>
                                  <th style={thKpi}>ХЭМНЭСЭН ХҮН/ӨДӨР</th>
                                </tr>
                              </thead>
                              <tbody>
                                {renderGroup14(newRows, "Тайлант хугацаанд шинээр нэвтрүүлсэн дата бүтээгдэхүүн", newTotal)}
                                {renderGroup14(usedRows, "Тайлант хугацаанд аудитын үйл ажиллагаанд ашигласан дата бүтээгдэхүүн", usedTotal)}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      if (sub.type === "section2table") {
                        const s2Rows = sub.section2Rows ?? [];
                        return (
                          <div key={sub.id} style={{ marginBottom: "8pt", paddingLeft: "6pt" }}>
                            <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "5pt", color: "#1e3a5f" }}>
                              {sub.id}. {sub.groupLabel}
                            </div>
                            {s2Rows.length === 0 ? (
                              <div style={{ fontSize: "11pt", color: "#bbb", fontStyle: "italic" }}>— Ажил байхгүй —</div>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4pt", fontSize: "11pt" }}>
                                <thead>
                                  <tr>
                                    <th style={thKpi}>№</th>
                                    <th style={thKpi}>АЖЛЫН НЭР</th>
                                    <th style={thKpi}>ГҮЙЦЭТГЭЛ %</th>
                                    <th style={thKpi}>ГҮЙЦЭТГЭЛ /ТОВЧ/</th>
                                    <th style={thKpi}>ХУГАЦАА</th>
                                    <th style={thKpi}>АЖИЛТАН</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s2Rows.map((row, ri) => (
                                    <tr key={ri}>
                                      <td style={tdKpi({ textAlign: "center", width: "5%" })}>{ri + 1}</td>
                                      <td style={tdKpi({ width: "35%" })}>{row.title}</td>
                                      <td style={tdKpi({ textAlign: "center", fontWeight: "bold", color: row.result ? "#1d4ed8" : "#bbb", width: "10%" })}>{row.result || ""}</td>
                                      <td style={tdKpi({ width: "20%" })}>{row.completion}</td>
                                      <td style={tdKpi({ width: "15%" })}>{row.period}</td>
                                      <td style={tdKpi({ width: "15%" })}>{row.employeeName ?? ""}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      }

                      if (sub.type === "dashboard") {
                        const dashRows = sub.dashboardRows ?? [];
                        return (
                          <div key={sub.id} style={{ marginBottom: "8pt", paddingLeft: "6pt" }}>
                            <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "5pt", color: "#1e3a5f" }}>
                              {sub.id}. {sub.groupLabel}
                            </div>
                            {dashRows.length === 0 ? (
                              <div style={{ fontSize: "11pt", color: "#bbb", fontStyle: "italic" }}>— Ажил байхгүй —</div>
                            ) : (
                              dashRows.map((row, ri) => (
                                <div key={ri} style={{ marginBottom: "8pt" }}>
                                  <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "2pt" }}>
                                    {ri + 1}. {row.title}
                                  </div>
                                  {row.description && (
                                    <div style={{ fontSize: "11pt", lineHeight: "1.7", whiteSpace: "pre-wrap", paddingLeft: "12pt", color: "#222" }}>
                                      {row.description}
                                    </div>
                                  )}
                                  {(row.images ?? []).map((img) => (
                                    <div key={img.id} style={{ textAlign: "center", margin: "6pt 0" }}>
                                      <img src={img.dataUrl} alt="" style={{ width: `${img.width}%`, maxWidth: "100%", display: "inline-block" }} />
                                    </div>
                                  ))}
                                </div>
                              ))
                            )}
                          </div>
                        );
                      }

                      const totalW = sub.rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
                      return (
                        <table key={sub.id} style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8pt" }}>
                          <thead>
                            <tr>
                              <th style={thKpi}></th>
                              <th style={thKpi}>ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
                              <th style={thKpi}>ХУВЬ</th>
                              <th style={thKpi}>ҮНЭЛГЭЭ</th>
                              <th style={thKpi}>ҮНЭЛСЭН ТАЙЛБАР</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.rows.map((row, ri) => (
                              <tr style={{ background: "#dbeafe" }} key={ri}>
                                {ri === 0 && (
                                  <td style={tdKpi({ fontWeight: "bold", textAlign: "center", background: "#dbeafe", width: "14%" })} rowSpan={sub.rows.length}>
                                    {sub.groupLabel}
                                  </td>
                                )}
                                <td style={tdKpi({ width: "40%" })}>{row.indicator}</td>
                                <td style={tdKpi({ textAlign: "center", width: "8%" })}>{row.weight}</td>
                                <td style={tdKpi({ textAlign: "center", width: "10%", fontWeight: "bold", color: row.score ? "#1d4ed8" : "#bbb" })}>{row.score || ""}</td>
                                <td style={tdKpi({ width: "28%", color: "#000" })}>{row.evaluatedBy}</td>
                              </tr>
                            ))}
                            <tr>
                              <td style={tdKpi({ textAlign: "center" })}></td>
                              <td style={tdKpi({ textAlign: "center", fontWeight: "bold" })}>Нийт</td>
                              <td style={tdKpi({ textAlign: "center", fontWeight: "bold" })}>{totalW}</td>
                              <td style={tdKpi()} colSpan={2}></td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })}
                  </div>
                ) : null}

                {s2kpiData ? (
                  <div style={{ paddingLeft: "6pt" }}>
                    {s2kpiData.map((sub) => {
                      const totalW = sub.rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
                      return (
                        <table key={sub.id} style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8pt" }}>
                          <thead>
                            <tr>
                              <th style={thKpi}></th>
                              <th style={thKpi}>ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
                              <th style={thKpi}>ХУВЬ</th>
                              <th style={thKpi}>ҮНЭЛГЭЭ</th>
                              <th style={thKpi}>ҮНЭЛСЭН ТАЙЛБАР</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.rows.map((row, ri) => (
                              <tr style={{ background: "#dbeafe" }} key={ri}>
                                {ri === 0 && (
                                  <td style={tdKpi({ fontWeight: "bold", textAlign: "center", background: "#dbeafe", width: "14%", verticalAlign: "middle" })} rowSpan={sub.rows.length}>
                                    {sub.groupLabel}
                                  </td>
                                )}
                                <td style={tdKpi({ width: "40%" })}>{row.indicator}</td>
                                <td style={tdKpi({ textAlign: "center", width: "8%" })}>{row.weight}</td>
                                <td style={tdKpi({ textAlign: "center", width: "10%", fontWeight: "bold", color: row.score ? "#1d4ed8" : "#bbb" })}>{row.score || ""}</td>
                                <td style={tdKpi({ width: "28%", color: "#000" })}>{row.evaluatedBy}</td>
                              </tr>
                            ))}
                            <tr>
                              <td style={tdKpi({ textAlign: "center" })}></td>
                              <td style={tdKpi({ textAlign: "center", fontWeight: "bold" })}>Нийт</td>
                              <td style={tdKpi({ textAlign: "center", fontWeight: "bold" })}>{totalW}</td>
                              <td style={tdKpi()} colSpan={2}></td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })}
                    {sec.content.trim() && (
                      <div style={{ marginBottom: "8pt" }}>
                        <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "4pt", color: "#1e3a5f" }}>
                          Ахисан түвшний дата анализын ажлын чанар, үр дүн:
                        </div>
                        <div style={{ fontSize: "11pt", lineHeight: "1.7", whiteSpace: "pre-wrap", color: "#000" }}>
                          {sec.content}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !hasContent ? (
                  <div style={{ fontSize: "11pt", color: "#bbb", fontStyle: "italic", paddingLeft: "9pt", marginBottom: "8pt" }}>
                    — Тайлан оруулаагүй —
                  </div>
                ) : (
                  <div style={{ paddingLeft: "9pt", marginBottom: "8pt" }}>
                    {sec.content.trim() && (<><div style={labelSt}>Тайлбар:</div><div style={bodyTxt}>{sec.content}</div></>)}
                    {sec.achievements.trim() && (<><div style={labelSt}>Амжилт, давуу тал:</div><div style={bodyTxt}>{sec.achievements}</div></>)}
                    {sec.issues.trim() && (<><div style={labelSt}>Бэрхшээл, сорилт:</div><div style={bodyTxt}>{sec.issues}</div></>)}
                    {sec.score.trim() && (
                      <div style={{ marginTop: "5pt" }}>
                        <span style={{ fontWeight: "bold", fontSize: "11pt" }}>Оноо: </span>
                        <span style={{ fontWeight: "bold", color: "#1d4ed8", fontSize: "11pt" }}>{sec.score}</span>
                        {!isNaN(parseFloat(sec.score)) && (
                          <span style={{ fontSize: "11pt", color: "#444", marginLeft: "6pt", fontStyle: "italic" }}>
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

        {/* ══ Page 2: Summary ══ */}
        <div style={page}>
          <div style={bigTitle}>ДАТА АНАЛИЗИЙН АЛБА</div>
          <div style={{ ...bigTitle, fontSize: "11pt", marginBottom: "3pt" }}>
            {year} ОНЫ {qName} УЛИРЛЫН БҮХ НИЙТИЙН НЭГТГЭЛ
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14pt" }}>
            <thead>
              <tr>
                {["№", "Тэлэв байдал", "Жин %", "Оноо", "Жинлэсэн оноо", "Үнэлгээ"].map((h) => (
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTION_DEFS.map((def, idx) => {
                const sec = sections[def.id] ?? emptySection();
                const sc = parseFloat(sec.score);
                const ws = !isNaN(sc) ? (sc * def.weight) / 100 : null;
                return (
                  <tr key={def.id}>
                    <td style={tdS({ textAlign: "center", width: "4%" })}>{idx + 1}</td>
                    <td style={tdS({ width: "46%" })}>{def.heading}</td>
                    <td style={tdS({ textAlign: "center", width: "8%" })}>{def.weight}%</td>
                    <td style={tdS({ textAlign: "center", width: "10%", fontWeight: "bold", color: "#1d4ed8" })}>{sec.score || "–"}</td>
                    <td style={tdS({ textAlign: "center", width: "12%", fontWeight: "bold", color: "#1d4ed8" })}>
                      {ws !== null ? ws.toFixed(3) : "–"}
                    </td>
                    <td style={tdS({ width: "20%", fontStyle: "italic", color: "#444" })}>
                      {!isNaN(sc) ? scoreLabel(sc) : "–"}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: "#e8eef6" }}>
                <td style={tdS({ textAlign: "center", fontWeight: "bold" })} colSpan={2}>НИЙТ ТҮЗ ОНОО:</td>
                <td style={tdS({ textAlign: "center", fontWeight: "bold" })}>100%</td>
                <td style={tdS()}></td>
                <td style={tdS({ textAlign: "center", fontWeight: "bold", fontSize: "11pt", color: "#1d4ed8" })}>
                  {totalWS > 0 ? totalWS.toFixed(3) : "–"}
                </td>
                <td style={tdS({ fontWeight: "bold", fontSize: "11pt", color: totalWS >= 4 ? "#16a34a" : totalWS >= 2.5 ? "#ca8a04" : "#dc2626" })}>
                  {totalWS > 0 ? scoreLabel(totalWS) : "–"}
                </td>
              </tr>
            </tbody>
          </table>

          {totalWS > 0 && (
            <div style={{ fontSize: "11pt", lineHeight: "1.7", marginBottom: "12pt", textAlign: "justify" }}>
              Дата анализийн алба {year} оны {qName} улирлын тэнцвэртэй үнэлгээний зургалалын нийт оноо{" "}
              <strong>{totalWS.toFixed(3)}</strong> байгаа нь{" "}
              <strong style={{ color: totalWS >= 4.5 ? "#15803d" : totalWS >= 3.5 ? "#1d4ed8" : totalWS >= 2.5 ? "#ca8a04" : "#dc2626" }}>
                &laquo;{scoreLabel(totalWS)}&raquo;
              </strong>{" "}
              үнэлгээтэй тохирч байна.
            </div>
          )}

          <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "5pt" }}>Оноогоор дүгнэх шалгуур:</div>
          <table style={{ width: "55%", borderCollapse: "collapse", fontSize: "11pt" }}>
            <thead>
              <tr>
                {["Оноо", "Биелэлт %", "Үнэлгээ"].map((h) => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[["5", "≥ 100%", "Маш сайн"], ["4", "90 – 99%", "Сайн"], ["3", "75 – 89%", "Хангалттай"], ["2", "60 – 74%", "Дунд"], ["1", "< 60%", "Хангалтгүй"]].map(([sc, pct, lbl]) => (
                <tr key={sc}>
                  <td style={tdS({ textAlign: "center", fontWeight: "bold", width: "15%" })}>{sc}</td>
                  <td style={tdS({ textAlign: "center", width: "30%" })}>{pct}</td>
                  <td style={tdS({ width: "55%" })}>{lbl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
