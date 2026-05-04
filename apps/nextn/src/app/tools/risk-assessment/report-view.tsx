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
  AlertTriangle,
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
  riskFilter,
  setRiskFilter,
}: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [activeSnapshot, setActiveSnapshot] = useState<SnapshotMeta | null>(null);
  const [snapshotList, setSnapshotList] = useState<SnapshotMeta[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveNameError, setSaveNameError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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

  // ESC товчоор modal хаах
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expanded) setExpanded(null);
        else if (historyOpen) setHistoryOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, historyOpen]);

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
    () => aggregateBranch(scoredRows),
    [scoredRows],
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

  // Snapshot хадгалах: модал нээх
  const openSaveModal = useCallback(() => {
    setSaveName(new Date().toLocaleDateString("mn-MN"));
    setSaveNameError(null);
    setSaveModalOpen(true);
  }, []);

  // Нэрийг баталгаажуулж ClickHouse-д хадгалах
  const doSaveSnapshot = useCallback(async () => {
    if (!saveName.trim()) {
      setSaveNameError("Тайлангийн нэр хоосон байж болохгүй.");
      return;
    }
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
        name: saveName.trim(),
        payload,
        branchCount: Object.keys(payload).length,
      });
      await loadSnapshotList();
      setSaveModalOpen(false);
      setSaveSuccess(`"${meta.name}" нэртэйгээр амжилттай хадгаллаа.`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (e: any) {
      setSaveNameError(`Хадгалахад алдаа гарлаа: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }, [saveName, aggregates, loadSnapshotList]);

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
      <div className="px-6 py-16 text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-muted border border-border items-center justify-center mb-3">
          <History className="w-5 h-5 text-muted-foreground/60" />
        </div>
        <div className="text-sm font-semibold">Тайлан гаргах өгөгдөл алга</div>
        <div className="text-xs mt-1 text-muted-foreground">
          Эхлээд Oracle-аас үнэлгээг татна уу.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-5">
      {/* ── Toolbar ── */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-[11px] text-muted-foreground max-w-2xl space-y-1.5 leading-relaxed">
            <p className="flex items-start gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <span>
                <b className="text-foreground">Score 4</b> ба{" "}
                <b className="text-foreground">Judgement</b>-ийг гараар оруулна
                (0–5). Бичсэн утга автоматаар хадгалагдана.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
              <span>
                <b className="text-foreground">Хадгалах</b> — одоогийн дүнг нэр өгч
                хадгална. <b className="text-foreground">Түүх</b> — өмнө хадгалснаас
                сонгоход <i>Зөрүү</i>, <i>Үнэлгээний өөрчлөлт</i>,{" "}
                <i>Түвшин өөрчлөлт</i> тооцогдоно.
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openSaveModal}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm shadow-violet-500/20 disabled:opacity-50 transition-all"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-all"
            >
              <History className="w-3.5 h-3.5" />
              Түүх
              {snapshotList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-[10px] tabular-nums font-bold">
                  {snapshotList.length}
                </span>
              )}
            </button>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
          {/* Risk filter */}
          <div className="flex rounded-lg border border-border overflow-hidden bg-background/60">
            {(["all", "Өндөр", "Дунд", "Бага"] as const).map((opt) => {
              const colors: Record<string, string> = {
                all: "text-foreground",
                Өндөр: "text-rose-600 dark:text-rose-400",
                Дунд: "text-amber-600 dark:text-amber-400",
                Бага: "text-emerald-600 dark:text-emerald-400",
              };
              const dot: Record<string, string> = {
                all: "bg-muted-foreground",
                Өндөр: "bg-rose-500",
                Дунд: "bg-amber-500",
                Бага: "bg-emerald-500",
              };
              return (
                <button
                  key={opt}
                  onClick={() => setRiskFilter(opt)}
                  className={`px-3 py-1.5 text-[11px] font-semibold border-r last:border-r-0 border-border flex items-center gap-1.5 transition-all ${
                    riskFilter === opt
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      : `hover:bg-accent/60 ${colors[opt]}`
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dot[opt]}`} />
                  {opt === "all" ? "Бүгд" : opt}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-[11px]">
            {manualLoading && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Гарын утга ачаалж байна…
              </span>
            )}
            {activeSnapshot && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  Харьцуулж буй:{" "}
                  <b>{activeSnapshot.name}</b>
                </span>
                <button
                  onClick={clearActiveSnapshot}
                  className="text-rose-600 hover:text-rose-700 ml-1"
                  title="Харьцуулалт цуцлах"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          {saveSuccess}
          <button onClick={() => setSaveSuccess(null)} className="ml-auto p-1 rounded hover:bg-emerald-500/20">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <ReportTable
        title="Улаанбаатар хотын Бизнес төв, салбар, тооцооны төвүүд"
        region="UB"
        rows={ub}
        snapshot={snapshot}
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

      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => { if (!saving) setSaveModalOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-violet-500/10 to-transparent flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Save className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Тайлан хадгалах</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Одоогийн дүнг нэрлэж хадгална. Дараа нь харьцуулахад ашиглана.
                </p>
              </div>
              <button
                onClick={() => setSaveModalOpen(false)}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Хаах"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Тайлангийн нэр
                </label>
                <input
                  autoFocus
                  type="text"
                  value={saveName}
                  onChange={(e) => { setSaveName(e.target.value); setSaveNameError(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") doSaveSnapshot();
                    if (e.key === "Escape") setSaveModalOpen(false);
                  }}
                  placeholder="жишээ нь: 2026Q1, 2025-12-31, Сарын тайлан 04"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    saveNameError
                      ? "border-red-500/50 focus:ring-red-500/40 focus:border-red-500/60"
                      : "border-border focus:ring-violet-500/40 focus:border-violet-500/60"
                  } bg-background text-sm focus:outline-none focus:ring-2 transition-all`}
                />
                {saveNameError && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {saveNameError}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                <button
                  onClick={() => setSaveModalOpen(false)}
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Цуцлах
                </button>
                <button
                  onClick={doSaveSnapshot}
                  disabled={saving || !saveName.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm shadow-violet-500/20 disabled:opacity-50 transition-all"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-card flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-blue-500/10 to-transparent flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Хадгалсан тайлангийн түүх</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Сонгосон тайлан «өмнөх үе» болж зөрүү тооцоонд орно.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onRefresh}
              className="text-xs px-2 py-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Шинэчлэх"
            >
              ↻
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Хаах"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2 text-blue-500" />
              Уншиж байна…
            </div>
          ) : list.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-muted border border-border items-center justify-center mb-3">
                <History className="w-5 h-5 text-muted-foreground/60" />
              </div>
              <div className="text-sm font-semibold">Хадгалсан тайлан алга</div>
              <div className="text-xs text-muted-foreground mt-1">
                «Хадгалах» товчоор эхний тайлангаа үүсгээрэй.
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Нэр</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Хадгалсан</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Салбар</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Огноо</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const isActive = s.id === activeId;
                  return (
                    <tr
                      key={s.id}
                      className={`border-t border-border transition-colors ${
                        isActive ? "bg-emerald-500/8" : "hover:bg-accent/40"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium">
                        {s.name}
                        {isActive && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            Идэвхтэй
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString("mn-MN")}
                        {s.createdByName && (
                          <div className="text-[10px] mt-0.5 opacity-70">
                            · {s.createdByName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {s.branchCount}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums text-[11px]">
                        {s.pDateBeg && s.pDate ? `${s.pDateBeg} → ${s.pDate}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => onApply(s)}
                          disabled={isActive}
                          className="px-2.5 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 text-[11px] font-semibold mr-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Сонгох
                        </button>
                        <button
                          onClick={() => onDelete(s.id)}
                          className="text-rose-600 hover:bg-rose-500/10 p-1.5 rounded-md transition-colors"
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
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold ${
              region === "UB"
                ? "bg-blue-500/15 text-blue-600 border border-blue-500/25"
                : "bg-violet-500/15 text-violet-600 border border-violet-500/25"
            }`}
          >
            {region}
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground px-2 py-0.5 rounded-full bg-background border border-border">
            {rows.length} салбар
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">Жин:</span>
          <span>S1 <b className="text-foreground tabular-nums">{(w.s1 * 100).toFixed(0)}%</b></span>
          <span>S2 <b className="text-foreground tabular-nums">{(w.s2 * 100).toFixed(0)}%</b></span>
          <span>S3 <b className="text-foreground tabular-nums">{(w.s3 * 100).toFixed(0)}%</b></span>
          <span>S4 <b className="text-foreground tabular-nums">{(w.s4 * 100).toFixed(0)}%</b></span>
          <span>J <b className="text-foreground tabular-nums">{(w.j * 100).toFixed(0)}%</b></span>
          <span className="ml-auto flex items-center gap-1 italic">
            <Hand className="w-3 h-3" /> товчоор гарын үзүүлэлт оруулна
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">№</th>
              <th className="px-2 py-2 text-left font-semibold">SOL</th>
              <th className="px-2 py-2 text-left font-semibold">Салбарын нэр</th>
              <th className="px-2 py-2 text-center font-semibold">Зэрэглэл</th>
              <th className="px-2 py-2 text-right font-semibold">Score 1</th>
              <th className="px-2 py-2 text-right font-semibold">Score 2</th>
              <th className="px-2 py-2 text-right font-semibold">Score 3</th>
              <th className="px-2 py-2 text-right font-semibold">Score 4</th>
              <th className="px-2 py-2 text-right font-semibold">Judgement</th>
              <th className="px-2 py-2 text-right font-semibold">Total</th>
              <th className="px-2 py-2 text-center font-semibold">Түвшин</th>
              <th className="px-2 py-2 text-right font-semibold">Зөрүү</th>
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
                        <span className="tabular-nums text-xs w-14 text-right inline-block">{fmt(b.s4 ?? null)}</span>
                        <HandBtn
                          open={openGroup === 4}
                          onClick={() => toggle(b.branchId, 4)}
                          count={countManual(branchManual, 4)}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <NumInput value={manualMap[b.branchId]?.["j-001"] ?? 0} onChange={(v) => setManualValue(b.branchId, "j-001", v)} />
                        <HandBtn
                          open={openGroup === 5}
                          onClick={() => toggle(b.branchId, 5)}
                          count={countManual(branchManual, 5)}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold">
                      <span className={b.total != null && b.total >= 3.5 ? "text-rose-600 dark:text-rose-400" : b.total != null && b.total >= 2.5 ? "text-amber-600 dark:text-amber-400" : b.total != null ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                        {fmt(b.total)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {b.level && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${riskLevelClass(
                            b.level,
                          )}`}
                        >
                          {b.level}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums font-medium ${
                        diff == null
                          ? "text-muted-foreground/40"
                          : diff > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : diff < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {diff == null
                        ? "—"
                        : diff === 0
                        ? "0.00"
                        : diff > 0
                        ? `▲ +${diff.toFixed(2)}`
                        : `▼ ${diff.toFixed(2)}`}
                    </td>
                  </tr>

                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                  <div className="text-xs">Энэ бүсэд тохирох салбар олдсонгүй</div>
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
      className={`relative inline-flex items-center justify-center w-6 h-6 rounded-md border transition-all ${
        open
          ? "bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/30"
          : count > 0
          ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
          : "bg-background border-border text-muted-foreground hover:bg-accent hover:border-amber-500/30 hover:text-amber-600"
      }`}
    >
      <Hand className="w-3 h-3" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full text-[8px] w-3.5 h-3.5 flex items-center justify-center font-bold ring-1 ring-card">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent flex-shrink-0">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Hand className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                {GROUP_LABEL[group]} — үзүүлэлтийн задаргаа
              </h3>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground truncate max-w-xs">{branchName}</span>
                <span className="text-border">·</span>
                <span>
                  Нийт жин:{" "}
                  <span className="font-semibold text-foreground tabular-nums">{totalWeight}%</span>
                </span>
                <span className="text-border">·</span>
                <span>
                  Гарын үзүүлэлт:{" "}
                  <span className="font-semibold text-foreground tabular-nums">{MANUAL_COUNT_BY_GROUP[group]}</span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title="Хаах (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Гараар оруулсан зүйлсийн хураангуй ── */}
        {(() => {
          const filled = items.filter(
            (ind: CatalogIndicator) => ind.autoSubid == null && (manual[ind.id] ?? 0) > 0,
          );
          const empty = items.filter(
            (ind: CatalogIndicator) => ind.autoSubid == null && !(manual[ind.id] ?? 0),
          );
          return (
            <div className="px-5 py-3 border-b border-amber-500/20 bg-amber-500/5 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Hand className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  Гараар оруулах үзүүлэлтүүд
                </span>
                <span className="ml-auto text-[10px] tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                  {filled.length} / {filled.length + empty.length} оруулсан
                </span>
              </div>
              {filled.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">
                  Одоогоор ямар ч гарын утга оруулаагүй байна.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filled.map((ind: CatalogIndicator) => (
                    <span
                      key={ind.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                    >
                      {ind.name}
                      <span className="font-bold tabular-nums">
                        → {manual[ind.id]}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {empty.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {empty.map((ind: CatalogIndicator) => (
                    <span
                      key={ind.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full border border-dashed border-amber-400/40 text-[10px] text-muted-foreground"
                    >
                      {ind.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

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
                <th className="px-3 py-2.5 text-right w-28">Гарын оноо</th>
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
                        ? "bg-amber-500/5 hover:bg-amber-500/8"
                        : "opacity-70 hover:opacity-90 hover:bg-accent/20"
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
                      {isManual ? (
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          max={5}
                          value={manualV || ""}
                          placeholder="0–5"
                          onChange={(e) =>
                            setManualValue(branchId, ind.id, Number(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1.5 text-right text-xs rounded-lg border border-amber-500/40 bg-background text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-colors"
                        />
                      ) : (
                        <div
                          className="w-20 inline-flex items-center justify-end gap-1 px-2 py-1.5 rounded-lg border border-border/40 bg-muted/40 text-muted-foreground/50 text-xs cursor-not-allowed select-none"
                          title="Auto үзүүлэлтийг гараар засах боломжгүй"
                        >
                          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-[10px]">auto</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex-shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">Гар</span>
            {" "}— гараар оруулах, засах боломжтой
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Auto</span>
            {" "}— Oracle-аас автоматаар тооцоологдсон, засах боломжгүй
          </span>
          <span className="text-border">·</span>
          <span>Score = Σ(оноо × жин) / Σ(оноотой жин)</span>
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
      className="w-14 px-1.5 py-0.5 text-right text-xs rounded-md border border-border bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
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
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-3.5 py-2.5 border-b border-border bg-gradient-to-r from-blue-500/5 to-transparent text-xs font-bold uppercase tracking-wider text-foreground">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
          <tr>
            {cols.map((c, i) => (
              <th key={c} className={`px-3 py-1.5 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>
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
  const diff = prev !== undefined ? v - prev : null;
  return (
    <tr className={`border-t border-border transition-colors ${bold ? "font-bold bg-muted/30" : "hover:bg-accent/30"}`}>
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{v}</td>
      {prev !== undefined && (
        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
          <span>{prev}</span>
          {diff !== null && diff !== 0 && (
            <span className={`ml-1.5 text-[10px] font-semibold ${diff > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {diff > 0 ? `+${diff}` : diff}
            </span>
          )}
        </td>
      )}
    </tr>
  );
}

// computeTotal-г import-аар ашиглаж байгааг tree-shaker-т зориулсан хадгалагч
void computeTotal;
void riskLevel;
