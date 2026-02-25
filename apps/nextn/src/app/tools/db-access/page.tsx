"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { dbAccessApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Database,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Calendar,
  Table2,
} from "lucide-react";

interface TableInfo {
  database: string;
  table: string;
  full: string;
}

interface AccessRequest {
  id: string;
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

export default function DbAccessRequestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Permission guard
  useEffect(() => {
    if (!user) return;
    const allowed =
      user.isAdmin ||
      user.isSuperAdmin ||
      user.allowedTools?.includes("db_access_requester");
    if (!allowed) router.replace("/tools");
  }, [user, router]);

  // Available tables
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  // Form state
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [accessTypes] = useState<string[]>(["SELECT"]);
  const [validUntilDate, setValidUntilDate] = useState("");
  const [validUntilTime, setValidUntilTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // My requests
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // Table search filter
  const [tableFilter, setTableFilter] = useState("");

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setValidUntilDate(nextMonth.toISOString().split("T")[0]);
  }, []);

  const loadTables = useCallback(async () => {
    try {
      setTablesLoading(true);
      const data = await dbAccessApi.getTables();
      setTables(data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Хүснэгтүүд ачаалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setTablesLoading(false);
    }
  }, [toast]);

  const loadMyRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const data = await dbAccessApi.getMyRequests();
      setMyRequests(data);
    } catch {
      // silent
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
    loadMyRequests();
  }, [loadTables, loadMyRequests]);

  const toggleTable = (full: string) => {
    setSelectedTables((prev) =>
      prev.includes(full) ? prev.filter((t) => t !== full) : [...prev, full],
    );
  };

  const handleSubmit = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: "Сонголт хийнэ үү",
        description: "Хамгийн багадаа нэг хүснэгт сонгоно уу",
        variant: "destructive",
      });
      return;
    }

    if (!validUntilDate) {
      toast({
        title: "Огноо оруулна уу",
        description: "Эрхийн дуусах огноог заавал оруулна уу",
        variant: "destructive",
      });
      return;
    }

    const validUntil = new Date(`${validUntilDate}T${validUntilTime}:00`);
    if (validUntil <= new Date()) {
      toast({
        title: "Буруу огноо",
        description: "Дуусах хугацаа ирээдүйд байх ёстой",
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
        title: "Хүсэлт илгээгдлээ",
        description: `${selectedTables.length} хүснэгтэд эрх хүсэх хүсэлт амжилттай илгээгдлээ`,
      });

      // Reset form
      setSelectedTables([]);
      setReason("");
      loadMyRequests();
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description:
          err?.response?.data?.message ?? "Хүсэлт илгээхэд алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Group tables by database
  const grouped = tables
    .filter(
      (t) =>
        !tableFilter ||
        t.full.toLowerCase().includes(tableFilter.toLowerCase()),
    )
    .reduce<Record<string, TableInfo[]>>((acc, t) => {
      (acc[t.database] = acc[t.database] || []).push(t);
      return acc;
    }, {});

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Database className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">ClickHouse Эрх Хүсэх</h1>
              <p className="text-sm text-muted-foreground">
                Хүснэгтэд хандах эрх хүсэх
              </p>
            </div>
          </div>
          {(user?.isAdmin ||
            user?.allowedTools?.includes("db_access_granter")) && (
            <Link href="/tools/db-access/manage" className="ml-auto">
              <Button variant="outline" size="sm">
                <Table2 className="h-4 w-4 mr-2" />
                Хүсэлт шийдвэрлэх
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Table picker */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-cyan-400" />
                  Хүснэгт сонгох
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadTables}
                  disabled={tablesLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${tablesLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>

              <Input
                placeholder="Хүснэгт хайх..."
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="bg-background"
              />

              {tablesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {Object.entries(grouped).map(([db, dbTables]) => (
                    <div key={db}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        {db}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {dbTables.map((t) => {
                          const selected = selectedTables.includes(t.full);
                          return (
                            <button
                              key={t.full}
                              onClick={() => toggleTable(t.full)}
                              className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                                selected
                                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                                  : "border-border hover:border-cyan-500/50 hover:bg-cyan-500/5"
                              }`}
                            >
                              <span className="font-mono truncate block">
                                {t.table}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {t.database}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {Object.keys(grouped).length === 0 && (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      Хүснэгт олдсонгүй
                    </p>
                  )}
                </div>
              )}

              {selectedTables.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Сонгогдсон ({selectedTables.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTables.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => toggleTable(t)}
                      >
                        {t} ✕
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date/time + reason */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-400" />
                Хугацаа & Шалтгаан
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Дуусах огноо</Label>
                  <Input
                    type="date"
                    value={validUntilDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setValidUntilDate(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Дуусах цаг</Label>
                  <Input
                    type="time"
                    value={validUntilTime}
                    onChange={(e) => setValidUntilTime(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Шалтгаан (заавал биш)</Label>
                <Textarea
                  placeholder="Яагаад энэ эрх хэрэгтэй байгаагаа бичнэ үү..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="bg-background resize-none"
                />
              </div>

              <Button
                className="w-full bg-cyan-600 hover:bg-cyan-500"
                onClick={handleSubmit}
                disabled={submitting || selectedTables.length === 0}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Хүсэлт илгээх
              </Button>
            </div>
          </div>

          {/* Right: My requests */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Миний хүсэлтүүд</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMyRequests}
                disabled={requestsLoading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${requestsLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            {requestsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : myRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Plus className="h-8 w-8 opacity-30" />
                <p className="text-sm">Хүсэлт байхгүй</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {myRequests.map((req) => {
                  const cfg = STATUS_CONFIG[req.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div
                      key={req.id}
                      className="rounded-lg border bg-background/50 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {req.tables.map((t) => (
                            <span
                              key={t}
                              className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs ${cfg.color}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>
                          Хүчинтэй:{" "}
                          {new Date(req.validUntil).toLocaleDateString("mn-MN")}
                        </p>
                        <p>
                          Илгээсэн:{" "}
                          {new Date(req.requestTime).toLocaleDateString(
                            "mn-MN",
                          )}
                        </p>
                        {req.reviewedByName && (
                          <p>Шийдвэрлэсэн: {req.reviewedByName}</p>
                        )}
                        {req.reviewNote && (
                          <p className="italic">"{req.reviewNote}"</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* My active grants link */}
            <Link href="/tools/db-access/my-grants">
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Идэвхтэй эрхүүд харах
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
