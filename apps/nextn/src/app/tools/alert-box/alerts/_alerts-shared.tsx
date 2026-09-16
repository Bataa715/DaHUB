"use client";

// Alert жагсаалтын төрөл, өнгө, дүнгийн формат, графикийн tooltip-ууд.
import type { TooltipContentProps } from "recharts";
import { type TranslationKey } from "@/contexts/LanguageContext";

export const ML_DASH_IDS = new Set([13, 14, 15, 16]);
// Том жагсаалтыг (10000 хүртэл CIF) нэг дор бүгдийг render хийхээс сэргийлж,
// эхэндээ ийм тоогоор л харуулаад "Load more"-оор алхам алхмаар нэмнэ.
export const ALERTS_PAGE_SIZE = 50;
export const ALERT_COLORS = [
  "#f97316",
  "#fb7185",
  "#f472b6",
  "#e879f9",
  "#c084fc",
  "#a78bfa",
  "#818cf8",
  "#6366f1",
  "#34d399",
  "#facc15",
];

export interface AlertDashboard {
  id: number;
  name: string;
  count: number;
  totalAmount: number;
}

export interface AlertItem {
  cif: string;
  dashboardCount: number;
  totalTransactions: number;
  totalAmount: number; // стандарт дашборд (1-12) дүн — ML (13-16) хасагдсан
  mlAmount: number; // ML дашборд (13-16) дүн тусдаа
  dashboards: AlertDashboard[];
}

export interface CifDetailDashboard {
  dashboardId: number;
  dashboardName: string;
  matchCount: number;
  rows: Record<string, unknown>[];
}
export interface CifDetail {
  cif: string;
  results: CifDetailDashboard[];
}

export interface FailedDashboard {
  id: number;
  name: string;
  error: string;
}

export interface AlertData {
  minDashboards: number;
  totalAlerts: number;
  alerts: AlertItem[];
  failedDashboards: FailedDashboard[];
}

export function formatAmount(n: number) {
  if (!n) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}Т`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}К`;
  return String(Math.round(n));
}

export function createTop10Tooltip(t: (key: TranslationKey) => string) {
  return function Top10Tooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as AlertItem & { stdAmount: number };
    return (
      <div className="bg-surface-elevated border border-surface-border rounded-xl px-3 py-2.5 text-xs shadow-2xl space-y-1">
        <p className="font-mono font-extrabold text-txt text-sm">{d.cif}</p>
        <p className="text-txt-dim">
          {t("abAlertsAmountLabel")}{" "}
          <span className="text-amber-400 font-bold">
            {formatAmount(d.stdAmount)}₮
          </span>
        </p>
        {d.mlAmount > 0 && (
          <p className="text-txt-dim">
            ML:{" "}
            <span className="text-primary font-bold">
              +{formatAmount(d.mlAmount)}₮
            </span>
          </p>
        )}
        <p className="text-txt-dim">
          {t("abAlertsTxnLabel")}{" "}
          <span className="text-txt font-bold">{d.totalTransactions}</span>
        </p>
        <p className="text-txt-dim">
          Dashboard:{" "}
          <span className="text-primary font-bold">
            {d.dashboardCount}
            {t("abAlertsCountSuffix")}
          </span>
        </p>
      </div>
    );
  };
}

export function SevTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-txt">{String(payload[0].name ?? "")}</p>
      <p className="text-txt-dim">{payload[0].value} CIF</p>
    </div>
  );
}

export function DbFreqTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { name: string; count: number };
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-txt">{d.name}</p>
      <p className="text-txt-dim">{d.count} CIF</p>
    </div>
  );
}
