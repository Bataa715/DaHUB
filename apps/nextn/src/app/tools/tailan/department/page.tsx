"use client";

import React from "react";
import {
  ArrowLeft,
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

import {
  SECTION_DEFS,
  getCurrentYear,
  scoreLabel,
  emptySection,
  SectionReport,
} from "./_types";
import { SectionEditor } from "./_SectionEditor";
import { WordPreview } from "./_WordPreview";
import { AutoTextarea } from "./_KpiTableEditor";
import { useDepartmentReport } from "./_hooks/useDepartmentReport";

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

export default function TailanBscPage() {
  const {
    year, setYear,
    quarter, setQuarter,
    activeTab, setActiveTab,
    sidebarOpen, setSidebarOpen,
    sections,
    saving,
    lastSaved,
    toast,
    showToast,
    updateSection,
    negtgelKpi,
    updateNegtgelRow,
    updateNegtgelGroupLabel,
    handleS1ApiLoad,
    handleS1_13ApiLoad,
    handleS1_14ApiLoad,
    handleS2_23ApiLoad,
    handleS2_24ApiLoad,
    handleS3_33ApiLoad,
    handleS3_34ApiLoad,
    handleS4_42ApiLoad,
    handleS4_43ApiLoad,
    handleDbSave,
    handleWordExport,
    totalWS,
    isEval,
    activeDef,
    qName,
  } = useDepartmentReport();

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
              { length: getCurrentYear() - 2020 + 1 },
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
