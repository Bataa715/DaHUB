"use client";

import { useMemo, useState, useEffect, useCallback, Fragment, useRef } from "react";
import {
  Save,
  Download,
  History,
  Trash2,
  Loader2,
  X,
  Hand,
} from "lucide-react";
import { riskApi } from "@/lib/api";
import {
  aggregateBranch,
  computeTotal,
  riskLevel,
  riskLevelClass,
  WEIGHTS,
  type BranchAggregate,
  type RiskLevel,
} from "./scoring-rules";
import {
  evaluateBranch,
  CATALOG_BY_GROUP,
  GROUP_LABEL,
  MANUAL_COUNT_BY_GROUP,
  type CatalogGroup,
  type CatalogIndicator,
  type BranchCatalogResult,
  type ManualMap,
} from "./indicator-catalog";

// localStorage key зайлсхийж — ClickHouse-д хадгалдаг болсон
// (backward-compat: localStorage-д юу байвал нэг удаа migrate хийнэ)

type AnyRow = {
  SOLID?: any;
  BRANCHID?: any;
  BRANCHNAME?: any;
  SUBID?: any;
  RESULT?: any;
  RESULT_TYPE?: any;
};

type Snapshot = Record<string, { total: number; level: string }>;

interface SnapshotMeta {
  id: string;
  name: string;
  createdBy: string;
  createdByName: string;
  pDate: string;
  pDateBeg: string;
  branchCount: number;
  createdAt: string;
}

interface Props {
  scoredRows: AnyRow[];
  judgement: Record<string, number>;
  setJudgement: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  score4: Record<string, number>;
  setScore4: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  riskFilter: "all" | RiskLevel;
  setRiskFilter: React.Dispatch<React.SetStateAction<"all" | RiskLevel>>;
}

const MANUAL_KEY_LEGACY = "riskass_manual_indicators";

// localStorage дахь өмнөх утгуудыг ClickHouse-руу нэг удаа migrate хийх
async function migrateFromLocalStorage(legacy: ManualMap) {
  try {
    const entries: Array<{ branchId: string; indicatorId: string; value: number }> = [];
    for (const [branchId, inds] of Object.entries(legacy)) {
      for (const [indicatorId, value] of Object.entries(inds)) {
        if (value > 0) entries.push({ branchId, indicatorId, value });
      }
    }
    await Promise.all(entries.map((e) => riskApi.upsertManualIndicator(e)));
    // Амжилттай migrate хийсний дараа localStorage-ийг цэвэрлэнэ
    window.localStorage.removeItem(MANUAL_KEY_LEGACY);
  } catch {
    // Migration алдаатай бол дараа дахин оролдоно
  }
}

