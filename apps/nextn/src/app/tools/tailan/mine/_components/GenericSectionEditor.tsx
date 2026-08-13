"use client";

import React from "react";
import { Trash2, ChevronDown, EyeOff, Eye } from "lucide-react";
import type { TailanSectionDef } from "@/lib/api";
import { RowImageUpload } from "./RowImageUpload";
import type { GenericRow } from "../_hooks/useTailanGenericReport";
import { useLanguage } from "@/contexts/LanguageContext";

const inputCls =
  "w-full bg-muted/60 border border-border/50 rounded px-2 py-1 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-blue-500/60";
const labelCls =
  "block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide";
const textareaCls =
  "w-full bg-muted/60 border border-border/50 rounded-xl px-3 py-2.5 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-blue-500/60 resize-none leading-relaxed min-h-[80px]";

// ─── Section shell (heading + collapse/hide controls) ──────────────────────
function SectionShell({
  section,
  collapsed,
  hidden,
  onToggleCollapse,
  onToggleHide,
  romanLabel,
  paneMode = false,
  children,
}: {
  section: TailanSectionDef;
  collapsed: boolean;
  hidden: boolean;
  onToggleCollapse: () => void;
  onToggleHide: () => void;
  romanLabel?: string;
  paneMode?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const title = (
    <>
      {section.headingLevel === "main" && romanLabel
        ? `${romanLabel}. `
        : section.headingLevel === "sub"
          ? "— "
          : ""}
      {section.titleMn}
    </>
  );

  if (paneMode) {
    return (
      <div className={`space-y-4 w-full ${hidden ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm font-bold ${hidden ? "text-muted-foreground" : "text-foreground"}`}
            >
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleHide}
            title={
              hidden ? t("tailan_showInReport") : t("tailan_hideFromReport")
            }
            className="text-muted-foreground hover:text-foreground transition shrink-0"
          >
            {hidden ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {!collapsed && children}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-opacity ${
        hidden
          ? "border-dashed border-border/40 opacity-60"
          : "border-border/40"
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b border-border/50 ${
          hidden ? "bg-muted/20" : "bg-muted/80"
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span
            className={`text-xs font-bold truncate ${hidden ? "text-muted-foreground" : "text-foreground"}`}
          >
            {title}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleHide}
          title={
            hidden ? t("tailan_showInReport") : t("tailan_hideFromReport")
          }
          className="text-muted-foreground hover:text-foreground transition shrink-0"
        >
          {hidden ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {!collapsed && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Richtext ────────────────────────────────────────────────────────────────
function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <textarea
      className={`${textareaCls} min-h-[140px]`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("tailanSectionEditorTextPlaceholder")}
    />
  );
}

// ─── Task list ───────────────────────────────────────────────────────────────
function TaskListEditor({
  section,
  rows,
  onAdd,
  onRemove,
  onUpdate,
}: {
  section: TailanSectionDef;
  rows: GenericRow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
}) {
  const { t } = useLanguage();
  const cfg = section.taskList ?? {};
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="px-4 py-4 text-center text-muted-foreground/50 text-[11px]">
          {t("tailan_noData")}
        </div>
      )}
      {rows.map((row, idx) => (
        <div
          key={row._id}
          className="rounded-xl border border-border/40 overflow-hidden bg-muted/20"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/40">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              № {idx + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(row._id)}
                className="text-muted-foreground/70 hover:text-red-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="p-3 space-y-2.5">
            <div>
              <label className={labelCls}>
                {cfg.titleLabel || t("tailanSectionEditorTaskFallback")}
              </label>
              <input
                className={inputCls}
                value={(row.title as string) ?? ""}
                onChange={(e) => onUpdate(row._id, "title", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cfg.showCompletion && (
                <div>
                  <label className={labelCls}>
                    {cfg.completionLabel ||
                      t("tailanSectionEditorCompletionFallback")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputCls}
                    value={(row.completion as string | number) ?? ""}
                    onChange={(e) =>
                      onUpdate(row._id, "completion", e.target.value)
                    }
                  />
                </div>
              )}
              {cfg.showPeriod && (
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className={labelCls}>
                      {t("tailanSectionEditorStartedLabel")}
                    </label>
                    <input
                      type="date"
                      className={inputCls}
                      value={(row.periodStart as string) ?? ""}
                      onChange={(e) => {
                        onUpdate(row._id, "periodStart", e.target.value);
                        const end = (row.periodEnd as string) ?? "";
                        onUpdate(
                          row._id,
                          "period",
                          `${e.target.value} – ${end}`,
                        );
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t("tailanSectionEditorEndedLabel")}
                    </label>
                    <input
                      type="date"
                      className={inputCls}
                      value={(row.periodEnd as string) ?? ""}
                      onChange={(e) => {
                        onUpdate(row._id, "periodEnd", e.target.value);
                        const start = (row.periodStart as string) ?? "";
                        onUpdate(
                          row._id,
                          "period",
                          `${start} – ${e.target.value}`,
                        );
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            {cfg.showDescription !== false && (
              <div>
                <label className={labelCls}>
                  {cfg.descriptionLabel || t("tailanSectionEditorDescFallback")}
                </label>
                <textarea
                  className={textareaCls}
                  value={(row.description as string) ?? ""}
                  onChange={(e) =>
                    onUpdate(row._id, "description", e.target.value)
                  }
                />
              </div>
            )}
            {cfg.showImages !== false && (
              <RowImageUpload
                images={(row.images as any[]) ?? []}
                onChange={(imgs) => onUpdate(row._id, "images", imgs)}
              />
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="text-[10px] text-muted-foreground/70 hover:text-blue-400 transition-colors"
      >
        + {t("tailanSectionEditorAddRow")}
      </button>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────
function TableEditor({
  section,
  rows,
  onAdd,
  onRemove,
  onUpdate,
}: {
  section: TailanSectionDef;
  rows: GenericRow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
}) {
  const { t } = useLanguage();
  const cols = section.table?.columns ?? [];
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="px-4 py-4 text-center text-muted-foreground/50 text-[11px]">
          {t("tailan_noData")}
        </div>
      )}
      {rows.map((row, idx) => (
        <div
          key={row._id}
          className="rounded-xl border border-border/40 overflow-hidden bg-muted/20"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/40">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              № {idx + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(row._id)}
                className="text-muted-foreground/70 hover:text-red-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="p-3 space-y-2.5">
            {cols.map((col) => (
              <div key={col.key}>
                <label className={labelCls}>{col.label}</label>
                {col.richtext ? (
                  <textarea
                    className={textareaCls}
                    value={(row[col.key] as string) ?? ""}
                    onChange={(e) => onUpdate(row._id, col.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={col.numeric ? "number" : "text"}
                    className={inputCls}
                    value={(row[col.key] as string) ?? ""}
                    onChange={(e) => onUpdate(row._id, col.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="text-[10px] text-muted-foreground/70 hover:text-blue-400 transition-colors"
      >
        + {t("tailanSectionEditorAddRow")}
      </button>
    </div>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
export function GenericSectionEditor({
  section,
  romanLabel,
  collapsed,
  hidden,
  onToggleCollapse,
  onToggleHide,
  paneMode = false,
  accentIndex: _accentIndex = 0,
  textValue,
  onTextChange,
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}: {
  section: TailanSectionDef;
  romanLabel?: string;
  collapsed: boolean;
  hidden: boolean;
  onToggleCollapse: () => void;
  onToggleHide: () => void;
  paneMode?: boolean;
  accentIndex?: number;
  textValue?: string;
  onTextChange?: (v: string) => void;
  rows?: GenericRow[];
  onAddRow?: () => void;
  onRemoveRow?: (id: string) => void;
  onUpdateRow?: (id: string, field: string, value: unknown) => void;
}) {
  return (
    <SectionShell
      section={section}
      collapsed={paneMode ? false : collapsed}
      hidden={hidden}
      onToggleCollapse={onToggleCollapse}
      onToggleHide={onToggleHide}
      romanLabel={romanLabel}
      paneMode={paneMode}
    >
      {section.type === "richtext" && (
        <RichTextEditor
          value={textValue ?? ""}
          onChange={onTextChange ?? (() => {})}
        />
      )}
      {section.type === "taskList" && (
        <TaskListEditor
          section={section}
          rows={rows ?? []}
          onAdd={onAddRow ?? (() => {})}
          onRemove={onRemoveRow ?? (() => {})}
          onUpdate={onUpdateRow ?? (() => {})}
        />
      )}
      {section.type === "table" && (
        <TableEditor
          section={section}
          rows={rows ?? []}
          onAdd={onAddRow ?? (() => {})}
          onRemove={onRemoveRow ?? (() => {})}
          onUpdate={onUpdateRow ?? (() => {})}
        />
      )}
    </SectionShell>
  );
}
