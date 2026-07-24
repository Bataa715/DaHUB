"use client";

import { useState, useEffect, useCallback } from "react";
import {
  tailanTemplateApi,
  departmentsApi,
  DEFAULT_TAILAN_DEPARTMENT_ID,
  type TailanTemplate,
  type TailanSectionDef,
  type TailanSectionType,
  type TailanTableColumnDef,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  ListChecks,
  Table2,
  LayoutTemplate,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
}

const TYPE_META: Record<
  TailanSectionType,
  { labelKey: TranslationKey; icon: typeof FileText }
> = {
  richtext: { labelKey: "admTailanTplTypeRichtext", icon: FileText },
  taskList: { labelKey: "admTailanTplTypeTaskList", icon: ListChecks },
  table: { labelKey: "admTailanTplTypeTable", icon: Table2 },
};

function emptySection(order: number): TailanSectionDef {
  return {
    key: `dyn_${Date.now()}`,
    titleMn: "",
    headingLevel: "main",
    type: "richtext",
    order,
  };
}

function emptyColumn(): TailanTableColumnDef {
  return { key: `col_${Date.now()}`, label: "" };
}

export default function TailanTemplatesPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [scope, setScope] = useState<"employee" | "department">("employee");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>(
    DEFAULT_TAILAN_DEPARTMENT_ID,
  );
  const [template, setTemplate] = useState<TailanTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TailanSectionDef | null>(
    null,
  );

  const loadDepartments = useCallback(async () => {
    try {
      const res = await departmentsApi.getAll();
      setDepartments(res as Department[]);
    } catch {
      // non-fatal — department dropdown just stays empty
    }
  }, []);

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const tpl = await tailanTemplateApi.getActive(
        departmentId === DEFAULT_TAILAN_DEPARTMENT_ID
          ? undefined
          : departmentId,
        scope,
      );
      setTemplate(tpl);
    } catch (e) {
      toast({
        variant: "destructive",
        title: t("admTailanTplLoadError"),
      });
    } finally {
      setLoading(false);
    }
  }, [departmentId, scope, toast, t]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const isOwnTemplate =
    template &&
    template.departmentId === departmentId &&
    departmentId !== DEFAULT_TAILAN_DEPARTMENT_ID;

  const sections = template?.sections ?? [];
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const save = async (nextSections: TailanSectionDef[]) => {
    setSaving(true);
    try {
      const reOrdered = nextSections.map((s, i) => ({ ...s, order: i * 10 }));
      const saved = await tailanTemplateApi.upsert({
        id: isOwnTemplate ? template?.id : undefined,
        departmentId,
        scope,
        name:
          departmentId === DEFAULT_TAILAN_DEPARTMENT_ID
            ? scope === "employee"
              ? t("admTailanTplDefaultNameEmployee")
              : t("admTailanTplDefaultNameDept")
            : `${departments.find((d) => d.id === departmentId)?.name ?? departmentId} ${t("admTailanTplNameSuffix")}`,
        sections: reOrdered,
      });
      setTemplate(saved);
      toast({ title: t("admEthicsSavedTitle") });
    } catch (e) {
      toast({ variant: "destructive", title: t("admTailanTplSaveError") });
    } finally {
      setSaving(false);
    }
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const list = [...sortedSections];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    save(list);
  };

  const removeSection = (key: string) => {
    if (!confirm(t("admTailanTplDeleteSectionConfirm"))) return;
    save(sortedSections.filter((s) => s.key !== key));
  };

  const openEdit = (sec?: TailanSectionDef) => {
    setEditingSection(
      sec ? { ...sec } : emptySection(sortedSections.length * 10),
    );
    setSectionDialogOpen(true);
  };

  const submitSectionEdit = () => {
    if (!editingSection) return;
    if (!editingSection.titleMn.trim()) {
      toast({
        variant: "destructive",
        title: t("admTailanTplTitleRequired"),
      });
      return;
    }
    const exists = sortedSections.some((s) => s.key === editingSection.key);
    const list = exists
      ? sortedSections.map((s) =>
          s.key === editingSection.key ? editingSection : s,
        )
      : [...sortedSections, editingSection];
    setSectionDialogOpen(false);
    save(list);
  };

  const resetToDefault = async () => {
    if (!template || departmentId === DEFAULT_TAILAN_DEPARTMENT_ID) return;
    if (!confirm(t("admTailanTplResetConfirm"))) return;
    setSaving(true);
    try {
      await tailanTemplateApi.remove(template.id);
      toast({ title: t("admTailanTplResetSuccess") });
      await loadTemplate();
    } catch {
      toast({ variant: "destructive", title: t("errorBoundaryTitle") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        icon={<LayoutTemplate className="w-4 h-4" />}
        title={t("admTailanTplPageTitle")}
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>{t("admTailanTplTypeLabel")}</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as "employee" | "department")}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">
                  {t("admTailanTplScopeEmployee")}
                </SelectItem>
                <SelectItem value="department">
                  {t("admTailanTplScopeDept")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{t("regFlowLabelDept")}</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_TAILAN_DEPARTMENT_ID}>
                  {t("admTailanTplDefaultDeptOption")}
                </SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isOwnTemplate && (
            <Button
              variant="outline"
              onClick={resetToDefault}
              disabled={saving}
            >
              {t("admTailanTplResetToDefaultBtn")}
            </Button>
          )}

          <Button
            className="ml-auto"
            onClick={() => openEdit()}
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-1" /> {t("admTailanTplAddSectionBtn")}
          </Button>
        </div>

        {!isOwnTemplate && departmentId !== DEFAULT_TAILAN_DEPARTMENT_ID && (
          <p className="text-xs text-muted-foreground">
            {t("admTailanTplNoOwnTemplateInfo")}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSections.map((sec, idx) => {
              const meta = TYPE_META[sec.type];
              const Icon = meta.icon;
              return (
                <div
                  key={sec.key}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
                >
                  <div className="flex flex-col">
                    <button
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, -1)}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === sortedSections.length - 1}
                      onClick={() => moveSection(idx, 1)}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {sec.headingLevel === "sub" ? "— " : ""}
                      {sec.titleMn}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t(meta.labelKey)}
                      {sec.orientation === "landscape"
                        ? ` · ${t("admTailanTplLandscapeSuffix")}`
                        : ""}
                      {sec.defaultHidden
                        ? ` · ${t("admTailanTplHiddenSuffix")}`
                        : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(sec)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSection(sec.key)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
            {sortedSections.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                {t("admTailanTplEmptySections")}
              </p>
            )}
          </div>
        )}
      </div>

      {editingSection && (
        <SectionEditDialog
          open={sectionDialogOpen}
          onOpenChange={setSectionDialogOpen}
          section={editingSection}
          onChange={setEditingSection}
          onSubmit={submitSectionEdit}
          saving={saving}
        />
      )}
    </div>
  );
}

