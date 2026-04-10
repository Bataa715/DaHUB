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
  Code2,
  Calendar,
  CalendarRange,
  MinusCircle,
  X,
  AlertTriangle,
  Check,
  Database,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import Link from "next/link";
import { excelReportApi, ReportTemplateAdmin } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const COLOR_OPTIONS = [
  { label: "Ногоон → Тэнгэр", value: "from-emerald-500 to-teal-500" },
  { label: "Цэнхэр → Ногоон", value: "from-blue-500 to-cyan-500" },
  { label: "Нил ягаан → Индиго", value: "from-violet-500 to-indigo-500" },
  { label: "Улаан → Ягаан", value: "from-rose-500 to-pink-500" },
  { label: "Шар → Улбар шар", value: "from-amber-500 to-orange-500" },
  { label: "Нил → Цэнхэр нил", value: "from-purple-500 to-violet-500" },
  { label: "Тэнгэр → Цэнхэр", value: "from-sky-500 to-blue-500" },
  { label: "Ягаан → Улаан", value: "from-pink-500 to-rose-500" },
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
};

// ── SQL_MARKER prefix so we can detect + extract SQL when editing ─────────────
const SQL_MARKER = "# __SQL_MODE__\n";

// ── Starter template for Python mode ─────────────────────────────────────────
// ── Starter template for Python (DataFrame) mode ─────────────────────────
const PYTHON_STARTER = [
  "# __DF_MODE__",
  "# ch_query(sql) болон START_DATE, END_DATE автоматаар байна.",
  "# df хувьсагчид DataFrame оноогоод дуусаарай — Excel автоматаар үүснэ.",
  "# Олон хуудас: sheets = {'Хуудас1': df1, 'Хуудас2': df2}",
  "",
  'sql = f"""',
  "SELECT *",
  "FROM your_table",
  "WHERE date >= '{START_DATE}'",
  "  AND date <= '{END_DATE}'",
  "ORDER BY date DESC",
  "LIMIT 50000",
  '"""',
  "",
  "df = ch_query(sql)",
  "",
  "# Нэмэлт боловсруулалт:",
  "# df = df[df['amount'] > 0]",
  "# df['total'] = df['qty'] * df['price']",
].join("\n");

// ── Quick-insert snippets ─────────────────────────────────────────────────
interface Snippet {
  label: string;
  desc: string;
  code: string;
}
const SNIPPETS: Snippet[] = [
  {
    label: "ch_query",
    desc: "ClickHouse query → df",
    code: [
      'sql = f"""',
      "SELECT col1, col2, SUM(amount) AS total",
      "FROM your_table",
      "WHERE date >= '{START_DATE}'",
      "  AND date <= '{END_DATE}'",
      "GROUP BY col1, col2",
      "ORDER BY total DESC",
      "LIMIT 50000",
      '"""',
      "df = ch_query(sql)",
    ].join("\n"),
  },
  {
    label: "merge",
    desc: "2 DataFrame нэгтгэх",
    code: [
      'df1 = ch_query("SELECT id, name FROM table1")',
      'df2 = ch_query("SELECT id, amount FROM table2")',
      "df = pd.merge(df1, df2, on='id', how='left')",
    ].join("\n"),
  },
  {
    label: "sheets",
    desc: "Олон хуудас",
    code: [
      'df1 = ch_query("SELECT ... FROM table1")',
      'df2 = ch_query("SELECT ... FROM table2")',
      "sheets = {",
      "    '1-р хуудас': df1,",
      "    '2-р хуудас': df2,",
      "}",
    ].join("\n"),
  },
];

