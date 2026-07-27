"use client";

import React from "react";
import { Plus, Trash2, ChevronDown, EyeOff, Eye } from "lucide-react";
import type { TailanSectionDef } from "@/lib/api";
import { RowImageUpload } from "./RowImageUpload";
import type { GenericRow } from "../_hooks/useTailanGenericReport";
import { useLanguage } from "@/contexts/LanguageContext";

const inputCls =
  "w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1";
const textareaCls = `${inputCls} min-h-[80px] resize-y`;

// ─── Section shell (heading + collapse/hide controls) ──────────────────────
function SectionShell({
  section,
  collapsed,
  hidden,
  onToggleCollapse,
  onToggleHide,
  romanLabel,
  children,
}: {
  section: TailanSectionDef;
  collapsed: boolean;
  hidden: boolean;
  onToggleCollapse: () => void;
  onToggleHide: () => void;
  romanLabel?: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={`rounded-xl border ${hidden ? "border-dashed border-border/40 opacity-60" : "border-border/60"} bg-card/40 overflow-hidden`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span className="text-sm font-semibold truncate">
            {section.headingLevel === "main" && romanLabel
              ? `${romanLabel}. `
              : section.headingLevel === "sub"
                ? "— "
                : ""}
            {section.titleMn}
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
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div
          key={row._id}
          className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              № {idx + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(row._id)}
                className="text-red-400/70 hover:text-red-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
                      onUpdate(row._id, "period", `${e.target.value} – ${end}`);
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
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
      >
        <Plus className="h-3.5 w-3.5" /> {t("tailanSectionEditorAddRow")}
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
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div
          key={row._id}
          className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              № {idx + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(row._id)}
                className="text-red-400/70 hover:text-red-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
      >
        <Plus className="h-3.5 w-3.5" /> {t("tailanSectionEditorAddRow")}
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
      collapsed={collapsed}
      hidden={hidden}
      onToggleCollapse={onToggleCollapse}
      onToggleHide={onToggleHide}
      romanLabel={romanLabel}
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