function SectionEditDialog({
  open,
  onOpenChange,
  section,
  onChange,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  section: TailanSectionDef;
  onChange: (s: TailanSectionDef) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const update = (patch: Partial<TailanSectionDef>) =>
    onChange({ ...section, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admTailanTplSectionDialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{t("admTailanTplTitleLabel")}</Label>
            <Input
              value={section.titleMn}
              onChange={(e) => update({ titleMn: e.target.value })}
              placeholder={t("admTailanTplTitlePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("admTailanTplLevelLabel")}</Label>
              <Select
                value={section.headingLevel}
                onValueChange={(v) =>
                  update({ headingLevel: v as "main" | "sub" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">
                    {t("admTailanTplLevelMain")}
                  </SelectItem>
                  <SelectItem value="sub">
                    {t("admTailanTplLevelSub")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("admTailanTplTypeFieldLabel")}</Label>
              <Select
                value={section.type}
                onValueChange={(v) => update({ type: v as TailanSectionType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="richtext">
                    {t("admTailanTplTypeRichtext")}
                  </SelectItem>
                  <SelectItem value="taskList">
                    {t("admTailanTplTypeTaskList")}
                  </SelectItem>
                  <SelectItem value="table">
                    {t("admTailanTplTypeTable")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <Label className="cursor-pointer" htmlFor="orientation-sw">
              {t("admTailanTplLandscapePageLabel")}
            </Label>
            <Checkbox
              id="orientation-sw"
              checked={section.orientation === "landscape"}
              onCheckedChange={(v) =>
                update({ orientation: v ? "landscape" : "portrait" })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <Label className="cursor-pointer" htmlFor="hidden-sw">
              {t("admTailanTplDefaultHideLabel")}
            </Label>
            <Checkbox
              id="hidden-sw"
              checked={!!section.defaultHidden}
              onCheckedChange={(v) => update({ defaultHidden: !!v })}
            />
          </div>

          {section.type === "taskList" && (
            <TaskListConfigEditor section={section} onChange={onChange} />
          )}
          {section.type === "table" && (
            <TableConfigEditor section={section} onChange={onChange} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskListConfigEditor({
  section,
  onChange,
}: {
  section: TailanSectionDef;
  onChange: (s: TailanSectionDef) => void;
}) {
  const { t } = useLanguage();
  const cfg = section.taskList ?? {};
  const update = (patch: Partial<typeof cfg>) =>
    onChange({ ...section, taskList: { ...cfg, ...patch } });

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">
        {t("admTailanTplTaskListColConfig")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!cfg.showCompletion}
            onCheckedChange={(v) => update({ showCompletion: !!v })}
          />
          {t("admTailanTplShowCompletion")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!cfg.showPeriod}
            onCheckedChange={(v) => update({ showPeriod: !!v })}
          />
          {t("admTailanTplShowPeriod")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={cfg.showDescription !== false}
            onCheckedChange={(v) => update({ showDescription: !!v })}
          />
          {t("dataDocColDesc")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={cfg.showImages !== false}
            onCheckedChange={(v) => update({ showImages: !!v })}
          />
          {t("admTailanTplShowImages")}
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder={t("admTailanTplTitleColLabel")}
          value={cfg.titleLabel ?? ""}
          onChange={(e) => update({ titleLabel: e.target.value })}
        />
        {cfg.showDescription !== false && (
          <Input
            placeholder={t("admTailanTplDescColLabel")}
            value={cfg.descriptionLabel ?? ""}
            onChange={(e) => update({ descriptionLabel: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

function TableConfigEditor({
  section,
  onChange,
}: {
  section: TailanSectionDef;
  onChange: (s: TailanSectionDef) => void;
}) {
  const { t } = useLanguage();
  const cfg = section.table ?? { columns: [] };
  const update = (patch: Partial<typeof cfg>) =>
    onChange({ ...section, table: { ...cfg, ...patch } });

  const updateColumn = (idx: number, patch: Partial<TailanTableColumnDef>) => {
    const columns = [...cfg.columns];
    columns[idx] = { ...columns[idx], ...patch };
    update({ columns });
  };

  const addColumn = () => update({ columns: [...cfg.columns, emptyColumn()] });
  const removeColumn = (idx: number) =>
    update({ columns: cfg.columns.filter((_, i) => i !== idx) });

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          {t("admTailanTplColumnsLabel")}
        </div>
        <Button size="sm" variant="outline" onClick={addColumn}>
          <Plus className="w-3.5 h-3.5 mr-1" /> {t("admTailanTplAddColumnBtn")}
        </Button>
      </div>
      <div className="space-y-2">
        {cfg.columns.map((col, idx) => (
          <div key={col.key} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder={t("admTailanTplHeaderPlaceholder")}
              value={col.label}
              onChange={(e) => updateColumn(idx, { label: e.target.value })}
            />
            <Input
              className="w-20"
              type="number"
              placeholder="%"
              value={col.width ?? ""}
              onChange={(e) =>
                updateColumn(idx, {
                  width: Number(e.target.value) || undefined,
                })
              }
            />
            <label className="flex items-center gap-1 text-xs shrink-0">
              <Checkbox
                checked={!!col.numeric}
                onCheckedChange={(v) => updateColumn(idx, { numeric: !!v })}
              />
              {t("admTailanTplNumericLabel")}
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeColumn(idx)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("admTailanTplAvgColLabel")}</Label>
        <Select
          value={cfg.averageColumnKey ?? "__none__"}
          onValueChange={(v) =>
            update({ averageColumnKey: v === "__none__" ? undefined : v })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              {t("admTailanTplNoAvgOption")}
            </SelectItem>
            {cfg.columns.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label || c.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
