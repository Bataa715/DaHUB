"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  abFetchDashboards,
  abFetchDashboardTop,
  abFetchDashboardSummaries,
} from "../_lib/api";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  LayoutDashboard,
  Loader2,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  TrendingUp,
  Hash,
  Brain,
  AlertTriangle,
  Database,
  RefreshCw,
} from "lucide-react";

// ML загварт суурилсан dashboard-уудын ID — нийлбэр тооцоололд оруулахгүй
const ML_IDS = new Set([13, 14, 15, 16]);

// Өнгийн palette
const BAR_COLORS = [
  "#6366f1",
  "#818cf8",
  "#a78bfa",
  "#c084fc",
  "#e879f9",
  "#f472b6",
  "#fb7185",
  "#f97316",
  "#facc15",
  "#34d399",
];

interface Dashboard {
  id: number;
  name: string;
  tableName: string;
  cifColumn: string;
  dateColumn: string | null;
  amountColumn: string | null;
  enabled: boolean;
}

interface Summary {
  id: number;
  name: string;
  totalCount: number | null;
  totalAmount: number | null;
  hasAmount: boolean;
  error?: string;
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

function fmtShort(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}Т`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}К`;
  return n.toLocaleString("mn-MN");
}

function fmtFull(n: number) {
  return n.toLocaleString("mn-MN");
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  hasAmount?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as TopRow;
  const isAmt = payload[0]?.dataKey === "totalAmount";
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-[11px] shadow-xl">
      <p className="font-mono font-bold text-foreground mb-1">{d.cif}</p>
      <p className="text-muted-foreground">
        Гүйлгээ:{" "}
        <span className="text-foreground font-semibold">
          {fmtFull(d.count)}
        </span>
      </p>
      {isAmt && d.totalAmount > 0 && (
        <p className="text-muted-foreground">
          Дүн:{" "}
          <span className="text-amber-400 font-semibold">
            ₮{fmtFull(d.totalAmount)}
          </span>
        </p>
      )}
    </div>
  );
}

