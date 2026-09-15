"use client";

import { useCallback, useEffect, useState } from "react";
import { pythonToolApi, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ScrollText, ShieldAlert, Terminal, RefreshCw } from "lucide-react";

type LogTab = "audit" | "login" | "python";

interface AuditRow {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
interface LoginRow {
  lockKey: string;
  attemptedAt: string;
  success: boolean;
}
interface RunRow {
  id: string;
  userId: string;
  userName: string;
  toolName: string;
  kind?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  filtersJson?: string;
  errorMessage?: string;
  ranAt: string;
}

const TABS: { id: LogTab; label: string; icon: typeof ScrollText }[] = [
  { id: "audit", label: "Үйлдлийн лог", icon: ScrollText },
  { id: "login", label: "Нэвтрэх оролдлого", icon: ShieldAlert },
  { id: "python", label: "Тайлан ажиллуулалт", icon: Terminal },
];

export default function AdminLogPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LogTab>("audit");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (which: LogTab) => {
    setLoading(true);
    setLoadError(null);
    try {
      if (which === "audit") {
        const data = await pythonToolApi.adminGetAuditLogs(300);
        setAudit(Array.isArray(data) ? data : []);
      } else if (which === "login") {
        const data = await pythonToolApi.adminGetLoginAttempts(300);
        setLogins(Array.isArray(data) ? data : []);
      } else {
        const data = await pythonToolApi.adminGetRunLogs(300);
        setRuns(Array.isArray(data) ? (data as RunRow[]) : []);
      }
    } catch (e: unknown) {
      setLoadError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Зөвхөн супер администраторт зориулсан хуудас.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold">Систем лог</h1>
        </div>
        <button
          onClick={() => load(tab)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-muted/30 text-xs font-semibold hover:bg-muted/60"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Шинэчлэх
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tb.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">
          {loadError}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          {tab === "audit" && <AuditTable rows={audit} />}
          {tab === "login" && <LoginTable rows={logins} />}
          {tab === "python" && <RunTable rows={runs} />}
        </div>
      )}
    </div>
  );
}

const th = "text-left px-3 py-2 font-semibold text-muted-foreground";
const td = "px-3 py-2 align-top border-t border-border/50";

function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/40">
        <tr>
          <th className={th}>Огноо</th>
          <th className={th}>Хэрэглэгч</th>
          <th className={th}>Үйлдэл</th>
          <th className={th}>Нөөц</th>
          <th className={th}>Төлөв</th>
          <th className={th}>Дэлгэрэнгүй</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-muted/20">
            <td className={`${td} whitespace-nowrap font-mono`}>{r.createdAt}</td>
            <td className={`${td} font-mono`}>{r.userId || "—"}</td>
            <td className={td}>{r.action}</td>
            <td className={td}>
              {r.resource}
              {r.resourceId ? ` · ${r.resourceId}` : ""}
            </td>
            <td className={td}>
              <span
                className={
                  r.status === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
              >
                {r.status}
              </span>
            </td>
            <td className={`${td} text-muted-foreground max-w-[360px]`}>
              {r.errorMessage ? (
                <span>{r.errorMessage}</span>
              ) : r.metadata && Object.keys(r.metadata).length ? (
                <span className="break-all">
                  {typeof r.metadata.toolName === "string"
                    ? `${r.metadata.toolName}${
                        r.metadata.startDate
                          ? ` · ${r.metadata.startDate}${
                              r.metadata.endDate
                                ? `–${r.metadata.endDate}`
                                : ""
                            }`
                          : ""
                      }${
                        r.metadata.userName
                          ? ` · ${String(r.metadata.userName)}`
                          : ""
                      }`
                    : JSON.stringify(r.metadata)}
                </span>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LoginTable({ rows }: { rows: LoginRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/40">
        <tr>
          <th className={th}>Огноо</th>
          <th className={th}>Түлхүүр (IP/хэрэглэгч)</th>
          <th className={th}>Үр дүн</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-muted/20">
            <td className={`${td} whitespace-nowrap font-mono`}>
              {r.attemptedAt}
            </td>
            <td className={`${td} font-mono`}>{r.lockKey}</td>
            <td className={td}>
              {r.success ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Амжилттай
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Амжилтгүй</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RunTable({ rows }: { rows: RunRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/40">
        <tr>
          <th className={th}>Огноо</th>
          <th className={th}>Хэрэглэгч</th>
          <th className={th}>Тайлан</th>
          <th className={th}>Төрөл</th>
          <th className={th}>Хугацаа</th>
          <th className={th}>Төлөв</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-muted/20">
            <td className={`${td} whitespace-nowrap font-mono`}>{r.ranAt}</td>
            <td className={td}>
              {r.userName || r.userId || "—"}
              {r.userName && r.userId ? (
                <div className="font-mono text-[10px] text-muted-foreground">
                  {r.userId}
                </div>
              ) : null}
            </td>
            <td className={td}>{r.toolName || "—"}</td>
            <td className={td}>{r.kind === "preview" ? "Preview" : "Таталт"}</td>
            <td className={`${td} font-mono whitespace-nowrap`}>
              {r.startDate || r.endDate
                ? `${r.startDate || "—"}${r.endDate ? ` → ${r.endDate}` : ""}`
                : "—"}
            </td>
            <td className={td}>
              <span
                className={
                  r.status === "failure"
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }
              >
                {r.status === "failure" ? "Амжилтгүй" : "Амжилттай"}
              </span>
              {r.errorMessage ? (
                <div className="text-[10px] text-muted-foreground max-w-[240px] truncate">
                  {r.errorMessage}
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty() {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      Лог олдсонгүй.
    </div>
  );
}
