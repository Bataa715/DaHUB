import type { RiskCurrentRow } from "@/lib/api";
import {
  computeScoreDynamic,
  scoreColorClass,
  scoreDisplay,
  detectRegion,
  computeTotal,
  riskLevel,
  type ScoreGroup,
  type ScoreResult,
  type BranchAggregate,
} from "./scoring-rules";
import type { DynamicCatalogIndicator } from "./use-indicator-config";

export type RiskRow = RiskCurrentRow;

export type ScoredRow = RiskRow & {
  __score: ScoreResult;
  __scoreLabel: string | null;
  __group: ScoreGroup | null;
};

export type FilterKey = "all" | ScoreGroup | "Score 4";

export type BranchGroup = {
  branchId: string;
  branchName: string;
  solid: string;
  rows: ScoredRow[];
};

export type GroupOption = { key: FilterKey; label: string; cls: string };

export const GROUP_OPTIONS: GroupOption[] = [
  { key: "all", label: "Бүгд", cls: "text-foreground" },
  { key: "Score 1", label: "Score 1", cls: "text-rose-600" },
  { key: "Score 2", label: "Score 2", cls: "text-amber-600" },
  { key: "Score 3", label: "Score 3", cls: "text-blue-600" },
  { key: "Score 4", label: "Score 4", cls: "text-violet-600" },
];

export const fmt = (n: number | null | undefined) =>
  n == null || n === 0 ? "—" : n.toFixed(2);

export function getScore4Subids(
  catalog: DynamicCatalogIndicator[],
): Set<number> {
  return new Set(
    catalog
      .filter((i) => i.group === 4 && !i.is_manual)
      .map((i) => Number(i.subid))
      .filter((n) => !Number.isNaN(n)),
  );
}

export function buildScoredRows(
  rows: RiskRow[],
  catalog: DynamicCatalogIndicator[],
): ScoredRow[] {
  if (catalog.length === 0) return [];
  return rows.map((r) => {
    const subidStr = String(r.SUBID ?? "").trim();
    const ind = catalog.find((c) => !c.is_manual && c.subid === subidStr);
    const { score, label } = ind
      ? computeScoreDynamic(
          ind.score_scale ?? "",
          r.RESULT as string | number | null,
          r.RESULT_TYPE as string | number | null,
        )
      : { score: null as ScoreResult, label: null };
    const g = ind?.group;
    const grp: ScoreGroup | null =
      g === 1
        ? "Score 1"
        : g === 2
          ? "Score 2"
          : g === 3
            ? "Score 3"
            : g === 4
              ? "Score 4"
              : null;
    return { ...r, __score: score, __scoreLabel: label, __group: grp };
  });
}

export function aggregateFromScoredRows(rows: ScoredRow[]): BranchAggregate[] {
  const map = new Map<
    string,
    {
      branchId: string;
      branchName: string;
      solid: string;
      rating: string;
      sums: Record<ScoreGroup, { sum: number; cnt: number }>;
    }
  >();

  for (const r of rows) {
    const key = String(r.SOLID || "");
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        branchId: key,
        branchName: String(r.BRANCHNAME ?? ""),
        solid: key,
        rating: "",
        sums: {
          "Score 1": { sum: 0, cnt: 0 },
          "Score 2": { sum: 0, cnt: 0 },
          "Score 3": { sum: 0, cnt: 0 },
          "Score 4": { sum: 0, cnt: 0 },
        },
      });
    }
    const acc = map.get(key)!;
    if (Number(r.SUBID) === 6 && r.RESULT != null) {
      acc.rating = String(r.RESULT).trim();
    }
    const score = r.__score;
    const grp = r.__group;
    if (typeof score === "number" && score > 0 && grp) {
      acc.sums[grp].sum += score;
      acc.sums[grp].cnt += 1;
    }
  }

  const list: BranchAggregate[] = [];
  for (const acc of map.values()) {
    const s1 = acc.sums["Score 1"].cnt
      ? acc.sums["Score 1"].sum / acc.sums["Score 1"].cnt
      : null;
    const s2 = acc.sums["Score 2"].cnt
      ? acc.sums["Score 2"].sum / acc.sums["Score 2"].cnt
      : null;
    const s3 = acc.sums["Score 3"].cnt
      ? acc.sums["Score 3"].sum / acc.sums["Score 3"].cnt
      : null;
    const s4 = acc.sums["Score 4"].cnt
      ? acc.sums["Score 4"].sum / acc.sums["Score 4"].cnt
      : null;
    const region = detectRegion(acc.rating);
    const total = computeTotal(region, s1, s2, s3, s4, null);
    list.push({
      branchId: acc.branchId,
      branchName: acc.branchName,
      solid: acc.solid,
      rating: acc.rating || "—",
      region,
      s1,
      s2,
      s3,
      s4,
      j: null,
      total,
      level: riskLevel(total),
    });
  }
  return list;
}