function sqlToPython(sql: string): string {
  // Build the same template as the backend SQL_TO_EXCEL_PYTHON, with SQL injected.
  // We use os.environ['QUERY_SQL'] which we put into env from the SQL field.
  // However for template-based reports the SQL is baked into the script directly
  // so the user doesn't need to pass it each time.
  return [
    SQL_MARKER.trim(),
    "import os, json, urllib.request, openpyxl",
    "from openpyxl.styles import Font, PatternFill, Alignment, Border, Side",
    "from openpyxl.utils import get_column_letter",
    "from urllib.parse import urlencode",
    "",
    "CH_HOST = os.environ.get('CLICKHOUSE_HOST', 'localhost')",
    "CH_PORT = os.environ.get('CLICKHOUSE_PORT', '8123')",
    "CH_USER = os.environ.get('CLICKHOUSE_USER', 'default')",
    "CH_PASS = os.environ.get('CLICKHOUSE_PASSWORD', '')",
    "CH_DB   = os.environ.get('CLICKHOUSE_DATABASE', 'audit_db')",
    "OUTPUT  = os.environ['OUTPUT_FILE']",
    "START   = os.environ.get('START_DATE', '')",
    "END     = os.environ.get('END_DATE', '')",
    "",
    // Embed SQL as a raw triple-quoted Python string — immune to \n / \\ round-trip issues.
    // Triple single-quotes are escaped inside the SQL to avoid prematurely closing the string.
    "SQL = r'''",
    sql.replace(/'''/g, "''\\'''"),
    "'''.strip()",
    "",
    "# Replace date placeholders if present",
    "SQL = SQL.replace('{start_date}', START).replace('{end_date}', END)",
    "",
    "params = urlencode({'user': CH_USER, 'password': CH_PASS, 'database': CH_DB, 'default_format': 'JSONCompact'})",
    "url = 'http://' + CH_HOST + ':' + CH_PORT + '/?' + params",
    "req = urllib.request.Request(url, data=SQL.encode('utf-8'), method='POST')",
    "with urllib.request.urlopen(req) as resp:",
    "    result = json.loads(resp.read().decode('utf-8'))",
    "",
    "headers = [col['name'] for col in result.get('meta', [])]",
    "rows = result.get('data', [])",
    "",
    "wb = openpyxl.Workbook()",
    "ws = wb.active",
    "ws.title = 'Result'",
    "",
    "header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')",
    "header_font = Font(color='FFFFFF', bold=True)",
    "thin = Side(border_style='thin', color='8EA9C1')",
    "for ci, h in enumerate(headers, 1):",
    "    cell = ws.cell(row=1, column=ci, value=h)",
    "    cell.fill = header_fill",
    "    cell.font = header_font",
    "    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)",
    "    cell.border = Border(bottom=thin)",
    "",
    "even_fill = PatternFill(start_color='D6E4F0', end_color='D6E4F0', fill_type='solid')",
    "data_side = Side(border_style='thin', color='D0D0D0')",
    "for ri, row in enumerate(rows, 2):",
    "    for ci, val in enumerate(row, 1):",
    "        cell = ws.cell(row=ri, column=ci, value=val)",
    "        if ri % 2 == 0:",
    "            cell.fill = even_fill",
    "        cell.border = Border(bottom=data_side)",
    "",
    "for ci in range(1, len(headers) + 1):",
    "    max_len = len(str(headers[ci - 1]))",
    "    for ri in range(2, min(len(rows) + 2, 102)):",
    "        v = ws.cell(row=ri, column=ci).value",
    "        if v is not None:",
    "            max_len = max(max_len, len(str(v)))",
    "    ws.column_dimensions[get_column_letter(ci)].width = min(max_len + 2, 50)",
    "",
    "ws.row_dimensions[1].height = 30",
    "ws.freeze_panes = 'A2'",
    "wb.save(OUTPUT)",
    "print('SAVED:' + OUTPUT)",
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

  // SQL vs Python mode
  const [sqlMode, setSqlMode] = useState(true);
  const [sqlCode, setSqlCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await excelReportApi.adminGetAll();
      setTemplates(data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Мэдээлэл татахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSqlMode(true);
    setSqlCode("");
    setPanelOpen(true);
  };

  const openEdit = (t: ReportTemplateAdmin) => {
    setEditing(t);
    const extracted = extractSqlFromPython(t.pythonCode);
    setSqlMode(extracted !== null);
    setSqlCode(extracted ?? "");
    setForm({
      name: t.name,
      description: t.description,
      pythonCode: t.pythonCode,
      dateMode: t.dateMode,
      color: t.color,
    });
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Нэр оруулна уу", variant: "destructive" });
      return;
    }
    if (sqlMode && !sqlCode.trim()) {
      toast({ title: "SQL query оруулна уу", variant: "destructive" });
      return;
    }
    if (!sqlMode && !form.pythonCode.trim()) {
      toast({ title: "Python код оруулна уу", variant: "destructive" });
      return;
    }
    const finalPythonCode = sqlMode
      ? sqlToPython(sqlCode.trim())
      : form.pythonCode;
    setSaving(true);
    try {
      const payload = { ...form, pythonCode: finalPythonCode };
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
                          <span className="inline-flex items-center gap-1 text-xs rounded-full border border-slate-700/60 bg-slate-800/40 text-slate-500 px-2 py-0.5">
                            {t.pythonCode.startsWith("# __SQL_MODE__") ? (
                              <>
                                <Database className="w-3 h-3 text-violet-400" />
                                <span className="text-violet-400">SQL</span>
                              </>
                            ) : (
                              <>
                                <Code2 className="w-3 h-3" />
                                {t.pythonCode.split("\n").length} мөр
                              </>
                            )}
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
                    {sqlMode
                      ? "SQL query оруулна — Python код автоматаар үүснэ"
                      : "df = ch_query(sql) бичнэ — Excel автоматаар гарна"}
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

                <div className="space-y-1.5">
                  {/* Mode toggle */}
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-slate-300 text-xs font-medium">
                      {sqlMode ? "SQL Query *" : "Python код *"}
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !sqlMode;
                        setSqlMode(next);
                        // When switching to Python mode with empty code → load starter template
                        if (next === false && !form.pythonCode.trim()) {
                          setForm((f) => ({
                            ...f,
                            pythonCode: PYTHON_STARTER,
                          }));
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                      title="SQL горим / Python горим солих"
                    >
                      {sqlMode ? (
                        <>
                          <Database className="w-3 h-3 text-violet-400" />
                          <span className="text-violet-300">SQL горим</span>
                          <ToggleRight className="w-4 h-4 text-violet-400" />
                        </>
                      ) : (
                        <>
                          <Code2 className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-400">Python горим</span>
                          <ToggleLeft className="w-4 h-4 text-slate-500" />
                        </>
                      )}
                    </button>
                  </div>

                  {sqlMode ? (
                    <>
                      <CodeEditor
                        value={sqlCode}
                        onChange={setSqlCode}
                        placeholder={
                          "SELECT *\nFROM your_table\nWHERE date >= '{start_date}'\n  AND date <= '{end_date}'\nLIMIT 10000"
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
                    </>
                  ) : (
                    <>
                      {/* Snippets */}
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              pythonCode: PYTHON_STARTER,
                            }))
                          }
                          className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          ↺ загвар
                        </button>
                        {SNIPPETS.map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            title={s.desc}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                pythonCode:
                                  (f.pythonCode ? f.pythonCode + "\n\n" : "") +
                                  s.code,
                              }))
                            }
                            className="text-xs px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            + {s.label}
                          </button>
                        ))}
                        <span className="ml-auto text-xs text-slate-600 self-center">
                          {form.pythonCode.split("\n").length} мөр
                        </span>
                      </div>
                      <CodeEditor
                        value={form.pythonCode}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, pythonCode: v }))
                        }
                        placeholder={`# __DF_MODE__\nsql = f"""\nSELECT *\nFROM your_table\nWHERE date >= '{START_DATE}'\n  AND date <= '{END_DATE}'\n"""\ndf = ch_query(sql)`}
                      />
                      <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2 space-y-1">
                        <p className="text-xs text-slate-400 font-medium">
                          Автоматаар байдаг:
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          ch_query(sql) → pd.DataFrame
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          START_DATE, END_DATE, CLICKHOUSE_*
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          df = ...{" "}
                          <span className="text-slate-600">
                            → Excel автоматаар
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          sheets = {"{'Хуудас': df}"}{" "}
                          <span className="text-slate-600">→ олон хуудас</span>
                        </p>
                      </div>
                    </>
                  )}
                </div>
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
