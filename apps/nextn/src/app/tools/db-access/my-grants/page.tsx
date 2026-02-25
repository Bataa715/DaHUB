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
} from "lucide-react";

interface ActiveGrant {
  id: string;
  tableName: string;
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  grantedByName: string;
  grantedAt: string;
  isActive: boolean;
}

function daysLeft(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function MyGrantsPage() {
  const { toast } = useToast();

  const [grants, setGrants] = useState<ActiveGrant[]>([]);
  const [loading, setLoading] = useState(true);

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
            {grants.map((g) => {
              const days = daysLeft(g.validUntil);
              const expiringSoon = days <= 3;
              const expired = days <= 0;

              return (
                <div
                  key={g.id}
                  className={`rounded-xl border bg-card p-5 space-y-3 ${
                    expired
                      ? "border-red-500/30 opacity-60"
                      : expiringSoon
                        ? "border-amber-500/40"
                        : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <Database className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-semibold font-mono text-sm">
                          {g.tableName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Олгосон: {g.grantedByName}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {g.accessTypes.map((a) => (
                        <Badge
                          key={a}
                          className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          variant="outline"
                        >
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
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
                    <span>
                      Хүчинтэй:{" "}
                      {new Date(g.validUntil).toLocaleDateString("mn-MN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    <span>
                      Олгосон:{" "}
                      {new Date(g.grantedAt).toLocaleDateString("mn-MN")}
                    </span>
                  </div>

                  {g.columns && g.columns.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">
                        Баганууд ({g.columns.length}):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {g.columns.map((c) => (
                          <span
                            key={c}
                            className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
                          >
                            {c}
                          </span>
                        ))}
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
