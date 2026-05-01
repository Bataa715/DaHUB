"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  riskApi,
  type RiskIndicator,
  type RiskScore,
  type BranchSummary,
} from "@/lib/api";
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Save,
  History,
  X,
  RefreshCw,
  Database,
  Settings,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useAuth } from "@/contexts/AuthContext";

// ── helpers ────────────────────────────────────────────────────────────────
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function levelStyles(level: BranchSummary["level"]) {
  if (level === "high")
    return {
      icon: ShieldAlert,
      label: "Өндөр",
      cls: "bg-red-500/15 text-red-500 border-red-500/30",
      bar: "bg-red-500",
    };
  if (level === "medium")
    return {
      icon: ShieldQuestion,
      label: "Дунд",
      cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      bar: "bg-amber-500",
    };
  return {
    icon: ShieldCheck,
    label: "Бага",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    bar: "bg-emerald-500",
  };
}

interface Branch {
  id: string;
  name: string;
}

// ── main page ──────────────────────────────────────────────────────────────
export default function RiskAssessmentPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>(currentPeriod());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [indicators, setIndicators] = useState<RiskIndicator[]>([]);
  const [scores, setScores] = useState<RiskScore[]>([]);
  const [summary, setSummary] = useState<BranchSummary[]>([]);

  const [selectedBranch, setSelectedBranch] = useState<BranchSummary | null>(null);
  const [auditCell, setAuditCell] = useState<{
    branchId: string;
    indicatorId: string;
    indicatorName: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<
    Awaited<ReturnType<typeof riskApi.syncOracle>> | null
  >(null);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [inds, scs, sum] = await Promise.all([
        riskApi.listIndicators(),
        riskApi.listScores(period),
        riskApi.getSummary(period),
      ]);
      setIndicators(inds);
      setScores(scs);
      setSummary(sum);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const runOracleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await riskApi.syncOracle(period);
      setSyncResult(res);
      await loadAll();
    } catch (e: any) {
      setSyncResult({
        period,
        ok: false,
        upserted: 0,
        skippedManual: 0,
        perIndicator: [
          { code: "ERROR", name: e?.response?.data?.message ?? e.message, rows: 0 },
        ],
      });
    } finally {
      setSyncing(false);
    }
  };

  const sortedBranches = useMemo(
    () => [...summary].sort((a, b) => b.totalScore - a.totalScore),
    [summary],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title="Эрсдэлийн үнэлгээ"
        subtitle="Сар тутмын салбарын эрсдэлийн оноо"
        rightContent={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
            />
            <button
              onClick={runOracleSync}
              disabled={syncing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-sm disabled:opacity-50"
              title="Oracle-аас өгөгдөл татах"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Oracle‑аас татах
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-sm"
              title="Индикатор тохиргоо"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => loadAll()}
              disabled={refreshing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Сэргээх
            </button>
          </div>
        }
      />
      <div className="container mx-auto px-4 py-5 space-y-5 flex-1">

      {/* Oracle sync result banner */}
      {syncResult && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            syncResult.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
              : "bg-amber-500/10 border-amber-500/30 text-amber-600"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>
              Oracle sync: <b>{syncResult.upserted}</b> мөр шинэчлэв, гараар
              засагдсан <b>{syncResult.skippedManual}</b> мөр хэвээрээ үлдээв.
            </span>
            <button onClick={() => setSyncResult(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          {syncResult.perIndicator.length > 0 && (
            <ul className="mt-2 text-xs space-y-0.5">
              {syncResult.perIndicator.map((p) => (
                <li key={p.code}>
                  · {p.code} — {p.name}: {p.rows} мөр
                  {p.error && (
                    <span className="text-red-500"> — {p.error}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Summary cards */}
      <SummaryHeader summary={summary} />

      {/* Branch list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Oracle-аас татсан салбарууд ({sortedBranches.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Салбар</th>
                <th className="px-4 py-2 text-right">Нийт оноо</th>
                <th className="px-4 py-2 text-center">Түвшин</th>
                <th className="px-4 py-2 text-center">Indicator</th>
                <th className="px-4 py-2 text-center">Гараар</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedBranches.map((b) => {
                const lv = levelStyles(b.level);
                const Icon = lv.icon;
                return (
                  <tr
                    key={b.branchId}
                    className="border-t border-border hover:bg-accent/40 transition-colors"
                  >
                    <td className="px-4 py-2 font-medium">{b.branchName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {b.totalScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${lv.cls}`}
                      >
                        <Icon className="w-3 h-3" />
                        {lv.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-muted-foreground">
                      {b.indicatorCount}
                    </td>
                    <td className="px-4 py-2 text-center text-muted-foreground">
                      {b.manualCount}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setSelectedBranch(b)}
                        className="px-3 py-1 rounded-md text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        Засах →
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedBranches.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <div>Oracle-аас өгөгдөл байхгүй байна</div>
                    <div className="text-xs mt-1 opacity-60">"Oracle-аас татах" товч дарж өгөгдөл татна уу</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor drawer */}
      {selectedBranch && (
        <BranchEditor
          period={period}
          branch={{ id: selectedBranch.branchId, name: selectedBranch.branchName }}
          indicators={indicators}
          scores={scores.filter((s) => s.branchId === selectedBranch.branchId)}
          onClose={() => setSelectedBranch(null)}
          onSaved={() => loadAll()}
          onShowAudit={(indicator) =>
            setAuditCell({
              branchId: selectedBranch.branchId,
              indicatorId: indicator.id,
              indicatorName: indicator.name,
            })
          }
        />
      )}

      {/* Audit log modal */}
      {auditCell && (
        <AuditLogModal
          period={period}
          branchId={auditCell.branchId}
          indicatorId={auditCell.indicatorId}
          indicatorName={auditCell.indicatorName}
          onClose={() => setAuditCell(null)}
        />
      )}

      {/* Indicator settings modal */}
      {settingsOpen && (
        <IndicatorSettingsModal
          indicators={indicators}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => loadAll()}
        />
      )}

      {/* Footer */}
      <p className="text-center text-slate-500 text-xs py-6">
        {user?.name && (
          <>
            <span>{user.name}</span>
            {" · "}
          </>
        )}
        {(user as any)?.department ?? ""}
      </p>
    </div>
  </div>
  );
}

// ── Summary header ──────────────────────────────────────────────────────────
function SummaryHeader({ summary }: { summary: BranchSummary[] }) {
  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    summary.forEach((s) => c[s.level]++);
    return c;
  }, [summary]);
  const avg =
    summary.length > 0
      ? summary.reduce((a, b) => a + b.totalScore, 0) / summary.length
      : 0;

  const cards = [
    {
      label: "Хамрагдсан салбар",
      value: summary.length.toString(),
      cls: "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
    },
    {
      label: "Дундаж оноо",
      value: avg.toFixed(1),
      cls: "from-violet-500/10 to-indigo-500/10 border-violet-500/20",
    },
    {
      label: "Өндөр эрсдэлтэй",
      value: counts.high.toString(),
      cls: "from-red-500/10 to-rose-500/10 border-red-500/20",
    },
    {
      label: "Дунд эрсдэлтэй",
      value: counts.medium.toString(),
      cls: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border bg-gradient-to-br p-4 ${c.cls}`}
        >
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Branch editor drawer ───────────────────────────────────────────────────
function BranchEditor({
  period,
  branch,
  indicators,
  scores,
  onClose,
  onSaved,
  onShowAudit,
}: {
  period: string;
  branch: Branch;
  indicators: RiskIndicator[];
  scores: RiskScore[];
  onClose: () => void;
  onSaved: () => void;
  onShowAudit: (indicator: RiskIndicator) => void;
}) {
  // Local edits keyed by indicator id
  type Edit = { rawValue: string; score: string; reason: string };
  const initial: Record<string, Edit> = {};
  indicators.forEach((ind) => {
    const existing = scores.find((s) => s.indicatorId === ind.id);
    initial[ind.id] = {
      rawValue: existing?.rawValue?.toString() ?? "",
      score: existing?.score?.toString() ?? "",
      reason: "",
    };
  });
  const [edits, setEdits] = useState<Record<string, Edit>>(initial);
  const [saving, setSaving] = useState<string | null>(null);

  const updateField = (id: string, field: keyof Edit, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveOne = async (ind: RiskIndicator) => {
    setSaving(ind.id);
    const e = edits[ind.id];
    try {
      await riskApi.upsertScore({
        period,
        branchId: branch.id,
        branchName: branch.name,
        indicatorId: ind.id,
        rawValue: e.rawValue === "" ? null : Number(e.rawValue),
        score: Number(e.score) || 0,
        reason: e.reason || "Гар оруулга",
      });
      onSaved();
      // Reset reason after successful save
      setEdits((prev) => ({ ...prev, [ind.id]: { ...prev[ind.id], reason: "" } }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-card border-l border-border w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="text-xs text-muted-foreground">{period}</div>
            <h3 className="text-lg font-semibold">{branch.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Indicator list */}
        <div className="p-4 space-y-3">
          {indicators.map((ind) => {
            const existing = scores.find((s) => s.indicatorId === ind.id);
            const e = edits[ind.id];
            return (
              <div
                key={ind.id}
                className="rounded-lg border border-border bg-background p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      {ind.name}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {ind.code}
                      </span>
                      {ind.sourceType === "auto" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                          AUTO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ind.category} · Жин: {(ind.weight * 100).toFixed(0)}%
                      {existing?.isManual ? " · Гараар засагдсан" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => onShowAudit(ind)}
                    className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <History className="w-3 h-3" /> Түүх
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Утга ({ind.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={e.rawValue}
                      onChange={(ev) =>
                        updateField(ind.id, "rawValue", ev.target.value)
                      }
                      className="w-full px-2 py-1 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Оноо (0-100)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={e.score}
                      onChange={(ev) =>
                        updateField(ind.id, "score", ev.target.value)
                      }
                      className="w-full px-2 py-1 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Шалтгаан
                    </label>
                    <input
                      type="text"
                      placeholder="Засах шалтгаан..."
                      value={e.reason}
                      onChange={(ev) =>
                        updateField(ind.id, "reason", ev.target.value)
                      }
                      className="w-full px-2 py-1 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => saveOne(ind)}
                    disabled={saving === ind.id}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving === ind.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Хадгалах
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Audit log modal ─────────────────────────────────────────────────────────
function AuditLogModal({
  period,
  branchId,
  indicatorId,
  indicatorName,
  onClose,
}: {
  period: string;
  branchId: string;
  indicatorId: string;
  indicatorName: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof riskApi.getAuditLog>>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void riskApi
      .getAuditLog(period, branchId, indicatorId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [period, branchId, indicatorId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{period}</div>
            <h3 className="text-sm font-semibold">{indicatorName}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              Түүх алга
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-border bg-background p-2 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{r.changedBy}</span>
                    <span className="text-muted-foreground">{r.changedAt}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Утга: {r.oldValue ?? "—"} → {r.newValue ?? "—"} · Оноо:{" "}
                    {r.oldScore ?? "—"} → {r.newScore ?? "—"}
                  </div>
                  {r.reason && (
                    <div className="mt-1 italic text-muted-foreground">
                      “{r.reason}”
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Indicator settings modal (Oracle query / scale) ─────────────────────────
function IndicatorSettingsModal({
  indicators,
  onClose,
  onSaved,
}: {
  indicators: RiskIndicator[];
  onClose: () => void;
  onSaved: () => void;
}) {
  type Edit = { oracleQuery: string; scoreScale: string; weight: string };
  const initial: Record<string, Edit> = {};
  indicators.forEach((i) => {
    initial[i.id] = {
      oracleQuery: i.oracleQuery ?? "",
      scoreScale: (i.scoreScale ?? 1).toString(),
      weight: (i.weight ?? 0).toString(),
    };
  });
  const [edits, setEdits] = useState<Record<string, Edit>>(initial);
  const [saving, setSaving] = useState<string | null>(null);

  const update = (id: string, field: keyof Edit, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const save = async (ind: RiskIndicator) => {
    setSaving(ind.id);
    const e = edits[ind.id];
    try {
      await riskApi.updateIndicator(ind.id, {
        oracleQuery: e.oracleQuery,
        scoreScale: Number(e.scoreScale) || 1,
        weight: Number(e.weight) || 0,
      });
      onSaved();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Индикаторын тохиргоо</h3>
            <p className="text-xs text-muted-foreground">
              Oracle SELECT нь <code>BRANCH_ID, BRANCH_NAME, RAW_VALUE</code>{" "}
              баганатай байх ёстой. Bind: <code>:1</code>=period (YYYY-MM),{" "}
              <code>:2</code>=period_start, <code>:3</code>=period_end.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-3">
          {indicators.map((ind) => {
            const e = edits[ind.id];
            return (
              <div
                key={ind.id}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">
                    {ind.name}{" "}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {ind.code}
                    </span>
                  </div>
                  <button
                    onClick={() => save(ind)}
                    disabled={saving === ind.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving === ind.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Хадгалах
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Жин (0..1)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={1}
                      value={e.weight}
                      onChange={(ev) => update(ind.id, "weight", ev.target.value)}
                      className="w-full px-2 py-1 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Score scale (raw × scale → score 0..100)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={e.scoreScale}
                      onChange={(ev) =>
                        update(ind.id, "scoreScale", ev.target.value)
                      }
                      className="w-full px-2 py-1 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                </div>
                <label className="text-xs text-muted-foreground">
                  Oracle SELECT (хоосон бол алгасна)
                </label>
                <textarea
                  rows={4}
                  value={e.oracleQuery}
                  onChange={(ev) =>
                    update(ind.id, "oracleQuery", ev.target.value)
                  }
                  placeholder={`SELECT BRANCH_ID, BRANCH_NAME, COUNT(*) AS RAW_VALUE\nFROM DATA_ANALYST.SOME_TABLE\nWHERE H_TRAN_DATE >= :2 AND H_TRAN_DATE < :3\nGROUP BY BRANCH_ID, BRANCH_NAME`}
                  className="w-full px-2 py-1 rounded-md border border-border bg-background text-xs font-mono"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
