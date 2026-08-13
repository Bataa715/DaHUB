"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { dbAccessApi, getApiErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Database,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

interface AccessRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterUserId: string;
  tables: string[];
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedByName: string;
  reviewNote: string;
  requestTime: string;
  reviewedAt: string | null;
}

interface ActiveGrant {
  id: string;
  userId: string;
  userName: string;
  userUserId: string;
  requestId: string;
  tableName: string;
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  grantedByName: string;
  grantedAt: string;
  isActive: boolean;
}

interface GrantGroup {
  requestId: string;
  grantIds: string[];
  userId: string;
  userName: string;
  userUserId: string;
  tables: string[];
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  grantedByName: string;
  grantedAt: string;
}

function groupByRequest(grants: ActiveGrant[]): GrantGroup[] {
  const map = new Map<string, GrantGroup>();
  for (const g of grants) {
    const key = g.requestId || g.id;
    if (!map.has(key)) {
      map.set(key, {
        requestId: key,
        grantIds: [],
        userId: g.userId,
        userName: g.userName,
        userUserId: g.userUserId,
        tables: [],
        columns: g.columns,
        accessTypes: g.accessTypes,
        validUntil: g.validUntil,
        grantedByName: g.grantedByName,
        grantedAt: g.grantedAt,
      });
    }
    const grp = map.get(key)!;
    grp.grantIds.push(g.id);
    if (!grp.tables.includes(g.tableName)) grp.tables.push(g.tableName);
  }
  return Array.from(map.values());
}

const STATUS_CONFIG = {
  pending: {
    labelKey: "dbManageStatusPending",
    icon: Clock,
    color: "text-amber-400",
  },
  approved: {
    labelKey: "dbManageStatusApproved",
    icon: CheckCircle2,
    color: "text-emerald-400",
  },
  rejected: {
    labelKey: "dbManageStatusRejected",
    icon: XCircle,
    color: "text-red-400",
  },
};

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

