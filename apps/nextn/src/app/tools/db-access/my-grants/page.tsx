"use client";

import { useState, useEffect, useCallback } from "react";
import { dbAccessApi, getApiErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Database,
  Clock,
  Copy,
  Eye,
  EyeOff,
  XCircle,
} from "lucide-react";

interface ActiveGrant {
  id: string;
  requestId: string;
  userUserId: string;
  tableName: string;
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  grantedByName: string;
  grantedAt: string;
  isActive: boolean;
  chPassword: string;
}

interface GrantGroup {
  requestId: string;
  grantIds: string[];
  userUserId: string;
  tables: string[];
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  grantedByName: string;
  grantedAt: string;
  chPassword: string;
}

function groupGrants(grants: ActiveGrant[]): GrantGroup[] {
  const map = new Map<string, GrantGroup>();
  for (const g of grants) {
    const key = g.requestId || g.id;
    if (!map.has(key)) {
      map.set(key, {
        requestId: key,
        grantIds: [],
        userUserId: g.userUserId,
        tables: [],
        columns: g.columns,
        accessTypes: g.accessTypes,
        validUntil: g.validUntil,
        grantedByName: g.grantedByName,
        grantedAt: g.grantedAt,
        chPassword: g.chPassword,
      });
    }
    const grp = map.get(key)!;
    grp.grantIds.push(g.id);
    if (!grp.tables.includes(g.tableName)) grp.tables.push(g.tableName);
  }
  return Array.from(map.values());
}

function daysLeft(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmt24(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MyGrantsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [grants, setGrants] = useState<ActiveGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} ${t("myGrantsCopiedSuffix")}`,
      duration: 1500,
    });
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dbAccessApi.getMyGrants();
      setGrants(data);
    } catch {
      toast({
        title: t("error"),
        description: t("myGrantsLoadErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const handleCancel = async (group: GrantGroup) => {
    const tblList = group.tables.join(", ");
    if (!confirm(`"${tblList}" ${t("myGrantsCancelConfirm")}`)) return;
    try {
      setCancelingId(group.requestId);
      await Promise.all(
        group.grantIds.map((id) => dbAccessApi.cancelMyGrant(id)),
      );
      toast({
        title: t("myGrantsCancelSuccessTitle"),
        description: t("myGrantsCancelSuccessDesc"),
      });
      await load();
    } catch (err: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(err) || t("myGrantsCancelErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setCancelingId(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <ToolPageHeader
        href="/tools/db-access"
        icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        title={t("dbAccessMyGrants")}
        rightContent={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      <div className="w-full px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : grants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground/50">
            <Database className="h-8 w-8 opacity-40" />
            <p className="text-sm text-muted-foreground">{t("myGrantsEmpty")}</p>
            <p className="text-[11px]">{t("myGrantsEmptyHint")}</p>
            <Link href="/tools/db-access">
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 text-xs text-cyan-400 hover:text-cyan-300"
              >
                {t("myGrantsRequestBtn")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden max-w-3xl">
            {groupGrants(grants).map((grp) => {
              const days = daysLeft(grp.validUntil);
              const expiringSoon = days <= 3;
              const expired = days <= 0;

              return (
                <div
                  key={grp.requestId}
                  className={`px-4 py-3.5 space-y-2.5 bg-card/30 ${
                    expired ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {grp.tables.map((tbl) => (
                          <span
                            key={tbl}
                            className="text-[10px] font-mono bg-muted/60 text-foreground/80 px-1.5 py-0.5 rounded"
                          >
                            {tbl}
                          </span>
                        ))}
                        {grp.accessTypes.map((a) => (
                          <span
                            key={a}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t("myGrantsGrantedBy")} {grp.grantedByName}
                      </p>
                    </div>
                    {!expired && (
                      <button
                        type="button"
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        disabled={cancelingId === grp.requestId}
                        onClick={() => handleCancel(grp)}
                        title={t("myGrantsCloseTitle")}
                      >
                        {cancelingId === grp.requestId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap gap-3 text-[11px] text-muted-foreground"
                    suppressHydrationWarning
                  >
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {expired ? (
                        <span className="text-red-400">
                          {t("myGrantsExpired")}
                        </span>
                      ) : expiringSoon ? (
                        <span className="text-amber-400">
                          {days} {t("myGrantsDaysLeft")}
                        </span>
                      ) : (
                        `${days} ${t("myGrantsDaysLeft")}`
                      )}
                    </span>
                    <span suppressHydrationWarning>
                      {t("myGrantsExpiresLabel")} {fmt24(grp.validUntil)}
                    </span>
                  </div>

                  {grp.chPassword && (
                    <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("myGrantsChCreds")}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                          {t("myGrantsChUser")}
                        </span>
                        <code className="text-[11px] font-mono bg-muted/60 px-2 py-0.5 rounded flex-1 truncate">
                          {grp.userUserId}
                        </code>
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyText(grp.userUserId, t("myGrantsCopyUser"))
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                          {t("myGrantsChPassword")}
                        </span>
                        <code className="text-[11px] font-mono bg-muted/60 px-2 py-0.5 rounded flex-1 tracking-widest truncate">
                          {showPwd[grp.requestId]
                            ? grp.chPassword
                            : "••••••••••••••••"}
                        </code>
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setShowPwd((p) => ({
                              ...p,
                              [grp.requestId]: !p[grp.requestId],
                            }))
                          }
                        >
                          {showPwd[grp.requestId] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyText(grp.chPassword, t("myGrantsCopyPwd"))
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
