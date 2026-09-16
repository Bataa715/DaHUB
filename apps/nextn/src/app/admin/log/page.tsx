"use client";

import { useCallback, useEffect, useState } from "react";
import {
  auditLogApi,
  getApiErrorMessage,
  type AuditLogRow,
  type LoginAttemptRow,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { Loader2, ScrollText, ShieldAlert, RefreshCw } from "lucide-react";

type LogTab = "audit" | "login";

const TABS: { id: LogTab; label: string; icon: typeof ScrollText }[] = [
  { id: "audit", label: "Үйлдлийн лог", icon: ScrollText },
  { id: "login", label: "Нэвтрэх оролдлого", icon: ShieldAlert },
];

export default function AdminLogPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LogTab>("audit");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [logins, setLogins] = useState<LoginAttemptRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (which: LogTab) => {
    setLoading(true);
    setLoadError(null);
    try {
      if (which === "audit") {
        const data = await auditLogApi.getAuditLogs(300);
        setAudit(Array.isArray(data) ? data : []);
      } else {
        const data = await auditLogApi.getLoginAttempts(300);
        setLogins(Array.isArray(data) ? data : []);
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
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        icon={<ScrollText className="w-4 h-4 text-blue-500" />}
        title="Систем лог"
        rightContent={
          <button
            onClick={() => load(tab)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Шинэчлэх
          </button>
        }
      />
      <div className="w-full px-4 py-6 sm:px-8 lg:px-12 2xl:px-16">
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
          </div>
        )}
      </div>
    </div>
  );
}

const th = "text-left px-3 py-2 font-semibold text-muted-foreground";
const td = "px-3 py-2 align-top border-t border-border/50";

function AuditTable({ rows }: { rows: AuditLogRow[] }) {
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
            <td className={`${td} whitespace-nowrap font-mono`}>
              {r.createdAt}
            </td>
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
                              r.metadata.endDate ? `–${r.metadata.endDate}` : ""
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

function LoginTable({ rows }: { rows: LoginAttemptRow[] }) {
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
                <span className="text-red-600 dark:text-red-400">
                  Амжилтгүй
                </span>
              )}
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