export function sortByTotalDesc(list: BranchAggregate[]): BranchAggregate[] {
  return [...list].sort((a, b) => {
    const ta = a.total ?? -Infinity;
    const tb = b.total ?? -Infinity;
    if (tb !== ta) return tb - ta;
    return a.solid.localeCompare(b.solid, undefined, { numeric: true });
  });
}

export function ScoreBadge({ row }: { row: ScoredRow }) {
  if (row.__score == null)
    return <span className="text-muted-foreground/50 text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded border text-[11px] font-bold ${scoreColorClass(row.__score)}`}
      title={
        row.__scoreLabel
          ? `${row.__group} · ${row.__scoreLabel}`
          : (row.__group ?? "")
      }
    >
      {scoreDisplay(row.__score)}
    </span>
  );
}

export function filterScoredRows(
  rows: ScoredRow[],
  search: string,
  groupFilter: FilterKey,
  catalog: DynamicCatalogIndicator[],
): ScoredRow[] {
  const score4Subids = getScore4Subids(catalog);
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (groupFilter !== "all") {
      if (groupFilter === "Score 4") {
        if (!score4Subids.has(Number(r.SUBID))) return false;
      } else if (r.__group !== groupFilter) {
        return false;
      }
    }
    if (!q) return true;
    return [
      r.SOLID,
      r.BRANCHNAME,
      r.RESULT,
      r.DESCRIPTION_TEXT,
      r.ID,
      r.SUBID,
      r.OPERATION_TYPE,
      r.__score,
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .some((s) => s.includes(q));
  });
}

export function groupScoredByBranch(
  rows: ScoredRow[],
  aggregates: BranchAggregate[],
): BranchGroup[] {
  const m = new Map<string, BranchGroup>();
  for (const r of rows) {
    const key = String(r.SOLID ?? "");
    if (!m.has(key)) {
      m.set(key, {
        branchId: String(r.SOLID ?? ""),
        branchName: String(r.BRANCHNAME ?? ""),
        solid: String(r.SOLID ?? ""),
        rows: [],
      });
    }
    m.get(key)!.rows.push(r);
  }
  return Array.from(m.values()).sort((a, b) => {
    const aggA = aggregates.find((x) => x.branchId === a.branchId);
    const aggB = aggregates.find((x) => x.branchId === b.branchId);
    const ta = aggA?.total ?? -Infinity;
    const tb = aggB?.total ?? -Infinity;
    if (tb !== ta) return tb - ta;
    return a.branchName.localeCompare(b.branchName, "mn");
  });
}

export function downloadScoredCsv(rows: ScoredRow[], filename: string) {
  const cols = [
    "SOLID",
    "BRANCHNAME",
    "RESULT",
    "RESULT_TYPE",
    "DESCRIPTION_TEXT",
    "P_DATEBEG",
    "P_DATE",
    "ID",
    "SUBID",
    "OPERATION_TYPE",
    "SCORE_GROUP",
    "SCORE",
    "SCORE_LABEL",
  ] as const;
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cols.join(","),
    ...rows.map((r) =>
      cols
        .map((c) => {
          if (c === "SCORE_GROUP") return escape(r.__group ?? "");
          if (c === "SCORE") return escape(r.__score ?? "");
          if (c === "SCORE_LABEL") return escape(r.__scoreLabel ?? "");
          return escape((r as unknown as Record<string, unknown>)[c]);
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
