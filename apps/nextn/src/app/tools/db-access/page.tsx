"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { dbAccessApi, getApiErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Database,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Check,
  ShieldCheck,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";

interface TableInfo {
  database: string;
  table: string;
  full: string;
}

const fieldCls =
  "bg-muted/60 border-border/50 text-xs focus-visible:ring-0 focus-visible:border-cyan-500/60";
const labelCls =
  "text-[11px] font-semibold text-muted-foreground uppercase tracking-wide";

export default function DbAccessRequestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const allowed =
      user.isAdmin ||
      user.isSuperAdmin ||
      user.allowedTools?.includes("db_access_requester");
    if (!allowed) router.replace("/");
  }, [user, router]);

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [accessTypes] = useState<string[]>(["SELECT"]);
  const [validUntilDate, setValidUntilDate] = useState("");
  const [validUntilTime, setValidUntilTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tableFilter, setTableFilter] = useState("");

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setValidUntilDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  const loadTables = useCallback(async () => {
    try {
      setTablesLoading(true);
      const data = await dbAccessApi.getTables();
      setTables(data);
    } catch {
      toast({
        title: t("dbAccessValidationTitle"),
        description: t("dbAccessLoadError"),
        variant: "destructive",
      });
    } finally {
      setTablesLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const toggleTable = (full: string) => {
    setSelectedTables((prev) =>
      prev.includes(full) ? prev.filter((x) => x !== full) : [...prev, full],
    );
  };

  const toggleDb = (dbTables: TableInfo[]) => {
    const allFulls = dbTables.map((x) => x.full);
    const allSelected = allFulls.every((f) => selectedTables.includes(f));
    if (allSelected) {
      setSelectedTables((prev) => prev.filter((x) => !allFulls.includes(x)));
    } else {
      setSelectedTables((prev) => [
        ...prev,
        ...allFulls.filter((f) => !prev.includes(f)),
      ]);
    }
  };

  const toggleAll = () => {
    const allFulls = tables.map((x) => x.full);
    const allSelected = allFulls.every((f) => selectedTables.includes(f));
    setSelectedTables(allSelected ? [] : allFulls);
  };

  const handleSubmit = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: t("dbAccessValidationTitle"),
        description: t("dbAccessValidationNoTable"),
        variant: "destructive",
      });
      return;
    }
    if (!validUntilDate) {
      toast({
        title: t("dbAccessValidationDate"),
        description: t("dbAccessValidationDateRequired"),
        variant: "destructive",
      });
      return;
    }
    if (!reason.trim()) {
      toast({
        title: t("dbAccessValidationReason"),
        description: t("dbAccessValidationReasonRequired"),
        variant: "destructive",
      });
      return;
    }
    const validUntil = new Date(`${validUntilDate}T${validUntilTime}:00`);
    if (validUntil <= new Date()) {
      toast({
        title: t("dbAccessValidationBadDate"),
        description: t("dbAccessValidationFutureDate"),
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      await dbAccessApi.createRequest({
        tables: selectedTables,
        accessTypes,
        validUntil: validUntil.toISOString(),
        reason,
      });
      toast({
        title: t("dbAccessRequestSent"),
        description: t("dbAccessRequestSentMsg"),
      });
      setSelectedTables([]);
      setReason("");
    } catch (err: unknown) {
      toast({
        title: t("dbAccessValidationTitle"),
        description: getApiErrorMessage(err) || t("dbAccessRequestError"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = tables
    .filter(
      (x) =>
        !tableFilter ||
        x.full.toLowerCase().includes(tableFilter.toLowerCase()),
    )
    .reduce<Record<string, TableInfo[]>>((acc, x) => {
      (acc[x.database] = acc[x.database] || []).push(x);
      return acc;
    }, {});

  const CheckBox = ({
    checked,
    partial = false,
  }: {
    checked: boolean;
    partial?: boolean;
  }) => (
    <div
      className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
        checked
          ? "bg-cyan-600 border-cyan-600"
          : partial
            ? "border-cyan-500 bg-cyan-500/30"
            : "border-border"
      }`}
    >
      {checked && <Check className="h-2 w-2 text-foreground" />}
      {!checked && partial && (
        <div className="w-1.5 h-px bg-cyan-400 rounded" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <ToolPageHeader
        href="/"
        icon={<Database className="w-4 h-4 text-cyan-500" />}
        title={t("toolDbRequestTitle")}
        rightContent={
          <div className="flex items-center gap-1.5">
            <Link href="/tools/db-access/my-grants">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                {t("dbAccessMyGrants")}
              </Button>
            </Link>
            {(user?.isAdmin ||
              user?.allowedTools?.includes("db_access_granter")) && (
              <Link href="/tools/db-access/manage">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  {t("dbAccessManage")}
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="w-full px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left — tables */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t("dbAccessSelectSection")}
              </h2>
              <div className="flex items-center gap-2">
                {selectedTables.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {selectedTables.length} {t("dbAccessTableUnit")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={loadTables}
                  disabled={tablesLoading}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${tablesLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            <Input
              placeholder={t("dbAccessTableSearch")}
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className={fieldCls}
            />

            {tablesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {!tableFilter && tables.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:border-cyan-500/40 hover:text-foreground transition-colors"
                  >
                    <CheckBox
                      checked={tables.every((x) =>
                        selectedTables.includes(x.full),
                      )}
                      partial={tables.some((x) =>
                        selectedTables.includes(x.full),
                      )}
                    />
                    {t("dbAccessSelectTableHint")} ({tables.length})
                  </button>
                )}

                <div className="space-y-3 max-h-[min(560px,60vh)] overflow-y-auto pr-1">
                  {Object.entries(grouped).map(([db, dbTables]) => {
                    const allDbSelected = dbTables.every((x) =>
                      selectedTables.includes(x.full),
                    );
                    const someDbSelected = dbTables.some((x) =>
                      selectedTables.includes(x.full),
                    );
                    return (
                      <div key={db} className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => toggleDb(dbTables)}
                          className="flex items-center gap-2 w-full text-left px-1 py-1"
                        >
                          <CheckBox
                            checked={allDbSelected}
                            partial={someDbSelected}
                          />
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            {db}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            ({dbTables.length})
                          </span>
                        </button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-1">
                          {dbTables.map((tbl) => {
                            const selected = selectedTables.includes(tbl.full);
                            return (
                              <button
                                key={tbl.full}
                                type="button"
                                onClick={() => toggleTable(tbl.full)}
                                className={`flex items-center gap-2 text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                                  selected
                                    ? "bg-cyan-500/10 text-cyan-300"
                                    : "hover:bg-muted/40 text-foreground/90"
                                }`}
                              >
                                <CheckBox checked={selected} />
                                <span className="font-mono truncate">
                                  {tbl.table}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(grouped).length === 0 && (
                    <p className="text-center text-muted-foreground/50 text-[11px] py-8">
                      {t("dbAccessSelectTableHint")}
                    </p>
                  )}
                </div>

                {selectedTables.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
                    {selectedTables.map((full) => (
                      <button
                        key={full}
                        type="button"
                        onClick={() => toggleTable(full)}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove"
                      >
                        {full} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — expiry + reason + submit */}
          <div className="space-y-4 min-w-0 lg:sticky lg:top-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t("dbAccessExpirySection")}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>{t("dbAccessExpiryDate")}</Label>
                <Input
                  type="date"
                  value={validUntilDate}
                  min={(() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().split("T")[0];
                  })()}
                  onChange={(e) => setValidUntilDate(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>{t("dbAccessExpiryTime")}</Label>
                <Input
                  type="time"
                  value={validUntilTime}
                  onChange={(e) => setValidUntilTime(e.target.value)}
                  className={fieldCls}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>{t("dbAccessReason")}</Label>
              <Textarea
                placeholder={t("dbAccessReasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className={`${fieldCls} resize-none`}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={
                submitting || selectedTables.length === 0 || !reason.trim()
              }
              className="w-full h-11 bg-cyan-600 hover:bg-cyan-700 text-foreground font-semibold text-sm disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {t("dbAccessSubmitBtn")}
              {selectedTables.length > 0 && (
                <span className="ml-1.5 opacity-70">
                  ({selectedTables.length})
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
