"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  weeklyReportApi,
  type WeeklyReport,
  type WeeklyReportRoleInfo,
} from "@/lib/api";
import {
  CalendarRange,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
  Building2,
  CheckCircle2,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  FileDown,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ──────────────────────────────────────────────────────────────────
interface AuditWorkRow {
  id: string;
  rowNo: number;
  openAuditWork: string;
  plan: string;
  performance: string;
  startDate: string;
  endDate: string;
  progress: string;
  foundIssues: string;
}

interface ComplaintRow {
  id: string;
  rowNo: number;
  responsibleEmployee: string;
  progress: string;
}

interface FollowupRow {
  id: string;
  rowNo: number;
  followupAudit: string;
  performance: string;
  progress: string;
}

interface DaaWorkRow {
  id: string;
  rowNo: number;
  plannedWork: string;
  purpose: string;
  performance: string;
}

interface DataProcessingRow {
  id: string;
  rowNo: number;
  relatedAudit: string;
  dataProcessingWork: string;
}

interface OtherExtraRow {
  id: string;
  label: string;
  value: string;
}

interface OtherInfo {
  approvedHeadcount: string;
  working: string;
  onLeave: string;
  recruiting: string;
  currentInfo: string;
  training: string;
  other: OtherExtraRow[];
}

interface AuditSections {
  auditWorks: AuditWorkRow[];
  complaints: ComplaintRow[];
  followups: FollowupRow[];
  other: OtherInfo;
}

interface DaaSections {
  daaWorks: DaaWorkRow[];
  dataProcessing: DataProcessingRow[];
  other: OtherInfo;
}

const EMPTY_OTHER: OtherInfo = {
  approvedHeadcount: "",
  working: "",
  onLeave: "",
  recruiting: "",
  currentInfo: "",
  training: "",
  other: [],
};

const EMPTY_AUDIT: AuditSections = {
  auditWorks: [],
  complaints: [],
  followups: [],
  other: { ...EMPTY_OTHER },
};

const EMPTY_DAA: DaaSections = {
  daaWorks: [],
  dataProcessing: [],
  other: { ...EMPTY_OTHER },
};

// ─── ISO week helpers ───────────────────────────────────────────────────────
function getIsoWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week };
}

function isoWeekToDates(year: number, week: number) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

function weekInputValue(year: number, week: number) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function parseWeekInput(v: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(v);
  if (!m) return null;
  return { year: Number(m[1]), week: Number(m[2]) };
}

