"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Loader2,
  Plus,
  Trash2,
  Save,
  Search,
  Users2,
  Wallet,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import {
  zainiiAuditExpenseApi,
  usersApi,
  getApiErrorMessage,
  type ExpenseVerificationTypeRow,
  type ZainiiAuditSettings,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isWebVisibleUser, cn } from "@/lib/utils";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Дэд хэрэгсэл тус бүрийн эрх. "Хоёулаа" гэдэг нь хоёуланг нь олгосон
// төлөв — тусдаа нэгдсэн ID байхгүй.
const TOOL_RPT = "zainii_audit_rpt";
const TOOL_EXPENSE = "zainii_audit_expense";
const ZA_TOOLS = [TOOL_RPT, TOOL_EXPENSE];

type AccessLevel = "none" | "both" | "rpt" | "expense";

interface AdminUser {
  id: string;
  userId: string;
  name: string;
  department?: string;
  position?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  allowedTools: string[];
}

/** allowedTools массиваас Зайны аудитын эрхийн түвшинг тодорхойлно. */
function levelOf(tools: string[]): AccessLevel {
  const rpt = tools.includes(TOOL_RPT);
  const exp = tools.includes(TOOL_EXPENSE);
  if (rpt && exp) return "both";
  if (rpt) return "rpt";
  if (exp) return "expense";
  return "none";
}

/**
 * Сонгосон түвшний дагуу allowedTools-ыг дахин бүрдүүлнэ.
 * Зайны аудиттай холбоогүй бусад эрхийг ХЭВЭЭР үлдээнэ.
 */
function applyLevel(tools: string[], level: AccessLevel): string[] {
  const rest = tools.filter((t) => !ZA_TOOLS.includes(t));
  if (level === "both") return [...rest, TOOL_RPT, TOOL_EXPENSE];
  if (level === "rpt") return [...rest, TOOL_RPT];
  if (level === "expense") return [...rest, TOOL_EXPENSE];
  return rest;
}

/**
 * Табын гарчиг + тайлбар.
 *
 * Тайлбарыг картын дотор биш ДЭЭР нь байрлуулснаар карт нь зөвхөн агуулга
 * (жагсаалт / маягт) агуулж, харагдац цэвэр болно.
 */
