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
  images: _images,
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
