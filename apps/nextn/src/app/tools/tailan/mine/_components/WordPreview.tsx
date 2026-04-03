"use client";

import React from "react";
import { parseContent } from "./RichEditor";
import { usePagination, mmToPx } from "../../_lib/usePagination";
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
  RowInlineImage,
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
  hiddenSections?: Set<string>;
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
  hiddenSections,
}: WordPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const hidden = hiddenSections ?? new Set<string>();

  // A4 pagination constants (px)
  const PAGE_H = mmToPx(297);
  const GAP_H = 20; // 20px grey gap between pages
  const PAD_TOP = mmToPx(15.9);
  const PAD_BOTTOM = mmToPx(22.2);

  usePagination(contentRef, PAGE_H, GAP_H, PAD_TOP, PAD_BOTTOM);

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

  // Compute dynamic Roman numerals based on visible sections
  const FIXED_SECTION_KEYS = [
    "s1",
    "s2",
    "s3",
    "s4",
    "s5",
    "s6",
    "s7",
  ] as const;
  const sectionRoman: Record<string, string> = {};
  let _romIdx = 0;
  for (const key of FIXED_SECTION_KEYS) {
    if (!hidden.has(key)) {
      sectionRoman[key] = ROMAN_NUMS[_romIdx++];
    }
  }
  const dynStartRomIdx = _romIdx;

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

  // render: outer grey container → zoom wrapper → paginated A4 pages
  const pageH = "297mm";
  const gapH = "20px";
  const padTop = "15.9mm";
  const padBottom = "22.2mm";
  const padLeft = "25.4mm";
  const padRight = "19mm";

  return (
    <div
      ref={containerRef}
      style={{
        background: "#d0d0d0",
        minHeight: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          zoom: scale,
          padding: `20px 20px`,
          width: "fit-content",
          minWidth: "100%",
        }}
      >
        {/* Outer wrapper: repeating page background with gaps */}
        <div
          className="mx-auto"
          style={{
            width: "210mm",
            position: "relative",
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              #ffffff 0px,
              #ffffff ${pageH},
              transparent ${pageH},
              transparent calc(${pageH} + ${gapH})
            )`,
            backgroundSize: `100% calc(${pageH} + ${gapH})`,
            paddingBottom: gapH,
          }}
        >
          {/* Shadow overlay for each page: use pseudo elements via box-shadow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              backgroundImage: `repeating-linear-gradient(
                to bottom,
                rgba(0,0,0,0.08) 0px,
                transparent 3px,
                transparent calc(${pageH} - 3px),
                rgba(0,0,0,0.08) ${pageH},
                rgba(0,0,0,0.15) calc(${pageH} + 2px),
                transparent calc(${pageH} + 2px),
                transparent calc(${pageH} + calc(${gapH} - 2px)),
                rgba(0,0,0,0.08) calc(${pageH} + ${gapH})
              )`,
              backgroundSize: `100% calc(${pageH} + ${gapH})`,
              zIndex: 1,
            }}
          />
          {/* Page content with correct padding */}
          <div
            ref={contentRef}
            style={{
              position: "relative",
              padding: `${padTop} ${padRight} ${padBottom} ${padLeft}`,
              fontFamily: "'Times New Roman', serif",
              fontSize: "11pt",
              lineHeight: "1.5",
              color: "#000",
              zIndex: 0,
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
            {!hidden.has("s1") && (
              <>
                <div style={headingStyle}>
                  {sectionRoman.s1}. Дата анализын үр дүнгээр аудитын үйл
                  ажиллагааг дэмжсэн байдал:
                </div>
                {plannedTasks.filter((t) => t.title?.trim()).length === 0 ? (
                  <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
                ) : (
                  <div style={{ marginBottom: "8pt" }}>
                    {plannedTasks
                      .filter((t) => t.title?.trim())
                      .map((t, idx) => (
                        <div key={t._id ?? idx} style={{ marginBottom: "6pt" }}>
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
                                      height: `${img.height ?? 280}px`,
                                      objectFit: "fill",
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
              </>
            )}

            {!hidden.has("s12") && (
              <>
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
                          <tr key={t._id ?? idx}>
                            <td
                              style={{ ...tdStyle("5%"), textAlign: "center" }}
                            >
                              {idx + 1}
                            </td>
                            <td style={tdStyle("30%")}>{t.title}</td>
                            <td
                              style={{ ...tdStyle("15%"), textAlign: "center" }}
                            >
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
                                const [s, e] = (t.period || "").split(
                                  " \u2013 ",
                                );
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
                              {t.summary
                                ? parseContent(t.summary, tableCounter)
                                : ""}
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
              </>
            )}
            {/* ── Section II ── */}
            {!hidden.has("s2") && (
              <>
                <div style={headingStyle}>
                  {sectionRoman.s2}. Аудитын үйл ажиллагаанд шаардлагатай
                  өгөгдөл боловсруулалтын ажил:
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
                        <tr key={t._id ?? idx}>
                          <td style={tdStyle("5%")} className="text-center">
                            {idx + 1}
                          </td>
                          <td style={tdStyle("30%")}>{t.title}</td>
                          <td
                            style={{ ...tdStyle("20%"), textAlign: "center" }}
                          >
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
                                height: `${img.height ?? 280}px`,
                                objectFit: "fill",
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
              </>
            )}

            {/* ── Section III ── */}
            {!hidden.has("s3") && (
              <>
                <div style={headingStyle}>
                  {sectionRoman.s3}. Тогтмол хийгддэг ажлууд
                </div>
                <div style={subHeadingStyle}>
                  Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь
                  гүйцэтгэсэн байдал:
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
                          <tr key={t._id ?? idx}>
                            <td
                              style={{ ...tdStyle("5%"), textAlign: "center" }}
                            >
                              {idx + 1}
                            </td>
                            <td style={tdStyle("40%")}>{t.title}</td>
                            <td style={tdStyle("35%")}>{t.value}</td>
                            <td
                              style={{ ...tdStyle("20%"), textAlign: "center" }}
                            >
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

                {!hidden.has("s32") && (
                  <>
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
                              <tr key={t._id ?? idx}>
                                <td
                                  style={{
                                    ...tdStyle("5%"),
                                    textAlign: "center",
                                  }}
                                >
                                  {idx + 1}
                                </td>
                                <td style={tdStyle("35%")}>{t.dashboard}</td>
                                <td style={tdStyle("40%")}>{t.value}</td>
                                <td
                                  style={{
                                    ...tdStyle("20%"),
                                    textAlign: "center",
                                  }}
                                >
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
                                    nums.reduce((a, b) => a + b, 0) /
                                      nums.length,
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
                  </>
                )}
              </>
            )}

            {/* ── Section IV ── */}
            {!hidden.has("s4") && (
              <>
                <div style={headingStyle}>
                  {sectionRoman.s4}. Хамрагдсан сургалт
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
                        <tr key={t._id ?? idx}>
                          <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                            {idx + 1}
                          </td>
                          <td style={tdStyle("25%")}>{t.training}</td>
                          <td
                            style={{ ...tdStyle("15%"), textAlign: "center" }}
                          >
                            {t.organizer}
                          </td>
                          <td
                            style={{ ...tdStyle("12%"), textAlign: "center" }}
                          >
                            {t.type}
                          </td>
                          <td
                            style={{ ...tdStyle("10%"), textAlign: "center" }}
                          >
                            {t.date ? t.date.replace(/-/g, ".") : ""}
                          </td>
                          <td
                            style={{ ...tdStyle("10%"), textAlign: "center" }}
                          >
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
              </>
            )}

            {/* ── Section V ── */}
            {!hidden.has("s5") && (
              <>
                <div style={headingStyle}>
                  {sectionRoman.s5}. Үүрэг даалгаварын биелэлт
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
                        <tr key={t._id ?? idx}>
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
              </>
            )}
            {/* ── Section VI ── */}
            {!hidden.has("s6") && (
              <>
                <div style={headingStyle}>
                  {sectionRoman.s6}. Хамт олны ажил
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
                      {["№", "Огноо", "Хамт олны ажил", "Санаачилга"].map(
                        (h) => (
                          <th key={h} style={thStyle}>
                            {h}
                          </th>
                        ),
                      )}
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
                        <tr key={t._id ?? idx}>
                          <td style={{ ...tdStyle("5%"), textAlign: "center" }}>
                            {idx + 1}
                          </td>
                          <td
                            style={{ ...tdStyle("20%"), textAlign: "center" }}
                          >
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
              </>
            )}
            {/* ── Section VII ── */}
            {!hidden.has("s7") && (
              <>
                <div style={headingStyle}>
                  {sectionRoman.s7}. Шинэ санал санаачилга
                </div>
                {section7Text?.trim() ? (
                  <div style={{ marginBottom: "8pt", whiteSpace: "pre-wrap" }}>
                    {section7Text}
                  </div>
                ) : (
                  <div style={{ marginBottom: "8pt" }}>&nbsp;</div>
                )}
              </>
            )}

            {/* ── Dynamic sections VIII, IX, … ── */}
            {dynamicSections.map((sec, idx) => {
              if (hidden.has(`dyn_${idx}`)) return null;
              const visibleBefore = dynamicSections
                .slice(0, idx)
                .filter((_, i) => !hidden.has(`dyn_${i}`)).length;
              const romIdx = dynStartRomIdx + visibleBefore;
              return (
                <div key={sec._id ?? idx}>
                  <div style={headingStyle}>
                    {ROMAN_NUMS[romIdx] ?? `${romIdx + 1}`}. {sec.title ?? ""}
                  </div>
                  {parseContent(sec.content, tableCounter)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HTML string export (identical to the preview above) ─────────────────────
function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineHtml(text: string): string {
  return text
    .split(/(\*\*[^*]*\*\*)/g)
    .map((p) =>
      p.startsWith("**") && p.endsWith("**")
        ? `<strong>${esc(p.slice(2, -2))}</strong>`
        : esc(p),
    )
    .join("");
}

function parseContentHtml(text: string, tc: { n: number }): string {
  const lines = (text ?? "").split("\n");
  let html = "";
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
        html += `<div style="margin-bottom:8pt"><div style="font-size:9pt;font-style:italic;margin-bottom:2pt">Хүснэгт ${tc.n}.</div>`;
        html += `<table style="width:100%;border-collapse:collapse;font-size:9.5pt"><tbody>`;
        dataRows.forEach((row, ri) => {
          const bg = ri === 0 ? "background:#1F3864;color:#fff" : "";
          html += `<tr style="${bg}">`;
          row.forEach((cell) => {
            html += `<td style="border:1px solid #888;padding:3px 5px">${esc(cell)}</td>`;
          });
          html += `</tr>`;
        });
        html += `</tbody></table></div>`;
      }
      continue;
    }
    if (line.startsWith("- ")) {
      html += `<ul style="margin-left:20pt;margin-bottom:4pt;list-style-type:disc">`;
      while (i < lines.length && lines[i].startsWith("- ")) {
        html += `<li style="margin-bottom:2pt">${renderInlineHtml(lines[i].slice(2))}</li>`;
        i++;
      }
      html += `</ul>`;
      continue;
    }
    if (/^\d+\. /.test(line)) {
      html += `<ol style="margin-left:20pt;margin-bottom:4pt">`;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        html += `<li style="margin-bottom:2pt">${renderInlineHtml(lines[i].replace(/^\d+\. /, ""))}</li>`;
        i++;
      }
      html += `</ol>`;
      continue;
    }
    html += `<div style="text-align:justify;margin-bottom:4pt">${line ? renderInlineHtml(line) : "&nbsp;"}</div>`;
    i++;
  }
  return html;
}

export interface BuildWordHtmlProps {
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
  hiddenSections?: Set<string>;
}

export function buildWordHtml(p: BuildWordHtmlProps): string {
  const tc = { n: 1 };
  const ic = { n: 1 };
  const hidden = p.hiddenSections ?? new Set<string>();

  const ROMAN = ROMAN_NUMS;

  // Compute dynamic Roman numerals based on visible sections
  const _fixedSectionKeys = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const;
  const _sectionRoman: Record<string, string> = {};
  let _buildRomIdx = 0;
  for (const key of _fixedSectionKeys) {
    if (!hidden.has(key)) {
      _sectionRoman[key] = ROMAN[_buildRomIdx++];
    }
  }
  const _dynRomStart = _buildRomIdx;

  const qName = ROMAN[(p.quarter - 1) % 4] ?? "I";
  const deptCode = deptAbbrevMn(p.userDepartment ?? "");
  const posUpper = (p.userPosition ?? "").toUpperCase();
  const nameUpper = (p.userName ?? "").toUpperCase();
  const titleText = `${deptCode ? `${deptCode}-НЫ ` : ""}${posUpper}${posUpper && nameUpper ? " " : ""}${nameUpper} ${p.year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`;

  const H = `font-family:'Times New Roman',Times,serif;font-size:11pt`;
  const heading = (t: string) =>
    `<div style="${H};font-weight:bold;margin-top:14pt;margin-bottom:6pt">${esc(t)}</div>`;
  const subHeading = (t: string) =>
    `<div style="${H};font-weight:bold;margin-top:10pt;margin-bottom:5pt">${esc(t)}</div>`;
  const th = (t: string, w?: string) =>
    `<th style="border:0.5px dotted #bbb;padding:4px 6px;text-align:center;font-weight:bold${w ? `;width:${w}` : ""}">${esc(t)}</th>`;
  const tdC = (t: string, w?: string) =>
    `<td style="border:0.5px dotted #ccc;padding:3px 5px;text-align:center${w ? `;width:${w}` : ""}">${esc(t)}</td>`;
  const tdL = (t: string, w?: string) =>
    `<td style="border:0.5px dotted #ccc;padding:3px 5px${w ? `;width:${w}` : ""}">${esc(t)}</td>`;
  const tdLH = (inner: string, w?: string) =>
    `<td style="border:0.5px dotted #ccc;padding:3px 5px${w ? `;width:${w}` : ""}">${inner}</td>`;
  const tblStart = `<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:10pt;font-family:'Times New Roman',serif;border:1px solid #000"><thead>`;
  const tblMid = `</thead><tbody>`;
  const tblEnd = `</tbody></table>`;
  const caption = () =>
    `<div style="font-size:9pt;font-style:italic;text-align:center;margin-bottom:2pt">Хүснэгт ${tc.n++}.</div>`;

  const fmtPeriodHtml = (period: string): string => {
    const [s, e] = (period ?? "").split(" – ");
    const fmt = (d?: string) => (d ? d.replace(/-/g, ".") : "");
    if (!s && !e) return "";
    if (!e) return fmt(s);
    return `${fmt(s)}-<br>${fmt(e)}`;
  };

  // A4 content width = 210mm - 25.4mm (left) - 19mm (right) = 165.6mm
  // Word ignores CSS percentage widths on <img>, so convert % → absolute mm.
  const CONTENT_WIDTH_MM = 165.6;
  const inlineImgHtml = (img: RowInlineImage): string => {
    if (!img.dataUrl) return "";
    const pct = img.width ?? 80;
    const wMm = Math.round((CONTENT_WIDTH_MM * pct) / 100);
    // Word ignores mm in the width/height attributes (only pixels accepted); convert at 96 DPI
    const wPx = Math.round((wMm * 96) / 25.4);
    const captureN = ic.n++;
    const hPx = img.height ?? 280;
    const hMm = Math.round((hPx * 25.4) / 96);
    const sizeStyle = `width:${wMm}mm;height:${hMm}mm;object-fit:fill;display:block;margin:0 auto`;
    const sizeAttr = `width="${wPx}" height="${hPx}"`;
    return (
      `<div style="text-align:center;margin-bottom:8pt;page-break-inside:avoid">` +
      `<img src="${img.dataUrl}" ${sizeAttr} style="${sizeStyle}" />` +
      `<div style="font-size:9pt;font-style:italic;margin-top:3pt">Зураг ${captureN}.</div></div>`
    );
  };

  let body = "";

  // Title
  body += `<div style="text-align:center;margin-bottom:20pt;font-weight:bold;font-size:11pt;text-transform:uppercase;font-family:'Times New Roman',serif">${esc(titleText)}</div>`;

  // ── Section I ──
  if (!hidden.has("s1")) {
    body += heading(
      `${_sectionRoman.s1}. Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал:`,
    );
    const filteredTasks = p.plannedTasks.filter((t) => t.title?.trim());
    if (filteredTasks.length === 0) {
      body += `<div style="margin-bottom:8pt">&nbsp;</div>`;
    } else {
      body += `<div style="margin-bottom:8pt">`;
      filteredTasks.forEach((t, idx) => {
        body += `<div style="margin-bottom:6pt"><span style="font-weight:bold">${idx + 1}. ${esc(t.title)}</span>`;
        if (t.description?.trim()) {
          body += `<div style="margin-left:16pt;margin-top:2pt;color:#080808">${parseContentHtml(t.description, tc)}</div>`;
        }
        if (t.images?.length > 0) {
          body += `<div style="margin-top:6pt">`;
          t.images.forEach((img) => {
            body += inlineImgHtml(img);
          });
          body += `</div>`;
        }
        body += `</div>`;
      });
      body += `</div>`;
    }
  }

  // I.2 dashboard table
  if (!hidden.has("s12")) {
    body += subHeading(
      "Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн:",
    );
    body += tblStart;
    body += `<tr style="background:#fff;color:#000">${["№", "Төлөвлөгөөт ажил", "Ажлын гүйцэтгэл", "Хийгдсэн хугацаа", "Гүйцэтгэл /товч/"].map((h) => th(h)).join("")}</tr>`;
    body += tblMid;
    if (p.section1Dashboards.length === 0) {
      body += `<tr>${[5, 30, 15, 20, 30].map((w) => tdL("&nbsp;", `${w}%`)).join("")}</tr>`;
    } else {
      p.section1Dashboards.forEach((t, idx) => {
        const nums1 = p.section1Dashboards
          .map((x) => parseFloat(x.completion))
          .filter((n) => !isNaN(n));
        body +=
          `<tr>` +
          tdC(`${idx + 1}`, "5%") +
          tdL(esc(t.title), "30%") +
          tdC(t.completion !== "" ? `${esc(t.completion)}%` : "", "15%") +
          `<td style="border:0.5px dotted #ccc;padding:3px 5px;text-align:center;width:20%;font-size:8.5pt">${fmtPeriodHtml(t.period ?? "")}</td>` +
          tdLH(parseContentHtml(t.summary ?? "", tc), "30%") +
          `</tr>`;
      });
      const nums1 = p.section1Dashboards
        .map((x) => parseFloat(x.completion))
        .filter((n) => !isNaN(n));
      const avg1 =
        nums1.length > 0
          ? Math.round(nums1.reduce((a, b) => a + b, 0) / nums1.length)
          : null;
      body +=
        `<tr>` +
        `<td colspan="2" style="border:0.5px dotted #ccc;padding:3px 5px;font-weight:bold;text-align:center;width:35%">Дундаж гүйцэтгэл</td>` +
        `<td style="border:0.5px dotted #ccc;padding:3px 5px;font-weight:bold;text-align:center;width:15%">${avg1 !== null ? `${avg1}%` : ""}</td>` +
        tdL("&nbsp;", "20%") +
        tdL("&nbsp;", "30%") +
        `</tr>`;
    }
    body += tblEnd;
    if (p.section1Dashboards.some((t) => t.images?.length > 0)) {
      body += `<div style="margin-bottom:8pt">`;
      p.section1Dashboards
        .filter((t) => t.images?.length > 0)
        .forEach((t) => {
          t.images.forEach((img) => {
            body += inlineImgHtml(img);
          });
        });
      body += `</div>`;
    }
    body += caption();
  }

  // ── Section II ──
  if (!hidden.has("s2")) {
    body += heading(
      `${_sectionRoman.s2}. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын ажил:`,
    );
    body += tblStart;
    body += `<tr style="background:#fff;color:#000">${["№", "Төлөвлөгөөт ажлууд<br>(Дууссан ажлууд)", "Ажлын гүйцэтгэл", "Хийгдсэн хугацаа", "Гүйцэтгэл/товч/"].map((h) => `<th style="border:0.5px dotted #bbb;padding:4px 6px;text-align:center;font-weight:bold">${h}</th>`).join("")}</tr>`;
    body += tblMid;
    if (p.section2Tasks.length === 0) {
      body += `<tr>${[5, 30, 20, 20, 25].map((w) => tdL("&nbsp;", `${w}%`)).join("")}</tr>`;
    } else {
      p.section2Tasks.forEach((t, idx) => {
        body +=
          `<tr>` +
          tdC(`${idx + 1}`, "5%") +
          tdL(esc(t.title), "30%") +
          tdC(t.result !== "" ? `${esc(t.result)}%` : "", "20%") +
          `<td style="border:0.5px dotted #ccc;padding:3px 5px;text-align:center;width:20%;font-size:8.5pt">${fmtPeriodHtml(t.period ?? "")}</td>` +
          tdL(esc(t.completion), "25%") +
          `</tr>`;
      });
    }
    body += tblEnd;
    if (p.section2Tasks.some((t) => t.images?.length > 0)) {
      body += `<div style="margin-bottom:8pt">`;
      p.section2Tasks
        .filter((t) => t.images?.length > 0)
        .forEach((t) => {
          t.images.forEach((img) => {
            body += inlineImgHtml(img);
          });
        });
      body += `</div>`;
    }
    body += caption();
  }

  // ── Section III ──
  if (!hidden.has("s3")) {
    body += heading(`${_sectionRoman.s3}. Тогтмол хийгддэг ажлууд`);
    body += subHeading(
      "Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал:",
    );
    body += tblStart;
    body += `<tr style="background:#fff;color:#000">${["№", "Тогтмол хийгддэг өгөгдөл боловсруулалт", "Өгөгдөл боловсруулалтын ажлын ач холбогдол,хэрэглээ", "Хэрэглэгчийн нэгжийн өгсөн үнэлгээ"].map((h) => th(h)).join("")}</tr>`;
    body += tblMid;
    if (p.section3AutoTasks.length === 0) {
      body += `<tr>${[5, 40, 35, 20].map((w) => tdL("&nbsp;", `${w}%`)).join("")}</tr>`;
    } else {
      p.section3AutoTasks.forEach((t, idx) => {
        body +=
          `<tr>` +
          tdC(`${idx + 1}`, "5%") +
          tdL(esc(t.title), "40%") +
          tdL(esc(t.value), "35%") +
          tdC(esc(t.rating), "20%") +
          `</tr>`;
      });
      const nums3a = p.section3AutoTasks
        .map((t) => parseFloat(t.rating))
        .filter((n) => !isNaN(n));
      const avg3a =
        nums3a.length > 0
          ? Math.round(nums3a.reduce((a, b) => a + b, 0) / nums3a.length)
          : null;
      body += `<tr><td colspan="3" style="border:0.5px dotted #ccc;padding:3px 5px;font-weight:bold;text-align:center;width:80%">Дундаж үнэлгээ</td><td style="border:0.5px dotted #ccc;padding:3px 5px;font-weight:bold;text-align:center;width:20%">${avg3a !== null ? `${avg3a}%` : ""}</td></tr>`;
    }
    body += tblEnd + caption();

    if (!hidden.has("s32")) {
      body += subHeading(
        "Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал:",
      );
      body += tblStart;
      body += `<tr style="background:#fff;color:#000">${["№", "Дашбоард", "Дашбоардын ач холбогдол,хэрэглээ", "Хэрэглэгч нэгжийн өгсөн үнэлгээ"].map((h) => th(h)).join("")}</tr>`;
      body += tblMid;
      if (p.section3Dashboards.length === 0) {
        body += `<tr>${[5, 35, 40, 20].map((w) => tdL("&nbsp;", `${w}%`)).join("")}</tr>`;
      } else {
        p.section3Dashboards.forEach((t, idx) => {
          body +=
            `<tr>` +
            tdC(`${idx + 1}`, "5%") +
            tdL(esc(t.dashboard), "35%") +
            tdL(esc(t.value), "40%") +
            tdC(esc(t.rating), "20%") +
            `</tr>`;
        });
        const nums3d = p.section3Dashboards
          .map((t) => parseFloat(t.rating))
          .filter((n) => !isNaN(n));
        const avg3d =
          nums3d.length > 0
            ? Math.round(nums3d.reduce((a, b) => a + b, 0) / nums3d.length)
            : null;
        body += `<tr><td colspan="3" style="border:0.5px dotted #ccc;padding:3px 5px;font-weight:bold;text-align:center;width:80%">Дундаж үнэлгээ</td><td style="border:0.5px dotted #ccc;padding:3px 5px;font-weight:bold;text-align:center;width:20%">${avg3d !== null ? `${avg3d}%` : ""}</td></tr>`;
      }
      body += tblEnd + caption();
    }
  }

  // ── Section IV ──
  if (!hidden.has("s4")) {
    body += heading(`${_sectionRoman.s4}. Хамрагдсан сургалт`);
    body += tblStart;
    body += `<tr style="background:#fff;color:#000">${["№", "Хамрагдсан сургалт", "Зохион байгуулагч", "Сургалтын төрөл", "Хэзээ", "Сургалтын хэлбэр", "Цаг", "Аудитын зорилгод нийцсэн эсэх", "Мэдлэгээ хуваалцсан эсэх"].map((h) => th(h)).join("")}</tr>`;
    body += tblMid;
    if (p.section4Trainings.length === 0) {
      body += `<tr>${[5, 25, 15, 12, 10, 10, 7, 8, 8].map((w) => tdL("&nbsp;", `${w}%`)).join("")}</tr>`;
    } else {
      p.section4Trainings.forEach((t, idx) => {
        body +=
          `<tr>` +
          tdC(`${idx + 1}`, "5%") +
          tdL(esc(t.training), "25%") +
          tdC(esc(t.organizer), "15%") +
          tdC(esc(t.type), "12%") +
          tdC(t.date ? t.date.replace(/-/g, ".") : "", "10%") +
          tdC(esc(t.format), "10%") +
          tdC(t.hours ? `${esc(t.hours)} цаг` : "", "7%") +
          tdC(esc(t.meetsAuditGoal), "8%") +
          tdC(esc(t.sharedKnowledge), "8%") +
          `</tr>`;
      });
    }
    body += tblEnd + caption();
    body += subHeading("Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал:");
    body += p.section4KnowledgeText?.trim()
      ? `<div style="margin-bottom:8pt;white-space:pre-wrap">${esc(p.section4KnowledgeText)}</div>`
      : `<div style="margin-bottom:8pt">&nbsp;</div>`;
  }

  // ── Section V ──
  if (!hidden.has("s5")) {
    body += heading(`${_sectionRoman.s5}. Үүрэг даалгаварын биелэлт`);
    body += tblStart;
    body += `<tr style="background:#fff;color:#000">${["№", "Ажлын төрөл", "Хийгдсэн ажил"].map((h) => th(h)).join("")}</tr>`;
    body += tblMid;
    if (p.section5Tasks.length === 0) {
      body += `<tr>${[5, 35, 60].map((w) => tdL("&nbsp;", `${w}%`)).join("")}</tr>`;
    } else {
      p.section5Tasks.forEach((t, idx) => {
        body +=
          `<tr>` +
          tdC(`${idx + 1}`, "5%") +
          tdL(esc(t.taskType), "35%") +
          tdLH(parseContentHtml(t.completedWork ?? "", tc), "60%") +
          `</tr>`;
      });
    }
    body += tblEnd + caption();
  }

  // ── Section VI ──
  if (!hidden.has("s6")) {
    body += heading(`${_sectionRoman.s6}. Хамт олны ажил`);
    body += tblStart;
    body += `<tr style="background:#fff;color:#000">${["№", "Огноо", "Хамт олны ажил", "Санаачилга"].map((h) => th(h)).join("")}</tr>`;
    body += tblMid;
    if (p.section6Activities.length === 0) {
      body += `<tr>${[5, 20, 50, 25].map((w) => tdL("&nbsp;", `${w}%`)).join("")}</tr>`;
    } else {
      p.section6Activities.forEach((t, idx) => {
        body +=
          `<tr>` +
          tdC(`${idx + 1}`, "5%") +
          tdC(t.date ? t.date.replace(/-/g, ".") : "", "20%") +
          tdL(esc(t.activity), "50%") +
          tdL(esc(t.initiative), "25%") +
          `</tr>`;
      });
    }
    body += tblEnd + caption();
  }

  // ── Section VII ──
  if (!hidden.has("s7")) {
    body += heading(`${_sectionRoman.s7}. Шинэ санал санаачилга`);
    body += p.section7Text?.trim()
      ? `<div style="margin-bottom:8pt;white-space:pre-wrap">${esc(p.section7Text)}</div>`
      : `<div style="margin-bottom:8pt">&nbsp;</div>`;
  }

  // ── Dynamic sections VIII, IX, … ──
  let _dynVisIdx = 0;
  p.dynamicSections.forEach((sec, idx) => {
    if (hidden.has(`dyn_${idx}`)) return;
    const romIdx = _dynRomStart + _dynVisIdx;
    _dynVisIdx++;
    const rom = ROMAN[romIdx] ?? `${romIdx + 1}`;
    body += heading(`${rom}. ${sec.title ?? ""}`);
    body += parseContentHtml(sec.content ?? "", tc);
  });

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
  @page { size:A4 portrait; margin:15.9mm 19mm 22.2mm 25.4mm }
  body { font-family:'Times New Roman',Times,serif; font-size:11pt; line-height:1.5; color:#000 }
  table { border-collapse:collapse; width:100% }
</style>
</head>
<body>${body}</body></html>`;
}
