import React from "react";
import { SECTION_DEFS, SectionReport, DEFAULT_S1_KPI, DEFAULT_S2_KPI, DashboardRow, Section2TaskRow, Section14Row } from "./_types";
import { KpiTableEditor } from "./_KpiTableEditor";

export function SectionEditor({
  def, report, onChange, onApiLoad, onS2TableApiLoad, onS14TableApiLoad,
}: {
  def: (typeof SECTION_DEFS)[number];
  report: SectionReport;
  onChange: (updated: SectionReport) => void;
  onApiLoad?: (si: number) => Promise<DashboardRow[]>;
  onS2TableApiLoad?: (si: number) => Promise<Section2TaskRow[]>;
  onS14TableApiLoad?: (si: number) => Promise<Section14Row[]>;
}) {
  const field = (key: keyof SectionReport, value: string) =>
    onChange({ ...report, [key]: value });

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 resize-none leading-relaxed";

  const kpiData = def.id === "s1"
    ? (report.kpiTable && report.kpiTable.length > 0 ? report.kpiTable : DEFAULT_S1_KPI)
    : [];

  const s2kpiData = def.id === "s2"
    ? (report.s2kpiTable && report.s2kpiTable.length > 0 ? report.s2kpiTable : DEFAULT_S2_KPI)
    : [];

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <div className="text-sm font-bold text-white mb-0.5">{def.num}. {def.heading}</div>
        {"subtitle" in def && (def as { subtitle?: string }).subtitle && (
          <div className="text-xs text-slate-300 font-bold mb-0.5">({(def as { subtitle?: string }).subtitle})</div>
        )}
      </div>

      {def.id === "s1" ? (
        <KpiTableEditor
          subSections={kpiData}
          onChange={(updated) => onChange({ ...report, kpiTable: updated })}
          onApiLoad={onApiLoad}
          onS2TableApiLoad={onS2TableApiLoad}
          onS14TableApiLoad={onS14TableApiLoad}
        />
      ) : def.id === "s2" ? (
        <>
          <KpiTableEditor
            subSections={s2kpiData}
            onChange={(updated) => onChange({ ...report, s2kpiTable: updated })}
          />
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Ахисан түвшний дата анализын ажлын чанар, үр дүн:
            </label>
            <textarea
              rows={6}
              value={report.content}
              onChange={(e) => field("content", e.target.value)}
              placeholder="Ахисан түвшний дата анализын талаар дэлгэрэнгүйгээр бичнэ..."
              className={inputCls}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Ерөнхий тайлбар</label>
            <textarea
              rows={5}
              value={report.content}
              onChange={(e) => field("content", e.target.value)}
              placeholder="Энэ тэлэвийн хүрээнд хийсэн ажил, үйл ажиллагааны талаар дэлгэрэнгүй тайлбар бичнэ..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Амжилт, давуу тал</label>
            <textarea
              rows={3}
              value={report.achievements}
              onChange={(e) => field("achievements", e.target.value)}
              placeholder="Тайлант хугацаанд гарсан амжилт, сайн үр дүн, давуу талыг тэмдэглэнэ..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Бэрхшээл, сорилт</label>
            <textarea
              rows={3}
              value={report.issues}
              onChange={(e) => field("issues", e.target.value)}
              placeholder="Тайлант хугацаанд тулгарсан бэрхшээл, шийдвэрлэх шаардлагатай асуудлуудыг тэмдэглэнэ..."
              className={inputCls}
            />
          </div>
        </>
      )}
    </div>
  );
}
