import {
  SECTION_DEFS,
  Q_NAMES,
  SectionReport,
  emptySection,
  mergeKpi,
  mergeKpiWithRows,
  DEFAULT_S1_KPI,
  DEFAULT_S2_KPI,
  DEFAULT_S3_KPI,
  DEFAULT_S4_KPI,
  DEFAULT_NEGTGEL_KPI,
  Section14Row,
  KpiSubSection,
  KpiRow,
} from "../_types";

export function buildWordHtml(
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