export default function ReportView({
  scoredRows,
  judgement,
  setJudgement,
  score4,
  setScore4,
  riskFilter,
  setRiskFilter,
}: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [activeSnapshot, setActiveSnapshot] = useState<SnapshotMeta | null>(null);
  const [snapshotList, setSnapshotList] = useState<SnapshotMeta[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Гар оруулсан үзүүлэлтийн утгууд (per-branch × per-indicator) ──
  const [manualMap, setManualMap] = useState<ManualMap>({});
  const [manualLoading, setManualLoading] = useState(false);
  // Аль салбар × бүлгийн манай гарын панель нээгдсэн байна
  const [expanded, setExpanded] = useState<{
    branchId: string;
    group: CatalogGroup;
  } | null>(null);
  // debounce save тимер хадгалах
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ClickHouse-аас гарын утгуудыг ачаалах (нэг удаа)
  useEffect(() => {
    setManualLoading(true);
    riskApi
      .listManualIndicators()
      .then((data) => setManualMap(data || {}))
      .catch(() => {
        // Сүлжээний алдаа: localStorage-аас нөөцлөн авах (migration)
        try {
          const raw = window.localStorage.getItem("riskass_manual_indicators");
          if (raw) {
            const legacy = JSON.parse(raw) as ManualMap;
            setManualMap(legacy);
            // Нэг удаа migrate
            migrateFromLocalStorage(legacy);
          }
        } catch {}
      })
      .finally(() => setManualLoading(false));
  }, []);

  const setManualValue = useCallback(
    (branchId: string, indicatorId: string, value: number) => {
      // 1) UI-г шууд шинэчлэх
      setManualMap((prev) => {
        const next = { ...prev };
        const branch = { ...(next[branchId] || {}) };
        if (!value || value <= 0) delete branch[indicatorId];
        else branch[indicatorId] = Math.min(5, Math.max(0, value));
        if (Object.keys(branch).length === 0) delete next[branchId];
        else next[branchId] = branch;
        return next;
      });
      // 2) 600ms debounce-тайгаар backend-рүү хадгалах
      const key = `${branchId}::${indicatorId}`;
      clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        // Scalar branchName-г rows-аас авч чадахгүй тул хоосон дамжуулна
        riskApi
          .upsertManualIndicator({ branchId, indicatorId, value })
          .catch(console.error);
      }, 600);
    },
    [],
  );

  const loadSnapshotList = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const list = await riskApi.listSnapshots();
      setSnapshotList(list);
    } catch {}
    finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshotList();
  }, [loadSnapshotList]);

  // Базын aggregate-уудыг авах (Oracle-аас ирсэн SUBID 11-аар бүс/зэрэглэл, мөн
  // одоо байгаа auto Score 1/2/3 тооцоог хадгална — эдгээрийг үндсэн default
  // болгож ашиглана; харин catalog-аар тооцсон group score дээр override хийнэ)
  const baseAggregates = useMemo(
    () => aggregateBranch(scoredRows, score4, judgement),
    [scoredRows, score4, judgement],
  );

  // Салбар бүрийн Oracle мөрнүүдийг branchId-аар бүлэглэх
  const rowsByBranch = useMemo(() => {
    const m = new Map<string, AnyRow[]>();
    for (const r of scoredRows) {
      const id = String(r.BRANCHID ?? "");
      if (!id) continue;
      let arr = m.get(id);
      if (!arr) {
        arr = [];
        m.set(id, arr);
      }
      arr.push(r);
    }
    return m;
  }, [scoredRows]);

  // Catalog-аас (auto + manual) бүлэг тус бүрийн жигнэсэн оноог тооцоолох
  const branchEvals = useMemo(() => {
    const m = new Map<string, BranchCatalogResult>();
    for (const id of rowsByBranch.keys()) {
      m.set(id, evaluateBranch(id, rowsByBranch.get(id) || [], manualMap[id]));
    }
    return m;
  }, [rowsByBranch, manualMap]);

  // baseAggregates дээр catalog-оор тооцсон group score-уудыг override
  const aggregates = useMemo<BranchAggregate[]>(() => {
    return baseAggregates.map((b) => {
      const ev = branchEvals.get(b.branchId);
      if (!ev) return b;
      const w = WEIGHTS[b.region];
      const s1 = ev.groupScores[1] ?? b.s1;
      const s2 = ev.groupScores[2] ?? b.s2;
      const s3 = ev.groupScores[3] ?? b.s3;
      const s4 = ev.groupScores[4] ?? b.s4 ?? 0;
      const j = ev.groupScores[5] ?? b.j ?? 0;
      // Total: одоо байгаа UB/LOC group жинг хадгална
      let total: number | null = null;
      if (s1 != null && s2 != null && s3 != null) {
        total =
          s1 * w.s1 +
          s2 * w.s2 +
          s3 * w.s3 +
          (s4 || 0) * w.s4 +
          (j || 0) * w.j;
      }
      const level: RiskLevel | "" =
        total == null
          ? ""
          : total >= 3.5
          ? "Өндөр"
          : total >= 2.5
          ? "Дунд"
          : "Бага";
      return {
        ...b,
        s1,
        s2,
        s3,
        s4: s4 ?? 0,
        j: j ?? 0,
        total,
        level,
      } as BranchAggregate;
    });
  }, [baseAggregates, branchEvals]);

  // Эрсдэлийн түвшний filter
  const filtered = useMemo(
    () =>
      riskFilter === "all"
        ? aggregates
        : aggregates.filter((b) => b.level === riskFilter),
    [aggregates, riskFilter],
  );

  const ub = filtered.filter((b) => b.region === "UB");
  const loc = filtered.filter((b) => b.region === "LOC");

  // Snapshot хадгалах: одоогийн дүнг ClickHouse-д нэр өгч хадгална
  const saveSnapshot = useCallback(async () => {
    const name = window.prompt(
      "Хадгалах тайлангийн нэр (жишээ нь: 2026Q1, 2025-12-31, эсвэл 'Сарын тайлан 04')",
      new Date().toLocaleDateString("mn-MN"),
    );
    if (!name || !name.trim()) return;
    const payload: Record<
      string,
      {
        total: number;
        level: string;
        s1: number | null;
        s2: number | null;
        s3: number | null;
        s4: number;
        j: number;
        region: string;
        rating: string;
        branchName: string;
        solid: string;
      }
    > = {};
    for (const b of aggregates) {
      if (b.total != null) {
        payload[b.branchId] = {
          total: b.total,
          level: b.level,
          s1: b.s1,
          s2: b.s2,
          s3: b.s3,
          s4: b.s4,
          j: b.j,
          region: b.region,
          rating: b.rating,
          branchName: b.branchName,
          solid: b.solid,
        };
      }
    }
    setSaving(true);
    try {
      const meta = await riskApi.saveSnapshot({
        name: name.trim(),
        payload,
        branchCount: Object.keys(payload).length,
      });
      await loadSnapshotList();
      window.alert(`"${meta.name}" нэртэйгээр амжилттай хадгаллаа.`);
    } catch (e: any) {
      window.alert(`Хадгалахад алдаа гарлаа: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }, [aggregates, loadSnapshotList]);

  // Түүхээс сонгосон snapshot-ийг "өмнөх үе" болгон ашиглах
  const applySnapshot = useCallback(async (meta: SnapshotMeta) => {
    try {
      const full = await riskApi.getSnapshot(meta.id);
      const snap: Snapshot = {};
      for (const [k, v] of Object.entries(full.payload || {})) {
        const vv = v as any;
        if (vv && typeof vv.total === "number") {
          snap[k] = { total: vv.total, level: vv.level ?? "" };
        }
      }
      setSnapshot(snap);
      setActiveSnapshot(meta);
      setHistoryOpen(false);
    } catch (e: any) {
      window.alert(`Татахад алдаа гарлаа: ${e?.message ?? e}`);
    }
  }, []);

  const clearActiveSnapshot = useCallback(() => {
    setSnapshot({});
    setActiveSnapshot(null);
  }, []);

  const deleteSnapshot = useCallback(
    async (id: string) => {
      if (!window.confirm("Энэ хадгалсан тайланг устгах уу?")) return;
      try {
        await riskApi.deleteSnapshot(id);
        if (activeSnapshot?.id === id) clearActiveSnapshot();
        await loadSnapshotList();
      } catch (e: any) {
        window.alert(`Устгахад алдаа гарлаа: ${e?.message ?? e}`);
      }
    },
    [activeSnapshot, clearActiveSnapshot, loadSnapshotList],
  );

  // Summary
  const summary = useMemo(() => {
    const cur = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
    const prev = { Өндөр: 0, Дунд: 0, Бага: 0, Нийт: 0 };
    let upCnt = 0,
      downCnt = 0,
      sameCnt = 0,
      newCnt = 0;
    const transitions: Record<string, number> = {};

    for (const b of aggregates) {
      cur.Нийт++;
      if (b.level) (cur as any)[b.level]++;
      const p = snapshot[b.branchId];
      if (p) {
        prev.Нийт++;
        (prev as any)[p.level]++;
        if (b.total != null) {
          const diff = b.total - p.total;
          if (Math.abs(diff) < 0.005) sameCnt++;
          else if (diff > 0) upCnt++;
          else downCnt++;
        }
        const k = `${p.level}-${b.level}`;
        transitions[k] = (transitions[k] || 0) + 1;
      } else {
        newCnt++;
      }
    }
    return { cur, prev, upCnt, downCnt, sameCnt, newCnt, transitions };
  }, [aggregates, snapshot]);

  const downloadCsv = () => {
    const cols = [
      "№",
      "SOL",
      "Салбарын нэр",
      "Зэрэглэл",
      "Бүс",
      "Score 1",
      "Score 2",
      "Score 3",
      "Score 4",
      "Judgement",
      "Total",
      "Эрсдэлийн түвшин",
      "Өмнөх Total",
      "Зөрүү",
    ];
    const fmt = (n: number | null) => (n == null ? "" : n.toFixed(2));
    const lines = [cols.join(",")];
    aggregates.forEach((b, i) => {
      const p = snapshot[b.branchId];
      const diff = p && b.total != null ? b.total - p.total : null;
      lines.push(
        [
          i + 1,
          b.solid,
          `"${b.branchName.replace(/"/g, '""')}"`,
          b.rating,
          b.region,
          fmt(b.s1),
          fmt(b.s2),
          fmt(b.s3),
          fmt(b.s4 || null),
          fmt(b.j || null),
          fmt(b.total),
          b.level,
          p ? fmt(p.total) : "",
          fmt(diff),
        ].join(","),
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-riskass-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (scoredRows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-muted-foreground text-sm">
        Тайлан гаргахын тулд эхлээд Oracle-аас өгөгдөл татна уу.
      </div>
    );
  }

  const updateNum = (
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    branchId: string,
    val: number,
  ) => setter((prev) => ({ ...prev, [branchId]: val }));

  return (
    <div className="space-y-5 p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground max-w-2xl space-y-1">
          <div>
            Score 4 ба Judgement-ийг гараар оруулна (0–5). Бичсэн утга localStorage-д
            автомат хадгалагдана.
          </div>
          <div>
            <b>Хадгалах</b> — одоогийн дүнг нэр өгч ClickHouse-д бэхэлнэ. <b>Түүх</b>{" "}
            — өмнө хадгалсан тайлангаас сонгоход <i>Зөрүү</i>,{" "}
            <i>Үнэлгээний өөрчлөлт</i>, <i>Түвшин өөрчлөлт</i> тооцогдоно.
          </div>
          {activeSnapshot && (
            <div className="text-emerald-600 flex items-center gap-1.5">
              <span>
                Харьцуулж буй: <b>{activeSnapshot.name}</b>
                <span className="text-muted-foreground/70 ml-1">
                  ({new Date(activeSnapshot.createdAt).toLocaleString("mn-MN")})
                </span>
              </span>
              <button
                onClick={clearActiveSnapshot}
                className="text-rose-600 hover:underline ml-1"
                title="Харьцуулалт цуцлах"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Эрсдэлийн түвшний filter */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "Өндөр", "Дунд", "Бага"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setRiskFilter(opt)}
                className={`px-2 py-1.5 text-xs border-r last:border-r-0 border-border ${
                  riskFilter === opt
                    ? "bg-blue-500/10 text-blue-600 font-semibold"
                    : "hover:bg-accent/40"
                }`}
              >
                {opt === "all" ? "Бүгд" : opt}
              </button>
            ))}
          </div>
          <button
            onClick={saveSnapshot}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 text-xs disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Хадгалах
          </button>
          <button
            onClick={() => {
              setHistoryOpen(true);
              loadSnapshotList();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 text-xs"
          >
            <History className="w-3.5 h-3.5" /> Түүх
            {snapshotList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-[10px] tabular-nums">
                {snapshotList.length}
              </span>
            )}
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          {manualLoading && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Гарын утга ачаалж байна…
            </div>
          )}
        </div>
      </div>

      <ReportTable
        title="Улаанбаатар хотын Бизнес төв, салбар, тооцооны төвүүд"
        region="UB"
        rows={ub}
        snapshot={snapshot}
        onScore4={(id, v) => updateNum(setScore4, id, v)}
        onJudgement={(id, v) => updateNum(setJudgement, id, v)}
        branchEvals={branchEvals}
        manualMap={manualMap}
        setManualValue={setManualValue}
        expanded={expanded}
        setExpanded={setExpanded}
      />

      <ReportTable
        title="Орон нутгийн Бизнес төв, салбар, тооцооны төвүүд"
        region="LOC"
        rows={loc}
        snapshot={snapshot}
        onScore4={(id, v) => updateNum(setScore4, id, v)}
        onJudgement={(id, v) => updateNum(setJudgement, id, v)}
        branchEvals={branchEvals}
        manualMap={manualMap}
        setManualValue={setManualValue}
        expanded={expanded}
        setExpanded={setExpanded}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryBlock title="1. ҮНЭЛГЭЭ" cols={["Үзүүлэлт", "Одоо", "Өмнө"]}>
          <SRow label="Өндөр" v={summary.cur.Өндөр} prev={summary.prev.Өндөр} />
          <SRow label="Дунд" v={summary.cur.Дунд} prev={summary.prev.Дунд} />
          <SRow label="Бага" v={summary.cur.Бага} prev={summary.prev.Бага} />
          <SRow label="Нийт" v={summary.cur.Нийт} prev={summary.prev.Нийт} bold />
        </SummaryBlock>
        <SummaryBlock title="2. ҮНЭЛГЭЭНИЙ ӨӨРЧЛӨЛТ" cols={["Үзүүлэлт", "Тоо"]}>
          <SRow label="Үнэлгээ өссөн" v={summary.upCnt} />
          <SRow label="Үнэлгээ буурсан" v={summary.downCnt} />
          <SRow label="Үнэлгээ өөрчлөлтгүй" v={summary.sameCnt} />
          <SRow label="Шинээр нэмэгдсэн" v={summary.newCnt} />
          <SRow label="Нийт" v={summary.cur.Нийт} bold />
        </SummaryBlock>
        <SummaryBlock title="3. ТҮВШИН ӨӨРЧЛӨЛТ" cols={["Үзүүлэлт", "Тоо"]}>
          {[
            "Өндөр-Өндөр",
            "Өндөр-Дунд",
            "Өндөр-Бага",
            "Дунд-Өндөр",
            "Дунд-Дунд",
            "Дунд-Бага",
            "Бага-Өндөр",
            "Бага-Дунд",
            "Бага-Бага",
          ].map((k) => (
            <SRow key={k} label={k} v={summary.transitions[k] || 0} />
          ))}
          <SRow label="Шинээр нэмэгдсэн" v={summary.newCnt} />
          <SRow label="Нийт" v={summary.cur.Нийт} bold />
        </SummaryBlock>
      </div>

      {expanded && (
        <IndicatorPanelModal
          group={expanded.group}
          branchId={expanded.branchId}
          branchName={aggregates.find((b) => b.branchId === expanded.branchId)?.branchName ?? expanded.branchId}
          ev={branchEvals.get(expanded.branchId)}
          manual={manualMap[expanded.branchId] || {}}
          setManualValue={setManualValue}
          onClose={() => setExpanded(null)}
        />
      )}

      {historyOpen && (
        <HistoryModal
          list={snapshotList}
          loading={loadingHistory}
          activeId={activeSnapshot?.id ?? null}
          onClose={() => setHistoryOpen(false)}
          onApply={applySnapshot}
          onDelete={deleteSnapshot}
          onRefresh={loadSnapshotList}
        />
      )}
    </div>
  );
}