function SectionHeading({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {badge && (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-2xl">
        {description}
      </p>
    </div>
  );
}

export default function ZainiiAuditAdminPage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  // ── Баталгаажуулалтын төрөл ────────────────────────────────────────────
  const [types, setTypes] = useState<ExpenseVerificationTypeRow[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [newTypeName, setNewTypeName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyTypeId, setBusyTypeId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ExpenseVerificationTypeRow | null>(null);

  // ── Анхдагч тохиргоо ───────────────────────────────────────────────────
  const [settings, setSettings] = useState<ZainiiAuditSettings | null>(null);
  const [minAmount, setMinAmount] = useState("");
  const [daysBack, setDaysBack] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Эрх ────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown) =>
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      }),
    [toast, t],
  );

  const loadTypes = useCallback(async () => {
    try {
      setTypesLoading(true);
      setTypes(await zainiiAuditExpenseApi.listVerificationTypes(false));
    } catch (e) {
      fail(e);
    } finally {
      setTypesLoading(false);
    }
  }, [fail]);

  const loadSettings = useCallback(async () => {
    try {
      const s = await zainiiAuditExpenseApi.getSettings();
      setSettings(s);
      setMinAmount(String(s.defaultMinAmount));
      setDaysBack(String(s.defaultDaysBack));
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const data = (await usersApi.getAll({
        excludeAdmins: true,
        limit: 1000,
      })) as AdminUser[];
      setUsers(data.filter((u) => isWebVisibleUser(u) && u.isActive !== false));
    } catch (e) {
      fail(e);
    } finally {
      setUsersLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    void loadTypes();
    void loadSettings();
    void loadUsers();
  }, [loadTypes, loadSettings, loadUsers]);

  // ── Төрлийн үйлдлүүд ───────────────────────────────────────────────────
  async function addType() {
    const name = newTypeName.trim();
    if (!name || creating) return;
    try {
      setCreating(true);
      const row = await zainiiAuditExpenseApi.createVerificationType(name);
      setTypes((prev) =>
        [...prev, row].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewTypeName("");
      toast({ title: t("zaAdminTypeCreated") });
    } catch (e) {
      fail(e);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(row: ExpenseVerificationTypeRow) {
    try {
      setBusyTypeId(row.id);
      const updated = await zainiiAuditExpenseApi.updateVerificationType(
        row.id,
        {
          isActive: !row.isActive,
        },
      );
      setTypes((prev) => prev.map((x) => (x.id === row.id ? updated : x)));
      toast({ title: t("zaAdminTypeUpdated") });
    } catch (e) {
      fail(e);
    } finally {
      setBusyTypeId(null);
    }
  }

  async function renameType(row: ExpenseVerificationTypeRow, name: string) {
    const next = name.trim();
    if (!next || next === row.name) return;
    try {
      setBusyTypeId(row.id);
      const updated = await zainiiAuditExpenseApi.updateVerificationType(
        row.id,
        {
          name: next,
        },
      );
      setTypes((prev) => prev.map((x) => (x.id === row.id ? updated : x)));
      toast({ title: t("zaAdminTypeUpdated") });
    } catch (e) {
      fail(e);
      // Серверт хадгалагдаагүй тул талбарыг бодит утга руу нь буцаана
      void loadTypes();
    } finally {
      setBusyTypeId(null);
    }
  }

  async function confirmDelete() {
    const row = deleteTarget;
    if (!row) return;
    setDeleteTarget(null);
    try {
      setBusyTypeId(row.id);
      await zainiiAuditExpenseApi.deleteVerificationType(row.id);
      setTypes((prev) => prev.filter((x) => x.id !== row.id));
      toast({ title: t("zaAdminTypeDeleted") });
    } catch (e) {
      fail(e);
    } finally {
      setBusyTypeId(null);
    }
  }

  // ── Анхдагч тохиргоо хадгалах ──────────────────────────────────────────
  const settingsDirty =
    settings !== null &&
    (Number(minAmount) !== settings.defaultMinAmount ||
      Number(daysBack) !== settings.defaultDaysBack);

  async function saveSettings() {
    const amount = Number(minAmount);
    const days = Number(daysBack);
    if (!Number.isFinite(amount) || amount < 0) return;
    if (!Number.isInteger(days) || days < 1) return;
    try {
      setSavingSettings(true);
      const saved = await zainiiAuditExpenseApi.updateSettings({
        defaultMinAmount: amount,
        defaultDaysBack: days,
      });
      setSettings(saved);
      setMinAmount(String(saved.defaultMinAmount));
      setDaysBack(String(saved.defaultDaysBack));
      toast({ title: t("zaAdminDefaultsSaved") });
    } catch (e) {
      fail(e);
    } finally {
      setSavingSettings(false);
    }
  }

  // ── Эрх өөрчлөх ────────────────────────────────────────────────────────
  async function setAccess(user: AdminUser, level: AccessLevel) {
    if (levelOf(user.allowedTools ?? []) === level) return;
    try {
      setBusyUserId(user.id);
      // Хамгийн сүүлийн байдлыг сервэрээс авч дээр нь тооцно — өөр админ
      // зэрэг өөр tool олгосон байвал түүнийг дарж бичихээс сэргийлнэ.
      const fresh = (await usersApi.getOne(user.id)) as AdminUser;
      const merged = applyLevel(fresh.allowedTools ?? [], level);
      await usersApi.updateTools(user.id, merged);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, allowedTools: merged } : u,
        ),
      );
      toast({ title: t("zaAdminAccessUpdated") });
    } catch (e) {
      fail(e);
    } finally {
      setBusyUserId(null);
    }
  }

  // Идэвхтэйг нь эхэнд, дараа нь нэрээр — идэвхгүй нь доор бүдэгхэн үлдэнэ.
  const sortedTypes = useMemo(() => {
    return [...types].sort((a, b) => {
      if (!!a.isActive !== !!b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [types]);

  const activeTypeCount = useMemo(
    () => types.filter((x) => x.isActive).length,
    [types],
  );

  const withAccess = useMemo(
    () => users.filter((u) => levelOf(u.allowedTools ?? []) !== "none"),
    [users],
  );

  // Хайлт хоосон үед зөвхөн эрхтэй хүмүүсийг харуулна; хайхад бүх
  // хэрэглэгчээс хайна (шинээр эрх олгохын тулд).
  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withAccess;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.userId?.toLowerCase().includes(q),
    );
  }, [users, withAccess, search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageHeader
        icon={<Activity className="w-4 h-4 text-orange-500" />}
        title={t("zaAdminTitle")}
      />

      <div className="max-w-[880px] mx-auto px-4 py-6">
        <Tabs defaultValue="types">
          <TabsList className="mb-6">
            <TabsTrigger value="types" className="gap-1.5">
              {t("zaAdminTabTypes")}
              {!typesLoading && types.length > 0 && (
                <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] font-medium tabular-nums">
                  {types.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="defaults">
              {t("zaAdminTabDefaults")}
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-1.5">
              {t("zaAdminTabAccess")}
              {!usersLoading && withAccess.length > 0 && (
                <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] font-medium tabular-nums">
                  {withAccess.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Баталгаажуулалтын төрөл ─────────────────────────────────── */}
          <TabsContent value="types" className="space-y-4">
            {/* Тайлбар нь картын дотор биш, дээр нь — карт цэвэр жагсаалт
                хэвээр үлдэж, гарчиг/тайлбар нь тусдаа давхарга болно. */}
            <SectionHeading
              title={t("zaAdminTabTypes")}
              description={t("zaAdminTypesDesc")}
              badge={
                !typesLoading && types.length > 0
                  ? `${activeTypeCount} / ${types.length}`
                  : undefined
              }
            />

            {/* Нэмэх мөр */}
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-2">
              <div className="flex items-center gap-2">
                <Input
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addType();
                  }}
                  placeholder={t("zaAdminTypeNamePlaceholder")}
                  maxLength={120}
                  className="h-9 border-transparent bg-background/60 focus-visible:border-input"
                />
                <Button
                  onClick={() => void addType()}
                  disabled={!newTypeName.trim() || creating}
                  size="sm"
                  className="h-9 shrink-0 gap-1.5"
                >
                  {creating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  {t("zaAdminTypeAdd")}
                </Button>
              </div>
            </div>

            {/* Жагсаалт */}
            <div className="rounded-xl border border-border bg-card shadow-premium ring-hairline overflow-hidden">
              {typesLoading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-10">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("loading")}
                </div>
              ) : sortedTypes.length === 0 ? (
                <div className="py-12 text-center">
                  <ListChecks className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {t("zaAdminTypeEmpty")}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {sortedTypes.map((row) => {
                    const busy = busyTypeId === row.id;
                    return (
                      <li
                        key={row.id}
                        className={cn(
                          "group flex items-center gap-2 pl-3 pr-2 py-1.5 transition-colors hover:bg-muted/40",
                          !row.isActive && "opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            row.isActive
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/40",
                          )}
                          aria-hidden
                        />

                        {/* Хүрэх хүртлээ энгийн текст, засахад л оролт болно */}
                        <Input
                          defaultValue={row.name}
                          maxLength={120}
                          disabled={busy}
                          onBlur={(e) => void renameType(row, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className={cn(
                            "h-8 text-sm border-transparent bg-transparent px-2 shadow-none",
                            "hover:bg-background/70 focus-visible:bg-background focus-visible:border-input",
                            !row.isActive && "line-through",
                          )}
                        />

                        {busy && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                        )}

                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          disabled={busy}
                          title={
                            row.isActive
                              ? t("zaAdminTypeActive")
                              : t("zaAdminTypeInactive")
                          }
                          className={cn(
                            "shrink-0 text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors",
                            row.isActive
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : "border-border bg-muted text-muted-foreground hover:bg-muted/70",
                          )}
                        >
                          {row.isActive
                            ? t("zaAdminTypeActive")
                            : t("zaAdminTypeInactive")}
                        </button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8 text-muted-foreground/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive transition-opacity"
                          disabled={busy}
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ── Анхдагч тохиргоо ────────────────────────────────────────── */}
          <TabsContent value="defaults" className="space-y-4">
            <SectionHeading
              title={t("zaAdminTabDefaults")}
              description={t("zaAdminDefaultsDesc")}
            />
            <div className="rounded-xl border border-border bg-card shadow-premium ring-hairline p-5 max-w-md">
              {settings === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("loading")}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {t("zaAdminMinAmountLabel")}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={1000000}
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {t("zaAdminMinAmountHint")}
                      {Number.isFinite(Number(minAmount)) &&
                        Number(minAmount) > 0 && (
                          <span className="ml-1 font-medium text-foreground">
                            ({Number(minAmount).toLocaleString("mn-MN")} ₮)
                          </span>
                        )}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {t("zaAdminDaysBackLabel")}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={daysBack}
                      onChange={(e) => setDaysBack(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {t("zaAdminDaysBackHint")}
                    </p>
                  </div>

                  <Button
                    onClick={() => void saveSettings()}
                    disabled={!settingsDirty || savingSettings}
                  >
                    {savingSettings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span className="ml-1.5">{t("save")}</span>
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Эрх бүхий хэрэглэгчид ───────────────────────────────────── */}
          <TabsContent value="access" className="space-y-4">
            <SectionHeading
              title={t("zaAdminTabAccess")}
              description={t("zaAdminAccessDesc")}
              badge={
                !usersLoading && withAccess.length > 0
                  ? String(withAccess.length)
                  : undefined
              }
            />
            <div className="rounded-xl border border-border bg-card shadow-premium ring-hairline p-5">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("zaAdminAccessSearch")}
                  className="pl-9"
                />
              </div>

              {usersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("loading")}
                </div>
              ) : visibleUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  {t("zaAdminAccessEmpty")}
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {visibleUsers.map((u) => {
                    const level = levelOf(u.allowedTools ?? []);
                    return (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 py-2.5 flex-wrap"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {u.userId}
                            {u.department ? ` · ${u.department}` : ""}
                          </div>
                        </div>

                        {busyUserId === u.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}

                        <Select
                          value={level}
                          onValueChange={(v) =>
                            void setAccess(u, v as AccessLevel)
                          }
                          disabled={busyUserId === u.id}
                        >
                          <SelectTrigger className="w-[230px] h-9 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              {t("zaAdminAccessNone")}
                            </SelectItem>
                            <SelectItem value="rpt">
                              <span className="inline-flex items-center gap-1.5">
                                <Users2 className="w-3.5 h-3.5" />
                                {t("zaAdminAccessRptOnly")}
                              </span>
                            </SelectItem>
                            <SelectItem value="expense">
                              <span className="inline-flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5" />
                                {t("zaAdminAccessExpenseOnly")}
                              </span>
                            </SelectItem>
                            <SelectItem value="both">
                              <span className="inline-flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {t("zaAdminAccessBoth")}
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("zaAdminTypeDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("zaAdminTypeDeleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              {t("zaAdminDeleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
