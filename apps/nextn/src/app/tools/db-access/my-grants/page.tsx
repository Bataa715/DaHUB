"use client";

import { useState, useEffect, useCallback } from "react";
import { dbAccessApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Database,
  Clock,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
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

/** Format DateTime as "YYYY.MM.DD HH:mm" (24h) */
function fmt24(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MyGrantsPage() {
  const { toast } = useToast();

  const [grants, setGrants] = useState<ActiveGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} хуулагдлаа`, duration: 1500 });
  };

  const handleCancel = async (group: GrantGroup) => {
    const tblList = group.tables.join(", ");
    if (
      !confirm(
        `"${tblList}" хандалтын эрхийг хаах уу? Та ClickHouse-руу нэвтрэх боломжгүй болно.`,
      )
    )
      return;
    try {
      setCancelingId(group.requestId);
      // Cancel every grant row belonging to this request
      await Promise.all(
        group.grantIds.map((id) => dbAccessApi.cancelMyGrant(id)),
      );
      toast({
        title: "✅ Эрх хаагдлаа",
        description: "ClickHouse хандалт цуцлагдлаа",
      });
      await load();
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description: err?.response?.data?.message ?? "Хаахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setCancelingId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dbAccessApi.getMyGrants();
      setGrants(data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Эрхүүдийг ачаалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/tools/db-access">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Миний Идэвхтэй Эрхүүд</h1>
              <p className="text-sm text-muted-foreground">
                Одоогийн хандалтын зөвшөөрлүүд
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : grants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border bg-card text-muted-foreground">
            <Database className="h-12 w-12 opacity-20" />
            <p className="font-medium">Идэвхтэй эрх байхгүй</p>
            <p className="text-sm">Эрх хүсэхийн тулд хүсэлт илгээнэ үү</p>
            <Link href="/tools/db-access">
              <Button variant="outline" size="sm" className="mt-1">
                Эрх хүсэх
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {groupGrants(grants).map((grp) => {
              const days = daysLeft(grp.validUntil);
              const expiringSoon = days <= 3;
              const expired = days <= 0;

              return (
                <div
                  key={grp.requestId}
                  className={`rounded-xl border bg-card p-5 space-y-3 ${
                    expired
                      ? "border-red-500/30 opacity-60"
                      : expiringSoon
                        ? "border-amber-500/40"
                        : ""
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <Database className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Олгосон: {grp.grantedByName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="flex gap-1.5 flex-wrap">
                        {grp.accessTypes.map((a) => (
                          <Badge
                            key={a}
                            className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                            variant="outline"
                          >
                            {a}
                          </Badge>
                        ))}
                      </div>
                      {!expired && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 gap-1 h-7 px-2"
                          disabled={cancelingId === grp.requestId}
                          onClick={() => handleCancel(grp)}
                          title="Эрхийг хугацаанаас өмнө хаах"
                        >
                          {cancelingId === grp.requestId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          <span className="text-xs">Хаах</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Table list */}
                  <div className="flex flex-wrap gap-1.5">
                    {grp.tables.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded-md"
                      >
                        <Database className="h-3 w-3" />
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Time info */}
                  <div
                    className="flex flex-wrap gap-4 text-sm text-muted-foreground"
                    suppressHydrationWarning
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span suppressHydrationWarning>
                        {expired ? (
                          <span className="text-red-400">Хугацаа дууссан</span>
                        ) : expiringSoon ? (
                          <span className="text-amber-400">
                            {days} өдөр үлдсэн
                          </span>
                        ) : (
                          `${days} өдөр үлдсэн`
                        )}
                      </span>
                    </div>
                    <span suppressHydrationWarning>
                      Хаагдах: <strong>{fmt24(grp.validUntil)}</strong>
                    </span>
                    <span suppressHydrationWarning>
                      Олгосон: {fmt24(grp.grantedAt)}
                    </span>
                  </div>

                  {/* ClickHouse credentials */}
                  {grp.chPassword && (
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
                      <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                        ClickHouse Нэвтрэх мэдээлэл
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">
                          Хэрэглэгч:
                        </span>
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded flex-1">
                          {grp.userUserId}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            copyText(grp.userUserId, "Хэрэглэгч нэр")
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">
                          Нууц үг:
                        </span>
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded flex-1 tracking-widest">
                          {showPwd[grp.requestId]
                            ? grp.chPassword
                            : "••••••••••••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
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
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyText(grp.chPassword, "Нууц үг")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <a
                        href={
                          process.env.NEXT_PUBLIC_CLICKHOUSE_PLAY_URL ??
                          "http://localhost:8123/play"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        ClickHouse Play дээр нээх
                      </a>
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