// ─── Word (.doc) export ─────────────────────────────────────────────────────
function downloadPreviewAsDoc(filename: string) {
  if (typeof window === "undefined") return;
  const sheet = document.querySelector(".weekly-print-sheet");
  if (!sheet) {
    alert("Preview not found");
    return;
  }
  // Replace textareas/inputs with their current values so Word sees the text
  const clone = sheet.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("textarea").forEach((t) => {
    const el = t as HTMLTextAreaElement;
    const span = document.createElement("div");
    span.style.whiteSpace = "pre-wrap";
    span.textContent = el.value || el.textContent || "";
    el.replaceWith(span);
  });
  clone.querySelectorAll("input").forEach((i) => {
    const el = i as HTMLInputElement;
    const span = document.createElement("span");
    span.textContent = el.value || "";
    el.replaceWith(span);
  });

  const css = `
    body { font-family: 'Calibri', 'Arial', sans-serif; color: #000; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #c8d0dc; padding: 6px 8px; vertical-align: top; font-size: 11pt; }
    th { background: #e8edf5; color: #1a2744; text-align: left; font-weight: bold; }
    h1 { color: #1a2744; font-size: 20pt; margin: 0 0 4pt 0; }
    .muted { color: #6b7a99; font-size: 9pt; }
  `;

  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>${filename}</title>` +
    `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>` +
    `<w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->` +
    `<style>${css}</style></head><body>${clone.outerHTML}</body></html>`;

  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── UI primitives ──────────────────────────────────────────────────────────
function SectionTitle({ idx, title }: { idx: number | string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-6 h-6 rounded-md bg-muted border border-border text-[11px] font-bold flex items-center justify-center text-muted-foreground tabular-nums flex-shrink-0">
        {idx}
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function Cell({
  value,
  onChange,
  type = "text",
  readOnly,
  rows = 1,
}: {
  value: string;
  onChange?: (v: string) => void;
  type?: "text" | "date" | "number";
  readOnly?: boolean;
  rows?: number;
}) {
  if (rows > 1) {
    return (
      <textarea
        rows={rows}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 disabled:opacity-50 read-only:bg-muted/20 transition-colors resize-none"
      />
    );
  }
  return (
    <input
      type={type}
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      min={type === "number" ? 0 : undefined}
      className={`w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 read-only:bg-muted/20 transition-colors${
        type === "number"
          ? " [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          : ""
      }`}
    />
  );
}

function AddRowButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <button
      onClick={onClick}
      className="p-1 rounded-md text-rose-500 hover:bg-rose-500/10"
      title={t("eng_deleteTitle")}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

// ─── Other-info form (shared) ───────────────────────────────────────────────
function OtherInfoForm({
  data,
  onChange,
  readOnly,
}: {
  data: OtherInfo;
  onChange?: (next: OtherInfo) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const upd = (k: keyof Omit<OtherInfo, "other">, v: string) =>
    onChange?.({ ...data, [k]: v });

  const numberFields: { key: keyof Omit<OtherInfo, "other">; label: string }[] =
    [
      { key: "approvedHeadcount", label: t("wr_staffApproved") },
      { key: "working", label: t("wr_staffWorking") },
      { key: "onLeave", label: t("wr_staffLeave") },
    ];

  const textFields: { key: keyof Omit<OtherInfo, "other">; label: string }[] = [
    { key: "currentInfo", label: t("wr_currentNews") },
    { key: "training", label: t("wr_training") },
    { key: "recruiting", label: t("wr_selection") },
  ];

  const extraRows: OtherExtraRow[] = Array.isArray(data.other)
    ? data.other
    : [];

  const addRow = () =>
    onChange?.({
      ...data,
      other: [...extraRows, { id: crypto.randomUUID(), label: "", value: "" }],
    });
  const removeRow = (id: string) =>
    onChange?.({ ...data, other: extraRows.filter((r) => r.id !== id) });
  const updateRow = (id: string, patch: Partial<OtherExtraRow>) =>
    onChange?.({
      ...data,
      other: extraRows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });

  return (
    <div className="space-y-4">
      {/* Number fields row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {numberFields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground mb-1 block">
              {f.label}
            </label>
            <Cell
              value={data[f.key] as string}
              onChange={(v) => upd(f.key, v)}
              readOnly={readOnly}
              type="number"
              rows={1}
            />
          </div>
        ))}
      </div>

      {/* Text fields */}
      <div className="space-y-3">
        {textFields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground mb-1 block">
              {f.label}
            </label>
            <Cell
              value={data[f.key] as string}
              onChange={(v) => upd(f.key, v)}
              readOnly={readOnly}
              rows={3}
            />
          </div>
        ))}
      </div>

      {/* Dynamic extra rows */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">
            {t("wr_extraInfo")}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> {t("wr_addRow")}
            </button>
          )}
        </div>
        {extraRows.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic text-center py-3">
            {readOnly ? "—" : t("wr_noExtra")}
          </p>
        ) : (
          <div className="space-y-2">
            {extraRows.map((row) => (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  <Cell
                    value={row.label}
                    onChange={(v) => updateRow(row.id, { label: v })}
                    readOnly={readOnly}
                    rows={1}
                  />
                </div>
                <div className={readOnly ? "col-span-8" : "col-span-7"}>
                  <Cell
                    value={row.value}
                    onChange={(v) => updateRow(row.id, { value: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="col-span-1 mt-1.5 text-muted-foreground hover:text-red-500 inline-flex justify-center"
                    title={t("eng_deleteTitle")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Audit role tables ──────────────────────────────────────────────────────
function AuditWorksTable({
  rows,
  onChange,
  readOnly,
}: {
  rows: AuditWorkRow[];
  onChange?: (next: AuditWorkRow[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const update = (i: number, patch: Partial<AuditWorkRow>) =>
    onChange?.(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) =>
    onChange?.(
      rows
        .filter((_, idx) => idx !== i)
        .map((r, idx) => ({ ...r, rowNo: idx + 1 })),
    );
  const add = () =>
    onChange?.([
      ...rows,
      {
        id: crypto.randomUUID(),
        rowNo: rows.length + 1,
        openAuditWork: "",
        plan: "",
        performance: "",
        startDate: "",
        endDate: "",
        progress: "",
        foundIssues: "",
      },
    ]);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-2 text-left w-10">№</th>
              <th className="px-2 py-2 text-left min-w-[180px]">
                {t("wr_openAudit")}
              </th>
              <th className="px-2 py-2 text-left min-w-[140px]">
                {t("wr_plan")}
              </th>
              <th className="px-2 py-2 text-left min-w-[140px]">
                {t("wr_execution")}
              </th>
              <th className="px-2 py-2 text-left w-32">{t("wr_started")}</th>
              <th className="px-2 py-2 text-left w-32">{t("wr_endDate")}</th>
              <th className="px-2 py-2 text-left min-w-[120px]">
                {t("wr_auditProgress")}
              </th>
              <th className="px-2 py-2 text-left min-w-[200px]">
                {t("wr_foundIssues")}
              </th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 8 : 9}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("wr_noData")}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-2 py-1.5">{r.rowNo}</td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.openAuditWork}
                    onChange={(v) => update(i, { openAuditWork: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.plan}
                    onChange={(v) => update(i, { plan: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.performance}
                    onChange={(v) => update(i, { performance: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.startDate}
                    onChange={(v) => update(i, { startDate: v })}
                    type="date"
                    readOnly={readOnly}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.endDate}
                    onChange={(v) => update(i, { endDate: v })}
                    type="date"
                    readOnly={readOnly}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.progress}
                    onChange={(v) => update(i, { progress: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.foundIssues}
                    onChange={(v) => update(i, { foundIssues: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                {!readOnly && (
                  <td className="px-2 py-1.5 text-center">
                    <RemoveBtn onClick={() => remove(i)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <AddRowButton onClick={add} label={t("wr_addRow")} />}
    </div>
  );
}

function ComplaintsTable({
  rows,
  onChange,
  readOnly,
}: {
  rows: ComplaintRow[];
  onChange?: (next: ComplaintRow[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const update = (i: number, patch: Partial<ComplaintRow>) =>
    onChange?.(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) =>
    onChange?.(
      rows
        .filter((_, idx) => idx !== i)
        .map((r, idx) => ({ ...r, rowNo: idx + 1 })),
    );
  const add = () =>
    onChange?.([
      ...rows,
      {
        id: crypto.randomUUID(),
        rowNo: rows.length + 1,
        responsibleEmployee: "",
        progress: "",
      },
    ]);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-2 text-left w-10">№</th>
              <th className="px-2 py-2 text-left min-w-[200px]">
                {t("wr_responsible")}
              </th>
              <th className="px-2 py-2 text-left min-w-[300px]">
                {t("wr_complaintProgress")}
              </th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 3 : 4}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("wr_noData")}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-2 py-1.5">{r.rowNo}</td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.responsibleEmployee}
                    onChange={(v) => update(i, { responsibleEmployee: v })}
                    readOnly={readOnly}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.progress}
                    onChange={(v) => update(i, { progress: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                {!readOnly && (
                  <td className="px-2 py-1.5 text-center">
                    <RemoveBtn onClick={() => remove(i)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <AddRowButton onClick={add} label={t("wr_addRow")} />}
    </div>
  );
}

function FollowupsTable({
  rows,
  onChange,
  readOnly,
}: {
  rows: FollowupRow[];
  onChange?: (next: FollowupRow[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const update = (i: number, patch: Partial<FollowupRow>) =>
    onChange?.(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) =>
    onChange?.(
      rows
        .filter((_, idx) => idx !== i)
        .map((r, idx) => ({ ...r, rowNo: idx + 1 })),
    );
  const add = () =>
    onChange?.([
      ...rows,
      {
        id: crypto.randomUUID(),
        rowNo: rows.length + 1,
        followupAudit: "",
        performance: "",
        progress: "",
      },
    ]);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-2 text-left w-10">№</th>
              <th className="px-2 py-2 text-left min-w-[200px]">
                {t("wr_followupAudit")}
              </th>
              <th className="px-2 py-2 text-left min-w-[160px]">
                {t("wr_execution")}
              </th>
              <th className="px-2 py-2 text-left min-w-[160px]">
                {t("wr_progress")}
              </th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 4 : 5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("wr_noData")}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-2 py-1.5">{r.rowNo}</td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.followupAudit}
                    onChange={(v) => update(i, { followupAudit: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.performance}
                    onChange={(v) => update(i, { performance: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.progress}
                    onChange={(v) => update(i, { progress: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                {!readOnly && (
                  <td className="px-2 py-1.5 text-center">
                    <RemoveBtn onClick={() => remove(i)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <AddRowButton onClick={add} label={t("wr_addRow")} />}
    </div>
  );
}

// ─── DAA tables ─────────────────────────────────────────────────────────────
function DaaWorksTable({
  rows,
  onChange,
  readOnly,
}: {
  rows: DaaWorkRow[];
  onChange?: (next: DaaWorkRow[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const update = (i: number, patch: Partial<DaaWorkRow>) =>
    onChange?.(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) =>
    onChange?.(
      rows
        .filter((_, idx) => idx !== i)
        .map((r, idx) => ({ ...r, rowNo: idx + 1 })),
    );
  const add = () =>
    onChange?.([
      ...rows,
      {
        id: crypto.randomUUID(),
        rowNo: rows.length + 1,
        plannedWork: "",
        purpose: "",
        performance: "",
      },
    ]);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-2 text-left w-10">№</th>
              <th className="px-2 py-2 text-left min-w-[200px]">
                {t("wr_plannedTask")}
              </th>
              <th className="px-2 py-2 text-left min-w-[180px]">
                {t("wr_goal")}
              </th>
              <th className="px-2 py-2 text-left min-w-[200px]">
                {t("wr_execution")}
              </th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 4 : 5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("wr_noData")}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-2 py-1.5">{r.rowNo}</td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.plannedWork}
                    onChange={(v) => update(i, { plannedWork: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.purpose}
                    onChange={(v) => update(i, { purpose: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.performance}
                    onChange={(v) => update(i, { performance: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                {!readOnly && (
                  <td className="px-2 py-1.5 text-center">
                    <RemoveBtn onClick={() => remove(i)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <AddRowButton onClick={add} label={t("wr_addRow")} />}
    </div>
  );
}

function DataProcessingTable({
  rows,
  onChange,
  readOnly,
}: {
  rows: DataProcessingRow[];
  onChange?: (next: DataProcessingRow[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const update = (i: number, patch: Partial<DataProcessingRow>) =>
    onChange?.(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) =>
    onChange?.(
      rows
        .filter((_, idx) => idx !== i)
        .map((r, idx) => ({ ...r, rowNo: idx + 1 })),
    );
  const add = () =>
    onChange?.([
      ...rows,
      {
        id: crypto.randomUUID(),
        rowNo: rows.length + 1,
        relatedAudit: "",
        dataProcessingWork: "",
      },
    ]);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-2 text-left w-10">№</th>
              <th className="px-2 py-2 text-left min-w-[200px]">
                {t("wr_relatedAudit")}
              </th>
              <th className="px-2 py-2 text-left min-w-[300px]">
                {t("wr_dataTask")}
              </th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 3 : 4}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("wr_noData")}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-2 py-1.5">{r.rowNo}</td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.relatedAudit}
                    onChange={(v) => update(i, { relatedAudit: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Cell
                    value={r.dataProcessingWork}
                    onChange={(v) => update(i, { dataProcessingWork: v })}
                    readOnly={readOnly}
                    rows={2}
                  />
                </td>
                {!readOnly && (
                  <td className="px-2 py-1.5 text-center">
                    <RemoveBtn onClick={() => remove(i)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <AddRowButton onClick={add} label={t("wr_addRow")} />}
    </div>
  );
}

// ─── Audit & DAA editor views ───────────────────────────────────────────────
function AuditEditor({
  data,
  onChange,
  readOnly,
}: {
  data: AuditSections;
  onChange?: (next: AuditSections) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle idx={1} title={t("wr_saved")} />
        <AuditWorksTable
          rows={data.auditWorks}
          onChange={(v) => onChange?.({ ...data, auditWorks: v })}
          readOnly={readOnly}
        />
      </div>
      <div>
        <SectionTitle idx={2} title={t("wr_s2Title")} />
        <ComplaintsTable
          rows={data.complaints}
          onChange={(v) => onChange?.({ ...data, complaints: v })}
          readOnly={readOnly}
        />
      </div>
      <div>
        <SectionTitle idx={3} title={t("wr_s3Title")} />
        <FollowupsTable
          rows={data.followups}
          onChange={(v) => onChange?.({ ...data, followups: v })}
          readOnly={readOnly}
        />
      </div>
      <div>
        <SectionTitle idx={4} title={t("wr_s4Title")} />
        <OtherInfoForm
          data={data.other}
          onChange={(v) => onChange?.({ ...data, other: v })}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

function DaaEditor({
  data,
  onChange,
  readOnly,
}: {
  data: DaaSections;
  onChange?: (next: DaaSections) => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle idx={1} title={t("wr_daaWork")} />
        <DaaWorksTable
          rows={data.daaWorks}
          onChange={(v) => onChange?.({ ...data, daaWorks: v })}
          readOnly={readOnly}
        />
      </div>
      <div>
        <SectionTitle idx={2} title={t("wr_dataProcessing")} />
        <DataProcessingTable
          rows={data.dataProcessing}
          onChange={(v) => onChange?.({ ...data, dataProcessing: v })}
          readOnly={readOnly}
        />
      </div>
      <div>
        <SectionTitle idx={3} title={t("wr_other")} />
        <OtherInfoForm
          data={data.other}
          onChange={(v) => onChange?.({ ...data, other: v })}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

// ─── Director consolidated view ─────────────────────────────────────────────
function DirectorReportCard({
  r,
  defaultOpen,
  onSaved,
  showToast,
}: {
  r: WeeklyReport;
  defaultOpen?: boolean;
  onSaved?: (next: WeeklyReport) => void;
  showToast: (m: string) => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();

  const buildAudit = (
    s: Partial<AuditSections & DaaSections>,
  ): AuditSections => ({
    auditWorks: s.auditWorks ?? [],
    complaints: s.complaints ?? [],
    followups: s.followups ?? [],
    other: s.other ?? { ...EMPTY_OTHER },
  });
  const buildDaa = (s: Partial<AuditSections & DaaSections>): DaaSections => ({
    daaWorks: s.daaWorks ?? [],
    dataProcessing: s.dataProcessing ?? [],
    other: s.other ?? { ...EMPTY_OTHER },
  });

  const initialSections = (r.sections ?? {}) as Partial<
    AuditSections & DaaSections
  >;
  const [audit, setAudit] = useState<AuditSections>(
    buildAudit(initialSections),
  );
  const [daa, setDaa] = useState<DaaSections>(buildDaa(initialSections));

  const startEdit = () => {
    setAudit(buildAudit(initialSections));
    setDaa(buildDaa(initialSections));
    setEditing(true);
    setOpen(true);
  };
  const cancelEdit = () => {
    setAudit(buildAudit(initialSections));
    setDaa(buildDaa(initialSections));
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const sections =
        r.role === "daa"
          ? (daa as unknown as Record<string, unknown>)
          : (audit as unknown as Record<string, unknown>);
      await weeklyReportApi.directorEdit(r.id, sections);
      onSaved?.({ ...r, sections });
      setEditing(false);
      showToast(t("wr_saved"));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("wr_saveError");
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden weekly-report-card">
      <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="font-medium">{r.departmentName || "—"}</div>
            <div className="text-xs text-muted-foreground">
              {r.userName} · {r.weekStart} — {r.weekEnd}
            </div>
          </div>
        </button>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-medium">
          {r.role === "daa" ? t("wr_daaWork") : t("wr_s1Title")}
        </span>
        {!editing ? (
          <button
            onClick={startEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors print:hidden"
            title={t("eng_editTitle")}
          >
            <Pencil className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-1 print:hidden">
            <button
              onClick={save}
              disabled={saving}
              className="px-2.5 py-1 rounded-md bg-foreground text-background text-xs inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              {t("wr_saved")}
            </button>
            <button
              onClick={cancelEdit}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              title={t("back")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {open && (
        <div className="p-4 border-t border-border">
          {r.role === "daa" ? (
            <DaaEditor
              data={daa}
              onChange={editing ? setDaa : undefined}
              readOnly={!editing}
            />
          ) : (
            <AuditEditor
              data={audit}
              onChange={editing ? setAudit : undefined}
              readOnly={!editing}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Preview document ────────────────────────────────────────────────────────
function PvTable({
  headers,
  rows,
  colWidths,
}: {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  colWidths?: string[];
}) {
  const { t } = useLanguage();
  return (
    <table
      className="w-full text-[9.5px] border-collapse mb-0"
      style={{ tableLayout: "fixed" }}
    >
      {colWidths && (
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
      )}
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className="border border-border px-1.5 py-[5px] text-left font-semibold text-foreground bg-muted/50"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={headers.length}
              className="border border-border px-2 py-3 text-center text-gray-400 italic"
            >
              {t("wr_noData")}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border border-border px-1.5 py-[5px] text-[#333] align-top"
                  style={{
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                    hyphens: "auto",
                  }}
                >
                  {cell ?? ""}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PvOtherInfo({ data }: { data: OtherInfo }) {
  const { t } = useLanguage();
  const left: { key: keyof Omit<OtherInfo, "other">; label: string }[] = [
    { key: "approvedHeadcount", label: t("wr_staffApproved") },
    { key: "working", label: t("wr_staffWorking") },
    { key: "onLeave", label: t("wr_staffLeave") },
  ];
  const right: { key: keyof Omit<OtherInfo, "other">; label: string }[] = [
    { key: "currentInfo", label: t("wr_currentNews") },
    { key: "training", label: t("wr_training") },
    { key: "recruiting", label: t("wr_selection") },
  ];
  const extraRows: OtherExtraRow[] = Array.isArray(data.other)
    ? data.other
    : [];
  return (
    <div
      className="space-y-3"
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    >
      <div className="grid grid-cols-2 gap-3">
        <table
          className="w-full text-[9.5px] border-collapse"
          style={{ tableLayout: "fixed" }}
        >
          <tbody>
            {left.map((f) => (
              <tr key={f.key}>
                <td className="border border-border px-2 py-[5px] font-semibold text-foreground bg-muted/50 w-[60%]">
                  {f.label}
                </td>
                <td className="border border-border px-2 py-[5px] text-[#333] text-right tabular-nums">
                  {data[f.key] || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <table
          className="w-full text-[9.5px] border-collapse"
          style={{ tableLayout: "fixed" }}
        >
          <tbody>
            {right.map((f) => (
              <tr key={f.key}>
                <td className="border border-border px-2 py-[5px] font-semibold text-foreground bg-muted/50 w-[35%] align-top">
                  {f.label}
                </td>
                <td className="border border-border px-2 py-[5px] text-[#333] whitespace-pre-wrap align-top">
                  {data[f.key] || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {extraRows.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold text-foreground uppercase tracking-wide mb-1 mt-2">
            {t("wr_extraInfo")}
          </div>
          <table
            className="w-full text-[9.5px] border-collapse"
            style={{ tableLayout: "fixed" }}
          >
            <thead>
              <tr>
                <th className="border border-border px-2 py-[5px] text-left font-semibold text-foreground bg-muted/50 w-[35%]">
                  {t("wr_titleCol")}
                </th>
                <th className="border border-border px-2 py-[5px] text-left font-semibold text-foreground bg-muted/50">
                  {t("wr_contentCol")}
                </th>
              </tr>
            </thead>
            <tbody>
              {extraRows.map((row, i) => (
                <tr
                  key={row.id}
                  className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}
                >
                  <td className="border border-border px-2 py-[5px] text-[#333] font-medium align-top">
                    {row.label || "—"}
                  </td>
                  <td className="border border-border px-2 py-[5px] text-[#333] whitespace-pre-wrap align-top">
                    {row.value || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PvSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
          style={{ background: "#1a2744" }}
        >
          {n}
        </div>
        <h2 className="text-[10.5px] font-bold text-foreground uppercase tracking-wide">
          {title}
        </h2>
      </div>
      <div
        className="rounded border border-border"
        style={{ overflowWrap: "anywhere" }}
      >
        {children}
      </div>
    </div>
  );
}

function WeeklyPreviewDoc({
  role,
  sections,
  weekStart,
  weekEnd,
  departmentName,
  userName,
}: {
  role: "audit" | "daa";
  sections: AuditSections | DaaSections;
  weekStart: string;
  weekEnd: string;
  departmentName: string;
  userName: string;
}) {
  const { t } = useLanguage();
  const fmt = (d: string) =>
    d
      ? new Date(d).toLocaleDateString("mn-MN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "—";

  const header = (
    <>
      {/* Top accent bar */}
      <div
        className="h-1.5 w-full rounded-t"
        style={{
          background:
            "linear-gradient(90deg,#1a2744 0%,#3b5bdb 50%,#1a2744 100%)",
        }}
      />
      <div className="px-7 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#6b7a99] mb-0.5">
              {t("wr_orgHeader")}
            </div>
            <h1 className="text-[18px] font-black text-foreground leading-tight tracking-tight">
              {t("wr_docTitle")}
            </h1>
            <div className="text-[10px] text-[#4a5568] mt-0.5">
              {departmentName}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block border border-border rounded-lg px-3 py-2 bg-muted/20">
              <div className="text-[8.5px] text-[#6b7a99] uppercase tracking-wide mb-0.5">
                {t("wr_period")}
              </div>
              <div className="text-[11px] font-bold text-foreground">
                {fmt(weekStart)}
              </div>
              <div className="text-[9px] text-[#6b7a99]">— {fmt(weekEnd)}</div>
            </div>
          </div>
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-[#1a2744] via-[#3b5bdb] to-transparent" />
      </div>
    </>
  );

  if (role === "audit") {
    const s = sections as AuditSections;
    return (
      <div className="font-sans text-black bg-white">
        {header}
        <div className="px-7 pb-7">
          <PvSection n={1} title={t("wr_saved")}>
            <PvTable
              headers={[
                "№",
                t("wr_openAudit"),
                t("wr_plan"),
                t("wr_execution"),
                t("wr_started"),
                t("wr_endDate"),
                t("wr_progressPct"),
                t("wr_foundIssues"),
              ]}
              colWidths={["4%", "18%", "13%", "13%", "8%", "8%", "8%", "28%"]}
              rows={s.auditWorks.map((r) => [
                r.rowNo,
                r.openAuditWork,
                r.plan,
                r.performance,
                r.startDate ? fmt(r.startDate) : "",
                r.endDate ? fmt(r.endDate) : "",
                r.progress,
                r.foundIssues,
              ])}
            />
          </PvSection>
          <PvSection n={2} title={t("wr_s2Title")}>
            <PvTable
              headers={["№", t("wr_responsible"), t("wr_complaintProgress")]}
              colWidths={["5%", "30%", "65%"]}
              rows={s.complaints.map((r) => [
                r.rowNo,
                r.responsibleEmployee,
                r.progress,
              ])}
            />
          </PvSection>
          <PvSection n={3} title={t("wr_s3Title")}>
            <PvTable
              headers={[
                "№",
                t("wr_followupAudit"),
                t("wr_execution"),
                t("wr_progress"),
              ]}
              colWidths={["5%", "40%", "30%", "25%"]}
              rows={s.followups.map((r) => [
                r.rowNo,
                r.followupAudit,
                r.performance,
                r.progress,
              ])}
            />
          </PvSection>
          <PvSection n={4} title={t("wr_s4Title")}>
            <div className="p-2">
              <PvOtherInfo data={s.other} />
            </div>
          </PvSection>
        </div>
      </div>
    );
  }

  const s = sections as DaaSections;
  return (
    <div className="font-sans text-black bg-white">
      {header}
      <div className="px-7 pb-7">
        <PvSection n={1} title={t("wr_daaSection1")}>
          <PvTable
            headers={[
              "№",
              t("wr_plannedTask"),
              t("wr_goal"),
              t("wr_execution"),
            ]}
            colWidths={["5%", "33%", "30%", "32%"]}
            rows={s.daaWorks.map((r) => [
              r.rowNo,
              r.plannedWork,
              r.purpose,
              r.performance,
            ])}
          />
        </PvSection>
        <PvSection n={2} title={t("wr_daaSection2")}>
          <PvTable
            headers={["№", t("wr_relatedAudit"), t("wr_dataTask")]}
            colWidths={["5%", "35%", "60%"]}
            rows={s.dataProcessing.map((r) => [
              r.rowNo,
              r.relatedAudit,
              r.dataProcessingWork,
            ])}
          />
        </PvSection>
        <PvSection n={3} title={t("wr_daaSection3")}>
          <div className="p-2">
            <PvOtherInfo data={s.other} />
          </div>
        </PvSection>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function WeeklyReportPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [roleInfo, setRoleInfo] = useState<WeeklyReportRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const initial = useMemo(() => getIsoWeek(new Date()), []);
  const [year, setYear] = useState(initial.year);
  const [week, setWeek] = useState(initial.week);
  const dateRange = useMemo(() => isoWeekToDates(year, week), [year, week]);

  const [auditData, setAuditData] = useState<AuditSections>(EMPTY_AUDIT);
  const [daaData, setDaaData] = useState<DaaSections>(EMPTY_DAA);
  const [status, setStatus] = useState<"draft" | "submitted">("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Director state
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Init: load role
  useEffect(() => {
    (async () => {
      try {
        const r = await weeklyReportApi.getRole();
        setRoleInfo(r);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load own report when week changes (writers)
  const loadMine = useCallback(async () => {
    if (!roleInfo || !roleInfo.canWrite) return;
    try {
      const r = await weeklyReportApi.getMine(year, week);
      if (!r) {
        setAuditData(EMPTY_AUDIT);
        setDaaData(EMPTY_DAA);
        setStatus("draft");
        return;
      }
      setStatus(r.status);
      const s = (r.sections ?? {}) as Partial<AuditSections & DaaSections>;
      if (roleInfo.role === "audit") {
        setAuditData({
          auditWorks: s.auditWorks ?? [],
          complaints: s.complaints ?? [],
          followups: s.followups ?? [],
          other: s.other ?? { ...EMPTY_OTHER },
        });
      } else if (roleInfo.role === "daa") {
        setDaaData({
          daaWorks: s.daaWorks ?? [],
          dataProcessing: s.dataProcessing ?? [],
          other: s.other ?? { ...EMPTY_OTHER },
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [roleInfo, year, week]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  // Load consolidated when director
  const loadConsolidated = useCallback(async () => {
    if (!roleInfo?.canViewAll) return;
    setReportsLoading(true);
    try {
      const list = await weeklyReportApi.consolidated(year, week);
      setReports(list);
    } catch (e) {
      console.error(e);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, [roleInfo, year, week]);

  useEffect(() => {
    void loadConsolidated();
  }, [loadConsolidated]);

  // Save / submit handlers
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = async (alsoSubmit = false) => {
    if (!roleInfo || !roleInfo.canWrite) return;
    const sections =
      roleInfo.role === "audit"
        ? (auditData as unknown as Record<string, unknown>)
        : (daaData as unknown as Record<string, unknown>);
    if (alsoSubmit) setSubmitting(true);
    else setSaving(true);
    try {
      await weeklyReportApi.save({
        year,
        weekNumber: week,
        weekStart: dateRange.weekStart,
        weekEnd: dateRange.weekEnd,
        role: roleInfo.role as "audit" | "daa",
        sections,
        status: alsoSubmit ? "submitted" : "draft",
      });
      if (alsoSubmit) {
        setStatus("submitted");
        showToast(t("wr_submitted"));
      } else {
        showToast(t("wr_saved"));
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.response?.data?.message ?? t("wr_saveError"));
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  const onWeekChange = (v: string) => {
    const p = parseWeekInput(v);
    if (p) {
      setYear(p.year);
      setWeek(p.week);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!roleInfo || roleInfo.role === "none") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">{t("wr_noAccess")}</h2>
        <p className="text-muted-foreground">{t("wr_noAccessMsg")}</p>
      </div>
    );
  }

  const isDirector = roleInfo.canViewAll;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col weekly-report-print">
      <style jsx global>{`
        @media print {
          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          /* Collapse height/overflow on every container so wrappers don't reserve a full screen */
          body,
          body * {
            min-height: 0 !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
          }
          /* Hide every element that is NOT an ancestor of, descendant of, or the print sheet itself */
          body
            :not(:has(.weekly-print-sheet)):not(.weekly-print-sheet):not(
              .weekly-print-sheet *
            ) {
            display: none !important;
          }
          .weekly-print-sheet {
            display: block !important;
            background: white !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          /* Strip dark backdrops on the wrapping containers */
          .weekly-print-area,
          .weekly-print-shell,
          .weekly-report-print {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          textarea,
          input {
            border: none !important;
            background: transparent !important;
            color: black !important;
            resize: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
      <ToolPageHeader
        href="/tools"
        icon={<CalendarRange className="w-4 h-4 text-indigo-500" />}
        title={t("wr_docTitle")}
        subtitle={
          isDirector
            ? t("wr_directorSubtitle")
            : roleInfo.departmentName
              ? `${roleInfo.departmentName} · ${roleInfo.role === "daa" ? t("wr_daaWork") : t("wr_s1Title")}`
              : undefined
        }
        rightContent={
          <div className="flex items-center gap-2 print:hidden">
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dateRange.weekStart}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const d = new Date(e.target.value + "T00:00:00Z");
                  const { year: y, week: w } = getIsoWeek(d);
                  setYear(y);
                  setWeek(w);
                }}
                className="px-2 py-1 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
                style={{ fontFamily: "var(--font-jetbrainsMono)" }}
              />
              <span className="text-muted-foreground/60 text-xs">–</span>
              <input
                type="date"
                value={dateRange.weekEnd}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const d = new Date(e.target.value + "T00:00:00Z");
                  const { year: y, week: w } = getIsoWeek(d);
                  setYear(y);
                  setWeek(w);
                }}
                className="px-2 py-1 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
                style={{ fontFamily: "var(--font-jetbrainsMono)" }}
              />
            </div>
            {!isDirector && (
              <>
                <button
                  disabled={saving || submitting}
                  onClick={() => handleSave(false)}
                  className="px-3 py-1.5 rounded-md border border-border hover:bg-accent text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {t("wr_saved")}
                </button>
                <button
                  disabled={saving || submitting}
                  onClick={() => handleSave(true)}
                  className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {t("wr_submitted")}
                </button>
              </>
            )}
            <button
              onClick={() =>
                downloadPreviewAsDoc(`${t("wr_docTitle")}-${year}-W${week}`)
              }
              className="px-3 py-1.5 rounded-md border border-border hover:bg-accent text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              title={t("wr_docTitle")}
            >
              <FileDown className="w-4 h-4" /> Word
            </button>
          </div>
        }
      />
      {isDirector ? (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 flex-1 w-full">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            {reportsLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                {t("wr_noReports")}
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <DirectorReportCard
                    key={r.id}
                    r={r}
                    defaultOpen
                    showToast={showToast}
                    onSaved={(next) =>
                      setReports((prev) =>
                        prev.map((p) => (p.id === next.id ? next : p)),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
          <p className="text-center text-muted-foreground/70 text-xs py-6 print:hidden">
            {user?.name && (
              <>
                <span>{user.name}</span>
                {" · "}
              </>
            )}
            {(user as any)?.department ?? ""}
          </p>
        </div>
      ) : (
        /* ── Writer: split-screen editor + preview ── */
        <div
          className="flex flex-1 overflow-hidden weekly-print-shell"
          style={{ height: "calc(100vh - 57px)" }}
        >
          {/* Left: editor */}
          <div className="w-1/2 overflow-y-auto border-r border-border px-4 py-5 sm:px-6 weekly-editor-pane">
            {status === "submitted" && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-sm mb-5">
                <CheckCircle2 className="w-4 h-4" />
                {t("wr_pdfHint")}
              </div>
            )}
            {roleInfo.role === "audit" ? (
              <AuditEditor data={auditData} onChange={setAuditData} />
            ) : (
              <DaaEditor data={daaData} onChange={setDaaData} />
            )}
          </div>
          {/* Right: preview */}
          <div className="w-1/2 overflow-y-auto bg-background px-3 py-6 sm:px-6 weekly-print-area">
            {/* A4-style shadow sheet */}
            <div
              className="bg-white rounded-2xl overflow-hidden weekly-print-sheet"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                minHeight: "297mm",
              }}
            >
              <WeeklyPreviewDoc
                role={roleInfo.role as "audit" | "daa"}
                sections={roleInfo.role === "audit" ? auditData : daaData}
                weekStart={dateRange.weekStart}
                weekEnd={dateRange.weekEnd}
                departmentName={roleInfo.departmentName ?? ""}
                userName={user?.name ?? ""}
              />
            </div>
            <p className="text-center text-muted-foreground/50 text-[11px] mt-3 print:hidden">
              {t("wr_pdfHint")}
            </p>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-lg bg-foreground text-background shadow-2xl text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
