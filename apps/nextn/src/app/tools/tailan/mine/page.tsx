"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  FileText,
  List,
  Table2,
  AlignLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { GenericSectionEditor } from "./_components/GenericSectionEditor";
import { RealDocxPreview } from "./_components/RealDocxPreview";
import { useTailanGenericReport } from "./_hooks/useTailanGenericReport";

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

const TAB_COLORS = ["blue", "emerald", "amber", "purple"] as const;
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

const metaInputCls =
  "bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-blue-500/60 placeholder-muted-foreground/40";
const editorInputCls =
  "w-full bg-muted/60 border border-border/50 rounded px-2 py-1 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-blue-500/60";
const editorTextareaCls =
  "w-full bg-muted/60 border border-border/50 rounded-xl px-3 py-2.5 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-blue-500/60 resize-none leading-relaxed min-h-[140px]";

function SectionTypeIcon({
  type,
  cls,
}: {
  type: string;
  cls: string;
}) {
  if (type === "taskList") return <List className={cls} />;
  if (type === "table") return <Table2 className={cls} />;
  if (type === "dyn") return <FileText className={cls} />;
  return <AlignLeft className={cls} />;
}

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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");

  const sortedSections = useMemo(
    () => [...(template?.sections ?? [])].sort((a, b) => a.order - b.order),
    [template?.sections],
  );
  const visibleMainKeys = sortedSections
    .filter((s) => s.headingLevel === "main" && !hiddenSections.has(s.key))
    .map((s) => s.key);
  const romanByKey = new Map(
    visibleMainKeys.map((key, i) => [key, ROMAN_NUMS[i] ?? `${i + 1}`]),
  );

  const navItems = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      type: string;
      color: (typeof TAB_COLORS)[number];
      hidden: boolean;
      isDyn?: boolean;
      dynId?: string;
    }> = [];
    sortedSections.forEach((sec, idx) => {
      const roman = romanByKey.get(sec.key);
      const prefix =
        sec.headingLevel === "main" && roman
          ? `${roman}. `
          : sec.headingLevel === "sub"
            ? "— "
            : "";
      items.push({
        id: sec.key,
        label: `${prefix}${sec.titleMn}`,
        type: sec.type,
        color: TAB_COLORS[idx % TAB_COLORS.length],
        hidden: hiddenSections.has(sec.key),
      });
    });
    dynamicSections.forEach((sec, idx) => {
      const dynKey = `dyn_${sec._id}`;
      items.push({
        id: dynKey,
        label: `${ROMAN_NUMS[visibleMainKeys.length + idx] ?? visibleMainKeys.length + idx + 1}. ${sec.title || t("tailan_sectionTitlePlaceholder")}`,
        type: "dyn",
        color: TAB_COLORS[(sortedSections.length + idx) % TAB_COLORS.length],
        hidden: hiddenSections.has(dynKey),
        isDyn: true,
        dynId: sec._id,
      });
    });
    return items;
  }, [
    sortedSections,
    dynamicSections,
    hiddenSections,
    romanByKey,
    visibleMainKeys.length,
    t,
  ]);

  useEffect(() => {
    if (!navItems.length) {
      setActiveTab("");
      return;
    }
    if (!navItems.some((n) => n.id === activeTab)) {
      setActiveTab(navItems[0]!.id);
    }
  }, [navItems, activeTab]);

  const activeTemplateSec = sortedSections.find((s) => s.key === activeTab);
  const activeDyn = dynamicSections.find((s) => `dyn_${s._id}` === activeTab);
  const qName = ["I", "II", "III", "IV"][quarter - 1] ?? String(quarter);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-card to-background overflow-hidden">
      {/* Top bar — department-style */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-card/60 backdrop-blur-sm shrink-0">
        <Link
          href="/tools/tailan"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
        <span className="text-muted-foreground/60">/</span>
        <span className="text-foreground/90 text-sm font-medium">
          {t("tailan_myReportTitle")}
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted/70 text-foreground/80 border border-border/50">
          {language === "en"
            ? `Q${quarter} ${year}`
            : `${year} оны ${qName} улирал`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <input
            value={cyrillicName}
            onChange={(e) => setCyrillicName(e.target.value)}
            placeholder={t("tailan_cyrillicNamePlaceholder")}
            className={`${metaInputCls} w-36 sm:w-44`}
            title={t("tailan_cyrillicName")}
          />
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={metaInputCls}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {language === "en" ? y : `${y} он`}
              </option>
            ))}
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className={metaInputCls}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {language === "en" ? `Q${q}` : `${q}-р улирал`}
              </option>
            ))}
          </select>

          {savedMsg && (
            <span
              className={`text-[10px] flex items-center gap-1 whitespace-nowrap ${
                savedMsg.startsWith("❌")
                  ? "text-red-400"
                  : "text-muted-foreground/70"
              }`}
            >
              {savedMsg.startsWith("❌") ? (
                <X className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3 text-emerald-400" />
              )}
              {savedMsg.replace(/^❌ /, "")}
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-foreground text-xs px-3 py-1.5 rounded-lg transition-colors"
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
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground text-xs px-3 py-1.5 rounded-lg transition-colors"
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
            className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 border border-border/50 disabled:opacity-50 text-foreground text-xs px-3 py-1.5 rounded-lg transition-colors"
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`shrink-0 border-r border-border/50 bg-card/50 flex flex-col overflow-hidden transition-all duration-200 ${
            sidebarOpen ? "w-60" : "w-11"
          }`}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center h-9 w-full border-b border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0"
            title={
              sidebarOpen
                ? t("tailan_collapseSidebar")
                : t("tailan_expandSidebar")
            }
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`flex items-start gap-2.5 w-full text-left px-2.5 py-2.5 rounded-xl transition-all duration-150 text-xs ${
                    active
                      ? COLOR_TAB_ACTIVE[item.color]
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground/90"
                  } ${item.hidden ? "opacity-50" : ""}`}
                >
                  <SectionTypeIcon
                    type={item.type}
                    cls={`h-4 w-4 shrink-0 mt-0.5 ${
                      active
                        ? COLOR_ICON[item.color]
                        : "text-muted-foreground/70"
                    }`}
                  />
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold leading-tight line-clamp-2">
                        {item.label}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                const id = addDynSection();
                setActiveTab(`dyn_${id}`);
              }}
              className={`mt-1 flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-xl text-[10px] text-muted-foreground/70 hover:text-blue-400 hover:bg-foreground/5 transition-colors ${
                sidebarOpen ? "" : "justify-center"
              }`}
              title={t("tailan_addSection")}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              {sidebarOpen && t("tailan_addSection")}
            </button>
          </div>
        </div>

        {/* Editor pane */}
        <div className="flex-1 overflow-y-auto p-5 min-w-0">
          {templateLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />{" "}
              {t("tailanMineTemplateLoading")}
            </div>
          )}

          {!templateLoading && activeTemplateSec && (
            <GenericSectionEditor
              section={activeTemplateSec}
              romanLabel={romanByKey.get(activeTemplateSec.key)}
              collapsed={collapsedSections.has(activeTemplateSec.key)}
              hidden={hiddenSections.has(activeTemplateSec.key)}
              onToggleCollapse={() => toggleSection(activeTemplateSec.key)}
              onToggleHide={() => toggleHideSection(activeTemplateSec.key)}
              paneMode
              textValue={
                activeTemplateSec.type === "richtext"
                  ? getText(activeTemplateSec.key)
                  : undefined
              }
              onTextChange={
                activeTemplateSec.type === "richtext"
                  ? (v) => setText(activeTemplateSec.key, v)
                  : undefined
              }
              rows={
                activeTemplateSec.type !== "richtext"
                  ? getRows(activeTemplateSec.key)
                  : undefined
              }
              onAddRow={
                activeTemplateSec.type !== "richtext"
                  ? () => addRow(activeTemplateSec.key)
                  : undefined
              }
              onRemoveRow={
                activeTemplateSec.type !== "richtext"
                  ? (id) => removeRow(activeTemplateSec.key, id)
                  : undefined
              }
              onUpdateRow={
                activeTemplateSec.type !== "richtext"
                  ? (id, field, value) =>
                      updateRow(activeTemplateSec.key, id, field, value)
                  : undefined
              }
            />
          )}

          {!templateLoading && activeDyn && (
            <div className="space-y-4 w-full">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground mb-2">
                    {t("tailan_sectionTitlePlaceholder")}
                  </div>
                  <input
                    className={editorInputCls}
                    value={activeDyn.title}
                    onChange={(e) =>
                      updateDynSection(activeDyn._id, "title", e.target.value)
                    }
                    placeholder={t("tailan_sectionTitlePlaceholder")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    removeDynSection(activeDyn._id);
                    setActiveTab("");
                  }}
                  className="text-muted-foreground/70 hover:text-red-400 transition shrink-0 mt-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                className={editorTextareaCls}
                value={activeDyn.content}
                onChange={(e) =>
                  updateDynSection(activeDyn._id, "content", e.target.value)
                }
                placeholder={t("tailanMineContentPlaceholder")}
              />
            </div>
          )}

          {!templateLoading && !activeTemplateSec && !activeDyn && (
            <div className="px-4 py-10 text-center text-muted-foreground/50 text-[11px]">
              {t("tailanMineTemplateLoading")}
            </div>
          )}
        </div>

        {/* Preview pane — desk gray comes from DocxBlobViewer (#d8d8d8) */}
        <div className="flex-1 min-w-0 border-l border-border/50 overflow-hidden flex flex-col">
          <div className="flex-1 min-w-0 overflow-hidden">
            {template && <RealDocxPreview payload={buildPayload()} />}
          </div>
        </div>
      </div>
    </div>
  );
}
