"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  AlertTriangle,
  Check,
  Database,
  FileText,
  Code2,
  KeyRound,
  History,
  UserCheck,
  Users,
  RefreshCw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";
import {
  pythonToolApi,
  usersApi,
  getApiErrorMessage,
  PythonToolAdmin,
  FilterDef,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CodeEditor, PyCodeWorkbench } from "./_components/PyCodeWorkbench";

// ── Shared constants ──────────────────────────────────────────────────────────

const DATE_MODE_META = {
  none: {
    label: "Огноогүй",
    Icon: MinusCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/30 border-border/30",
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

const CONNECTION_META = {
  clickhouse: { label: "ClickHouse", color: "text-yellow-400", icon: Database },
  oracle: { label: "Oracle DB", color: "text-red-400", icon: Database },
  clickhouse_oracle: {
    label: "ClickHouse + Oracle",
    color: "text-violet-400",
    icon: Database,
  },
};

const OUTPUT_META = {
  excel: {
    label: "Excel (.xlsx)",
    icon: FileSpreadsheet,
    color: "text-emerald-400",
  },
  csv: { label: "CSV", icon: FileText, color: "text-sky-400" },
};

const DEFAULT_CONN_CONFIG: Record<string, string> = {
  clickhouse: `{}`,
  oracle: `{
  "host": "localhost",
  "port": 1521,
  "serviceName": "ORCL",
  "user": "",
  "password": ""
}`,
  oracle_multi: `{
  "finacle": {
    "host": "localhost",
    "port": 1521,
    "serviceName": "ORCL",
    "user": "",
    "password": ""
  },
  "erp": {
    "host": "localhost",
    "port": 1521,
    "serviceName": "ERPPRD",
    "user": "",
    "password": ""
  }
}`,
  clickhouse_oracle: `{
  "oracle": {
    "host": "localhost",
    "port": 1521,
    "serviceName": "ORCL",
    "user": "",
    "password": ""
  }
}`,
};

const DEFAULT_PY_CODE = `# Энд Python кодоо бичнэ үү.
# Боломжит хувьсагчид:
#   conn        - ClickHouse клиент эсвэл Oracle Connection эсвэл
#                 Oracle олон connection бол dict: conn["finacle"], conn["erp"]
#   ch          - ClickHouse+Oracle хослолд ClickHouse клиент
#   ora         - ClickHouse+Oracle хослолд Oracle connection dict
#   pd          - pandas
#   np          - numpy
#   start_date  - эхлэх огноо (str)
#   end_date    - дуусах огноо (str)
#   filters     - нэмэлт шүүлтүүрүүд (dict, бүх утга string)
#
# "Олон утга" (list) төрлийн шүүлтүүр — жиш: олон CIF/дугаар нэг
# талбарт (админ Шүүлтүүрүүд хэсэгт "Олон утга" сонгоно):
#   customer_ids = [x for x in filters.get("customer_ids", "").split(",") if x]
#
# Oracle олон connection жишээ:
#   cur1 = conn["finacle"].cursor()
#   cur2 = conn["erp"].cursor()
#
# ClickHouse+Oracle хослолжишээ:
#   df_ch = ch.query_df("SELECT ...")
#   cur   = ora["oracle"].cursor()
#
# Заавал result оноох хэрэгтэй:
#   result = df
#   result = [("Sheet1", df1), ("Sheet2", df2)]

df = conn.query_df("SELECT * FROM some_table LIMIT 100")
result = df
`;

// ── Code editor — _components/PyCodeWorkbench.tsx-д тусад нь байрлана ─────────

// ── Filters editor ─────────────────────────────────────────────────────────────

function FiltersEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [items, setItems] = useState<FilterDef[]>([]);
  useEffect(() => {
    try {
      setItems(JSON.parse(value) as FilterDef[]);
    } catch {
      setItems([]);
    }
  }, [value]);
  const update = (next: FilterDef[]) => {
    setItems(next);
    onChange(JSON.stringify(next));
  };
  const add = () =>
    update([
      ...items,
      { key: "", label: "", placeholder: "", required: false, type: "text" },
    ]);
  const remove = (i: number) => update(items.filter((_, idx) => idx !== i));
  const set = (i: number, field: keyof FilterDef, val: string | boolean) =>
    update(items.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));
  return (
    <div className="space-y-2">
      {items.map((f, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            value={f.key}
            onChange={(e) => set(i, "key", e.target.value)}
            placeholder="key"
            className="h-8 text-xs bg-background border-border flex-1"
          />
          <Input
            value={f.label}
            onChange={(e) => set(i, "label", e.target.value)}
            placeholder="Нэр"
            className="h-8 text-xs bg-background border-border flex-1"
          />
          <Input
            value={f.placeholder ?? ""}
            onChange={(e) => set(i, "placeholder", e.target.value)}
            placeholder="Hint"
            className="h-8 text-xs bg-background border-border flex-1"
          />
          <select
            value={f.type ?? "text"}
            onChange={(e) => set(i, "type", e.target.value)}
            title="Нэг талбар (text) эсвэл олон утга (list — CIF/дугаарын жагсаалт)"
            className="h-8 text-xs bg-background border border-border rounded px-1.5 text-foreground"
          >
            <option value="text">Нэг утга</option>
            <option value="list">Олон утга (жагсаалт)</option>
          </select>
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1.5 rounded text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1"
      >
        <Plus className="w-3.5 h-3.5" /> Шүүлтүүр нэмэх
      </button>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        &ldquo;Олон утга&rdquo; төрлийн шүүлтүүрт хэрэглэгч дурын олон утга
        (жиш: CIF дугаар) шинэ мөр бүрт эсвэл ,-аар зааглаж оруулж чадна. Python
        кодод:{" "}
        <code>
          filters.get(&quot;key&quot;, &quot;&quot;).split(&quot;,&quot;)
        </code>{" "}
        гэж бичээд жагсаалт болгоно.
      </p>
    </div>
  );
}

// ── Forms ─────────────────────────────────────────────────────────────────────

interface PyFormState {
  name: string;
  apiPath: string;
  description: string;
  pythonCode: string;
  connectionType: "clickhouse" | "oracle" | "clickhouse_oracle";
  connectionConfig: string;
  outputFormat: "excel" | "csv";
  dateMode: "none" | "single" | "range";
  filters: string;
}

const EMPTY_PY_FORM: PyFormState = {
  name: "",
  apiPath: "",
  description: "",
  pythonCode: DEFAULT_PY_CODE,
  connectionType: "clickhouse",
  connectionConfig: DEFAULT_CONN_CONFIG.clickhouse,
  outputFormat: "excel",
  dateMode: "none",
  filters: "[]",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [pageTab, setPageTab] = useState<"templates" | "permissions" | "logs">(
    "templates",
  );

  // Python state
  const [pyTools, setPyTools] = useState<PythonToolAdmin[]>([]);
  const [pyLoading, setPyLoading] = useState(true);
  const [editingPy, setEditingPy] = useState<PythonToolAdmin | null>(null);
  const [pyForm, setPyForm] = useState(EMPTY_PY_FORM);
  const [deletePyTarget, setDeletePyTarget] = useState<PythonToolAdmin | null>(
    null,
  );

  // Shared panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Permissions tab state ─────────────────────────────────────────────────
  const [pUsers, setPUsers] = useState<any[]>([]);
  const [pPermissions, setPPermissions] = useState<
    { userId: string; templateId: string }[]
  >([]);
  const [pLoading, setPLoading] = useState(false);
  const [pSaving, setPSaving] = useState<string | null>(null);
  const [pSelectedTemplate, setPSelectedTemplate] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const [pSheetTab, setPSheetTab] = useState<"with" | "without">("with");
  const [pGranting, setPGranting] = useState(false);
  const [pSelectedUsers, setPSelectedUsers] = useState<Set<string>>(new Set());

  // ── Logs tab state ────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadPy = useCallback(async () => {
    setPyLoading(true);
    try {
      setPyTools(await pythonToolApi.adminGetAll());
    } catch {
      toast({ title: "Python tool ачаалахад алдаа", variant: "destructive" });
    } finally {
      setPyLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPy();
  }, [loadPy]);

  // ── Permissions ───────────────────────────────────────────────────────────

  const loadPermissions = useCallback(async () => {
    setPLoading(true);
    try {
      const [users, perms] = await Promise.all([
        usersApi.getAll(),
        pythonToolApi.adminGetPermissions(),
      ]);
      setPUsers(
        users.filter((u: { isActive?: boolean }) => u.isActive !== false),
      );
      setPPermissions(perms);
    } catch {
      toast({
        title: "Эрхийн мэдээлэл татахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setPLoading(false);
    }
  }, [toast]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await pythonToolApi.adminGetRunLogs(500);
      setLogs(data);
    } catch {
      toast({ title: "Лог татахад алдаа гарлаа", variant: "destructive" });
    } finally {
      setLogsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (pageTab === "permissions" && pUsers.length === 0 && !pLoading)
      loadPermissions();
    if (pageTab === "logs" && logs.length === 0 && !logsLoading) loadLogs();
  }, [pageTab]); // eslint-disable-line

  const hasPermission = (userId: string, templateId: string) =>
    pPermissions.some(
      (p) => p.userId === userId && p.templateId === templateId,
    );

  const togglePermission = async (userId: string, templateId: string) => {
    const key = `${userId}:${templateId}`;
    setPSaving(key);
    try {
      if (hasPermission(userId, templateId)) {
        await pythonToolApi.adminRevokePermission(userId, templateId);
        setPPermissions((prev) =>
          prev.filter(
            (p) => !(p.userId === userId && p.templateId === templateId),
          ),
        );
      } else {
        await pythonToolApi.adminGrantPermission(userId, templateId);
        setPPermissions((prev) => [...prev, { userId, templateId }]);
      }
    } catch {
      toast({ title: "Алдаа гарлаа", variant: "destructive" });
    } finally {
      setPSaving(null);
    }
  };

  const openPermSheet = (t: { id: string; name: string; color: string }) => {
    setPSelectedTemplate(t);
    setPSheetTab("with");
    setPSelectedUsers(new Set());
  };

  const getUsersWithAccess = (templateId: string) =>
    pUsers.filter((u) => u.isAdmin || hasPermission(u.id, templateId));

  const getUsersWithoutAccess = (templateId: string) =>
    pUsers.filter((u) => !u.isAdmin && !hasPermission(u.id, templateId));

  const grantSelected = async () => {
    if (!pSelectedTemplate || pSelectedUsers.size === 0) return;
    setPGranting(true);
    try {
      for (const uid of Array.from(pSelectedUsers)) {
        await pythonToolApi.adminGrantPermission(uid, pSelectedTemplate.id);
        setPPermissions((prev) => [
          ...prev,
          { userId: uid, templateId: pSelectedTemplate.id },
        ]);
      }
      setPSelectedUsers(new Set());
      setPSheetTab("with");
      toast({ title: `${pSelectedUsers.size} хэрэглэгчид эрх олголоо` });
    } catch {
      toast({ title: "Алдаа гарлаа", variant: "destructive" });
    } finally {
      setPGranting(false);
    }
  };

  const revokeUser = async (userId: string) => {
    if (!pSelectedTemplate) return;
    await togglePermission(userId, pSelectedTemplate.id);
  };

  // ── Panel open/close ──────────────────────────────────────────────────────

  const closePanel = () => {
    setPanelOpen(false);
    setEditingPy(null);
    setPyForm(EMPTY_PY_FORM);
  };

  const openCreate = () => {
    setEditingPy(null);
    setPyForm(EMPTY_PY_FORM);
    setPanelOpen(true);
  };

  const openEditPy = (t: PythonToolAdmin) => {
    setEditingPy(t);
    setPyForm({
      name: t.name,
      apiPath: t.apiPath,
      description: t.description ?? "",
      pythonCode: t.pythonCode,
      connectionType: (t.connectionType ??
        "clickhouse") as PyFormState["connectionType"],
      connectionConfig:
        t.connectionConfig && t.connectionConfig !== "{}"
          ? JSON.stringify(JSON.parse(t.connectionConfig), null, 2)
          : DEFAULT_CONN_CONFIG[t.connectionType ?? "clickhouse"],
      outputFormat: (t.outputFormat ?? "excel") as PyFormState["outputFormat"],
      dateMode: (t.dateMode ?? "none") as PyFormState["dateMode"],
      filters: t.filters ?? "[]",
    });
    setPanelOpen(true);
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSavePy = async () => {
    if (!pyForm.name.trim())
      return toast({ title: "Нэр шаардлагатай", variant: "destructive" });
    if (!pyForm.apiPath.trim())
      return toast({ title: "API зам шаардлагатай", variant: "destructive" });
    if (!pyForm.pythonCode.trim())
      return toast({
        title: "Python код шаардлагатай",
        variant: "destructive",
      });
    try {
      JSON.parse(pyForm.connectionConfig);
    } catch {
      return toast({
        title: "Connection Config JSON буруу",
        variant: "destructive",
      });
    }
    setSaving(true);
    try {
      const payload = {
        ...pyForm,
        color: editingPy?.color ?? "from-blue-500 to-cyan-500",
        connectionConfig: JSON.stringify(JSON.parse(pyForm.connectionConfig)),
      };
      if (editingPy) {
        await pythonToolApi.adminUpdate(editingPy.id, payload);
        toast({ title: "Шинэчлэгдлээ" });
      } else {
        await pythonToolApi.adminCreate(payload);
        toast({ title: "Үүслээ" });
      }
      closePanel();
      loadPy();
    } catch (e: unknown) {
      toast({
        title: "Хадгалахад алдаа",
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle / Delete ───────────────────────────────────────────────────────

  const handleTogglePy = async (t: PythonToolAdmin) => {
    setToggling(t.id);
    try {
      const updated = await pythonToolApi.adminToggle(t.id, !t.isActive);
      setPyTools((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)),
      );
    } catch {
      toast({ title: "Алдаа", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const handleDeletePy = async () => {
    if (!deletePyTarget) return;
    try {
      await pythonToolApi.adminDelete(deletePyTarget.id);
      setPyTools((prev) => prev.filter((t) => t.id !== deletePyTarget.id));
      toast({ title: "Устгагдлаа" });
      setDeletePyTarget(null);
      setConfirmDelete(false);
    } catch {
      toast({ title: "Устгахад алдаа", variant: "destructive" });
    }
  };

  // [SORT] Move tool up/down in display order; persists via /admin/tools/reorder
  const movePy = async (id: string, dir: -1 | 1) => {
    const idx = pyTools.findIndex((t) => t.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= pyTools.length) return;
    const reordered = [...pyTools];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setPyTools(reordered); // optimistic
    try {
      await pythonToolApi.adminReorder(reordered.map((t) => t.id));
    } catch (e: unknown) {
      toast({
        title: "Дарааллыг хадгалж чадсангүй",
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
      loadPy(); // restore from server
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Буцах
          </Link>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-3.5 h-3.5 text-foreground" />
            </div>
            <span className="font-semibold text-foreground">
              Тайлан татах - Удирдах
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pageTab === "templates" && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-foreground text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Шинэ тайлан
              </button>
            )}
            {pageTab === "permissions" && (
              <button
                onClick={loadPermissions}
                disabled={pLoading}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${pLoading ? "animate-spin" : ""}`}
                />
              </button>
            )}
            {pageTab === "logs" && (
              <button
                onClick={loadLogs}
                disabled={logsLoading}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Page tabs */}
        <div className="max-w-[1400px] mx-auto px-4 flex gap-1 pb-0">
          {[
            {
              id: "templates" as const,
              label: "Тайлангууд",
              Icon: FileSpreadsheet,
            },
            {
              id: "permissions" as const,
              label: "Тайлангийн эрх",
              Icon: KeyRound,
            },
            { id: "logs" as const, label: "Татах лог", Icon: History },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPageTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${pageTab === id ? "border-emerald-400 text-emerald-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* ═══════════ TEMPLATES TAB ═══════════ */}
        {pageTab === "templates" && (
          <>
            {pyLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : pyTools.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground">
                <Code2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Тайлан байхгүй байна</p>
                <p className="text-sm mt-1">
                  Дээрх &quot;Шинэ тайлан&quot; дарж нэмнэ үү
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <AnimatePresence>
                  {pyTools.map((t, idx) => {
                    const connType = (t.connectionType ??
                      "clickhouse") as keyof typeof CONNECTION_META;
                    const ConnIcon = CONNECTION_META[connType].icon;
                    const OutIcon = OUTPUT_META[t.outputFormat ?? "excel"].icon;
                    const DateIcon = DATE_MODE_META[t.dateMode ?? "none"].Icon;
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${t.isActive ? "border-border" : "border-dashed border-border/40 opacity-60"}`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} shrink-0 flex items-center justify-center shadow`}
                        >
                          <Code2 className="w-5 h-5 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">
                              {t.name}
                            </span>
                            <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-violet-300 font-mono">
                              /python-api/run/{t.apiPath}
                            </code>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                              Python
                            </span>
                            {!t.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                Идэвхгүй
                              </span>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {t.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span
                              className={`flex items-center gap-1 text-xs ${CONNECTION_META[connType].color}`}
                            >
                              <ConnIcon className="w-3 h-3" />{" "}
                              {CONNECTION_META[connType].label}
                            </span>
                            <span
                              className={`flex items-center gap-1 text-xs ${OUTPUT_META[t.outputFormat ?? "excel"].color}`}
                            >
                              <OutIcon className="w-3 h-3" />{" "}
                              {OUTPUT_META[t.outputFormat ?? "excel"].label}
                            </span>
                            <span
                              className={`flex items-center gap-1 text-xs ${DATE_MODE_META[t.dateMode ?? "none"].color}`}
                            >
                              <DateIcon className="w-3 h-3" />{" "}
                              {DATE_MODE_META[t.dateMode ?? "none"].label}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex flex-col gap-0.5 mr-1">
                            <button
                              onClick={() => movePy(t.id, -1)}
                              disabled={idx === 0}
                              title="Дээш"
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => movePy(t.id, 1)}
                              disabled={idx === pyTools.length - 1}
                              title="Доош"
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => handleTogglePy(t)}
                            disabled={toggling === t.id}
                            className={`p-2 rounded-lg transition-colors ${t.isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground/60 hover:bg-muted/30"}`}
                          >
                            {toggling === t.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : t.isActive ? (
                              <Power className="w-4 h-4" />
                            ) : (
                              <PowerOff className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => openEditPy(t)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeletePyTarget(t);
                              setConfirmDelete(false);
                            }}
                            className="p-2 rounded-lg text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* ═══════════ PERMISSIONS TAB ═══════════ */}
        {pageTab === "permissions" && (
          <div className="space-y-4">
            {pLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="ml-3 text-sm text-muted-foreground">
                  Ачаалж байна...
                </span>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Python тайлан дарж хэрэглэгчдэд эрх олгох, хасах.
                </p>
                {(() => {
                  const allItems = pyTools.filter((t) => t.isActive);
                  if (allItems.length === 0) {
                    return (
                      <div className="text-center py-16 text-muted-foreground">
                        <Code2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Идэвхтэй тайлан байхгүй байна</p>
                      </div>
                    );
                  }
                  const nonAdminTotal = pUsers.filter((u) => !u.isAdmin).length;
                  return (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {allItems.map((t) => {
                        const permCount = pPermissions.filter(
                          (p) => p.templateId === t.id,
                        ).length;
                        const pct =
                          nonAdminTotal > 0
                            ? Math.round((permCount / nonAdminTotal) * 100)
                            : 0;
                        return (
                          <button
                            key={t.id}
                            onClick={() =>
                              openPermSheet({
                                id: t.id,
                                name: t.name,
                                color: t.color,
                              })
                            }
                            className="group text-left bg-card border border-border hover:border-border/60 rounded-xl p-4 transition-all hover:bg-accent"
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div
                                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center shrink-0`}
                              >
                                <Code2 className="w-4 h-4 text-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {t.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {`${permCount} / ${nonAdminTotal} хэрэглэгч`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-gradient-to-r ${t.color} transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] shrink-0 text-muted-foreground">
                                {permCount} эрх
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 group-hover:text-foreground transition-colors">
                              Эрх удирдах →
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Permission Sheet */}
        <Sheet
          open={!!pSelectedTemplate}
          onOpenChange={(o) => !o && setPSelectedTemplate(null)}
        >
          <SheetContent className="w-full sm:max-w-md bg-background border-border p-0 flex flex-col">
            <SheetTitle className="sr-only">
              {pSelectedTemplate?.name ?? "Эрх удирдах"}
            </SheetTitle>
            {pSelectedTemplate &&
              (() => {
                const withAccess = getUsersWithAccess(pSelectedTemplate.id);
                const withoutAccess = getUsersWithoutAccess(
                  pSelectedTemplate.id,
                );
                return (
                  <>
                    <div
                      className={`bg-gradient-to-br ${pSelectedTemplate.color} p-5`}
                    >
                      <p className="text-foreground/70 text-xs font-medium uppercase tracking-widest mb-1">
                        Эрх удирдах
                      </p>
                      <p className="text-foreground text-lg font-semibold leading-snug">
                        {pSelectedTemplate.name}
                      </p>
                      <div className="flex gap-4 mt-3">
                        <div className="text-center">
                          <p className="text-foreground text-xl font-bold leading-none">
                            {withAccess.length}
                          </p>
                          <p className="text-foreground/60 text-xs mt-0.5">
                            эрхтэй
                          </p>
                        </div>
                        <div className="w-px bg-foreground/20" />
                        <div className="text-center">
                          <p className="text-foreground text-xl font-bold leading-none">
                            {withoutAccess.length}
                          </p>
                          <p className="text-foreground/60 text-xs mt-0.5">
                            эрхгүй
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-b border-border bg-background">
                      {(["with", "without"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => {
                            setPSheetTab(tab);
                            setPSelectedUsers(new Set());
                          }}
                          className={`py-2.5 text-xs font-medium transition-colors border-b-2 ${pSheetTab === tab ? "border-white text-foreground" : "border-transparent text-muted-foreground/60 hover:text-foreground/80"}`}
                        >
                          {tab === "with"
                            ? `Эрхтэй (${withAccess.length})`
                            : `Эрх олгох (${withoutAccess.length})`}
                        </button>
                      ))}
                    </div>
                    {pSheetTab === "with" && (
                      <ScrollArea className="flex-1">
                        {withAccess.length === 0 ? (
                          <div className="text-center py-16 text-muted-foreground/40">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Эрхтэй хэрэглэгч байхгүй</p>
                            <button
                              onClick={() => setPSheetTab("without")}
                              className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                            >
                              Эрх олгох
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-800/60">
                            {withAccess.map((u) => {
                              const busy =
                                pSaving === `${u.id}:${pSelectedTemplate.id}`;
                              return (
                                <div
                                  key={u.id}
                                  className="flex items-center justify-between px-5 py-3 group hover:bg-background/60"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${pSelectedTemplate.color} flex items-center justify-center text-foreground text-xs font-bold shrink-0`}
                                    >
                                      {(u.name || u.userId || "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {u.name || u.userId}
                                      </p>
                                      <p className="text-xs text-muted-foreground/60 truncate">
                                        {u.department}
                                      </p>
                                    </div>
                                    {u.isAdmin && (
                                      <span className="text-[9px] text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5 shrink-0">
                                        Admin
                                      </span>
                                    )}
                                  </div>
                                  {!u.isAdmin && (
                                    <button
                                      onClick={() => revokeUser(u.id)}
                                      disabled={busy}
                                      className="text-xs text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2 disabled:opacity-40"
                                    >
                                      {busy ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        "Хасах"
                                      )}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    )}
                    {pSheetTab === "without" && (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-5 py-3 border-b border-border flex gap-2">
                          <button
                            onClick={() =>
                              setPSelectedUsers(
                                new Set(withoutAccess.map((u) => u.id)),
                              )
                            }
                            disabled={withoutAccess.length === 0}
                            className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40"
                          >
                            Бүгдийг сонгох
                          </button>
                          <button
                            onClick={() => setPSelectedUsers(new Set())}
                            disabled={pSelectedUsers.size === 0}
                            className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40"
                          >
                            Цэвэрлэх
                          </button>
                        </div>
                        <ScrollArea className="flex-1">
                          {withoutAccess.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground/40">
                              <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">
                                Бүх хэрэглэгч эрхтэй байна
                              </p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-800/60">
                              {withoutAccess.map((u) => {
                                const selected = pSelectedUsers.has(u.id);
                                return (
                                  <button
                                    key={u.id}
                                    onClick={() => {
                                      const next = new Set(pSelectedUsers);
                                      selected
                                        ? next.delete(u.id)
                                        : next.add(u.id);
                                      setPSelectedUsers(next);
                                    }}
                                    className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-background/60 transition-colors ${selected ? "bg-muted/40" : ""}`}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-emerald-500 border-emerald-500" : "border-border/70"}`}
                                    >
                                      {selected && (
                                        <Check className="w-2.5 h-2.5 text-foreground" />
                                      )}
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground text-xs font-bold shrink-0">
                                      {(u.name || u.userId || "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <div className="min-w-0 text-left">
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {u.name || u.userId}
                                      </p>
                                      <p className="text-xs text-muted-foreground/60 truncate">
                                        {u.department}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                        {pSelectedUsers.size > 0 && (
                          <div className="px-5 py-4 border-t border-border">
                            <button
                              onClick={grantSelected}
                              disabled={pGranting}
                              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-foreground text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                              {pGranting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                              {pSelectedUsers.size} хэрэглэгчид эрх олгох
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
          </SheetContent>
        </Sheet>

        {/* ═══════════ LOGS TAB ═══════════ */}
        {pageTab === "logs" && (
          <div className="space-y-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="ml-3 text-sm text-muted-foreground">
                  Ачаалж байна...
                </span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20">
                <History className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">
                  Татсан тайлангийн лог байхгүй байна
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-accent">
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Хэрэглэгч
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Тайлан
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Ажлуулсан огноо
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr
                        key={log.id ?? i}
                        className="border-t border-border hover:bg-accent/50"
                      >
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{log.userId}</p>
                          {log.userName && (
                            <p className="text-[10px] text-muted-foreground">
                              {log.userName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {log.toolName || log.toolId}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {log.ranAt
                            ? new Date(log.ranAt).toLocaleString("mn-MN", {
                                timeZone: "Asia/Ulaanbaatar",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Delete confirm dialog ── */}
      <AnimatePresence>
        {deletePyTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    Устгах уу?
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    &quot;{deletePyTarget.name}&quot; тайланг устгана
                  </p>
                </div>
              </div>
              {!confirmDelete ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeletePyTarget(null)}
                    className="flex-1 py-2 text-sm rounded-lg border border-border text-foreground/80 hover:bg-muted"
                  >
                    Болих
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex-1 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-foreground"
                  >
                    Устгах
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-amber-400">
                    Та итгэлтэй байна уу? Буцаах боломжгүй.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDeletePyTarget(null);
                        setConfirmDelete(false);
                      }}
                      className="flex-1 py-2 text-sm rounded-lg border border-border text-foreground/80 hover:bg-muted"
                    >
                      Болих
                    </button>
                    <button
                      onClick={handleDeletePy}
                      className="flex-1 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-foreground font-semibold"
                    >
                      Тийм, устга
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create / Edit Sheet ── */}
      <Sheet open={panelOpen} onOpenChange={(o) => !o && closePanel()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl bg-background border-border p-0 flex flex-col"
        >
          <SheetTitle className="sr-only">
            {editingPy ? "Python tool засах" : "Шинэ Python tool"}
          </SheetTitle>

          {/* Panel header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600">
              <Code2 className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">
                {editingPy ? "Python tool засах" : "Шинэ Python tool"}
              </p>
              <p className="text-xs text-muted-foreground">
                FastAPI дээр ажиллах Python код
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={closePanel}
                className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Болих
              </button>
              <button
                onClick={handleSavePy}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-foreground text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Хадгалах
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-5 pb-8">
              {/* ══ PYTHON FORM ══ */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">
                    Харагдах нэр *
                  </Label>
                  <Input
                    value={pyForm.name}
                    onChange={(e) =>
                      setPyForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Зээлийн тайлан"
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">
                    API зам *{" "}
                    <span className="text-muted-foreground/60 font-normal ml-1">
                      /python-api/run/
                      <span className="text-violet-400">
                        {pyForm.apiPath || "..."}
                      </span>
                    </span>
                  </Label>
                  <Input
                    value={pyForm.apiPath}
                    onChange={(e) =>
                      setPyForm((f) => ({
                        ...f,
                        apiPath: e.target.value
                          .replace(/[^a-z0-9_-]/gi, "-")
                          .toLowerCase(),
                      }))
                    }
                    placeholder="loan-report"
                    className="bg-background border-border text-foreground font-mono"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-foreground/80 text-xs">Тайлбар</Label>
                  <Input
                    value={pyForm.description}
                    onChange={(e) =>
                      setPyForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Tool-ийн зориулалт"
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">
                    Холболтын төрөл
                  </Label>
                  <Select
                    value={pyForm.connectionType}
                    onValueChange={(v: string) =>
                      setPyForm((f) => ({
                        ...f,
                        connectionType: v as PyFormState["connectionType"],
                        connectionConfig: DEFAULT_CONN_CONFIG[v],
                      }))
                    }
                  >
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {Object.entries(CONNECTION_META).map(([k, v]) => (
                        <SelectItem
                          key={k}
                          value={k}
                          className="text-foreground"
                        >
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">
                    Гаралтын төрөл
                  </Label>
                  <Select
                    value={pyForm.outputFormat}
                    onValueChange={(v: string) =>
                      setPyForm((f) => ({
                        ...f,
                        outputFormat: v as PyFormState["outputFormat"],
                      }))
                    }
                  >
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {Object.entries(OUTPUT_META).map(([k, v]) => (
                        <SelectItem
                          key={k}
                          value={k}
                          className="text-foreground"
                        >
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">
                    Огноо горим
                  </Label>
                  <Select
                    value={pyForm.dateMode}
                    onValueChange={(v: string) =>
                      setPyForm((f) => ({
                        ...f,
                        dateMode: v as PyFormState["dateMode"],
                      }))
                    }
                  >
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {Object.entries(DATE_MODE_META).map(([k, v]) => (
                        <SelectItem
                          key={k}
                          value={k}
                          className="text-foreground"
                        >
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">
                  Connection Config (JSON)
                </Label>
                <CodeEditor
                  value={pyForm.connectionConfig}
                  onChange={(v) =>
                    setPyForm((f) => ({ ...f, connectionConfig: v }))
                  }
                  minHeight={120}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">
                  Python код *
                </Label>
                <PyCodeWorkbench
                  value={pyForm.pythonCode}
                  onChange={(v) => {
                    setPyForm((f) => ({ ...f, pythonCode: v }));
                  }}
                  connectionType={pyForm.connectionType}
                  connectionConfig={pyForm.connectionConfig}
                  dateMode={pyForm.dateMode}
                  filtersJson={pyForm.filters}
                  minHeight={320}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">
                  Нэмэлт шүүлтүүрүүд
                </Label>
                <FiltersEditor
                  value={pyForm.filters}
                  onChange={(v) => setPyForm((f) => ({ ...f, filters: v }))}
                />
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
