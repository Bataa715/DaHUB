import React from "react";
import {
  KpiRow, KpiSubSection, DashboardRow, Section2TaskRow, Section14Row,
  PRODUCT_TYPES,
} from "./_types";

// ─── DashTaskCard ─────────────────────────────────────────────────────────────

export function DashTaskCard({
  index, row, onChangeTitle, onChangeDesc, onRemove,
}: {
  index: number;
  row: DashboardRow;
  onChangeTitle: (v: string) => void;
  onChangeDesc: (v: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const iCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60";
  return (
    <div className="bg-slate-700/20">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-700/40 transition select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs text-slate-500 w-5 shrink-0 text-center">{index + 1}</span>
        <span className="flex-1 text-xs font-semibold text-white truncate">
          {row.title || <span className="font-normal text-slate-500">Ажлын нэр...</span>}
        </span>
        {(row.images ?? []).length > 0 && (
          <span className="text-[9px] text-slate-500">{row.images!.length} зур</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-red-400/60 hover:text-red-400 transition"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {/* Expanded */}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40">
          <div className="pt-2">
            <label className="block text-[10px] text-slate-400 mb-1">Ажлын нэр</label>
            <input value={row.title} onChange={(e) => onChangeTitle(e.target.value)} placeholder="Ажлын нэр..." className={iCls + " font-bold"} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Гүйцэтгэл /тайлбар/</label>
            <textarea
              rows={4}
              value={row.description}
              onChange={(e) => onChangeDesc(e.target.value)}
              placeholder="Дэлгэрэнгүй тайлбар..."
              className={iCls + " resize-none leading-relaxed"}
            />
          </div>
          {(row.images ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {row.images!.map((img) => (
                <img key={img.id} src={img.dataUrl} alt="" className="h-16 rounded border border-slate-700/50 object-cover" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI Table Editor ─────────────────────────────────────────────────────────

export function KpiTableEditor({
  subSections,
  onChange,
  onApiLoad,
  onS2TableApiLoad,
  onS14TableApiLoad,
}: {
  subSections: KpiSubSection[];
  onChange: (updated: KpiSubSection[]) => void;
  onApiLoad?: (si: number) => Promise<DashboardRow[]>;
  onS2TableApiLoad?: (si: number) => Promise<Section2TaskRow[]>;
  onS14TableApiLoad?: (si: number) => Promise<Section14Row[]>;
}) {
  const iCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60";

  const updateSection14Row = (si: number, ri: number, field: "title" | "productType" | "savedDays" | "employeeName", value: string) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, section14Rows: (sub.section14Rows ?? []).map((row, r) => r !== ri ? row : { ...row, [field]: value }) }
    ));

  const addSection14Row = (si: number, group: "new" | "used") =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, section14Rows: [...(sub.section14Rows ?? []), { title: "", productType: "Өгөгдөл боловсруулалт", savedDays: "", group, employeeName: "" }] }
    ));

  const removeSection14Row = (si: number, ri: number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, section14Rows: (sub.section14Rows ?? []).filter((_, r) => r !== ri) }
    ));

  const updateSection14Text = (si: number, value: string) =>
    onChange(subSections.map((sub, s) => s !== si ? sub : { ...sub, section14Text: value }));

  const updateSection2Row = (si: number, ri: number, field: "title" | "result" | "period" | "completion" | "employeeName", value: string) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, section2Rows: (sub.section2Rows ?? []).map((row, r) => r !== ri ? row : { ...row, [field]: value }) }
    ));

  const addSection2Row = (si: number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, section2Rows: [...(sub.section2Rows ?? []), { order: (sub.section2Rows?.length ?? 0) + 1, title: "", result: "", period: "", completion: "", employeeName: "", images: [] }] }
    ));

  const removeSection2Row = (si: number, ri: number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, section2Rows: (sub.section2Rows ?? []).filter((_, r) => r !== ri) }
    ));

  const updateRow = (si: number, ri: number, field: keyof KpiRow, value: string | number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, rows: sub.rows.map((row, r) => r !== ri ? row : { ...row, [field]: value }) }
    ));

  const updateSub = (si: number, field: "id" | "groupLabel", value: string) =>
    onChange(subSections.map((sub, s) => s !== si ? sub : { ...sub, [field]: value }));

  const addRow = (si: number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, rows: [...sub.rows, { indicator: "", weight: 10, score: "", evaluatedBy: "" }] }
    ));

  const removeRow = (si: number, ri: number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, rows: sub.rows.filter((_, r) => r !== ri) }
    ));

  const updateDashRow = (si: number, ri: number, field: "title" | "description", value: string) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, dashboardRows: (sub.dashboardRows ?? []).map((row, r) => r !== ri ? row : { ...row, [field]: value }) }
    ));

  const addDashRow = (si: number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, dashboardRows: [...(sub.dashboardRows ?? []), { title: "", description: "", images: [] }] }
    ));

  const removeDashRow = (si: number, ri: number) =>
    onChange(subSections.map((sub, s) =>
      s !== si ? sub : { ...sub, dashboardRows: (sub.dashboardRows ?? []).filter((_, r) => r !== ri) }
    ));

  return (
    <div className="space-y-4">
      {subSections.map((sub, si) => {

        // ── Section14Table (1.4 style) ────────────────────────────────────────
        if (sub.type === "section14table") {
          const all14 = sub.section14Rows ?? [];
          const newRows = all14.filter(r => r.group === "new");
          const usedRows = all14.filter(r => r.group === "used");

          const renderGroup = (group: "new" | "used", rows: Section14Row[], startIdx: number) => {
            const label = group === "new"
              ? "Тайлант хугацаанд шинээр нэвтрүүлсэн дата бүтээгдэхүүн"
              : "Тайлант хугацаанд аудитын үйл ажиллагаанд ашигласан дата бүтээгдэхүүн";
            const total = rows.reduce((s, r) => s + (parseFloat(r.savedDays) || 0), 0);
            return (
              <>
                <tr className="bg-slate-800/60">
                  <td colSpan={5} className="border border-slate-700/40 px-2 py-1.5 text-center text-[10px] font-bold text-slate-300">{label}</td>
                </tr>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="border border-slate-700/40 px-2 py-2 text-center text-slate-600 text-[10px]">— Мэдээлэл байхгүй —</td></tr>
                )}
                {rows.map((row, li) => {
                  const ri = startIdx + li;
                  return (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400 text-xs">{li + 1}</td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input value={row.title} onChange={(e) => updateSection14Row(si, ri, "title", e.target.value)} placeholder="Бүтээгдэхүүний нэр..." className={iCls} />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <select value={row.productType} onChange={(e) => updateSection14Row(si, ri, "productType", e.target.value)} className={iCls}>
                          {PRODUCT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                        </select>
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input value={row.savedDays} onChange={(e) => updateSection14Row(si, ri, "savedDays", e.target.value)} placeholder="–" className={`${iCls} text-center`} />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button onClick={() => removeSection14Row(si, ri)} className="text-slate-600 hover:text-rose-400 text-sm leading-none">×</button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-800/40">
                  <td colSpan={3} className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-[10px] text-slate-400">НИЙТ</td>
                  <td className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white text-xs">{total > 0 ? total : "–"}</td>
                  <td className="border border-slate-700/40">
                    <button onClick={() => addSection14Row(si, group)} className="w-full text-[10px] text-slate-500 hover:text-blue-400 transition-colors">+</button>
                  </td>
                </tr>
              </>
            );
          };

          return (
            <div key={si} className="border border-slate-700/40 rounded-xl overflow-hidden">
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input value={sub.id} onChange={(e) => updateSub(si, "id", e.target.value)} className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none" />
                <input value={sub.groupLabel} onChange={(e) => updateSub(si, "groupLabel", e.target.value)} placeholder="Хэсгийн нэр..." className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none" />
                {onS14TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS14TableApiLoad(si);
                      onChange(subSections.map((sub2, s) => s !== si ? sub2 : { ...sub2, section14Rows: rows }));
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <div className="px-3 pt-2 pb-1">
                <label className="block text-[10px] text-slate-400 mb-1">Тайлбар текст</label>
                <textarea
                  rows={3}
                  value={sub.section14Text ?? ""}
                  onChange={(e) => updateSection14Text(si, e.target.value)}
                  placeholder="Тайлант хугацаанд хэмнэсэн нөөц, цаг хугацааны талаарх тайлбар..."
                  className={iCls + " resize-none leading-relaxed"}
                />
              </div>
              <div className="px-3 pb-3">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-400/30 text-amber-100">
                      <th className="border border-slate-700/40 px-2 py-1.5 text-center w-8">№</th>
                      <th className="border border-slate-700/40 px-2 py-1.5 text-left">ДАТА БҮТЭЭГДЭХҮҮН</th>
                      <th className="border border-slate-700/40 px-2 py-1.5 w-40">БҮТЭЭГДЭХҮҮНИЙ ТӨРӨЛ</th>
                      <th className="border border-slate-700/40 px-2 py-1.5 text-center w-24">ХЭМНЭСЭН ХҮН/ӨДӨР</th>
                      <th className="border border-slate-700/40 w-7"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderGroup("new", newRows, 0)}
                    {renderGroup("used", usedRows, newRows.length)}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        // ── Section2Table (1.3 style) ─────────────────────────────────────────
        if (sub.type === "section2table") {
          const s2Rows = sub.section2Rows ?? [];
          return (
            <div key={si} className="border border-slate-700/40 rounded-xl overflow-hidden">
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input value={sub.id} onChange={(e) => updateSub(si, "id", e.target.value)} className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none" />
                <input value={sub.groupLabel} onChange={(e) => updateSub(si, "groupLabel", e.target.value)} placeholder="Хэсгийн нэр..." className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none" />
                {onS2TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS2TableApiLoad(si);
                      onChange(subSections.map((sub2, s) => s !== si ? sub2 : { ...sub2, section2Rows: rows }));
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-400/30 text-amber-100">
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-8">№</th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">АЖЛЫН НЭР</th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-16">ГҮЙЦЭТГЭЛ %</th>
                    <th className="border border-slate-700/40 px-2 py-1.5 w-28">ГҮЙЦЭТГЭЛ /ТОВЧ/</th>
                    <th className="border border-slate-700/40 px-2 py-1.5 w-36">ХУГАЦАА</th>
                    <th className="border border-slate-700/40 px-2 py-1.5 w-24">АЖИЛТАН</th>
                    <th className="border border-slate-700/40 w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {s2Rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="border border-slate-700/40 px-3 py-3 text-center text-slate-600 text-[11px]">
                        Ажил байхгүй — "Хувийн тайланаас татах" эсвэл "+" товч дарна уу
                      </td>
                    </tr>
                  )}
                  {s2Rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400">{ri + 1}</td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input value={row.title} onChange={(e) => updateSection2Row(si, ri, "title", e.target.value)} placeholder="Ажлын нэр..." className={iCls} />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input type="number" value={row.result} onChange={(e) => updateSection2Row(si, ri, "result", e.target.value)} placeholder="%" className={`${iCls} text-center`} />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input value={row.completion} onChange={(e) => updateSection2Row(si, ri, "completion", e.target.value)} placeholder="Гүйцэтгэл..." className={iCls} />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input value={row.period} onChange={(e) => updateSection2Row(si, ri, "period", e.target.value)} placeholder="Хугацаа..." className={iCls} />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input value={row.employeeName ?? ""} onChange={(e) => updateSection2Row(si, ri, "employeeName", e.target.value)} placeholder="Ажилтан..." className={iCls} />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button onClick={() => removeSection2Row(si, ri)} className="text-slate-600 hover:text-rose-400 text-sm leading-none" title="Устгах">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button onClick={() => addSection2Row(si)} className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">+ Ажил нэмэх</button>
              </div>
            </div>
          );
        }

        // ── Dashboard (1.2 style) ─────────────────────────────────────────────
        if (sub.type === "dashboard") {
          const dashRows = sub.dashboardRows ?? [];
          return (
            <div key={si} className="border border-slate-700/40 rounded-xl overflow-hidden">
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input value={sub.id} onChange={(e) => updateSub(si, "id", e.target.value)} className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none" />
                <input value={sub.groupLabel} onChange={(e) => updateSub(si, "groupLabel", e.target.value)} placeholder="Хэсгийн нэр..." className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none" />
                {onApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onApiLoad(si);
                      onChange(subSections.map((sub2, s) => s !== si ? sub2 : { ...sub2, dashboardRows: rows }));
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-700/30">
                {dashRows.length === 0 && (
                  <div className="px-4 py-4 text-center text-slate-600 text-[11px]">
                    Ажил байхгүй — "Хувийн тайланаас татах" эсвэл "+" товч дарна уу
                  </div>
                )}
                {dashRows.map((row, ri) => (
                  <DashTaskCard
                    key={ri}
                    index={ri}
                    row={row}
                    onChangeTitle={(v) => updateDashRow(si, ri, "title", v)}
                    onChangeDesc={(v) => updateDashRow(si, ri, "description", v)}
                    onRemove={() => removeDashRow(si, ri)}
                  />
                ))}
              </div>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button onClick={() => addDashRow(si)} className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">+ Ажил нэмэх</button>
              </div>
            </div>
          );
        }

        // ── KPI (1.1 style) ───────────────────────────────────────────────────
        const totalW = sub.rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
        return (
          <div key={si} className="border border-slate-700/40 rounded-xl overflow-hidden">
            <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
              <input value={sub.id} onChange={(e) => updateSub(si, "id", e.target.value)} className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none" />
              <input value={sub.groupLabel} onChange={(e) => updateSub(si, "groupLabel", e.target.value)} placeholder="Хэсгийн нэр..." className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none" />
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-400/30 text-amber-100">
                  <th className="border border-slate-700/40 px-2 py-1.5 text-left">ТҮЛХҮҮР ҮЗҮҮЛЭЛТ</th>
                  <th className="border border-slate-700/40 px-2 py-1.5 text-center w-14">ХУВЬ</th>
                  <th className="border border-slate-700/40 px-2 py-1.5 text-center w-16">ҮНЭЛГЭЭ</th>
                  <th className="border border-slate-700/40 px-2 py-1.5 w-44">ҮНЭЛСЭН ТАЙЛБАР</th>
                  <th className="border border-slate-700/40 w-7"></th>
                </tr>
              </thead>
              <tbody>
                {sub.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-700/30">
                    <td className="border border-slate-700/40 px-1 py-1">
                      <input value={row.indicator} onChange={(e) => updateRow(si, ri, "indicator", e.target.value)} placeholder="Үзүүлэлт..." className={iCls} />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1">
                      <input type="number" value={row.weight} onChange={(e) => updateRow(si, ri, "weight", Number(e.target.value))} className={`${iCls} text-center`} />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1">
                      <input value={row.score} onChange={(e) => updateRow(si, ri, "score", e.target.value)} placeholder="Оноо" className={`${iCls} text-center`} />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1">
                      <input value={row.evaluatedBy} onChange={(e) => updateRow(si, ri, "evaluatedBy", e.target.value)} className={iCls} />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1 text-center">
                      <button onClick={() => removeRow(si, ri)} className="text-slate-600 hover:text-rose-400 text-sm leading-none" title="Устгах">×</button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-800/40">
                  <td className="border border-slate-700/40 px-2 py-1.5 text-center text-slate-400 font-bold text-[10px]">Нийт</td>
                  <td className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white">{totalW}</td>
                  <td className="border border-slate-700/40" colSpan={3}></td>
                </tr>
              </tbody>
            </table>
            <div className="px-3 py-1.5 bg-slate-900/40">
              <button onClick={() => addRow(si)} className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">+ Мөр нэмэх</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
