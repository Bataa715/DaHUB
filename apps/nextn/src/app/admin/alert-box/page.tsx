"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  oracleConfigApi,
  type OracleDashboardConfig,
  type OracleEventChainConfig,
} from "@/lib/api";
import {
  BellDot,
  Loader2,
  Database,
  GitBranch,
  Power,
  PowerOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/shared/AdminPageHeader";

type TabKey = "dashboards" | "chains";

export default function AdminAlertBoxPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabKey>("dashboards");
  const [dashboards, setDashboards] = useState<OracleDashboardConfig[]>([]);
  const [chains, setChains] = useState<OracleEventChainConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [d, c] = await Promise.all([
        oracleConfigApi.listDashboards(),
        oracleConfigApi.listChains(),
      ]);
      setDashboards(d);
      setChains(c);
    } catch {
      toast({
        title: "Алдаа",
        description: "Тохиргоог ачаалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDashboard = async (d: OracleDashboardConfig) => {
    const key = `d-${d.id}`;
    setSavingId(key);
    try {
      const updated = await oracleConfigApi.setDashboardEnabled(
        d.id,
        !d.enabled,
      );
      setDashboards((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, enabled: updated.enabled } : x)),
      );
    } catch {
      toast({
        title: "Алдаа",
        description: "Төлөв өөрчлөхөд алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const toggleChain = async (c: OracleEventChainConfig) => {
    const key = `c-${c.id}`;
    setSavingId(key);
    try {
      const updated = await oracleConfigApi.setChainEnabled(c.id, !c.enabled);
      setChains((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, enabled: updated.enabled } : x)),
      );
    } catch {
      toast({
        title: "Алдаа",
        description: "Төлөв өөрчлөхөд алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  const enabledDashboards = dashboards.filter((d) => d.enabled).length;
  const enabledChains = chains.filter((c) => c.enabled).length;

  return (
    <div className="admin-shell min-h-screen bg-background">
      <AdminPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-premium">
            <BellDot className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Alert Box — Тохиргоо"
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("dashboards")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === "dashboards"
                ? "bg-foreground text-background"
                : "border border-border text-foreground/70 hover:bg-muted"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Дашбоард
            <span className="text-xs opacity-70">
              {enabledDashboards}/{dashboards.length}
            </span>
          </button>
          <button
            onClick={() => setTab("chains")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === "chains"
                ? "bg-foreground text-background"
                : "border border-border text-foreground/70 hover:bg-muted"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Event Chain
            <span className="text-xs opacity-70">
              {enabledChains}/{chains.length}
            </span>
          </button>
        </div>

        {/* Dashboards */}
        {tab === "dashboards" && (
          <div className="grid gap-2.5 md:grid-cols-2">
            {dashboards.map((d) => (
              <div
                key={d.id}
                className={`rounded-xl border-2 px-4 py-3 flex items-start gap-3 transition-colors ${
                  d.enabled
                    ? "border-border bg-card"
                    : "border-dashed border-border/50 bg-card/40 opacity-70"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground/80">
                      DB{d.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        d.enabled
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d.enabled ? "Идэвхтэй" : "Идэвхгүй"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {d.name}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground/70 mt-1 truncate">
                    {d.tableName}
                  </p>
                </div>
                <button
                  onClick={() => toggleDashboard(d)}
                  disabled={savingId === `d-${d.id}`}
                  title={d.enabled ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                  className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                    d.enabled
                      ? "text-emerald-500 hover:bg-emerald-500/10"
                      : "text-muted-foreground/60 hover:bg-muted"
                  }`}
                >
                  {savingId === `d-${d.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : d.enabled ? (
                    <Power className="w-4 h-4" />
                  ) : (
                    <PowerOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Event chains */}
        {tab === "chains" && (
          <div className="grid gap-2.5 md:grid-cols-2">
            {chains.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border-2 px-4 py-3 flex items-start gap-3 transition-colors ${
                  c.enabled
                    ? "border-border bg-card"
                    : "border-dashed border-border/50 bg-card/40 opacity-70"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground/80">
                      #{c.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        c.enabled
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.enabled ? "Идэвхтэй" : "Идэвхгүй"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">
                    {c.description}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground/60 mt-1.5">
                    {c.sourceLabel} → {c.targetLabel}
                  </p>
                </div>
                <button
                  onClick={() => toggleChain(c)}
                  disabled={savingId === `c-${c.id}`}
                  title={c.enabled ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                  className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                    c.enabled
                      ? "text-emerald-500 hover:bg-emerald-500/10"
                      : "text-muted-foreground/60 hover:bg-muted"
                  }`}
                >
                  {savingId === `c-${c.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : c.enabled ? (
                    <Power className="w-4 h-4" />
                  ) : (
                    <PowerOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