function DetailPanel({
  d,
  detail,
  search,
  onSearch,
  onRetry,
}: {
  d: Dashboard;
  detail: DetailState;
  search: string;
  onSearch: (v: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border/50 bg-muted/10">
      <div className="relative max-w-xs">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="CIF хайх…"
          className="w-full bg-background border border-border rounded-lg pl-7 pr-8 py-1.5 text-[11px] placeholder:text-muted-foreground/60 outline-none focus:border-violet-500/50"
        />
        {search && (
          <button
            onClick={() => onSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {detail.status === "loading" && (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[11px]">Oracle-с татаж байна…</span>
        </div>
      )}

      {detail.status === "error" && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-3 space-y-1.5">
          <p className="text-[11px] text-red-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle size={12} /> Алдаа гарлаа
          </p>
          <p className="text-[10px] text-red-300/70 font-mono whitespace-pre-wrap break-all">
            {detail.error}
          </p>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-[10px] text-red-400 border border-red-500/30 rounded px-2 py-0.5 hover:bg-red-500/10 transition-colors"
          >
            <RefreshCw size={10} /> Дахин оролдох
          </button>
        </div>
      )}

      {detail.status === "done" && detail.rows.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-8">
          Өгөгдөл олдсонгүй
        </p>
      )}

      {detail.status === "done" && detail.rows.length > 0 && (
        <div className="space-y-4">
          {/* Chart */}
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {detail.hasAmount
                ? "Гүйлгээний дүн (₮) — Top CIFs"
                : "Гүйлгээний тоо — Top CIFs"}
            </p>
            <ResponsiveContainer
              width="100%"
              height={Math.max(180, detail.rows.length * 30)}
            >
              <BarChart
                data={[...detail.rows].reverse()}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={fmtShort}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="cif"
                  width={82}
                  tick={{
                    fontSize: 9,
                    fontFamily: "monospace",
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar
                  dataKey={detail.hasAmount ? "totalAmount" : "count"}
                  radius={[0, 5, 5, 0]}
                >
                  {[...detail.rows].reverse().map((_, i) => (
                    <Cell
                      key={i}
                      fill={BAR_COLORS[i % BAR_COLORS.length]}
                      fillOpacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium w-7">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium">
                    CIF
                  </th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Hash size={9} />
                      Тоо
                    </span>
                  </th>
                  {detail.hasAmount && (
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                      <span className="flex items-center justify-end gap-1">
                        <TrendingUp size={9} />
                        Дүн (₮)
                      </span>
                    </th>
                  )}
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row, i) => {
                  const maxVal = detail.hasAmount
                    ? Math.max(...detail.rows.map((r) => r.totalAmount))
                    : Math.max(...detail.rows.map((r) => r.count));
                  const val = detail.hasAmount ? row.totalAmount : row.count;
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return (
                    <tr
                      key={i}
                      className="border-b border-border/40 hover:bg-muted/20 transition-colors last:border-0"
                    >
                      <td className="px-3 py-2 text-muted-foreground/50 tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 font-mono text-violet-400 font-medium">
                        {row.cif}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {fmtFull(row.count)}
                      </td>
                      {detail.hasAmount && (
                        <td className="px-3 py-2 text-right font-mono text-amber-400 font-semibold tabular-nums">
                          {fmtShort(row.totalAmount)}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor:
                                BAR_COLORS[i % BAR_COLORS.length],
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-right font-mono">
            {d.tableName}
          </p>
        </div>
      )}
    </div>
  );
}

function DashboardCard({
  d,
  summary,
  isOpen,
  detail,
  search,
  onToggle,
  onSearch,
  onRetry,
}: {
  d: Dashboard;
  summary?: Summary;
  isOpen: boolean;
  detail: DetailState;
  search: string;
  onToggle: () => void;
  onSearch: (v: string) => void;
  onRetry: () => void;
}) {
  const isML = ML_IDS.has(d.id);
  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        isOpen
          ? "border-violet-500/40 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
          : "border-border"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-card hover:bg-muted/20 transition-colors"
      >
        <span
          className={`flex-shrink-0 inline-flex items-center justify-center gap-0.5 w-12 h-6 rounded-md font-bold text-[10px] border ${
            isML
              ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
              : "bg-violet-500/10 border-violet-500/20 text-violet-400"
          }`}
        >
          {isML && <Brain size={9} />}
          {isML ? `ML${d.id}` : `DB${d.id}`}
        </span>
        <span className="flex-1 text-[12px] font-medium leading-snug">
          {d.name}
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {summary?.totalCount != null ? (
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums flex items-center gap-0.5">
              <Hash size={9} />
              {fmtShort(summary.totalCount)}
            </span>
          ) : summary?.error ? (
            <AlertTriangle size={11} className="text-red-400/60" />
          ) : (
            <div className="w-10 h-3 rounded bg-muted/40 animate-pulse" />
          )}
          {!isML && summary?.hasAmount && summary?.totalAmount != null && (
            <span className="text-[11px] font-mono text-amber-400 tabular-nums">
              ₮{fmtShort(summary.totalAmount)}
            </span>
          )}
          {isOpen ? (
            <ChevronDown size={14} className="text-violet-400" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
        </div>
      </button>
      {isOpen && (
        <DetailPanel
          d={d}
          detail={detail}
          search={search}
          onSearch={onSearch}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setSummLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [detail, setDetail] = useState<DetailState>({
    status: "idle",
    hasAmount: false,
    rows: [],
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    abFetchDashboards()
      .then(setDashboards)
      .catch((e) => setError(e?.message || "Oracle алдаа"))
      .finally(() => setLoading(false));

    abFetchDashboardSummaries()
      .then(setSummaries)
      .catch(() => setSummaries([]))
      .finally(() => setSummLoading(false));
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
          error: e?.message || "Oracle алдаа",
        }),
      );
  }, []);

  const handleToggle = (id: number) => {
    if (openId === id) {
      setOpenId(null);
      setDetailSearch("");
      return;
    }
    setOpenId(id);
    setDetailSearch("");
    loadDetail(id, "");
  };

  const handleSearch = (val: string) => {
    setDetailSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (openId !== null) loadDetail(openId, val);
    }, 400);
  };

  const summaryMap = Object.fromEntries(summaries.map((s) => [s.id, s]));

  const standardDash = dashboards.filter((d) => !ML_IDS.has(d.id));
  const mlDash = dashboards.filter((d) => ML_IDS.has(d.id));

  const filteredStd = listSearch
    ? standardDash.filter(
        (d) =>
          d.name.toLowerCase().includes(listSearch.toLowerCase()) ||
          String(d.id).includes(listSearch),
      )
    : standardDash;
  const filteredML = listSearch
    ? mlDash.filter(
        (d) =>
          d.name.toLowerCase().includes(listSearch.toLowerCase()) ||
          String(d.id).includes(listSearch),
      )
    : mlDash;

  return (
    <div className="space-y-5 pb-8">
      <ToolPageHeader
        href="/tools"
        icon={<LayoutDashboard size={16} className="text-violet-400" />}
        title="Alert Box Dashboards"
        subtitle={`Oracle · ${dashboards.length} dashboard`}
      />

      <div className="px-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Dashboard хайх…"
            className="w-full bg-card border border-border rounded-xl pl-9 pr-10 py-2.5 text-[12px] placeholder:text-muted-foreground/60 outline-none focus:border-violet-500/50 transition-colors"
          />
          {listSearch && (
            <button
              onClick={() => setListSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[12px]">Татаж байна…</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Standard section */}
            {filteredStd.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Database size={13} className="text-violet-400" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Стандарт загвар
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                    {filteredStd.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {filteredStd.map((d) => (
                    <DashboardCard
                      key={d.id}
                      d={d}
                      summary={summaryMap[d.id]}
                      isOpen={openId === d.id}
                      detail={
                        openId === d.id
                          ? detail
                          : { status: "idle", hasAmount: false, rows: [] }
                      }
                      search={openId === d.id ? detailSearch : ""}
                      onToggle={() => handleToggle(d.id)}
                      onSearch={handleSearch}
                      onRetry={() => loadDetail(d.id, detailSearch)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ML section */}
            {filteredML.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Brain size={13} className="text-amber-400" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    ML загварт суурилсан
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                    {filteredML.length}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-1">
                    · нийт дүнгийн тооцоолоос хасагдсан
                  </span>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <AlertTriangle
                    size={12}
                    className="text-amber-400 flex-shrink-0 mt-0.5"
                  />
                  <p className="text-[10.5px] text-amber-300/80 leading-relaxed">
                    Эдгээр dashboard-ууд нь ID 1–12-ын стандарт загваруудтай
                    ижил өгөгдлийг ML загвараар дахин боловсруулсан тул нийлбэр
                    тооцоолол давхардахаас зайлсхийж нийт дүнд оруулаагүй.
                  </p>
                </div>
                <div className="space-y-2">
                  {filteredML.map((d) => (
                    <DashboardCard
                      key={d.id}
                      d={d}
                      summary={summaryMap[d.id]}
                      isOpen={openId === d.id}
                      detail={
                        openId === d.id
                          ? detail
                          : { status: "idle", hasAmount: false, rows: [] }
                      }
                      search={openId === d.id ? detailSearch : ""}
                      onToggle={() => handleToggle(d.id)}
                      onSearch={handleSearch}
                      onRetry={() => loadDetail(d.id, detailSearch)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredStd.length === 0 && filteredML.length === 0 && (
              <div className="text-center py-12 text-[12px] text-muted-foreground">
                Хайлтад тохирох dashboard олдсонгүй
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
