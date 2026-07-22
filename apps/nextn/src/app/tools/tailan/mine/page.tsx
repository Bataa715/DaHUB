"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Trash2,
  Download,
  Send,
  Save,
  ArrowLeft,
  Loader2,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { GenericSectionEditor } from "./_components/GenericSectionEditor";
import { RealDocxPreview } from "./_components/RealDocxPreview";
import { useTailanGenericReport } from "./_hooks/useTailanGenericReport";

const inputCls =
  "w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1";
const textareaCls = `${inputCls} min-h-[100px] resize-y`;

const ROMAN_NUMS = [
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
];

// ─── Main Page (template-driven, generic) ──────────────────────────────────
export default function TailanMinePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const report = useTailanGenericReport(user?.name, user?.departmentId);
  const {
    year,
    setYear,
    quarter,
    setQuarter,
    cyrillicName,
    setCyrillicName,
    template,
    templateLoading,
    collapsedSections,
    toggleSection,
    hiddenSections,
    toggleHideSection,
    getRows,
    getText,
    setText,
    addRow,
    removeRow,
    updateRow,
    dynamicSections,
    addDynSection,
    removeDynSection,
    updateDynSection,
    saving,
    submitting,
    downloading,
    savedMsg,
    handleSave,
    handleSubmit,
    handleDownload,
    buildPayload,
  } = report;

  const sortedSections = [...(template?.sections ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const visibleMainKeys = sortedSections
    .filter((s) => s.headingLevel === "main" && !hiddenSections.has(s.key))
    .map((s) => s.key);
  const romanByKey = new Map(
    visibleMainKeys.map((key, i) => [key, ROMAN_NUMS[i] ?? `${i + 1}`]),
  );
  const nextDynRoman =
    ROMAN_NUMS[visibleMainKeys.length] ?? `${visibleMainKeys.length + 1}`;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* --- LEFT: Editor --- */}
      <div className="flex flex-col w-1/2 border-r border-border/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href="/tools/tailan"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </Link>
            <span className="font-semibold text-foreground text-sm">
              {t("tailan_myReportTitle")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {savedMsg && (
              <span
                className={`text-xs flex items-center gap-1 ${savedMsg.startsWith("❌") ? "text-red-400" : "text-emerald-400"}`}
              >
                {savedMsg.startsWith("❌") ? (
                  <X className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {savedMsg.replace(/^❌ /, "")}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted text-foreground text-xs font-medium transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {t("save")}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground text-xs font-medium transition disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("tailan_downloadWord")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-foreground text-xs font-medium transition disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {t("tailan_submitReport")}
            </button>
          </div>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Year & Quarter & Name */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className={labelCls}>{t("tailan_cyrillicName")}</label>
              <input
                value={cyrillicName}
                onChange={(e) => setCyrillicName(e.target.value)}
                placeholder={t("tailan_cyrillicNamePlaceholder")}
                className={inputCls}
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className={labelCls}>{t("tailan_yearLabel")}</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={inputCls}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>{t("tailan_quarterLabel")}</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className={inputCls}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {language === "en" ? `Q${q}` : `${q}-р улирал`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {templateLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загвар ачааллаж
              байна...
            </div>
          )}

          {/* Template-driven sections */}
          {sortedSections.map((sec) => (
            <GenericSectionEditor
              key={sec.key}
              section={sec}
              romanLabel={romanByKey.get(sec.key)}
              collapsed={collapsedSections.has(sec.key)}
              hidden={hiddenSections.has(sec.key)}
              onToggleCollapse={() => toggleSection(sec.key)}
              onToggleHide={() => toggleHideSection(sec.key)}
              textValue={sec.type === "richtext" ? getText(sec.key) : undefined}
              onTextChange={
                sec.type === "richtext" ? (v) => setText(sec.key, v) : undefined
              }
              rows={sec.type !== "richtext" ? getRows(sec.key) : undefined}
              onAddRow={
                sec.type !== "richtext" ? () => addRow(sec.key) : undefined
              }
              onRemoveRow={
                sec.type !== "richtext"
                  ? (id) => removeRow(sec.key, id)
                  : undefined
              }
              onUpdateRow={
                sec.type !== "richtext"
                  ? (id, field, value) => updateRow(sec.key, id, field, value)
                  : undefined
              }
            />
          ))}

          {/* Dynamic (ad-hoc) sections */}
          {dynamicSections.map((sec, idx) => (
            <div
              key={sec._id}
              className={`rounded-xl border ${hiddenSections.has(`dyn_${idx}`) ? "border-dashed border-border/40 opacity-60" : "border-border/60"} bg-card/40 p-3 space-y-2`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {ROMAN_NUMS[visibleMainKeys.length + idx] ?? nextDynRoman}.
                </span>
                <input
                  className={`${inputCls} flex-1`}
                  value={sec.title}
                  onChange={(e) =>
                    updateDynSection(sec._id, "title", e.target.value)
                  }
                  placeholder="Хэсгийн гарчиг"
                />
                <button
                  type="button"
                  onClick={() => removeDynSection(sec._id)}
                  className="text-red-400/70 hover:text-red-400 transition shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                className={textareaCls}
                value={sec.content}
                onChange={(e) =>
                  updateDynSection(sec._id, "content", e.target.value)
                }
                placeholder="Агуулга..."
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addDynSection}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Нэмэлт хэсэг нэмэх
          </button>
        </div>
      </div>

      {/* --- RIGHT: Real .docx preview --- */}
      <div className="w-1/2 overflow-hidden">
        {template && <RealDocxPreview payload={buildPayload()} />}
      </div>
    </div>
  );
}
