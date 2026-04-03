"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { dbAccessApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
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
  Users,
  Database,
  AlertTriangle,
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
    label: "Хүлээгдэж байна",
    icon: Clock,
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  approved: {
    label: "Зөвшөөрөгдсөн",
    icon: CheckCircle2,
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  rejected: {
    label: "Татгалзсан",
    icon: XCircle,
    color: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

/** Format DateTime as "YYYY.MM.DD HH:mm" (24h) */
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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Permission guard
  useEffect(() => {
    if (!user) return;
    const allowed =
      user.isAdmin ||
      user.isSuperAdmin ||
      user.allowedTools?.includes("db_access_granter");
    if (!allowed) router.replace("/tools");
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
  const [deletingHistory, setDeletingHistory] = useState(false);
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
      } catch (err: any) {
        if (err?.response?.status === 403) {
          toast({
            title: "Эрх байхгүй",
            description: "Та энэ хуудсыг үзэх эрхгүй байна",
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const loadAllGrants = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dbAccessApi.getAllGrants();
      setAllGrants(data);
    } catch {
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
      toast({ title: action === "approve" ? " Зөвшөөрлөө" : " Татгалзлаа" });
      setReviewingId(null);
      setReviewNote("");
      loadRequests(tab === "all");
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description: err?.response?.data?.message ?? "Үйлдэл амжилтгүй",
        variant: "destructive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm("Энэ хүсэлтийг бүрмөсөн устгах уу?")) return;
    try {
      setDeletingId(id);
      await dbAccessApi.deleteRequest(id);
      toast({ title: "✅ Устгагдлаа" });
      setExpandedId(null);
      setReviewingId(null);
      loadRequests(tab === "all");
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description: err?.response?.data?.message ?? "Устгахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteHistory = async () => {
    if (
      !confirm(
        "Бүх шийдвэрлэгдсэн хүсэлтийн түүхийг устгах уу? (Хүлээгдэж байгаа хүсэлтүүд хэвээр үлдэна)",
      )
    )
      return;
    try {
      setDeletingHistory(true);
      await dbAccessApi.deleteRequestHistory();
      toast({ title: "✅ Түүх устгагдлаа" });
      loadRequests(tab === "all");
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description: err?.response?.data?.message ?? "Устгахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setDeletingHistory(false);
    }
  };

  const handleRevoke = async (group: GrantGroup) => {
    const tblList = group.tables.join(", ");
    if (!confirm(`"${tblList}" эрхийг цуцлах уу?`)) return;
    try {
      setRevokingId(group.requestId);
      await Promise.all(
        group.grantIds.map((id) => dbAccessApi.revokeGrant(id)),
      );
      toast({ title: "✅ Устгагдлаа", description: "Эрх цуцлагдлаа" });
      const all = await dbAccessApi.getAllGrants();
      setAllGrants(all);
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description: err?.response?.data?.message ?? "Цуцлахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleCleanupCh = async (group: GrantGroup) => {
    if (
      !confirm(
        `"${group.userName}" (${group.userUserId}) хэрэглэгчийн ClickHouse хандалтын өгөгдлийг бүхэлд нь цэвэрлэх үү?\n\n` +
          `Энэ үйлдэл нь ClickHouse-ын хэрэглэгч болон бүх role-ийг устгана. ` +
          `Дараа нь шинэ эрх зөвшөөрөхөд хэрэглэгч дахин бүртгэгдэнэ.`,
      )
    )
      return;
    try {
      setCleaningChUser(group.userUserId);
      const result = await dbAccessApi.cleanupChUser(group.userUserId);
      toast({
        title: "✅ CH хандалт цэвэрлэгдлээ",
        description: result.message,
      });
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description:
          err?.response?.data?.message ?? "CH цэвэрлэхэд алдаа гарлаа",
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
        href="/tools/db-access"
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Эрхийн Хүсэлт Шийдвэрлэх"
        subtitle="ClickHouse хандалтын хүсэлтүүдийг хянах"
        rightContent={
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              tab === "grants" ? loadAllGrants() : loadRequests(tab === "all")
            }
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        }
      />
      <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-8">
        {/* Tabs */}
        <div className="flex gap-0 border-b">
          {(
            [
              { key: "pending" as Tab, label: "Хүлээгдэж буй" },
              { key: "all" as Tab, label: "Бүх хүсэлт" },
              { key: "grants" as Tab, label: "Хэрэглэгчийн эрхийн жагсаалт" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                tab === t.key
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.key === "pending" && pendingCount > 0 && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs px-1.5 py-0"
                >
                  {pendingCount}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/*  PENDING / ALL tab  */}
        {(tab === "pending" || tab === "all") && (
          <>
            {/* Pending count banner */}
            {requests.some((r) => r.status === "pending") && (
              <div className="flex gap-3 p-4 rounded-xl border bg-card items-center">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-sm">
                  <span className="font-semibold text-amber-400">
                    {pendingCount}
                  </span>{" "}
                  хүсэлт хүлээгдэж байна
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground rounded-xl border bg-card">
                <CheckCircle2 className="h-10 w-10 opacity-20" />
                <p className="font-medium">
                  {tab === "pending"
                    ? " Одоогоор баталгаажаагүй хүсэлт алга."
                    : "Хүсэлт байхгүй"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((req) => {
                  const cfg = STATUS_CONFIG[req.status];
                  const StatusIcon = cfg.icon;
                  const expanded = expandedId === req.id;
                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border bg-card overflow-hidden"
                    >
                      {/* Row */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedId(expanded ? null : req.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-violet-300">
                          {req.requesterName?.[0] ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {req.requesterName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({req.requesterUserId})
                            </span>
                            {req.tables.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
                              >
                                {t}
                              </span>
                            ))}
                            {req.tables.length > 4 && (
                              <span className="text-xs text-muted-foreground">
                                +{req.tables.length - 4}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Илгээсэн:{" "}
                            {new Date(req.requestTime).toLocaleString("mn-MN")}{" "}
                            Хүчинтэй:{" "}
                            {new Date(req.validUntil).toLocaleDateString(
                              "mn-MN",
                            )}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs ${cfg.color}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <button
                          className="shrink-0 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          disabled={deletingId === req.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRequest(req.id);
                          }}
                          title="Устгах"
                        >
                          {deletingId === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>

                      {/* Expanded */}
                      {expanded && (
                        <div className="px-4 pb-4 border-t bg-muted/5 space-y-3">
                          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                                Хүснэгтүүд
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {req.tables.map((t) => (
                                  <span
                                    key={t}
                                    className="text-xs font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                                Эрхийн төрөл
                              </p>
                              <div className="flex gap-1">
                                {req.accessTypes.map((a) => (
                                  <Badge key={a} variant="secondary">
                                    {a}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {req.reason && (
                              <div className="sm:col-span-2">
                                <p className="text-xs text-muted-foreground mb-1 font-medium">
                                  Шалтгаан
                                </p>
                                <p className="text-sm italic text-muted-foreground bg-muted/50 rounded px-3 py-2">
                                  "{req.reason}"
                                </p>
                              </div>
                            )}
                            {req.reviewedByName && (
                              <div className="sm:col-span-2 text-xs text-muted-foreground">
                                Шийдвэрлэсэн:{" "}
                                <span className="text-foreground">
                                  {req.reviewedByName}
                                </span>
                                {req.reviewNote && (
                                  <span> "{req.reviewNote}"</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Review panel */}
                          {(req.status === "pending" ||
                            req.status === "rejected") && (
                            <div className="pt-1">
                              {req.status ===
                              "rejected" ? null : reviewingId === req.id ? (
                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    Тайлбар (заавал)
                                  </Label>
                                  <Textarea
                                    placeholder="Шийдвэрийн тайлбар..."
                                    value={reviewNote}
                                    onChange={(e) =>
                                      setReviewNote(e.target.value)
                                    }
                                    rows={2}
                                    className="bg-background resize-none text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white flex-1"
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
                                      Батлах
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="flex-1"
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
                                      Татгалзах
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setReviewingId(null);
                                        setReviewNote("");
                                      }}
                                    >
                                      Болих
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:bg-destructive/10 ml-auto"
                                      disabled={deletingId === req.id}
                                      onClick={() =>
                                        handleDeleteRequest(req.id)
                                      }
                                    >
                                      {deletingId === req.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Button
                                    className="bg-violet-600 hover:bg-violet-500 text-white"
                                    size="sm"
                                    onClick={() => {
                                      setReviewingId(req.id);
                                      setReviewNote("");
                                      setExpandedId(req.id);
                                    }}
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                                    Шийдвэрлэх
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10"
                                    disabled={deletingId === req.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteRequest(req.id);
                                    }}
                                    title="Хүсэлтийг устгах"
                                  >
                                    {deletingId === req.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
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

        {/*  GRANTS tab  */}
        {tab === "grants" && (
          <div className="space-y-4">
            {/* Summary bar */}
            {!loading && allGrants.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-card text-sm">
                <Users className="h-4 w-4 text-violet-400 shrink-0" />
                <span className="flex-1 text-muted-foreground">
                  Нийт{" "}
                  <span className="font-semibold text-foreground">
                    {allGrants.length}
                  </span>{" "}
                  идэвхтэй эрх,{" "}
                  <span className="font-semibold text-foreground">
                    {uniqueUsers.length}
                  </span>{" "}
                  хэрэглэгч
                </span>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : allGrants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground rounded-xl border bg-card">
                <Database className="h-10 w-10 opacity-20" />
                <p className="font-medium">Идэвхтэй эрх байхгүй</p>
              </div>
            ) : (
              uniqueUsers.map((u) => {
                const uGrants = allGrants.filter((g) => g.userId === u.id);
                if (uGrants.length === 0) return null;
                return (
                  <div key={u.id} className="space-y-2">
                    {/* User header */}
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                        {u.name[0]}
                      </div>
                      <span className="font-semibold text-sm">{u.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({u.code})
                      </span>
                      <Badge variant="secondary" className="text-xs ml-1">
                        {groupByRequest(uGrants).length} хүсэлт
                      </Badge>
                    </div>

                    {/* Grants for this user — grouped by request */}
                    {groupByRequest(uGrants).map((grp) => (
                      <div
                        key={grp.requestId}
                        className="rounded-xl border bg-card p-4 flex items-start gap-3 ml-9"
                      >
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Database className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Table badges */}
                          <div className="flex flex-wrap gap-1.5">
                            {grp.tables.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1 text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded-md"
                              >
                                {t}
                              </span>
                            ))}
                            {grp.accessTypes.map((a) => (
                              <Badge
                                key={a}
                                variant="secondary"
                                className="text-xs"
                              >
                                {a}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>
                              Олгосон:{" "}
                              <span className="text-foreground">
                                {grp.grantedByName}
                              </span>
                            </span>
                            <span suppressHydrationWarning>
                              {fmt24(grp.grantedAt)}
                            </span>
                            <span suppressHydrationWarning>
                              Хаагдах:{" "}
                              <span className="text-foreground">
                                {fmt24(grp.validUntil)}
                              </span>
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-500 hover:bg-amber-500/10 shrink-0 gap-1.5"
                          disabled={cleaningChUser === grp.userUserId}
                          onClick={() => handleCleanupCh(grp)}
                          title="ClickHouse хандалтын өгөгдлийг цэвэрлэх (гэмтсэн/зогссон эрхүүдэд хэрэглэнэ)"
                        >
                          {cleaningChUser === grp.userUserId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                          <span className="text-xs">CH Reset</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 shrink-0 gap-1.5"
                          disabled={revokingId === grp.requestId}
                          onClick={() => handleRevoke(grp)}
                          title="Энэ эрхийг устгах"
                        >
                          {revokingId === grp.requestId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="text-xs">Устгах</span>
                        </Button>
                      </div>
                    ))}
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
