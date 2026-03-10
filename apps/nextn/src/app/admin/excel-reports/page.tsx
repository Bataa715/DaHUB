"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
} from "lucide-react";
import Link from "next/link";
import { excelReportApi, ReportTemplateAdmin } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const COLOR_OPTIONS = [
  { label: "Цэнхэр → Ногоон", value: "from-blue-500 to-cyan-500" },
  { label: "Нил ягаан → Индиго", value: "from-violet-500 to-indigo-500" },
  { label: "Улаан → Ягаан", value: "from-rose-500 to-pink-500" },
  { label: "Шар → Улбар шар", value: "from-amber-500 to-orange-500" },
  { label: "Ногоон → Тэнгэр", value: "from-emerald-500 to-teal-500" },
  { label: "Нил → Цэнхэр нил", value: "from-purple-500 to-violet-500" },
  { label: "Тэнгэр → Цэнхэр", value: "from-sky-500 to-blue-500" },
  { label: "Ягаан → Улаан", value: "from-pink-500 to-rose-500" },
];

const DATE_MODE_LABELS: Record<string, { label: string; icon: React.FC<any> }> =
  {
    none: { label: "Огноогүй", icon: MinusCircle },
    single: { label: "Нэг огноо", icon: Calendar },
    range: { label: "Хугацааны интервал", icon: CalendarRange },
  };

const EMPTY_FORM = {
  name: "",
  description: "",
  pythonCode: "",
  dateMode: "range" as "none" | "single" | "range",
  color: "from-blue-500 to-cyan-500",
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
    <div className="relative flex overflow-hidden rounded-md border border-input bg-[#0d1117] font-mono text-xs leading-5">
      {/* Line numbers */}
      <div
        ref={lnRef}
        className="select-none overflow-hidden border-r border-slate-700 bg-[#161b22] px-2 py-3 text-right text-slate-500"
        style={{ minWidth: "3rem", userSelect: "none" }}
        aria-hidden
      >
        {lines.map((_, i) => (
          <div key={i} className="leading-5">
            {i + 1}
          </div>
        ))}
      </div>
      {/* Textarea */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent py-3 pl-3 pr-3 text-slate-200 outline-none placeholder:text-slate-600"
        style={{ minHeight: "320px", lineHeight: "1.25rem", tabSize: 4 }}
      />
    </div>
  );
}

export default function AdminExcelReportsPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReportTemplateAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReportTemplateAdmin | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplateAdmin | null>(
    null,
  );
  const [toggling, setToggling] = useState<string | null>(null);

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
    setDialogOpen(true);
  };

  const openEdit = (t: ReportTemplateAdmin) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description,
      pythonCode: t.pythonCode,
      dateMode: t.dateMode,
      color: t.color,
    });
    setDialogOpen(true);
  };

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
      setDialogOpen(false);
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
      load();
    } catch {
      toast({ title: "Устгахад алдаа гарлаа", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Excel тайлан удирдах</h1>
            <p className="text-sm text-muted-foreground">
              Тайлангийн загваруудыг нэмэх, засах, устгах
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="ml-auto gap-2">
          <Plus className="h-4 w-4" />
          Шинэ загвар
        </Button>
      </div>

      {/* Template list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <FileSpreadsheet className="mb-4 h-16 w-16 opacity-30" />
          <p className="text-lg">Тайлан загвар байхгүй байна</p>
          <p className="text-sm">
            "Шинэ загвар" товчийг дарж эхлэх загвар нэмнэ үү
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {templates.map((t, i) => {
              const DM = DATE_MODE_LABELS[t.dateMode];
              const Icon = DM?.icon ?? MinusCircle;
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className={`border-border/50 ${!t.isActive ? "opacity-50 grayscale" : ""}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.color}`}
                        >
                          <FileSpreadsheet className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex gap-1">
                          <Badge
                            variant={t.isActive ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="mt-2 text-base">{t.name}</CardTitle>
                      {t.description && (
                        <CardDescription className="line-clamp-2 text-sm">
                          {t.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{DM?.label}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Code2 className="h-3.5 w-3.5" />
                        <span>{t.pythonCode.split("\n").length} мөр код</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Засах
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={toggling === t.id}
                          onClick={() => handleToggle(t)}
                        >
                          {toggling === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : t.isActive ? (
                            <PowerOff className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[95vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Загвар засах" : "Шинэ тайлан загвар"}
            </DialogTitle>
            <DialogDescription>
              Python скрипт нь{" "}
              <code className="rounded bg-muted px-1 text-xs">OUTPUT_FILE</code>{" "}
              env-ийн замд Excel файл (.xlsx) бичих ёстой.
              <br />
              Нэмэлт env:{" "}
              <code className="rounded bg-muted px-1 text-xs">
                START_DATE, END_DATE, CLICKHOUSE_HOST, CLICKHOUSE_USER,
                CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Тайлангийн нэр *</Label>
              <Input
                placeholder="Жишээ: Сэжигтэй гүйлгээний тайлан"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Тайлбар</Label>
              <Input
                placeholder="Тайлангийн товч тайлбар"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Огноо оролт</Label>
                <Select
                  value={form.dateMode}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      dateMode: v as "none" | "single" | "range",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Огноогүй</SelectItem>
                    <SelectItem value="single">Нэг огноо</SelectItem>
                    <SelectItem value="range">Хугацааны интервал</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Карт өнгө</Label>
                <Select
                  value={form.color}
                  onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Python код *</Label>
                <span className="text-xs text-muted-foreground">
                  {form.pythonCode.split("\n").length} мөр
                </span>
              </div>
              <CodeEditor
                value={form.pythonCode}
                onChange={(v) => setForm((f) => ({ ...f, pythonCode: v }))}
                placeholder={`import os\nimport openpyxl\n\nstart = os.environ.get('START_DATE', '')\nend   = os.environ.get('END_DATE', '')\nout   = os.environ['OUTPUT_FILE']\n\nwb = openpyxl.Workbook()\nws = wb.active\nws.title = 'Тайлан'\nws.append(['Огноо', 'Дүн'])\n# ... ClickHouse-аас өгөгдөл татах ...\nwb.save(out)`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Болих
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Хадгалах" : "Үүсгэх"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Загвар устгах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> загварыг устгахад буцаах
              боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
