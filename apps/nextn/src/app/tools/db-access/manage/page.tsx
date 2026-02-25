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
import {
  ArrowLeft,
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

export default function DbAccessManagePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

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

  const [bulkLoading, setBulkLoading] = useState<"approve" | "reject" | null>(
    null,
  );

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userGrants, setUserGrants] = useState<ActiveGrant[]>([]);
  const [userGrantsLoading, setUserGrantsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

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
      if (data.length > 0 && !selectedUserId) {
        setSelectedUserId(data[0].userId);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (tab === "pending") loadRequests(false);
    else if (tab === "all") loadRequests(true);
    else loadAllGrants();
  }, [tab, loadRequests, loadAllGrants]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserGrants([]);
      return;
    }
    setUserGrantsLoading(true);
    dbAccessApi
      .getGrantsByUser(selectedUserId)
      .then(setUserGrants)
      .catch(() => setUserGrants([]))
      .finally(() => setUserGrantsLoading(false));
  }, [selectedUserId]);

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

  const handleBulk = async (action: "approve" | "reject") => {
    const pending = requests.filter((r) => r.status === "pending");
    if (pending.length === 0) return;
    const label = action === "approve" ? "зөвшөөрөх" : "татгалзах";
    if (!confirm(`Нийт ${pending.length} хүсэлтийг бүгдийг ${label} уу?`))
      return;
    try {
      setBulkLoading(action);
      const res = await dbAccessApi.bulkReview(action);
      toast({
        title:
          action === "approve" ? " Бүгдийг зөвшөөрлөө" : " Бүгдийг татгалзлаа",
        description: `${res.affected} хүсэлт шийдвэрлэгдлээ`,
      });
      loadRequests(tab === "all");
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description: err?.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setBulkLoading(null);
    }
  };

  const handleRevoke = async (grantId: string) => {
    try {
      setRevokingId(grantId);
      await dbAccessApi.revokeGrant(grantId);
      toast({ title: " Устгагдлаа", description: "Эрх цуцлагдлаа" });
      const updated = await dbAccessApi.getGrantsByUser(selectedUserId);
      setUserGrants(updated);
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

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/tools/db-access">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Эрхийн Хүсэлт Шийдвэрлэх</h1>
              <p className="text-sm text-muted-foreground">
                {user?.name} ClickHouse хандалтын хүсэлтүүдийг хянах
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() =>
              tab === "grants" ? loadAllGrants() : loadRequests(tab === "all")
            }
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

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
            {/* Bulk buttons */}
            {tab === "pending" && requests.length > 0 && (
              <div className="flex gap-3 p-4 rounded-xl border bg-card items-center">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-sm flex-1">
                  <span className="font-semibold text-amber-400">
                    {pendingCount}
                  </span>{" "}
                  хүсэлт хүлээгдэж байна
                </p>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  size="sm"
                  onClick={() => handleBulk("approve")}
                  disabled={!!bulkLoading || pendingCount === 0}
                >
                  {bulkLoading === "approve" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Бүгдийг зөвшөөрөх
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulk("reject")}
                  disabled={!!bulkLoading || pendingCount === 0}
                >
                  {bulkLoading === "reject" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Бүгдийг татгалзах
                </Button>
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
                          {req.status === "pending" && (
                            <div className="pt-1">
                              {reviewingId === req.id ? (
                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    Тайлбар (заавал биш)
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
                                  </div>
                                </div>
                              ) : (
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
          <div className="space-y-5">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* User picker */}
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-400" />
                    <h2 className="font-semibold text-sm">Хэрэглэгч сонгох</h2>
                  </div>
                  {uniqueUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Идэвхтэй эрхтэй хэрэглэгч байхгүй
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {uniqueUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUserId(u.id)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                            selectedUserId === u.id
                              ? "border-violet-500 bg-violet-500/10 text-violet-300"
                              : "border-border hover:border-violet-500/50 hover:bg-violet-500/5 text-muted-foreground"
                          }`}
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="ml-1.5 text-xs opacity-70">
                            {u.code}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected user grants */}
                {selectedUserId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2 text-sm">
                        <Database className="h-4 w-4 text-cyan-400" />
                        <span className="text-violet-300">
                          {
                            uniqueUsers.find((u) => u.id === selectedUserId)
                              ?.name
                          }
                        </span>
                        <span className="text-muted-foreground font-normal">
                          эрхийн жагсаалт
                        </span>
                      </h3>
                      {userGrantsLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    {!userGrantsLoading && userGrants.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground rounded-xl border bg-card">
                        <Database className="h-8 w-8 opacity-20" />
                        <p className="text-sm">Идэвхтэй эрх байхгүй</p>
                      </div>
                    ) : (
                      userGrants.map((g) => (
                        <div
                          key={g.id}
                          className="rounded-xl border bg-card p-4 flex items-start gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Database className="h-4 w-4 text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-cyan-300">
                                {g.tableName}
                              </span>
                              {g.accessTypes.map((a) => (
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
                                  {g.grantedByName}
                                </span>
                              </span>
                              <span>
                                {new Date(g.grantedAt).toLocaleDateString(
                                  "mn-MN",
                                )}
                              </span>
                              <span>
                                Хүчинтэй:{" "}
                                <span className="text-foreground">
                                  {new Date(g.validUntil).toLocaleDateString(
                                    "mn-MN",
                                  )}
                                </span>
                              </span>
                            </div>
                            {g.columns && g.columns.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {g.columns.map((c) => (
                                  <span
                                    key={c}
                                    className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 shrink-0 gap-1.5"
                            disabled={revokingId === g.id}
                            onClick={() => handleRevoke(g.id)}
                            title="Энэ эрхийг устгах"
                          >
                            {revokingId === g.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            <span className="text-xs">Устгах</span>
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
