"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ArrowLeft,
  Loader2,
  Calendar,
  CalendarRange,
  MinusCircle,
  X,
  AlertTriangle,
  Check,
  Database,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { excelReportApi, ReportTemplateAdmin, FilterDef } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const COLOR_OPTIONS = [
  { label: "Ногоон", value: "from-emerald-500 to-teal-500" },
  { label: "Цэнхэр", value: "from-blue-500 to-cyan-500" },
  { label: "Нил ягаан", value: "from-violet-500 to-indigo-500" },
  { label: "Улаан", value: "from-rose-500 to-pink-500" },
  { label: "Шар", value: "from-amber-500 to-orange-500" },
  { label: "Ягаан", value: "from-pink-500 to-rose-500" },
];

const DATE_MODE_META = {
  none: {
    label: "Огноогүй",
    Icon: MinusCircle,
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
  single: {
    label: "Нэг огноо",
    Icon: Calendar,
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  range: {
    label: "Хугацааны интервал",
    Icon: CalendarRange,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
};

const EMPTY_FORM = {
  name: "",
  description: "",
  pythonCode: "",
  dateMode: "range" as "none" | "single" | "range",
  color: "from-emerald-500 to-teal-500",
  filters: "[]" as string,
  stagingTable: "",
  stagingInsertSql: "",
};

// ── SQL_MARKER prefix so we can detect + extract SQL when editing ─────────────
const SQL_MARKER = "# __SQL_MODE__\n";

function sqlToPython(sql: string): string {
  // Generate minimal SQL-mode code — buildScript() on the backend
  // wraps this with ch_query(), ClickHouse env vars, and xlsxwriter postamble.
  return [
    SQL_MARKER.trim(),
    "SQL = r'''",
    sql.replace(/'''/g, "''\\'''"),
    "'''.strip()",
    "",
    "df = ch_query(SQL)",
  ].join("\n");
}

/** Extract SQL from a SQL-mode generated pythonCode, or return null */
function extractSqlFromPython(code: string): string | null {
  if (!code.startsWith(SQL_MARKER.trim())) return null;
  // SQL is embedded as: SQL = r'''
  // <sql lines>
  // '''.strip()
  const match = code.match(/^SQL = r'''\n([\s\S]*?)\n'''\.strip\(\)/m);
  if (match) return match[1].replace(/''\\'''/g, "'''");
  // Fallback: old JSON-encoded format SQL = "..."
  const legacyMatch = code.match(/^SQL = ("[\s\S]*?")\s*$/m);
  if (legacyMatch) {
    try {
      return JSON.parse(legacyMatch[1]) as string;
    } catch {
      return null;
    }
  }
  return null;
}

// ── Inline code editor with line numbers ─────────────────────────────────────
function CodeEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);

  const lines = value ? value.split("\n") : [""];

  const syncScroll = () => {
    if (taRef.current && lnRef.current) {
      lnRef.current.scrollTop = taRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = taRef.current!;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.substring(0, start) + "    " + value.substring(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  };

  return (
    <div className="relative flex overflow-hidden rounded-xl border border-slate-700 bg-[#0d1117] font-mono text-xs leading-5">
      <div
        ref={lnRef}
        className="select-none overflow-hidden border-r border-slate-800 bg-[#161b22] px-3 py-3 text-right text-slate-600"
        style={{ minWidth: "3rem" }}
        aria-hidden
      >
        {lines.map((_, i) => (
          <div key={i} className="leading-5">
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent py-3 pl-3 pr-3 text-slate-200 outline-none placeholder:text-slate-700"
        style={{ minHeight: "340px", lineHeight: "1.25rem", tabSize: 4 }}
      />
    </div>
  );
}

// ── SQL Code Generator component ─────────────────────────────────────────────

interface ColInfo {
  alias: string; // e.g. CIF_ID
  expr: string; // e.g. GAM.CIF_ID
  filterKey: string; // editable, e.g. cif_ids
  selected: boolean;
}

interface StagingColInfo extends ColInfo {
  required: boolean;
}

function parseCols(sql: string): ColInfo[] {
  const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s/i);
  if (!selectMatch) return [];
  const selectPart = selectMatch[1];
  const rawCols = splitTopLevel(selectPart);
  return rawCols
    .map((raw) => {
      const trimmed = raw.trim();
      const asMatch = trimmed.match(/^([\s\S]+?)\s+AS\s+(\w+)\s*$/i);
      if (asMatch) {
        const expr = asMatch[1].trim();
        const alias = asMatch[2].trim();
        return { alias, expr, filterKey: alias.toLowerCase(), selected: false };
      }
      // bare col or table.col
      const dotParts = trimmed.split(".");
      const alias = dotParts[dotParts.length - 1].trim();
      return {
        alias,
        expr: trimmed,
        filterKey: alias.toLowerCase(),
        selected: false,
      };
    })
    .filter((c) => c.alias && !/[()*/+\-]/.test(c.alias));
}

function splitTopLevel(s: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) result.push(cur);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminExcelReportsPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReportTemplateAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<ReportTemplateAdmin | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplateAdmin | null>(
    null,
  );
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sqlCode, setSqlCode] = useState("");
  const [parsedCols, setParsedCols] = useState<ColInfo[]>([]);
  const [whereFilters, setWhereFilters] = useState<{ key: string; label: string }[]>([]);
  const [showStagingFields, setShowStagingFields] = useState(false);
  const [stagingCols, setStagingCols] = useState<StagingColInfo[]>([]);
  const [stagingWhereFilters, setStagingWhereFilters] = useState<{ key: string; label: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await excelReportApi.adminGetAll();
      setTemplates(data);
    } catch {
      toast({ title: "Ачаалалтын алдаа", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setSqlCode("");
    setParsedCols([]);
    setWhereFilters([]);
    setStagingCols([]);
    setStagingWhereFilters([]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSqlCode("");
    setParsedCols([]);
    setWhereFilters([]);
    setStagingCols([]);
    setStagingWhereFilters([]);
    setShowStagingFields(false);
    setPanelOpen(true);
  };

  const openEdit = (t: ReportTemplateAdmin) => {
    setEditing(t);
    const extracted = extractSqlFromPython(t.pythonCode);
    // Strip stored {IF}...{/IF} filter blocks to show clean SQL in the editor
    const cleanSql = (extracted ?? "")
      .replace(/\n?\{IF \w+\}[^{]*\{\/IF\}/g, "")
      .trim();
    setSqlCode(cleanSql);
    // Restore chip selections from stored filterDefs
    let storedFilters: FilterDef[] = [];
    try {
      storedFilters = JSON.parse(t.filters || "[]");
    } catch {
      /* */
    }
    const cols = parseCols(cleanSql);
    const selectedKeys = new Set<string>(storedFilters.map((f) => f.key));
    setParsedCols(
      cols.map((c) => ({
        ...c,
        selected: selectedKeys.has(c.filterKey),
        filterKey:
          storedFilters.find((f) => f.label === c.alias)?.key ?? c.filterKey,
      })),
    );
    // Restore WHERE-only filters: stored filters whose key doesn't match any SELECT chip
    const chipKeys = new Set(cols.map((c) => c.filterKey));
    const whereKeys = [...(extracted ?? "").matchAll(/\{IF\s+(\w+)\}/g)].map(
      (m) => m[1],
    );
    const uniqueWhereKeys = [...new Set(whereKeys)];
    setWhereFilters(
      uniqueWhereKeys
        .filter((k) => !chipKeys.has(k))
        .map((k) => ({
          key: k,
          label: storedFilters.find((f) => f.key === k)?.label ?? "",
        })),
    );
    // Strip chip-appended {IF}...{/IF} blocks from stagingInsertSql so the
    // editor shows clean SQL; chips are restored from storedFilters below.
    const cleanStgSql = (t.stagingInsertSql ?? "")
      .replace(/\n?\{IF \w+\}[^{]*\{\/IF\}/g, "")
      .trim();
    setForm({
      name: t.name,
      description: t.description,
      pythonCode: t.pythonCode,
      dateMode: t.dateMode,
      color: t.color,
      filters: t.filters || "[]",
      stagingTable: t.stagingTable ?? "",
      stagingInsertSql: cleanStgSql,
    });
    const isStg = !!t.stagingTable?.trim();
    setShowStagingFields(isStg);
    if (isStg) {
      const stgCols = parseCols(cleanStgSql);
      const selectedKeys = new Set(storedFilters.map((f) => f.key));
      setStagingCols(
        stgCols.map((c) => {
          const stored = storedFilters.find(
            (f) => f.label === c.alias || f.key === c.filterKey,
          );
          return {
            ...c,
            selected: selectedKeys.has(c.filterKey) || storedFilters.some((f) => f.label === c.alias),
            filterKey: stored?.key ?? c.filterKey,
            required: !!stored?.required,
          };
        }),
      );
      // Restore WHERE-only filters for staging mode
      const stgChipKeys = new Set(stgCols.map((c) => c.filterKey));
      const stgWhereKeys = [
        ...(t.stagingInsertSql ?? "").matchAll(/\{IF\s+(\w+)\}/g),
      ].map((m) => m[1]);
      const uniqueStgWhereKeys = [...new Set(stgWhereKeys)];
      setStagingWhereFilters(
        uniqueStgWhereKeys
          .filter((k) => !stgChipKeys.has(k))
          .map((k) => ({
            key: k,
            label: storedFilters.find((f) => f.key === k)?.label ?? "",
          })),
      );
    } else {
      setStagingCols([]);
      setStagingWhereFilters([]);
    }
    setPanelOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Нэр оруулна уу", variant: "destructive" });
      return;
    }
    const isStaging = showStagingFields;
    if (!isStaging && !sqlCode.trim()) {
      toast({ title: "SQL query оруулна уу", variant: "destructive" });
      return;
    }
    // Append {IF key}AND expr IN ({key}){/IF} blocks for each selected chip,
    // but skip if {IF key} already exists in the SQL (user wrote it manually)
    const selectedCols = parsedCols.filter((c) => c.selected);
    let sqlWithFilters = sqlCode.trim();
    for (const col of selectedCols) {
      if (!sqlWithFilters.includes(`{IF ${col.filterKey}}`)) {
        sqlWithFilters += `\n{IF ${col.filterKey}}AND ${col.expr} IN ({${col.filterKey}}){/IF}`;
      }
    }
    const finalPythonCode = isStaging
      ? "# __STAGING_MODE__"
      : sqlToPython(sqlWithFilters);
    const finalFilters = isStaging
      ? JSON.stringify([
          ...stagingCols
            .filter((c) => c.selected)
            .map((c) => ({
              key: c.filterKey,
              label: c.alias,
              placeholder: "",
              required: c.required,
            })),
          ...stagingWhereFilters
            .filter((w) => w.key)
            .map((w) => ({
              key: w.key,
              label: w.label || w.key,
              placeholder: "",
            })),
        ])
      : JSON.stringify([
          ...selectedCols.map((c) => ({
            key: c.filterKey,
            label: c.alias,
            placeholder: "",
          })),
          ...whereFilters
            .filter((w) => w.key)
            .map((w) => ({
              key: w.key,
              label: w.label || w.key,
              placeholder: "",
            })),
        ]);
    setSaving(true);
    // For staging mode, append {IF key}AND expr IN ({key}){/IF} for selected chips
    let stagingInsertSqlFinal = "";
    if (isStaging) {
      stagingInsertSqlFinal = form.stagingInsertSql.trim();
      for (const col of stagingCols.filter((c) => c.selected)) {
        if (!stagingInsertSqlFinal.includes(`{IF ${col.filterKey}}`)) {
          stagingInsertSqlFinal += `\n{IF ${col.filterKey}}AND ${col.expr} IN ({${col.filterKey}}){/IF}`;
        }
      }
    }
    try {
      const payload = {
        ...form,
        pythonCode: finalPythonCode,
        filters: finalFilters,
        stagingInsertSql: stagingInsertSqlFinal,
      };
      if (editing) {
        await excelReportApi.adminUpdate(editing.id, payload);
        toast({ title: "Амжилттай шинэчлэгдлээ" });
      } else {
        await excelReportApi.adminCreate(payload);
        toast({ title: "Амжилттай үүслээ" });
      }
      closePanel();
      load();
    } catch (e: any) {
      toast({
        title: "Алдаа",
        description: e?.response?.data?.message ?? "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t: ReportTemplateAdmin) => {
    setToggling(t.id);
    try {
      await excelReportApi.adminToggle(t.id, !t.isActive);
      toast({ title: t.isActive ? "Идэвхгүй болголоо" : "Идэвхжүүллээ" });
      load();
    } catch {
      toast({ title: "Алдаа", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await excelReportApi.adminDelete(deleteTarget.id);
      toast({ title: "Устгагдлаа" });
      setDeleteTarget(null);
      setConfirmDelete(false);
      load();
    } catch {
      toast({ title: "Устгахад алдаа гарлаа", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Буцах
          </Link>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-100">
              Excel тайлан удирдах
            </span>
          </div>

          <div className="ml-auto">
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-medium transition-all shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Шинэ тайлан нэмэх
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-4 border-slate-800" />
              <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-slate-500">Ачаалж байна...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <FileSpreadsheet className="w-10 h-10 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium text-lg">
                Тайлан загвар байхгүй байна
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Дээрх "Шинэ тайлан нэмэх" товчийг дарна уу
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Шинэ тайлан нэмэх
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {templates.map((t, i) => {
                const dm =
                  DATE_MODE_META[t.dateMode as keyof typeof DATE_MODE_META] ??
                  DATE_MODE_META.none;
                const DmIcon = dm.Icon;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div
                      className={`relative rounded-2xl border border-slate-700/50 bg-slate-900/60 overflow-hidden transition-all duration-200 ${
                        !t.isActive
                          ? "opacity-50 grayscale"
                          : "hover:border-slate-500/60 hover:shadow-xl hover:shadow-black/40"
                      }`}
                    >
                      <div
                        className={`h-1 w-full bg-gradient-to-r ${t.color}`}
                      />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-4">
                          <div
                            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shadow-md flex-shrink-0`}
                          >
                            <FileSpreadsheet className="w-5 h-5 text-white" />
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              t.isActive
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-slate-700/40 border-slate-600/40 text-slate-500"
                            }`}
                          >
                            {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-100 text-sm leading-snug">
                          {t.name}
                        </p>
                        {t.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 ${dm.bg} ${dm.color}`}
                          >
                            <DmIcon className="w-3 h-3" />
                            {dm.label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs rounded-full border border-slate-700/60 bg-slate-800/40 px-2 py-0.5">
                            <Database className="w-3 h-3 text-violet-400" />
                            <span className="text-violet-400">SQL</span>
                          </span>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => openEdit(t)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Засах
                          </button>
                          <button
                            onClick={() => handleToggle(t)}
                            disabled={toggling === t.id}
                            className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
                            title={
                              t.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"
                            }
                          >
                            {toggling === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : t.isActive ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(t);
                              setConfirmDelete(false);
                            }}
                            className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 transition-colors"
                            title="Устгах"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Create / Edit side panel ── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              key="panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
              onClick={() => !saving && closePanel()}
            />
            <motion.div
              key="panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="fixed right-0 top-0 z-40 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-700/60 shadow-2xl flex flex-col"
            >
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100 text-sm">
                    {editing ? "Тайлан загвар засах" : "Шинэ тайлан загвар"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    SQL query оруулна — Python код автоматаар үүснэ
                  </p>
                </div>
                <button
                  onClick={() => !saving && closePanel()}
                  className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">
                    Тайлангийн нэр *
                  </Label>
                  <Input
                    placeholder="Жишээ: Сэжигтэй гүйлгээний тайлан"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">
                    Тайлбар
                  </Label>
                  <Input
                    placeholder="Тайлангийн товч тайлбар"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">
                      Огноо оролт
                    </Label>
                    <Select
                      value={form.dateMode}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          dateMode: v as "none" | "single" | "range",
                        }))
                      }
                    >
                      <SelectTrigger className="bg-slate-800/60 border-slate-700 text-slate-100 focus:ring-emerald-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem
                          value="none"
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          Огноогүй
                        </SelectItem>
                        <SelectItem
                          value="single"
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          Нэг огноо
                        </SelectItem>
                        <SelectItem
                          value="range"
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          Хугацааны интервал
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">
                      Карт өнгө
                    </Label>
                    <Select
                      value={form.color}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, color: v }))
                      }
                    >
                      <SelectTrigger className="bg-slate-800/60 border-slate-700 text-slate-100 focus:ring-emerald-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {COLOR_OPTIONS.map((c) => (
                          <SelectItem
                            key={c.value}
                            value={c.value}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-3 w-6 rounded bg-gradient-to-r ${c.value}`}
                              />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div
                  className={`h-1.5 w-full rounded-full bg-gradient-to-r ${form.color}`}
                />

                {/* Staging mode fields */}
                <div
                  className={`rounded-xl border ${showStagingFields ? "border-amber-500/30 bg-amber-500/5" : "border-slate-700/40 bg-slate-800/20"} overflow-hidden transition-colors`}
                >
                  {/* Toggle header */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showStagingFields;
                      setShowStagingFields(next);
                      if (!next) {
                        setForm((f) => ({
                          ...f,
                          stagingTable: "",
                          stagingInsertSql: "",
                        }));
                        setStagingCols([]);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${showStagingFields ? "bg-amber-400" : "bg-slate-600"}`}
                      />
                      <span
                        className={`text-xs font-semibold ${showStagingFields ? "text-amber-400" : "text-slate-500"}`}
                      >
                        Стейжинг горим
                      </span>
                    </div>
                    <div
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showStagingFields ? "bg-amber-500" : "bg-slate-700"}`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${showStagingFields ? "translate-x-3.5" : "translate-x-0.5"}`}
                      />
                    </div>
                  </button>

                  {/* Collapsible content */}
                  {showStagingFields && (
                    <div className="px-4 pb-4 space-y-3 border-t border-amber-500/20">
                      <p className="text-[11px] text-slate-500 leading-relaxed pt-3">
                        Тавар оруулсан: INSERT SQL ажиллана → стейжинг хүснээсээ
                        ашиглана → CSV татагдана → TRUNCATE. INSERT SQL-д{" "}
                        {"{start_date}"}, {"{end_date}"} placeholder ашиглаж
                        болно.
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-slate-400 text-xs">
                          Стейжинг хүснэгтэйн нэр (schema.table)
                        </Label>
                        <Input
                          placeholder="Жиш: BRANCH.AUDIT_S1_FINAL"
                          value={form.stagingTable}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              stagingTable: e.target.value,
                            }))
                          }
                          className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:border-amber-500 focus:ring-amber-500/20 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-400 text-xs">
                          INSERT INTO ... SELECT ... SQL
                        </Label>
                        <CodeEditor
                          value={form.stagingInsertSql}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, stagingInsertSql: v }))
                          }
                          placeholder={`INSERT INTO BRANCH.AUDIT_S1_FINAL\nSELECT ...\nFROM FINACLE.GAM_LAM\nWHERE toDate(B_TXNDATE) BETWEEN toDate('{start_date}') AND toDate('{end_date}')`}
                        />
                      </div>

                      {/* ── Staging filter chip selector ── */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-400 text-xs">
                            Шүүлтүүр баганууд (сонголтот)
                          </Label>
                          <button
                            type="button"
                            onClick={() => {
                              const cols = parseCols(form.stagingInsertSql).map(
                                (c) => ({ ...c, required: false }),
                              );
                              setStagingCols(cols);
                              // Auto-detect {IF key} placeholders in WHERE clause
                              const chipKeys = new Set(cols.map((c) => c.filterKey));
                              const found = [
                                ...form.stagingInsertSql.matchAll(/\{IF\s+(\w+)\}/g),
                              ].map((m) => m[1]);
                              const unique = [...new Set(found)];
                              setStagingWhereFilters(
                                unique
                                  .filter((k) => !chipKeys.has(k))
                                  .map((k) => ({
                                    key: k,
                                    label:
                                      stagingWhereFilters.find((w) => w.key === k)
                                        ?.label ?? "",
                                  })),
                              );
                            }}
                            disabled={!form.stagingInsertSql.trim()}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                          >
                            <Wand2 className="w-3 h-3" />
                            Баганууд задлах
                          </button>
                        </div>
                        {stagingCols.length === 0 ? (
                          <p className="text-xs text-slate-600 text-center py-1">
                            INSERT SQL бичсэний дараа &ldquo;Баганууд
                            задлах&rdquo; товчийг дарна уу
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500">
                              Фильтр болгох баганаа сонгох — шар = сонгогдсон
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {stagingCols.map((c, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    setStagingCols((prev) => {
                                      const next = [...prev];
                                      next[i] = {
                                        ...next[i],
                                        selected: !next[i].selected,
                                      };
                                      return next;
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                                    c.selected
                                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                      : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-500"
                                  }`}
                                >
                                  {c.alias}
                                </button>
                              ))}
                            </div>
                            {stagingCols.some((c) => c.selected) && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] text-slate-500">
                                  Filter key болон &ldquo;Заавал&rdquo;
                                  тохируулах
                                </p>
                                <div className="grid gap-1.5">
                                  {stagingCols
                                    .filter((c) => c.selected)
                                    .map((c) => {
                                      const realIdx = stagingCols.indexOf(c);
                                      return (
                                        <div
                                          key={realIdx}
                                          className="flex items-center gap-2 rounded-lg bg-slate-800/40 border border-amber-500/20 px-2.5 py-1.5"
                                        >
                                          <span className="text-xs text-amber-400 font-mono flex-shrink-0 w-28 truncate">
                                            {c.alias}
                                          </span>
                                          <span className="text-slate-600 text-[10px]">
                                            →
                                          </span>
                                          <input
                                            value={c.filterKey}
                                            onChange={(e) =>
                                              setStagingCols((prev) =>
                                                prev.map((x, j) =>
                                                  j === realIdx
                                                    ? {
                                                        ...x,
                                                        filterKey:
                                                          e.target.value
                                                            .replace(
                                                              /[^a-z0-9_]/gi,
                                                              "",
                                                            )
                                                            .toLowerCase(),
                                                      }
                                                    : x,
                                                ),
                                              )
                                            }
                                            className="flex-1 min-w-0 bg-transparent text-xs font-mono text-sky-300 outline-none border-b border-slate-600 focus:border-amber-500"
                                          />
                                          <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                                            <input
                                              type="checkbox"
                                              checked={c.required}
                                              onChange={(e) =>
                                                setStagingCols((prev) =>
                                                  prev.map((x, j) =>
                                                    j === realIdx
                                                      ? {
                                                          ...x,
                                                          required:
                                                            e.target.checked,
                                                        }
                                                      : x,
                                                  ),
                                                )
                                              }
                                              className="w-3 h-3 accent-amber-500"
                                            />
                                            <span className="text-[10px] text-amber-400 whitespace-nowrap">
                                              Заавал
                                            </span>
                                          </label>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── WHERE-clause {IF key} filters already in staging INSERT SQL ── */}
                      {stagingWhereFilters.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-amber-500/10">
                          <div className="flex items-center gap-2 pt-1">
                            <Label className="text-amber-400/80 text-xs font-medium">
                              WHERE-д байгаа шүүлтүүрүүд
                            </Label>
                            <span className="text-[10px] text-slate-600">
                              (автоматаар илэрсэн)
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 leading-relaxed">
                            INSERT SQL WHERE хэсэгт{" "}
                            <code className="text-amber-600/80">&#123;IF key&#125;</code>{" "}
                            блок байгаа — доор Label нэрсийг оруулна уу
                          </p>
                          <div className="grid gap-1.5">
                            {stagingWhereFilters.map((w, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-2.5 py-1.5"
                              >
                                <code className="text-xs text-amber-400 font-mono flex-shrink-0">
                                  &#123;IF {w.key}&#125;
                                </code>
                                <span className="text-slate-600 text-[10px]">
                                  →
                                </span>
                                <input
                                  value={w.label}
                                  onChange={(e) =>
                                    setStagingWhereFilters((prev) =>
                                      prev.map((x, j) =>
                                        j === i
                                          ? { ...x, label: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                  placeholder="Харуулах нэр (жишх: SOL ID)"
                                  className="flex-1 bg-transparent text-xs text-slate-200 outline-none border-b border-slate-600 focus:border-amber-500 placeholder:text-slate-600"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!showStagingFields && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-slate-300 text-xs font-medium">
                        SQL Query *
                      </Label>
                      <CodeEditor
                        value={sqlCode}
                        onChange={setSqlCode}
                        placeholder={
                          "SELECT *\nFROM your_table\nWHERE date >= '{start_date}'\n  AND date <= '{end_date}'"
                        }
                      />
                      <p className="text-xs text-slate-600">
                        Хадгалахад автоматаар Python код үүснэ.{" "}
                        <code className="text-slate-400">
                          {"'{start_date}'"}
                        </code>
                        ,{" "}
                        <code className="text-slate-400">{"'{end_date}'"}</code>{" "}
                        placeholder ашиглаж болно.
                      </p>
                    </div>

                    {/* ── Filter column chip selector ── */}
                    {!form.stagingTable && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-300 text-xs font-medium">
                            Шүүлтүүр баганууд
                          </Label>
                          <button
                            type="button"
                            onClick={() => {
                              const cols = parseCols(sqlCode);
                              setParsedCols(cols);
                              // Auto-detect {IF key} placeholders already in SQL
                              const chipKeys = new Set(cols.map((c) => c.filterKey));
                              const found = [
                                ...sqlCode.matchAll(/\{IF\s+(\w+)\}/g),
                              ].map((m) => m[1]);
                              const unique = [...new Set(found)];
                              setWhereFilters(
                                unique
                                  .filter((k) => !chipKeys.has(k))
                                  .map((k) => ({
                                    key: k,
                                    label:
                                      whereFilters.find((w) => w.key === k)
                                        ?.label ?? "",
                                  })),
                              );
                            }}
                            disabled={!sqlCode.trim()}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors disabled:opacity-40"
                          >
                            <Wand2 className="w-3 h-3" />
                            Баганууд задлах
                          </button>
                        </div>
                        {parsedCols.length === 0 ? (
                          <p className="text-xs text-slate-600 text-center py-2">
                            SQL бичсэний дараа &ldquo;Баганууд задлах&rdquo;
                            товчийг дарж фильтр баганаа сонгоно уу
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[11px] text-slate-500">
                              Фильтр болгох баганаа сонгох — ногоон = сонгогдсон
                              → хадгалахад автоматаар {"{IF key}"}...{"{/IF}"}{" "}
                              блок үүснэ
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {parsedCols.map((c, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    setParsedCols((prev) => {
                                      const next = [...prev];
                                      next[i] = {
                                        ...next[i],
                                        selected: !next[i].selected,
                                      };
                                      return next;
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                                    c.selected
                                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                      : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-500"
                                  }`}
                                >
                                  {c.alias}
                                </button>
                              ))}
                            </div>
                            {parsedCols.some((c) => c.selected) && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] text-slate-500">
                                  Filter key нэрсийг засвар болох — хадгалахад
                                  автоматаар SQL-д нэмэгдэнэ
                                </p>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  {parsedCols
                                    .filter((c) => c.selected)
                                    .map((c) => {
                                      const realIdx = parsedCols.indexOf(c);
                                      return (
                                        <div
                                          key={realIdx}
                                          className="flex items-center gap-2 rounded-lg bg-slate-800/40 border border-slate-700/40 px-2.5 py-1.5"
                                        >
                                          <span className="text-xs text-emerald-400 font-mono flex-shrink-0 w-28 truncate">
                                            {c.alias}
                                          </span>
                                          <span className="text-slate-600 text-[10px]">
                                            →
                                          </span>
                                          <input
                                            value={c.filterKey}
                                            onChange={(e) =>
                                              setParsedCols((prev) =>
                                                prev.map((x, j) =>
                                                  j === realIdx
                                                    ? {
                                                        ...x,
                                                        filterKey:
                                                          e.target.value
                                                            .replace(
                                                              /[^a-z0-9_]/gi,
                                                              "",
                                                            )
                                                            .toLowerCase(),
                                                      }
                                                    : x,
                                                ),
                                              )
                                            }
                                            className="flex-1 min-w-0 bg-transparent text-xs font-mono text-sky-300 outline-none border-b border-slate-600 focus:border-sky-500"
                                          />
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {/* ── WHERE-clause {IF key} filters already in SQL ── */}
                      {whereFilters.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-amber-400/80 text-xs font-medium">
                              SQL-д аль хэдийн байгаа шүүлтүүрүүд
                            </Label>
                            <span className="text-[10px] text-slate-600">
                              (автоматаар илэрсэн)
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 leading-relaxed">
                            SQL WHERE хэсэгт{" "}
                            <code className="text-amber-600/80">&#123;IF key&#125;</code>{" "}
                            блок байгаа — доор Label нэрсийг оруулна уу
                          </p>
                          <div className="grid gap-1.5">
                            {whereFilters.map((w, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-2.5 py-1.5"
                              >
                                <code className="text-xs text-amber-400 font-mono flex-shrink-0">
                                  &#123;IF {w.key}&#125;
                                </code>
                                <span className="text-slate-600 text-[10px]">
                                  →
                                </span>
                                <input
                                  value={w.label}
                                  onChange={(e) =>
                                    setWhereFilters((prev) =>
                                      prev.map((x, j) =>
                                        j === i
                                          ? { ...x, label: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                  placeholder="Харуулах нэр (жишх: SOL ID)"
                                  className="flex-1 bg-transparent text-xs text-slate-200 outline-none border-b border-slate-600 focus:border-amber-500 placeholder:text-slate-600"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>
                  )}
                  </>
                )}
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-800 flex-shrink-0">
                <button
                  onClick={() => !saving && closePanel()}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  Болих
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Хадгалж
                      байна...
                    </>
                  ) : editing ? (
                    <>
                      <Check className="w-4 h-4" /> Хадгалах
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Үүсгэх
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              key="del-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              key="del-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100 text-sm">
                      Загвар устгах уу?
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Буцаах боломжгүй
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-5">
                  <span className="font-medium text-slate-200">
                    "{deleteTarget.name}"
                  </span>{" "}
                  загварыг устгахад бүх тохиргоо устна.
                </p>
                {!confirmDelete ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-2.5 text-sm rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                      Болих
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex-1 py-2.5 text-sm rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 hover:text-red-300 transition-colors"
                    >
                      Устгах
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-red-400 text-center font-medium">
                      Итгэлтэй байна уу? Дахин баталгаажуулна уу.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setDeleteTarget(null);
                          setConfirmDelete(false);
                        }}
                        className="flex-1 py-2.5 text-sm rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
                      >
                        Болих
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex-1 py-2.5 text-sm rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Тийм, устгах
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