// ── Хадгалсан тайлангийн түүхийн модал ─────────────────────────────────────
function HistoryModal({
  list,
  loading,
  activeId,
  onClose,
  onApply,
  onDelete,
  onRefresh,
}: {
  list: SnapshotMeta[];
  loading: boolean;
  activeId: string | null;
  onClose: () => void;
  onApply: (m: SnapshotMeta) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-xl border border-border bg-card flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Хадгалсан тайлангийн түүх</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Сонгосон тайлан нь «өмнөх үе» болж Зөрүү/Үнэлгээний өөрчлөлт/Түвшин
              өөрчлөлт тооцоонд хэрэглэгдэнэ.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/40"
              title="Шинэчлэх"
            >
              ↻
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent/40"
              title="Хаах"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" /> Уншиж
              байна…
            </div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Хадгалсан тайлан байхгүй. «Хадгалах» товчийг ашиглан эхний тайлангаа
              үүсгээрэй.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Нэр</th>
                  <th className="px-3 py-2 text-left">Хадгалсан</th>
                  <th className="px-3 py-2 text-right">Салбар</th>
                  <th className="px-3 py-2 text-left">Огноо</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const isActive = s.id === activeId;
                  return (
                    <tr
                      key={s.id}
                      className={`border-t border-border ${
                        isActive ? "bg-emerald-500/5" : "hover:bg-accent/30"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium">
                        {s.name}
                        {isActive && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                            Идэвхтэй
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString("mn-MN")}
                        {s.createdByName && (
                          <span className="ml-1 text-[10px]">
                            · {s.createdByName}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.branchCount}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {s.pDateBeg && s.pDate ? `${s.pDateBeg} → ${s.pDate}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => onApply(s)}
                          className="text-blue-600 hover:underline mr-2"
                        >
                          Сонгох
                        </button>
                        <button
                          onClick={() => onDelete(s.id)}
                          className="text-rose-600 hover:bg-rose-500/10 p-1 rounded"
                          title="Устгах"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Тайлангийн хүснэгт ────────────────────────────────────────────────────
function ReportTable({
  title,
  region,
  rows,
  snapshot,
  onScore4,
  onJudgement,
  branchEvals,
  manualMap,
  setManualValue,
  expanded,
  setExpanded,
}: {
  title: string;
  region: "UB" | "LOC";
  rows: BranchAggregate[];
  snapshot: Snapshot;
  onScore4: (id: string, v: number) => void;
  onJudgement: (id: string, v: number) => void;
  branchEvals: Map<string, BranchCatalogResult>;
  manualMap: ManualMap;
  setManualValue: (branchId: string, indicatorId: string, v: number) => void;
  expanded: { branchId: string; group: CatalogGroup } | null;
  setExpanded: React.Dispatch<
    React.SetStateAction<{ branchId: string; group: CatalogGroup } | null>
  >;
}) {
  const w = WEIGHTS[region];
  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(2));
  const toggle = (branchId: string, group: CatalogGroup) =>
    setExpanded((cur) =>
      cur && cur.branchId === branchId && cur.group === group
        ? null
        : { branchId, group },
    );
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/40">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Жин: Score1 {(w.s1 * 100).toFixed(0)}% · Score2 {(w.s2 * 100).toFixed(0)}% · Score3{" "}
          {(w.s3 * 100).toFixed(0)}% · Score4 {(w.s4 * 100).toFixed(0)}% · Judgement{" "}
          {(w.j * 100).toFixed(0)}%
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          <Hand className="inline w-3 h-3 mr-1" />
          товчийг дарж тухайн Score-н гарын үзүүлэлтүүдийг оруулна. Auto утгууд нь
          Oracle-аас өөрөө гарна.
        </div>
      </div>
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left">№</th>
              <th className="px-2 py-2 text-left">SOL</th>
              <th className="px-2 py-2 text-left">Салбарын нэр</th>
              <th className="px-2 py-2 text-center">Зэрэглэл</th>
              <th className="px-2 py-2 text-right">Score 1</th>
              <th className="px-2 py-2 text-right">Score 2</th>
              <th className="px-2 py-2 text-right">Score 3</th>
              <th className="px-2 py-2 text-right">Score 4</th>
              <th className="px-2 py-2 text-right">Judgement</th>
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2 text-center">Түвшин</th>
              <th className="px-2 py-2 text-right">Зөрүү</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => {
              const prev = snapshot[b.branchId];
              const diff = prev && b.total != null ? b.total - prev.total : null;
              const ev = branchEvals.get(b.branchId);
              const isOpen = expanded?.branchId === b.branchId;
              const openGroup = isOpen ? expanded!.group : null;
              const branchManual = manualMap[b.branchId] || {};
              return (
                <Fragment key={b.branchId}>
                  <tr
                    className="border-t border-border hover:bg-accent/30"
                  >
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1.5 tabular-nums">{b.solid}</td>
                    <td className="px-2 py-1.5 font-medium">{b.branchName}</td>
                    <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
                      {b.rating}
                    </td>
                    <ScoreCell
                      value={b.s1}
                      group={1}
                      branchId={b.branchId}
                      manual={branchManual}
                      open={openGroup === 1}
                      onToggle={toggle}
                    />
                    <ScoreCell
                      value={b.s2}
                      group={2}
                      branchId={b.branchId}
                      manual={branchManual}
                      open={openGroup === 2}
                      onToggle={toggle}
                    />
                    <ScoreCell
                      value={b.s3}
                      group={3}
                      branchId={b.branchId}
                      manual={branchManual}
                      open={openGroup === 3}
                      onToggle={toggle}
                    />
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <NumInput value={b.s4} onChange={(v) => onScore4(b.branchId, v)} />
                        <HandBtn
                          open={openGroup === 4}
                          onClick={() => toggle(b.branchId, 4)}
                          count={countManual(branchManual, 4)}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <NumInput value={b.j} onChange={(v) => onJudgement(b.branchId, v)} />
                        <HandBtn
                          open={openGroup === 5}
                          onClick={() => toggle(b.branchId, 5)}
                          count={countManual(branchManual, 5)}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold">
                      {fmt(b.total)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {b.level && (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${riskLevelClass(
                            b.level,
                          )}`}
                        >
                          {b.level}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        diff == null
                          ? "text-muted-foreground/40"
                          : diff > 0
                          ? "text-rose-600"
                          : diff < 0
                          ? "text-emerald-600"
                          : ""
                      }`}
                    >
                      {diff == null ? "—" : (diff > 0 ? "+" : "") + diff.toFixed(2)}
                    </td>
                  </tr>

                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  Энэ бүсэд салбар байхгүй
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function countManual(branchManual: Record<string, number>, group: CatalogGroup) {
  let c = 0;
  for (const ind of CATALOG_BY_GROUP[group]) {
    if (ind.autoSubid == null && (branchManual[ind.id] ?? 0) > 0) c++;
  }
  return c;
}

function HandBtn({
  open,
  onClick,
  count,
}: {
  open: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      title={`Гарын үзүүлэлт оруулах${count > 0 ? ` (${count} оруулсан)` : ""}`}
      className={`relative p-1 rounded border text-[10px] transition-colors ${
        open
          ? "bg-amber-500/20 border-amber-500/50 text-amber-700"
          : "bg-background border-border hover:bg-accent/40 text-muted-foreground"
      }`}
    >
      <Hand className="w-3 h-3" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full text-[8px] w-3.5 h-3.5 flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}

function ScoreCell({
  value,
  group,
  branchId,
  manual,
  open,
  onToggle,
}: {
  value: number | null;
  group: CatalogGroup;
  branchId: string;
  manual: Record<string, number>;
  open: boolean;
  onToggle: (branchId: string, group: CatalogGroup) => void;
}) {
  return (
    <td className="px-2 py-1.5 text-right">
      <div className="flex items-center justify-end gap-1">
        <span className="tabular-nums">{value == null ? "—" : value.toFixed(2)}</span>
        <HandBtn
          open={open}
          onClick={() => onToggle(branchId, group)}
          count={countManual(manual, group)}
        />
      </div>
    </td>
  );
}

function IndicatorPanelModal({
  group,
  branchId,
  branchName,
  ev,
  manual,
  setManualValue,
  onClose,
}: {
  group: CatalogGroup;
  branchId: string;
  branchName: string;
  ev: BranchCatalogResult | undefined;
  manual: Record<string, number>;
  setManualValue: (branchId: string, indicatorId: string, v: number) => void;
  onClose: () => void;
}) {
  const items = CATALOG_BY_GROUP[group];
  const totalWeight = items.reduce((s: number, i: CatalogIndicator) => s + i.weight, 0);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/40 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Hand className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">
                {GROUP_LABEL[group]} — үзүүлэлтийн задаргаа
              </h3>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{branchName}</span>
              <span className="text-border">·</span>
              <span>
                Нийт жин:{" "}
                <span className="font-semibold text-foreground">{totalWeight}%</span>
              </span>
              <span className="text-border">·</span>
              <span>
                Гарын үзүүлэлт:{" "}
                <span className="font-semibold text-foreground">{MANUAL_COUNT_BY_GROUP[group]}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left w-8">№</th>
                <th className="px-3 py-2.5 text-left">Үзүүлэлт</th>
                <th className="px-3 py-2.5 text-right w-12">Жин</th>
                <th className="px-3 py-2.5 text-center w-24">Эх үүсвэр</th>
                <th className="px-3 py-2.5 text-left">Auto утга</th>
                <th className="px-3 py-2.5 text-right w-16">Оноо</th>
                <th className="px-3 py-2.5 text-right w-24">Гарын оноо</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ind: CatalogIndicator, idx: number) => {
                const v = ev?.values[ind.id];
                const manualV = manual[ind.id] ?? 0;
                const isManual = ind.autoSubid == null;
                return (
                  <tr
                    key={ind.id}
                    className={`border-t border-border/50 transition-colors ${
                      isManual
                        ? "bg-amber-500/5 hover:bg-amber-500/10"
                        : "hover:bg-accent/30"
                    }`}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {ind.name}
                      {ind.hint && (
                        <div className="text-[9px] text-muted-foreground font-normal mt-0.5">
                          {ind.hint}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {ind.weight}%
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isManual ? (
                        <span className="inline-block text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium">
                          Гар
                        </span>
                      ) : (
                        <span className="inline-block text-[9px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium">
                          Auto · S{ind.autoSubid}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-[11px]">
                      {v?.autoRaw ? (
                        <span title={v.autoLabel ?? ""}>
                          {String(v.autoRaw).slice(0, 30)}
                          {v.autoLabel && (
                            <span className="ml-1 text-[9px] text-muted-foreground/60">
                              ({v.autoLabel})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {v?.score != null ? (
                        <span
                          className={`font-semibold ${
                            v.source === "manual"
                              ? "text-amber-600 dark:text-amber-400"
                              : v.source === "auto"
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-muted-foreground/40"
                          }`}
                        >
                          {v.score.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={5}
                        value={manualV || ""}
                        placeholder={isManual ? "0–5" : "override"}
                        onChange={(e) =>
                          setManualValue(branchId, ind.id, Number(e.target.value) || 0)
                        }
                        className="w-20 px-2 py-1.5 text-right text-xs rounded-lg border border-border bg-background text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-colors"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex-shrink-0">
          <p className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">Auto</span> = Oracle
            RESULT-аас тооцоологдсон{" "}
            <span className="mx-1">·</span>
            <span className="font-semibold text-foreground">Гар</span> = гараар
            оруулах шаардлагатай{" "}
            <span className="mx-1">·</span>
            Гарын утга оруулсан бол auto-г дарж гарна{" "}
            <span className="mx-1">·</span>
            Score = Σ(оноо × жин) / Σ(оноотой жин)
          </p>
        </div>
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      step="0.01"
      min={0}
      max={5}
      value={value || ""}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-14 px-1 py-0.5 text-right text-xs rounded border border-border bg-background tabular-nums"
    />
  );
}

function SummaryBlock({
  title,
  cols,
  children,
}: {
  title: string;
  cols: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-bold">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
          <tr>
            {cols.map((c, i) => (
              <th key={c} className={`px-3 py-1.5 ${i === 0 ? "text-left" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function SRow({
  label,
  v,
  prev,
  bold,
}: {
  label: string;
  v: number;
  prev?: number;
  bold?: boolean;
}) {
  return (
    <tr className={`border-t border-border ${bold ? "font-bold bg-muted/30" : ""}`}>
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{v}</td>
      {prev !== undefined && (
        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
          {prev}
        </td>
      )}
    </tr>
  );
}

// computeTotal-г import-аар ашиглаж байгааг tree-shaker-т зориулсан хадгалагч
void computeTotal;
void riskLevel;
