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
} from "lucide-react";
import Link from "next/link";
import { excelReportApi, ReportTemplateAdmin } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const COLOR_OPTIONS = [
  { label: "Ногоон → Тэнгэр",    value: "from-emerald-500 to-teal-500" },
  { label: "Цэнхэр → Ногоон",    value: "from-blue-500 to-cyan-500" },
  { label: "Нил ягаан → Индиго", value: "from-violet-500 to-indigo-500" },
  { label: "Улаан → Ягаан",      value: "from-rose-500 to-pink-500" },
  { label: "Шар → Улбар шар",    value: "from-amber-500 to-orange-500" },
  { label: "Нил → Цэнхэр нил",   value: "from-purple-500 to-violet-500" },
  { label: "Тэнгэр → Цэнхэр",   value: "from-sky-500 to-blue-500" },
  { label: "Ягаан → Улаан",      value: "from-pink-500 to-rose-500" },
];

const DATE_MODE_META = {
  none:   { label: "Огноогүй",           Icon: MinusCircle,  color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20" },
  single: { label: "Нэг огноо",          Icon: Calendar,     color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
  range:  { label: "Хугацааны интервал", Icon: CalendarRange, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

const EMPTY_FORM = {
  name: "",
  description: "",
  pythonCode: "",
  dateMode: "range" as "none" | "single" | "range",
  color: "from-emerald-500 to-teal-500",
};

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
          <div key={i} className="leading-5">{i + 1}</div>
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
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplateAdmin | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setPanelOpen(true);
  };

  const openEdit = (t: ReportTemplateAdmin) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description, pythonCode: t.pythonCode, dateMode: t.dateMode, color: t.color });
    setPanelOpen(true);
  };

  const closePanel = () => { setPanelOpen(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Нэр оруулна уу", variant: "destructive" });
      return;
    }
    if (!form.pythonCode.trim()) {
      toast({ title: "Python код оруулна уу", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await excelReportApi.adminUpdate(editing.id, form);
        toast({ title: "Амжилттай шинэчлэгдлээ" });
      } else {
        await excelReportApi.adminCreate(form);
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
            <span className="font-semibold text-slate-100">Excel тайлан удирдах</span>
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
              <p className="text-slate-300 font-medium text-lg">Тайлан загвар байхгүй байна</p>
              <p className="text-slate-500 text-sm mt-1">Дээрх "Шинэ тайлан нэмэх" товчийг дарна уу</p>
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
                const dm = DATE_MODE_META[t.dateMode as keyof typeof DATE_MODE_META] ?? DATE_MODE_META.none;
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
                        !t.isActive ? "opacity-50 grayscale" : "hover:border-slate-500/60 hover:shadow-xl hover:shadow-black/40"
                      }`}
                    >
                      <div className={`h-1 w-full bg-gradient-to-r ${t.color}`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-4">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                            <FileSpreadsheet className="w-5 h-5 text-white" />
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            t.isActive
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-slate-700/40 border-slate-600/40 text-slate-500"
                          }`}>
                            {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-100 text-sm leading-snug">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 ${dm.bg} ${dm.color}`}>
                            <DmIcon className="w-3 h-3" />
                            {dm.label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs rounded-full border border-slate-700/60 bg-slate-800/40 text-slate-500 px-2 py-0.5">
                            <Code2 className="w-3 h-3" />
                            {t.pythonCode.split("\n").length} мөр
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
                            title={t.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
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
                            onClick={() => { setDeleteTarget(t); setConfirmDelete(false); }}
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
                    Python скрипт <code className="bg-slate-800 px-1 rounded text-slate-300">OUTPUT_FILE</code>-д .xlsx бичих ёстой
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
                  <Label className="text-slate-300 text-xs font-medium">Тайлангийн нэр *</Label>
                  <Input
                    placeholder="Жишээ: Сэжигтэй гүйлгээний тайлан"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Тайлбар</Label>
                  <Input
                    placeholder="Тайлангийн товч тайлбар"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">Огноо оролт</Label>
                    <Select
                      value={form.dateMode}
                      onValueChange={(v) => setForm((f) => ({ ...f, dateMode: v as "none" | "single" | "range" }))}
                    >
                      <SelectTrigger className="bg-slate-800/60 border-slate-700 text-slate-100 focus:ring-emerald-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="none" className="text-slate-200 focus:bg-slate-700">Огноогүй</SelectItem>
                        <SelectItem value="single" className="text-slate-200 focus:bg-slate-700">Нэг огноо</SelectItem>
                        <SelectItem value="range" className="text-slate-200 focus:bg-slate-700">Хугацааны интервал</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">Карт өнгө</Label>
                    <Select
                      value={form.color}
                      onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}
                    >
                      <SelectTrigger className="bg-slate-800/60 border-slate-700 text-slate-100 focus:ring-emerald-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {COLOR_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-slate-200 focus:bg-slate-700">
                            <div className="flex items-center gap-2">
                              <div className={`h-3 w-6 rounded bg-gradient-to-r ${c.value}`} />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${form.color}`} />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-xs font-medium">Python код *</Label>
                    <span className="text-xs text-slate-600">{form.pythonCode.split("\n").length} мөр</span>
                  </div>
                  <CodeEditor
                    value={form.pythonCode}
                    onChange={(v) => setForm((f) => ({ ...f, pythonCode: v }))}
                    placeholder={`import os\nimport openpyxl\n\nstart = os.environ.get('START_DATE', '')\nend   = os.environ.get('END_DATE', '')\nout   = os.environ['OUTPUT_FILE']\n\nwb = openpyxl.Workbook()\nws = wb.active\nws.title = 'Тайлан'\nws.append(['Огноо', 'Дүн'])\n# ... ClickHouse-аас өгөгдөл татах ...\nwb.save(out)`}
                  />
                  <p className="text-xs text-slate-600">
                    Env: <code className="text-slate-400">OUTPUT_FILE, START_DATE, END_DATE, CLICKHOUSE_HOST, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE</code>
                  </p>
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Хадгалж байна...</>
                  ) : editing ? (
                    <><Check className="w-4 h-4" /> Хадгалах</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Үүсгэх</>
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
                    <p className="font-semibold text-slate-100 text-sm">Загвар устгах уу?</p>
                    <p className="text-xs text-slate-500 mt-0.5">Буцаах боломжгүй</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-5">
                  <span className="font-medium text-slate-200">"{deleteTarget.name}"</span> загварыг устгахад бүх тохиргоо устна.
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
                    <p className="text-xs text-red-400 text-center font-medium">Итгэлтэй байна уу? Дахин баталгаажуулна уу.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setDeleteTarget(null); setConfirmDelete(false); }}
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
