"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { abFetchDashboards, abFetchDashboardTop } from "../_lib/api";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard,
  Loader2,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  TrendingUp,
  Hash,
} from "lucide-react";

interface Dashboard {
  id: number;
  name: string;
  tableName: string;
  cifColumn: string;
  dateColumn: string | null;
  amountColumn: string | null;
  enabled: boolean;
}

interface TopRow {
  cif: string;
  count: number;
  totalAmount: number;
}

interface DetailState {
  status: "idle" | "loading" | "done" | "error";
  hasAmount: boolean;
  rows: TopRow[];
  error?: string;
}

function fmt(n: number) {
  return n.toLocaleString("mn-MN");
}

export default function DashboardsPage() {
  const { t } = useLanguage();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [detail, setDetail] = useState<DetailState>({
    status: "idle",
    hasAmount: false,
    rows: [],
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    abFetchDashboards()
      .then(setDashboards)
      .catch((e) => setError(e?.message || t("dashOracleError")))
      .finally(() => setLoading(false));
  }, []);

  const loadDetail = useCallback((id: number, s = "") => {
    setDetail({ status: "loading", hasAmount: false, rows: [] });
    abFetchDashboardTop(id, 10, s)
      .then((res) =>
        setDetail({ status: "done", hasAmount: res.hasAmount, rows: res.rows }),
      )
      .catch((e) =>
        setDetail({
          status: "error",
          hasAmount: false,
          rows: [],
          error: e?.message || t("dashOracleError"),
        }),
      );
  }, []);

  const handleOpen = (id: number) => {
    if (openId === id) {
      setOpenId(null);
      setSearch("");
      return;
    }
    setOpenId(id);
    setSearch("");
    loadDetail(id, "");
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (openId !== null) loadDetail(openId, val);
    }, 400);
  };

  const filtered = dashboards.filter(
    (d) =>
      listSearch === "" ||
      d.name.toLowerCase().includes(listSearch.toLowerCase()) ||
      String(d.id).includes(listSearch),
  );

  return (
    <div className="space-y-5">
      <ToolPageHeader
        href="/tools"
        icon={<LayoutDashboard size={16} className="text-violet-400" />}
        title="Dashboards"
        subtitle={`Oracle ${t("dashTitle")} ${dashboards.length} dashboard`}
      />

      <div className="px-6 space-y-4">
        {/* List search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim"
          />
          <input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder={t("dashSearchPlaceholder")}
            className="w-full bg-surface-card border border-surface-border rounded-xl pl-8 pr-4 py-2 text-[12px] text-txt placeholder:text-txt-dim outline-none focus:border-golomt-500/50"
          />
          {listSearch && (
            <button
              onClick={() => setListSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-dim hover:text-txt"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-golomt-400" />
            <span className="text-[12px] text-txt-dim ml-3">
              {t("dashLoading")}
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="rounded-xl border border-surface-border overflow-hidden divide-y divide-surface-border/50">
            {filtered.map((d) => {
              const isOpen = openId === d.id;
              return (
                <div key={d.id}>
                  {/* Row */}
                  <button
                    onClick={() => handleOpen(d.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                  >
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-11 h-6 rounded-md bg-golomt-500/10 border border-golomt-500/20 text-golomt-400 font-bold text-[11px]">
                      DB{d.id}
                    </span>
                    <span className="flex-1 text-[12px] text-txt font-medium leading-relaxed">
                      {d.name}
                    </span>
                    {isOpen ? (
                      <ChevronDown
                        size={14}
                        className="text-txt-dim flex-shrink-0"
                      />
                    ) : (
                      <ChevronRight
                        size={14}
                        className="text-txt-dim flex-shrink-0"
                      />
                    )}
                  </button>

                  {/* Detail panel */}
                  {isOpen && (
                    <div className="border-t border-surface-border/50 bg-surface-hover/40 px-4 py-3 space-y-3">
                      {/* Sub-search */}
                      <div className="relative">
                        <Search
                          size={12}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-dim"
                        />
                        <input
                          value={search}
                          onChange={(e) => handleSearch(e.target.value)}
                          placeholder={t("dashCifSearch")}
                          className="w-full bg-surface-card border border-surface-border rounded-lg pl-7 pr-4 py-1.5 text-[11px] text-txt placeholder:text-txt-dim outline-none focus:border-golomt-500/50"
                        />
                        {search && (
                          <button
                            onClick={() => {
                              setSearch("");
                              loadDetail(d.id, "");
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-dim hover:text-txt"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>

                      {/* Loading */}
                      {detail.status === "loading" && (
                        <div className="flex items-center gap-2 py-4 justify-center">
                          <Loader2
                            size={14}
                            className="animate-spin text-golomt-400"
                          />
                          <span className="text-[11px] text-txt-dim">
                            {t("dashOracleLoading")}
                          </span>
                        </div>
                      )}

                      {/* Error */}
                      {detail.status === "error" && (
                        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-3 space-y-2">
                          <p className="text-[11px] text-red-400 font-semibold flex items-start gap-1.5">
                            <span className="mt-px">⚠</span>
                            <span>{t("dashOracleError")}</span>
                          </p>
                          <p className="text-[10.5px] text-red-300/80 font-mono whitespace-pre-wrap break-all leading-relaxed">
                            {detail.error}
                          </p>
                          <button
                            onClick={() => loadDetail(d.id, search)}
                            className="text-[10px] text-red-400 border border-red-500/30 rounded px-2 py-0.5 hover:bg-red-500/10 transition-colors"
                          >
                            {t("dashRetry")}
                          </button>
                        </div>
                      )}

                      {/* Table */}
                      {detail.status === "done" && (
                        <>
                          {detail.rows.length === 0 ? (
                            <p className="text-[11px] text-txt-dim text-center py-4">
                              {t("dashNoData")}
                            </p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border border-surface-border">
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-surface-card border-b border-surface-border">
                                    <th className="px-3 py-2 text-left text-txt-dim font-semibold w-6">
                                      #
                                    </th>
                                    <th className="px-3 py-2 text-left text-txt-dim font-semibold">
                                      CIF
                                    </th>
                                    <th className="px-3 py-2 text-right text-txt-dim font-semibold">
                                      <span className="flex items-center justify-end gap-1">
                                        <Hash size={10} />{" "}
                                        {t("alertTransactions")}
                                      </span>
                                    </th>
                                    {detail.hasAmount && (
                                      <th className="px-3 py-2 text-right text-txt-dim font-semibold">
                                        <span className="flex items-center justify-end gap-1">
                                          <TrendingUp size={10} />{" "}
                                          {t("alertTotalAmount")} (₮)
                                        </span>
                                      </th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.rows.map((row, i) => (
                                    <tr
                                      key={i}
                                      className="border-b border-surface-border/40 hover:bg-surface-hover transition-colors last:border-0"
                                    >
                                      <td className="px-3 py-2 text-txt-dim">
                                        {i + 1}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-golomt-300 font-medium">
                                        {row.cif}
                                      </td>
                                      <td className="px-3 py-2 text-right text-txt font-mono">
                                        {fmt(row.count)}
                                      </td>
                                      {detail.hasAmount && (
                                        <td className="px-3 py-2 text-right text-amber-300 font-mono font-semibold">
                                          {fmt(row.totalAmount)}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <p className="text-[10px] text-txt-dim text-right">
                            {t("dataDocDbLabel")}: {d.tableName}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div className="px-4 py-10 text-center text-[12px] text-txt-dim">
                {t("dashNoResults")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
