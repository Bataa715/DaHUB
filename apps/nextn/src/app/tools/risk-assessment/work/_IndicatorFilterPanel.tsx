"use client";

import { useMemo } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import {
  evaluateBranchDynamic,
  type DynamicCatalogIndicator,
} from "../use-indicator-config";
import type { RiskCurrentRow } from "@/lib/api";

interface Props {
  rows: RiskCurrentRow[];
  catalog: DynamicCatalogIndicator[];
  selectedIndId: string;
  onSelectInd: (id: string) => void;
  onClose: () => void;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export default function IndicatorFilterPanel({
  rows,
  catalog,
  selectedIndId,
  onSelectInd,
  onClose,
}: Props) {
  // Indicator-уудыг бүлгээр нь ангилах
  const byGroup = useMemo(() => {
    const m = new Map<number, DynamicCatalogIndicator[]>();
    for (const c of [...catalog].sort(
      (a, b) => a.group - b.group || Number(a.subid) - Number(b.subid),
    )) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    return m;
  }, [catalog]);

  const selectedInd = catalog.find((c) => c.id === selectedIndId) ?? null;

  // Oracle мөрүүдийг SOLID-аар бүлэглэх
  const byBranch = useMemo(() => {
    const m = new Map<string, { name: string; oracleRows: RiskCurrentRow[] }>();
    for (const r of rows) {
      if (r.rowType !== "oracle") continue;
      const id = String(r.SOLID ?? "");
      if (!id) continue;
      if (!m.has(id)) m.set(id, { name: String(r.BRANCHNAME ?? ""), oracleRows: [] });
      m.get(id)!.oracleRows.push(r);
    }
    return m;
  }, [rows]);

  // Сонгосон indicator-ийн оноог салбар бүрт тооцох
  const branchScores = useMemo(() => {
    if (!selectedInd) return [];
    return [...byBranch.entries()]
      .map(([solid, b]) => {
        const ev = evaluateBranchDynamic(catalog, b.oracleRows, undefined);
        const val = ev[selectedInd.id];
        return {
          solid,
          name: b.name,
          score: val?.score ?? null,
          source: val?.source ?? ("none" as const),
          autoRaw: val?.autoRaw ?? "",
        };
      })
      .sort((a, b) => Number(a.solid) - Number(b.solid) || a.solid.localeCompare(b.solid));
  }, [selectedInd, byBranch, catalog]);

  const filledCount = branchScores.filter((b) => b.score != null).length;
  const avgScore =
    filledCount > 0
      ? branchScores.reduce((s, b) => s + (typeof b.score === "number" ? b.score : 0), 0) /
        filledCount
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b-2 border-border shrink-0 bg-card">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <SlidersHorizontal className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-base font-bold tracking-tight">
            Indicator харагдац
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Selector bar */}
      <div className="px-6 py-3 border-b border-border bg-muted/20 shrink-0 flex items-center gap-3 flex-wrap">
        <select
          value={selectedIndId}
          onChange={(e) => onSelectInd(e.target.value)}
          className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/30 min-w-[300px] cursor-pointer"
        >
          <option value="">— Indicator сонгох —</option>
          {[...byGroup.entries()].map(([grp, inds]) => (
            <optgroup key={grp} label={`── Score ${grp} ──`}>
              {inds.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {selectedInd && (
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                selectedInd.is_manual
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
              }`}
            >
              {selectedInd.is_manual ? "Гар оруулга" : "Автомат"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Score {selectedInd.group}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">
              {filledCount}/{branchScores.length} салбар үнэлэгдсэн
            </span>
            {avgScore != null && (
              <>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] font-semibold text-foreground/70">
                  Дундаж: {avgScore.toFixed(2)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {selectedInd ? (
      <div className="flex-1 overflow-auto px-6 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 sticky top-0 z-10">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-9">
                  #
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Салбарын нэр
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">
                  SOLID
                </th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                  Oracle утга
                </th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">
                  Оноо
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {branchScores.map((b, i) => (
                <tr key={b.solid} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground/40 tabular-nums text-[11px]">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[12px]">{b.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                    {b.solid}
                  </td>
                  {/* Oracle raw result */}
                  <td className="px-4 py-2.5 text-right">
                    {b.autoRaw ? (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {b.autoRaw}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-[11px]">—</span>
                    )}
                  </td>
                  {/* Score — big bold number */}
                  <td className="px-4 py-2.5 text-right">
                    {b.score != null ? (
                      <span
                        className={`inline-block tabular-nums font-bold text-xl leading-none ${
                          b.source === "manual"
                            ? "text-amber-500"
                            : b.score >= 4
                              ? "text-red-500"
                              : b.score >= 3
                                ? "text-orange-500"
                                : b.score >= 2
                                  ? "text-yellow-500"
                                  : "text-emerald-500"
                        }`}
                      >
                        {b.score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xl font-bold">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Дээрхээс indicator сонгоно уу
          </p>
        </div>
      )}
    </div>
  );
}
