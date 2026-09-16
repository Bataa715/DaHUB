"use client";

// Нийт зардлын KPI, график, хүснэгт.
import { useMemo } from "react";
import { Wallet, PieChart, Users2, List } from "lucide-react";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ExpenseTotalTxRow } from "@/lib/api";
import { fmtAmount } from "./expense-format";
import { Th, Td } from "./expense-ui";

export function BudgetTypePie({
  data,
}: {
  data: { name: string; value: number; fill: string }[];
}) {
  const { t } = useLanguage();
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t("zaExpBreakdownEmpty")}
      </p>
    );
  }
  return (
    <div className="h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => fmtAmount(Number(value) || 0)}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
            }}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetTypeTable({
  data,
}: {
  data: { name: string; value: number; fill: string }[];
}) {
  const { t } = useLanguage();
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {t("zaExpBreakdownEmpty")}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <Th className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
              {t("zaExpChartTitle")}
            </Th>
            <Th className="border-b border-border bg-muted/40 text-right text-xs font-semibold text-muted-foreground">
              {t("zaExpColCount")}
            </Th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const value = Number(d.value) || 0;
            return (
              <tr
                key={d.name}
                className="border-t border-border hover:bg-accent/10"
              >
                <Td>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: d.fill }}
                    />
                    <span className="font-semibold">{d.name || "—"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (value / max) * 100)}%`,
                        background: d.fill,
                      }}
                    />
                  </div>
                </Td>
                <Td className="text-right tabular-nums font-semibold" nowrap>
                  {fmtAmount(value)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Нийт зардлын дээд талын үзүүлэлтүүд.
 *
 * Эдгээр нь ганц тоон гарц (headline) тул диаграм БИШ, stat tile хэлбэрээр
 * харуулна — график зурах нь энд мэдээлэл нэмэхгүй, зөвхөн чимэг болно.
 */
export function TotalKpiRow({
  rows,
  totalAmount,
}: {
  rows: ExpenseTotalTxRow[];
  totalAmount: number;
}) {
  const { t } = useLanguage();

  const stats = useMemo(() => {
    const customers = new Set<string>();
    let largest = 0;
    for (const r of rows) {
      if (r.customer_code) customers.add(r.customer_code);
      const v = Number(r.debit_amount) || 0;
      if (v > largest) largest = v;
    }
    return {
      count: rows.length,
      customers: customers.size,
      avg: rows.length > 0 ? totalAmount / rows.length : 0,
      largest,
    };
  }, [rows, totalAmount]);

  const tiles: {
    icon: typeof Wallet;
    label: string;
    value: string;
    tint: string;
  }[] = [
    {
      icon: Wallet,
      label: t("zaExpTotalDebit"),
      value: `₮${fmtAmount(totalAmount)}`,
      tint: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: List,
      label: t("zaExpKpiTxCount"),
      value: fmtAmount(stats.count),
      tint: "text-primary bg-primary/10 border-primary/20",
    },
    {
      icon: Users2,
      label: t("zaExpKpiCustomers"),
      value: fmtAmount(stats.customers),
      tint: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    },
    {
      icon: PieChart,
      label: t("zaExpKpiAvg"),
      value: `₮${fmtAmount(Math.round(stats.avg))}`,
      tint: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-3 min-w-0"
          >
            <span
              className={cn(
                "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                tile.tint,
              )}
            >
              <Icon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-muted-foreground truncate">
                {tile.label}
              </div>
              <div className="text-base font-bold tabular-nums text-foreground truncate">
                {tile.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Задаргааны баганан диаграм.
 *
 * Бүх багана НЭГ ижил хэмжигдэхүүнийг (дүн) харуулж байгаа тул өнгө нь
 * ялгах үүрэггүй — sequential нэг өнгө ашиглана (categorical палитр биш).
 * Өнгийг dataviz-ийн шалгуураар баталгаажуулсан: цайван горимд sky-500,
 * харанхуйд sky-600 (харанхуйд sky-500 нь гэрэлтэлтийн зурваснаас гардаг).
 * Дүн бүрийг шууд шошголсон тул бага контрастын сануулга нөхөгдөнө.
 */
export function BreakdownChart({
  title,
  data,
}: {
  title: string;
  data: { code: string; name: string; count: number; total: number }[];
}) {
  const { t } = useLanguage();

  const rows = useMemo(() => {
    const mapped = data.map((d) => ({
      code: d.code?.trim() || "—",
      name: d.name?.trim() || "—",
      count: Number(d.count) || 0,
      total: Number(d.total) || 0,
    }));
    mapped.sort((a, b) => b.total - a.total);
    return mapped;
  }, [data]);

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  const grand = totalAmount || 1;
  const max = rows[0]?.total || 1;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("zaExpBreakdownEmpty")}
        </p>
      ) : (
        <>
          <div className="overflow-auto max-h-[min(380px,52vh)] px-4 py-3 space-y-3">
            {rows.map((r, i) => {
              const share = (r.total / grand) * 100;
              // Уртыг ХАМГИЙН ТОМ утгатай харьцуулж хэмжинэ — ингэснээр
              // жижиг ангиллууд ч харагдахуйц урттай болно.
              const width = Math.max((r.total / max) * 100, 1.5);
              return (
                <div
                  key={`${r.code}-${r.name}-${i}`}
                  className="group"
                  title={`${r.name} · ${r.code} · ₮${fmtAmount(r.total)} · ${share.toFixed(1)}%`}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">
                        {r.name}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate">
                        {r.code} · {fmtAmount(r.count)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold tabular-nums text-foreground">
                        ₮{fmtAmount(r.total)}
                      </div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">
                        {share.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {/* Мөр = нэг хэмжигдэхүүн. Суурьт наалдсан, төгсгөл нь
                      бөөрөнхий; зам нь бүдэг тул багана нь тодрон харагдана. */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-500 dark:bg-sky-600 transition-[width] duration-500 group-hover:opacity-80"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border px-4 py-2 flex items-center justify-between gap-3 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {t("zaExpTotalDebit")}
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {fmtAmount(totalCount)} · ₮{fmtAmount(totalAmount)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