export default function DbAccessManagePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const router = useRouter();
  const [, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user) return;
    const allowed =
      user.isAdmin ||
      user.isSuperAdmin ||
      user.allowedTools?.includes("db_access_granter");
    if (!allowed) router.replace("/");
  }, [user, router]);

  type Tab = "pending" | "all" | "grants";
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [allGrants, setAllGrants] = useState<ActiveGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [cleaningChUser, setCleaningChUser] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRequests = useCallback(
    async (all = false) => {
      try {
        setLoading(true);
        const data = all
          ? await dbAccessApi.getAllRequests()
          : await dbAccessApi.getPendingRequests();
        setRequests(data);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response
          ?.status;
        if (status === 403) {
          toast({
            title: t("accessDenied"),
            description: t("accessDeniedMsg"),
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [toast, t],
  );

  const loadAllGrants = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dbAccessApi.getAllGrants();
      setAllGrants(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "pending") loadRequests(false);
    else if (tab === "all") loadRequests(true);
    else loadAllGrants();
  }, [tab, loadRequests, loadAllGrants]);

  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    return allGrants
      .filter((g) => {
        if (seen.has(g.userId)) return false;
        seen.add(g.userId);
        return true;
      })
      .map((g) => ({ id: g.userId, name: g.userName, code: g.userUserId }));
  }, [allGrants]);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    try {
      setReviewLoading(true);
      await dbAccessApi.reviewRequest(id, action, reviewNote || undefined);
      toast({
        title:
          action === "approve" ? t("dbManageApproved") : t("dbManageRejected"),
      });
      setReviewingId(null);
      setReviewNote("");
      loadRequests(tab === "all");
    } catch (err: unknown) {
      toast({
        title: t("dbAccessValidationTitle"),
        description: getApiErrorMessage(err) || t("dbManageActionError"),
        variant: "destructive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm(t("dbManageConfirmDelete"))) return;
    try {
      setDeletingId(id);
      await dbAccessApi.deleteRequest(id);
      toast({ title: t("dbManageHistoryDeleted") });
      setExpandedId(null);
      setReviewingId(null);
      loadRequests(tab === "all");
    } catch (err: unknown) {
      toast({
        title: t("dbAccessValidationTitle"),
        description: getApiErrorMessage(err) || t("dbManageDeleteError"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRevoke = async (group: GrantGroup) => {
    if (!confirm(t("dbManageConfirmDelete"))) return;
    try {
      setRevokingId(group.requestId);
      await Promise.all(
        group.grantIds.map((id) => dbAccessApi.revokeGrant(id)),
      );
      toast({ title: t("dbManageRevoked") });
      const all = await dbAccessApi.getAllGrants();
      setAllGrants(all);
    } catch (err: unknown) {
      toast({
        title: t("dbAccessValidationTitle"),
        description: getApiErrorMessage(err) || t("dbManageRevokeError"),
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleCleanupCh = async (group: GrantGroup) => {
    if (!confirm(t("dbManageHistoryConfirm"))) return;
    try {
      setCleaningChUser(group.userUserId);
      const result = await dbAccessApi.cleanupChUser(group.userUserId);
      toast({
        title: t("dbManageCleaned"),
        description: result.message,
      });
    } catch (err: unknown) {
      toast({
        title: t("dbAccessValidationTitle"),
        description: getApiErrorMessage(err) || t("dbManageCleanError"),
        variant: "destructive",
      });
    } finally {
      setCleaningChUser(null);
    }
  };

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );

  return (
    <div className="min-h-screen bg-background">
      <ToolPageHeader
        href="/"
        icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
        title={t("toolDbGrantTitle")}
        rightContent={
          <div className="flex items-center gap-1.5">
            <Link href="/tools/db-access">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                {t("toolDbRequestTitle")}
              </Button>
            </Link>
            <button
              type="button"
              onClick={() =>
                tab === "grants" ? loadAllGrants() : loadRequests(tab === "all")
              }
              disabled={loading}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        }
      />

      <div className="w-full px-4 md:px-6 py-6 space-y-4">
        {/* Tabs — muted pills */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "pending" as Tab, label: t("dbManagePendingTab") },
              { key: "all" as Tab, label: t("dbManageAllTab") },
              { key: "grants" as Tab, label: t("dbManageGrantsTab") },
            ] as const
          ).map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === tb.key
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
              }`}
            >
              {tb.label}
              {tb.key === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 text-[10px] text-amber-400">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {(tab === "pending" || tab === "all") && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground/50">
                <CheckCircle2 className="h-8 w-8 opacity-40" />
                <p className="text-sm">
                  {tab === "pending"
                    ? t("dbManageNoPending")
                    : t("dbManageNoRequests")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden">
                {requests.map((req) => {
                  const cfg = STATUS_CONFIG[req.status];
                  const StatusIcon = cfg.icon;
                  const expanded = expandedId === req.id;
                  return (
                    <div key={req.id} className="bg-card/30">
                      <div
                        className="flex items-center gap-3 px-3.5 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() =>
                          setExpandedId(expanded ? null : req.id)
                        }
                      >
                        <div className="w-7 h-7 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-center shrink-0 text-[11px] font-semibold text-muted-foreground">
                          {req.requesterName?.[0] ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                              {req.requesterName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {req.requesterUserId}
                            </span>
                            {req.tables.slice(0, 3).map((tbl) => (
                              <span
                                key={tbl}
                                className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
                              >
                                {tbl}
                              </span>
                            ))}
                            {req.tables.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{req.tables.length - 3}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            {t("dbManageSentAt")} {fmt24(req.requestTime)} ·{" "}
                            {t("dbManageValidUntil")} {fmt24(req.validUntil)}
                          </p>
                        </div>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-medium shrink-0 ${cfg.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {t(cfg.labelKey as TranslationKey)}
                        </span>
                        <button
                          className="shrink-0 p-1 rounded text-muted-foreground/50 hover:text-destructive transition-colors"
                          disabled={deletingId === req.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRequest(req.id);
                          }}
                        >
                          {deletingId === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>

                      {expanded && (
                        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-border/30 bg-muted/10">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                {t("dbManageTables")}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {req.tables.map((tbl) => (
                                  <span
                                    key={tbl}
                                    className="text-[10px] font-mono bg-muted/60 text-foreground/80 px-1.5 py-0.5 rounded"
                                  >
                                    {tbl}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                {t("dbManageGrantType")}
                              </p>
                              <div className="flex gap-1">
                                {req.accessTypes.map((a) => (
                                  <span
                                    key={a}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
                                  >
                                    {a}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {req.reason && (
                              <div className="sm:col-span-2">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                  {t("dbManageReasonLabel")}
                                </p>
                                <p className="text-xs text-muted-foreground italic">
                                  “{req.reason}”
                                </p>
                              </div>
                            )}
                            {req.reviewedByName && (
                              <div className="sm:col-span-2 text-[10px] text-muted-foreground">
                                {t("dbManageResolvedAt")}{" "}
                                <span className="text-foreground">
                                  {req.reviewedByName}
                                </span>
                                {req.reviewNote && (
                                  <span> “{req.reviewNote}”</span>
                                )}
                              </div>
                            )}
                          </div>

                          {req.status === "pending" && (
                            <div>
                              {reviewingId === req.id ? (
                                <div className="space-y-2">
                                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    {t("dbManageDecisionNote")}
                                  </Label>
                                  <Textarea
                                    placeholder={t(
                                      "dbManageDecisionPlaceholder",
                                    )}
                                    value={reviewNote}
                                    onChange={(e) =>
                                      setReviewNote(e.target.value)
                                    }
                                    rows={2}
                                    className="bg-muted/60 border-border/50 text-xs resize-none focus-visible:ring-0 focus-visible:border-emerald-500/60"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      className="bg-emerald-600 hover:bg-emerald-500 text-foreground h-8 text-xs"
                                      size="sm"
                                      disabled={reviewLoading}
                                      onClick={() =>
                                        handleReview(req.id, "approve")
                                      }
                                    >
                                      {reviewLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                      ) : (
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                      )}
                                      {t("dbManageApprove")}
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-8 text-xs"
                                      disabled={reviewLoading}
                                      onClick={() =>
                                        handleReview(req.id, "reject")
                                      }
                                    >
                                      {reviewLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                      ) : (
                                        <XCircle className="h-3.5 w-3.5 mr-1" />
                                      )}
                                      {t("dbManageReject")}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => {
                                        setReviewingId(null);
                                        setReviewNote("");
                                      }}
                                    >
                                      {t("back")}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  className="bg-emerald-600 hover:bg-emerald-500 text-foreground h-8 text-xs"
                                  size="sm"
                                  onClick={() => {
                                    setReviewingId(req.id);
                                    setReviewNote("");
                                    setExpandedId(req.id);
                                  }}
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                                  {t("dbManageResolveBtn")}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "grants" && (
          <div className="space-y-4">
            {!loading && allGrants.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {t("dbManageSummary")}{" "}
                <span className="text-foreground font-medium">
                  {allGrants.length}
                </span>{" "}
                {t("dbManageGrantUnit")} ·{" "}
                <span className="text-foreground font-medium">
                  {uniqueUsers.length}
                </span>{" "}
                {t("dbManageUserUnit")}
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : allGrants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground/50">
                <Database className="h-8 w-8 opacity-40" />
                <p className="text-sm">{t("dbManageNoPending")}</p>
              </div>
            ) : (
              uniqueUsers.map((u) => {
                const uGrants = allGrants.filter((g) => g.userId === u.id);
                if (uGrants.length === 0) return null;
                return (
                  <div key={u.id} className="space-y-2">
                    <div className="flex items-center gap-2 px-0.5">
                      <div className="w-6 h-6 rounded-md bg-muted/60 border border-border/40 flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                        {u.name[0]}
                      </div>
                      <span className="font-semibold text-sm">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {u.code}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-1">
                        {groupByRequest(uGrants).length}{" "}
                        {t("dbManageGrantUnit")}
                      </span>
                    </div>

                    <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden">
                      {groupByRequest(uGrants).map((grp) => (
                        <div
                          key={grp.requestId}
                          className="px-3.5 py-3 flex items-start gap-3 bg-card/30"
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
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
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                              <span>
                                {grp.grantedByName} · {fmt24(grp.grantedAt)}
                              </span>
                              <span suppressHydrationWarning>
                                {t("dbManageValidUntil")} {fmt24(grp.validUntil)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-amber-500/80 hover:bg-amber-500/10 transition-colors"
                              disabled={cleaningChUser === grp.userUserId}
                              onClick={() => handleCleanupCh(grp)}
                              title="CH Reset"
                            >
                              {cleaningChUser === grp.userUserId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              disabled={revokingId === grp.requestId}
                              onClick={() => handleRevoke(grp)}
                              title={t("dbManageRevokeBtn")}
                            >
                              {revokingId === grp.requestId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
