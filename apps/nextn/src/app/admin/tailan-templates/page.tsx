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
  { label: string; icon: typeof FileText }
> = {
  richtext: { label: "Чөлөөт текст", icon: FileText },
  taskList: { label: "Ажлын жагсаалт", icon: ListChecks },
  table: { label: "Хүснэгт", icon: Table2 },
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
        title: "Загвар ачааллахад алдаа гарлаа",
      });
    } finally {
      setLoading(false);
    }
  }, [departmentId, scope, toast]);

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
              ? "Үндсэн загвар (ажилтан)"
              : "Үндсэн загвар (хэлтэс)"
            : `${departments.find((d) => d.id === departmentId)?.name ?? departmentId} загвар`,
        sections: reOrdered,
      });
      setTemplate(saved);
      toast({ title: "Хадгаллаа" });
    } catch (e) {
      toast({ variant: "destructive", title: "Хадгалахад алдаа гарлаа" });
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
    if (!confirm("Энэ хэсгийг устгах уу?")) return;
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
      toast({ variant: "destructive", title: "Гарчиг заавал шаардлагатай" });
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
    if (
      !confirm("Тухайн хэлтсийн загварыг устгаж, үндсэн загвар руу шилжих үү?")
    )
      return;
    setSaving(true);
    try {
      await tailanTemplateApi.remove(template.id);
      toast({ title: "Үндсэн загвар руу шилжлээ" });
      await loadTemplate();
    } catch {
      toast({ variant: "destructive", title: "Алдаа гарлаа" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        icon={<LayoutTemplate className="w-4 h-4" />}
        title="Тайлангийн загвар (Tailan template)"
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Тайлангийн төрөл</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as "employee" | "department")}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Ажилтны улирлын тайлан</SelectItem>
                <SelectItem value="department">
                  Хэлтсийн (ТУЗ/BSC) тайлан
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Хэлтэс</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_TAILAN_DEPARTMENT_ID}>
                  Үндсэн загвар (бүх хэлтэст)
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
              Үндсэн загвар руу шилжих
            </Button>
          )}

          <Button
            className="ml-auto"
            onClick={() => openEdit()}
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-1" /> Хэсэг нэмэх
          </Button>
        </div>

        {!isOwnTemplate && departmentId !== DEFAULT_TAILAN_DEPARTMENT_ID && (
          <p className="text-xs text-muted-foreground">
            Энэ хэлтэс одоогоор өөрийн загваргүй тул үндсэн загварыг ашиглаж
            байна. Хэсэг нэмэх/засах бүрд тухайн хэлтсэд зориулсан шинэ загвар
            үүснэ.
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
                      {meta.label}
                      {sec.orientation === "landscape" ? " · хэвтээ" : ""}
                      {sec.defaultHidden ? " · анхны байдлаар нуугдсан" : ""}
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
                Одоогоор хэсэг байхгүй байна. "Хэсэг нэмэх" дарж эхлээрэй.
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
  const update = (patch: Partial<TailanSectionDef>) =>
    onChange({ ...section, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Хэсэг тохируулах</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Гарчиг (MN)</Label>
            <Input
              value={section.titleMn}
              onChange={(e) => update({ titleMn: e.target.value })}
              placeholder="Тухайн хэсгийн гарчиг"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Түвшин</Label>
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
                  <SelectItem value="main">Гол (дугаартай)</SelectItem>
                  <SelectItem value="sub">Дэд (дугааргүй)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Төрөл</Label>
              <Select
                value={section.type}
                onValueChange={(v) => update({ type: v as TailanSectionType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="richtext">Чөлөөт текст</SelectItem>
                  <SelectItem value="taskList">Ажлын жагсаалт</SelectItem>
                  <SelectItem value="table">Хүснэгт</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <Label className="cursor-pointer" htmlFor="orientation-sw">
              Хэвтээ (landscape) хуудас
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
              Анхны байдлаар нуух
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
            Болих
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Хадгалах
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
  const cfg = section.taskList ?? {};
  const update = (patch: Partial<typeof cfg>) =>
    onChange({ ...section, taskList: { ...cfg, ...patch } });

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">
        Ажлын жагсаалтын багана тохиргоо
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!cfg.showCompletion}
            onCheckedChange={(v) => update({ showCompletion: !!v })}
          />
          Гүйцэтгэл %
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!cfg.showPeriod}
            onCheckedChange={(v) => update({ showPeriod: !!v })}
          />
          Хугацаа
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={cfg.showDescription !== false}
            onCheckedChange={(v) => update({ showDescription: !!v })}
          />
          Тайлбар
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={cfg.showImages !== false}
            onCheckedChange={(v) => update({ showImages: !!v })}
          />
          Зураг
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Гарчгийн багана нэр"
          value={cfg.titleLabel ?? ""}
          onChange={(e) => update({ titleLabel: e.target.value })}
        />
        {cfg.showDescription !== false && (
          <Input
            placeholder="Тайлбарын багана нэр"
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
        <div className="text-xs font-medium text-muted-foreground">Багана</div>
        <Button size="sm" variant="outline" onClick={addColumn}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Багана нэмэх
        </Button>
      </div>
      <div className="space-y-2">
        {cfg.columns.map((col, idx) => (
          <div key={col.key} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Гарчиг"
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
              тоо
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
        <Label className="text-xs">Дундаж мөр гаргах багана (сонголт)</Label>
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
            <SelectItem value="__none__">Дундаж мөр байхгүй</SelectItem>
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
