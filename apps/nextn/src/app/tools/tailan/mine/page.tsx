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
  ChevronDown,
  Loader2,
  Check,
  X,
  ImageIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { RichToolbar } from "./_components/RichEditor";
import { WordPreview, ROMAN_NUMS } from "./_components/WordPreview";
import { RowImageUpload } from "./_components/RowImageUpload";
import { useTailanReport } from "./_hooks/useTailanReport";

const selectCls =
  "w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";

// --- Shared style helpers -----------------------------------------------------
const inputCls =
  "w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

// --- Main Page ---------------------------------------------------------------
export default function TailanMinePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const report = useTailanReport(user?.name);
  const {
    mounted,
    year,
    setYear,
    quarter,
    setQuarter,
    cyrillicName,
    setCyrillicName,
    expandedTaskIds,
    toggleTaskExpand,
    collapsedSections,
    toggleSection,
    hiddenSections,
    toggleHideSection,
    plannedTasks,
    section1Dashboards,
    section2Tasks,
    section3AutoTasks,
    section3Dashboards,
    section4Trainings,
    section4KnowledgeText,
    setSection4KnowledgeText,
    section5Tasks,
    section6Activities,
    section7Text,
    setSection7Text,
    dynamicSections,
    addTask,
    removeTask,
    updateTask,
    addSection1Dashboard,
    removeSection1Dashboard,
    updateSection1Dashboard,
    addSection2Task,
    removeSection2Task,
    updateSection2Task,
    addSection3AutoTask,
    removeSection3AutoTask,
    updateSection3AutoTask,
    addSection3Dashboard,
    removeSection3Dashboard,
    updateSection3Dashboard,
    addSection4Training,
    removeSection4Training,
    updateSection4Training,
    addSection5Task,
    removeSection5Task,
    updateSection5Task,
    addSection6Activity,
    removeSection6Activity,
    updateSection6Activity,
    addDynSection: addSection,
    removeDynSection: removeSection,
    updateDynSection: updateSection,
    saving,
    submitting,
    downloading,
    savedMsg,
    handleSave,
    handleSubmit,
    handleDownload,
    images,
  } = report;

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
            <span className="font-semibold text-white text-sm">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted text-white text-xs font-medium transition disabled:opacity-50"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition disabled:opacity-50"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition disabled:opacity-50"
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
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
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
          {/* Section 1: Planned tasks */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s1") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s1")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s1Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s1");
                  }}
                  title={
                    hiddenSections.has("s1")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                >
                  {hiddenSections.has("s1") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addTask();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("tailan_addTask")}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s1") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>

            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s1") ? "hidden" : ""}`}
            >
              {plannedTasks.map((task) => {
                const isOpen = expandedTaskIds.has(task._id);
                return (
                  <div
                    key={task._id}
                    className="bg-muted/30 rounded-lg overflow-hidden"
                  >
                    {/* Collapsed header — always visible */}
                    <div
                      className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-muted/60 transition select-none"
                      onClick={() => toggleTaskExpand(task._id)}
                    >
                      <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
                        {task.order}
                      </span>
                      <span className="flex-1 text-sm font-bold text-white">
                        {task.title ? (
                          task.title
                        ) : (
                          <span className="font-normal text-muted-foreground/70">
                            Ажлын нэр...
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label
                          htmlFor={task._id + "-img"}
                          className="cursor-pointer text-muted-foreground hover:text-blue-400 transition"
                          onClick={(e) => e.stopPropagation()}
                          suppressHydrationWarning
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </label>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTask(task._id);
                          }}
                          className="text-red-400/70 hover:text-red-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </div>
                    {/* Expanded form */}
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border/50">
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="col-span-2">
                            <label className={labelCls}>
                              {t("tailan_taskNameLabel")}
                            </label>
                            <input
                              value={task.title}
                              onChange={(e) =>
                                updateTask(task._id, "title", e.target.value)
                              }
                              placeholder={t("tailan_taskNamePlaceholder")}
                              className={inputCls + " font-bold"}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className={labelCls}>
                              {t("tailan_taskDescLabel")}
                            </label>
                            <RichToolbar
                              value={task.description}
                              onChange={(v) =>
                                updateTask(task._id, "description", v)
                              }
                              placeholder={t("tailan_detailedDescPlaceholder")}
                              rows={2}
                              className={inputCls + " resize-none"}
                            />
                          </div>
                        </div>
                        <RowImageUpload
                          inputId={task._id + "-img"}
                          images={task.images ?? []}
                          onChange={(imgs) =>
                            updateTask(task._id, "images", imgs)
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          {/* Section I.2: Шинээр хөгжүүлсэн dashboard */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s12") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s12")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s12Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s12");
                  }}
                  title={
                    hiddenSections.has("s12")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                  className={`transition ${hiddenSections.has("s12") ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                >
                  {hiddenSections.has("s12") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection1Dashboard();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("tailan_addEntry")}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s12") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-3 mt-3 ${collapsedSections.has("s12") ? "hidden" : ""}`}
            >
              {section1Dashboards.map((dash) => (
                <div
                  key={dash._id}
                  className="bg-muted/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      #{dash.order}
                    </span>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={dash._id + "-img"}
                        className="cursor-pointer text-muted-foreground hover:text-blue-400 transition"
                        suppressHydrationWarning
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </label>
                      <button
                        onClick={() => removeSection1Dashboard(dash._id)}
                        className="text-red-400/70 hover:text-red-400 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>
                        {t("tailan_plannedTaskLabel")}
                      </label>
                      <input
                        value={dash.title}
                        onChange={(e) =>
                          updateSection1Dashboard(
                            dash._id,
                            "title",
                            e.target.value,
                          )
                        }
                        placeholder={t("tailan_taskNamePlaceholder")}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        {t("tailan_taskCompletionPct")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={dash.completion}
                        onChange={(e) =>
                          updateSection1Dashboard(
                            dash._id,
                            "completion",
                            e.target.value,
                          )
                        }
                        placeholder="100"
                        className={inputCls}
                      />
                    </div>
                    <div />
                    <div className="col-span-2">
                      <label className={labelCls}>
                        {t("tailan_periodLabel")}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>
                            {t("tailan_startDateLabel")}
                          </label>
                          <input
                            type="date"
                            value={dash.period.split(" – ")[0] ?? ""}
                            onChange={(e) => {
                              const end = dash.period.split(" – ")[1] ?? "";
                              updateSection1Dashboard(
                                dash._id,
                                "period",
                                e.target.value + (end ? ` – ${end}` : ""),
                              );
                            }}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            {t("tailan_endDateLabel")}
                          </label>
                          <input
                            type="date"
                            value={dash.period.split(" – ")[1] ?? ""}
                            onChange={(e) => {
                              const start = dash.period.split(" – ")[0] ?? "";
                              updateSection1Dashboard(
                                dash._id,
                                "period",
                                (start ? `${start} – ` : "") + e.target.value,
                              );
                            }}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>
                        {t("tailan_taskSummaryLabel")}
                      </label>
                      <RichToolbar
                        value={dash.summary}
                        onChange={(v) =>
                          updateSection1Dashboard(dash._id, "summary", v)
                        }
                        placeholder={t("tailan_briefSummaryPlaceholder")}
                        rows={2}
                        className={inputCls + " resize-none"}
                      />
                    </div>
                  </div>
                  <RowImageUpload
                    inputId={dash._id + "-img"}
                    images={dash.images ?? []}
                    onChange={(imgs) =>
                      updateSection1Dashboard(dash._id, "images", imgs)
                    }
                  />
                </div>
              ))}
            </div>
          </section>
          {/* Section II: Өгөгдөл боловсруулах ажил */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s2") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s2")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s2Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s2");
                  }}
                  title={
                    hiddenSections.has("s2")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                  className={`transition ${hiddenSections.has("s2") ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                >
                  {hiddenSections.has("s2") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection2Task();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("tailan_addTask")}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s2") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s2") ? "hidden" : ""}`}
            >
              {section2Tasks.map((s2) => (
                <div
                  key={s2._id}
                  className="bg-muted/30 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
                      {s2.order}
                    </span>
                    <input
                      value={s2.title}
                      onChange={(e) =>
                        updateSection2Task(s2._id, "title", e.target.value)
                      }
                      placeholder={t("tailan_plannedTaskPlaceholder")}
                      className={inputCls + " flex-1"}
                    />
                    <label
                      htmlFor={s2._id + "-img"}
                      className="cursor-pointer text-muted-foreground hover:text-blue-400 transition shrink-0"
                      suppressHydrationWarning
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </label>
                    <button
                      onClick={() => removeSection2Task(s2._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={s2.result}
                      onChange={(e) =>
                        updateSection2Task(s2._id, "result", e.target.value)
                      }
                      placeholder={t("tailan_taskCompletionPct")}
                      className={inputCls}
                    />
                    <textarea
                      rows={2}
                      value={s2.completion}
                      onChange={(e) =>
                        updateSection2Task(s2._id, "completion", e.target.value)
                      }
                      placeholder={t("tailan_taskSummaryLabel")}
                      className={inputCls + " resize-none"}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className={labelCls}>
                          {t("tailan_startDateLabel")}
                        </label>
                        <input
                          type="date"
                          value={s2.period.split(" – ")[0] ?? ""}
                          onChange={(e) => {
                            const end = s2.period.split(" – ")[1] ?? "";
                            updateSection2Task(
                              s2._id,
                              "period",
                              e.target.value + (end ? ` – ${end}` : ""),
                            );
                          }}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          {t("tailan_endDateLabel")}
                        </label>
                        <input
                          type="date"
                          value={s2.period.split(" – ")[1] ?? ""}
                          onChange={(e) => {
                            const start = s2.period.split(" – ")[0] ?? "";
                            updateSection2Task(
                              s2._id,
                              "period",
                              (start ? `${start} – ` : "") + e.target.value,
                            );
                          }}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                  <RowImageUpload
                    inputId={s2._id + "-img"}
                    images={s2.images ?? []}
                    onChange={(imgs) =>
                      updateSection2Task(s2._id, "images", imgs)
                    }
                  />
                </div>
              ))}
            </div>
          </section>
          {/* Section III: Тогтмол хийгддэг ажлууд */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s3") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s3")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s3Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s3");
                  }}
                  title={
                    hiddenSections.has("s3")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                  className={`transition ${hiddenSections.has("s3") ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                >
                  {hiddenSections.has("s3") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s3") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>

            <div
              className={`mt-3 ${collapsedSections.has("s3") ? "hidden" : ""}`}
            >
              {/* III.1 Автоматжуулалт */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-foreground/80">
                    {t("tailan_s31Title")}
                  </p>
                  <button
                    onClick={addSection3AutoTask}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("tailan_addEntry")}
                  </button>
                </div>
                <div className="space-y-2">
                  {section3AutoTasks.map((s3a) => (
                    <div
                      key={s3a._id}
                      className="bg-muted/30 rounded-lg p-2 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
                          {s3a.order}
                        </span>
                        <input
                          value={s3a.title}
                          onChange={(e) =>
                            updateSection3AutoTask(
                              s3a._id,
                              "title",
                              e.target.value,
                            )
                          }
                          placeholder={t("tailan_autoTaskPlaceholder")}
                          className={inputCls + " flex-1"}
                        />
                        <button
                          onClick={() => removeSection3AutoTask(s3a._id)}
                          className="text-red-400/70 hover:text-red-400 transition shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        <textarea
                          rows={2}
                          value={s3a.value}
                          onChange={(e) =>
                            updateSection3AutoTask(
                              s3a._id,
                              "value",
                              e.target.value,
                            )
                          }
                          placeholder={t("tailan_valueUsagePlaceholder")}
                          className={inputCls + " resize-none"}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={s3a.rating}
                          onChange={(e) =>
                            updateSection3AutoTask(
                              s3a._id,
                              "rating",
                              e.target.value,
                            )
                          }
                          placeholder={t("tailan_userRatingPlaceholder")}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* III.2 Dashboard */}
              <div className={hiddenSections.has("s32") ? "opacity-50" : ""}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground/80">
                      {t("tailan_s32Title")}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHideSection("s32");
                      }}
                      title={
                        hiddenSections.has("s32")
                          ? t("tailan_showInReport")
                          : t("tailan_hideFromReport")
                      }
                      className={`transition ${hiddenSections.has("s32") ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                    >
                      {hiddenSections.has("s32") ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={addSection3Dashboard}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("tailan_addEntry")}
                  </button>
                </div>
                <div className="space-y-2">
                  {section3Dashboards.map((s3d) => (
                    <div
                      key={s3d._id}
                      className="bg-muted/30 rounded-lg p-2 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
                          {s3d.order}
                        </span>
                        <input
                          value={s3d.dashboard}
                          onChange={(e) =>
                            updateSection3Dashboard(
                              s3d._id,
                              "dashboard",
                              e.target.value,
                            )
                          }
                          placeholder={t("tailan_dashboardNamePlaceholder")}
                          className={inputCls + " flex-1"}
                        />
                        <button
                          onClick={() => removeSection3Dashboard(s3d._id)}
                          className="text-red-400/70 hover:text-red-400 transition shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        <textarea
                          rows={2}
                          value={s3d.value}
                          onChange={(e) =>
                            updateSection3Dashboard(
                              s3d._id,
                              "value",
                              e.target.value,
                            )
                          }
                          placeholder={t("tailan_valueUsagePlaceholder")}
                          className={inputCls + " resize-none"}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={s3d.rating}
                          onChange={(e) =>
                            updateSection3Dashboard(
                              s3d._id,
                              "rating",
                              e.target.value,
                            )
                          }
                          placeholder={t("tailan_clientRatingPlaceholder")}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          {/* Section IV: Хамрагдсан сургалт */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s4") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s4")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s4Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s4");
                  }}
                  title={
                    hiddenSections.has("s4")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                  className={`transition ${hiddenSections.has("s4") ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                >
                  {hiddenSections.has("s4") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection4Training();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("tailan_addTraining")}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s4") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`mt-3 ${collapsedSections.has("s4") ? "hidden" : ""}`}
            >
              <div className="space-y-2">
                {section4Trainings.map((tr) => (
                  <div
                    key={tr._id}
                    className="bg-muted/30 rounded-lg p-2 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
                        {tr.order}
                      </span>
                      <input
                        value={tr.training}
                        onChange={(e) =>
                          updateSection4Training(
                            tr._id,
                            "training",
                            e.target.value,
                          )
                        }
                        placeholder={t("tailan_trainingNamePlaceholder")}
                        className={inputCls + " flex-1"}
                      />
                      <button
                        onClick={() => removeSection4Training(tr._id)}
                        className="text-red-400/70 hover:text-red-400 transition shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pl-6">
                      <input
                        value={tr.organizer}
                        onChange={(e) =>
                          updateSection4Training(
                            tr._id,
                            "organizer",
                            e.target.value,
                          )
                        }
                        placeholder={t("tailan_organizerLabel")}
                        className={inputCls}
                      />
                      <div>
                        <label className={labelCls}>
                          {t("tailan_trainingTypeLabel")}
                        </label>
                        <select
                          value={tr.type}
                          onChange={(e) =>
                            updateSection4Training(
                              tr._id,
                              "type",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">{t("tailan_selectOption")}</option>
                          <option value="Гадаад">
                            {t("tailan_externalTraining")}
                          </option>
                          <option value="Дотоод">
                            {t("tailan_internalTraining")}
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>
                          {t("tailan_dateLabel")}
                        </label>
                        <input
                          type="date"
                          value={tr.date}
                          onChange={(e) =>
                            updateSection4Training(
                              tr._id,
                              "date",
                              e.target.value,
                            )
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          {t("tailan_trainingFormatLabel")}
                        </label>
                        <select
                          value={tr.format}
                          onChange={(e) =>
                            updateSection4Training(
                              tr._id,
                              "format",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">{t("tailan_selectOption")}</option>
                          <option value="Онлайн">
                            {t("tailan_onlineFormat")}
                          </option>
                          <option value="Танхим">
                            {t("tailan_inPersonFormat")}
                          </option>
                        </select>
                      </div>
                      <input
                        value={tr.hours}
                        onChange={(e) =>
                          updateSection4Training(
                            tr._id,
                            "hours",
                            e.target.value,
                          )
                        }
                        placeholder={t("tailan_hoursLabel")}
                        className={inputCls}
                      />
                      <div>
                        <label className={labelCls}>
                          {t("tailan_meetsGoalLabel")}
                        </label>
                        <select
                          value={tr.meetsAuditGoal}
                          onChange={(e) =>
                            updateSection4Training(
                              tr._id,
                              "meetsAuditGoal",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">{t("tailan_selectOption")}</option>
                          <option value="Нийцсэн">
                            {t("tailan_meetsGoalYes")}
                          </option>
                          <option value="Нийцээгүй">
                            {t("tailan_meetsGoalNo")}
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>
                          {t("tailan_sharedKnowledgeLabel")}
                        </label>
                        <select
                          value={tr.sharedKnowledge}
                          onChange={(e) =>
                            updateSection4Training(
                              tr._id,
                              "sharedKnowledge",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">{t("tailan_selectOption")}</option>
                          <option value="Хуваалцсан">
                            {t("tailan_sharedKnowledgeYes")}
                          </option>
                          <option value="Хуваалцаагүй">
                            {t("tailan_sharedKnowledgeNo")}
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-foreground/80 mb-1">
                  {t("tailan_s41Title")}
                </p>
                <RichToolbar
                  value={section4KnowledgeText}
                  onChange={setSection4KnowledgeText}
                  rows={3}
                  placeholder={t("tailan_knowledgeUsagePlaceholder")}
                  className={inputCls + " resize-y"}
                />
              </div>
            </div>
          </section>
          {/* Section V: Үүрэг даалгаварын биелэлт */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s5") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s5")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s5Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s5");
                  }}
                  title={
                    hiddenSections.has("s5")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                  className={`transition ${hiddenSections.has("s5") ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                >
                  {hiddenSections.has("s5") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection5Task();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("tailan_addTask")}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s5") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s5") ? "hidden" : ""}`}
            >
              {section5Tasks.map((t) => (
                <div
                  key={t._id}
                  className="bg-muted/30 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
                      {t.order}
                    </span>
                    <input
                      value={t.taskType}
                      onChange={(e) =>
                        updateSection5Task(t._id, "taskType", e.target.value)
                      }
                      placeholder="Ажлын төрөл..."
                      className={inputCls + " flex-1"}
                    />
                    <button
                      onClick={() => removeSection5Task(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="pl-6">
                    <RichToolbar
                      value={t.completedWork}
                      onChange={(v) =>
                        updateSection5Task(t._id, "completedWork", v)
                      }
                      placeholder="Хийгдсэн ажил..."
                      rows={2}
                      className={inputCls + " resize-none"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          {/* Section VI: Хамт олны ажил */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s6") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s6")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s6Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s6");
                  }}
                  title={
                    hiddenSections.has("s6")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                >
                  {hiddenSections.has("s6") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection6Activity();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("tailan_addTask")}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s6") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s6") ? "hidden" : ""}`}
            >
              {section6Activities.map((act) => (
                <div
                  key={act._id}
                  className="bg-muted/30 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
                      {act.order}
                    </span>
                    <input
                      value={act.activity}
                      onChange={(e) =>
                        updateSection6Activity(
                          act._id,
                          "activity",
                          e.target.value,
                        )
                      }
                      placeholder={t("tailan_teamActivityPlaceholder")}
                      className={inputCls + " flex-1"}
                    />
                    <button
                      onClick={() => removeSection6Activity(act._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <input
                      type="date"
                      value={act.date}
                      onChange={(e) =>
                        updateSection6Activity(act._id, "date", e.target.value)
                      }
                      className={inputCls}
                    />
                    <textarea
                      rows={2}
                      value={act.initiative}
                      onChange={(e) =>
                        updateSection6Activity(
                          act._id,
                          "initiative",
                          e.target.value,
                        )
                      }
                      placeholder={t("tailan_initiativeLabel")}
                      className={inputCls + " resize-none"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          {/* Section VII: Шинэ санал санаачилга */}
          <section
            className={`rounded-xl border border-border/60 bg-muted/30 p-4 ${hiddenSections.has("s7") ? "opacity-50" : ""}`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s7")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_s7Title")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s7");
                  }}
                  title={
                    hiddenSections.has("s7")
                      ? t("tailan_showInReport")
                      : t("tailan_hideFromReport")
                  }
                  className={`transition ${hiddenSections.has("s7") ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                >
                  {hiddenSections.has("s7") ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("s7") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`mt-3 ${collapsedSections.has("s7") ? "hidden" : ""}`}
            >
              <RichToolbar
                value={section7Text}
                onChange={setSection7Text}
                rows={4}
                placeholder={t("tailan_proposalPlaceholder")}
                className={inputCls + " resize-y"}
              />
            </div>
          </section>{" "}
          {/* Dynamic sections */}
          <section className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("sdyn")}
            >
              <h3 className="text-sm font-semibold text-white">
                {t("tailan_dynTitle")}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("tailan_addSection")}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("sdyn") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-3 mt-3 ${collapsedSections.has("sdyn") ? "hidden" : ""}`}
            >
              {dynamicSections.map((sec, idx) => (
                <div
                  key={sec._id}
                  className="bg-muted/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/70 font-medium w-8 shrink-0">
                      {ROMAN_NUMS[idx + 7] ?? `${idx + 8}`}.
                    </span>
                    <input
                      value={sec.title}
                      onChange={(e) =>
                        updateSection(sec._id, "title", e.target.value)
                      }
                      className={inputCls + " flex-1"}
                      placeholder={t("tailan_sectionTitlePlaceholder")}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHideSection(`dyn_${idx}`);
                      }}
                      title={
                        hiddenSections.has(`dyn_${idx}`)
                          ? t("tailan_showInReport")
                          : t("tailan_hideFromReport")
                      }
                      className={`transition flex-shrink-0 ${hiddenSections.has(`dyn_${idx}`) ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground/80"}`}
                    >
                      {hiddenSections.has(`dyn_${idx}`) ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => removeSection(sec._id)}
                      className="text-red-400/70 hover:text-red-400 transition flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <RichToolbar
                    value={sec.content}
                    onChange={(v) => updateSection(sec._id, "content", v)}
                    rows={4}
                    placeholder={t("tailan_sectionContentPlaceholder")}
                    className={inputCls + " resize-y"}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* --- RIGHT: Live Word Preview --- */}
      <div className="flex flex-col flex-1 bg-muted overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/50 text-xs font-medium text-foreground/80 flex items-center gap-2 flex-shrink-0 bg-muted/50">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {t("tailan_livePreview")}
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <WordPreview
            userName={mounted ? cyrillicName.trim() : ""}
            userPosition={user?.position}
            userDepartment={user?.department}
            year={year}
            quarter={quarter}
            plannedTasks={plannedTasks}
            section2Tasks={section2Tasks}
            section3AutoTasks={section3AutoTasks}
            section3Dashboards={section3Dashboards}
            section1Dashboards={section1Dashboards}
            dynamicSections={dynamicSections}
            section4Trainings={section4Trainings}
            section4KnowledgeText={section4KnowledgeText}
            section5Tasks={section5Tasks}
            section6Activities={section6Activities}
            section7Text={section7Text}
            images={images}
            hiddenSections={hiddenSections}
          />
        </div>
      </div>
    </div>
  );
}
