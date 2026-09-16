"use client";

import type { TranslationKey } from "@/contexts/LanguageContext";
import type { NetReviewStatus, NetRiskLevel, NetXdrStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Эрсдэл ────────────────────────────────────────────────────────────────

export const RISK_ORDER: NetRiskLevel[] = ["Critical", "High", "Medium", "Low"];

export const RISK_LABEL: Record<NetRiskLevel, TranslationKey> = {
  Critical: "netRiskCritical",
  High: "netRiskHigh",
  Medium: "netRiskMedium",
  Low: "netRiskLow",
};

const RISK_STYLE: Record<NetRiskLevel, { badge: string; bar: string }> = {
  Critical: {
    badge: "bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-400",
    bar: "bg-rose-500",
  },
  High: {
    badge:
      "bg-orange-500/10 text-orange-600 ring-orange-500/25 dark:text-orange-400",
    bar: "bg-orange-500",
  },
  Medium: {
    badge:
      "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  Low: {
    badge:
      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
};

export const riskBarClass = (level: string) =>
  RISK_STYLE[level as NetRiskLevel]?.bar ?? "bg-muted-foreground";

const pill =
  "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1";

export function RiskBadge({
  level,
  t,
}: {
  level: NetRiskLevel;
  t: (k: TranslationKey) => string;
}) {
  return (
    <span className={cn(pill, RISK_STYLE[level].badge)}>
      {t(RISK_LABEL[level])}
    </span>
  );
}

// ─── Хяналтын төлөв (Palo Alto) ────────────────────────────────────────────

export const REVIEW_ORDER: NetReviewStatus[] = [
  "pending",
  "approved",
  "rejected",
];

export const REVIEW_LABEL: Record<NetReviewStatus, TranslationKey> = {
  pending: "netReviewPending",
  approved: "netReviewApproved",
  rejected: "netReviewRejected",
};

const REVIEW_STYLE: Record<NetReviewStatus, string> = {
  pending: "bg-muted text-muted-foreground ring-border",
  approved:
    "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
  rejected: "bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-400",
};

export function ReviewBadge({
  status,
  t,
}: {
  status: NetReviewStatus;
  t: (k: TranslationKey) => string;
}) {
  return (
    <span className={cn(pill, REVIEW_STYLE[status])}>
      {t(REVIEW_LABEL[status])}
    </span>
  );
}

// ─── XDR төлөв ─────────────────────────────────────────────────────────────

export const XDR_STATUS_ORDER: NetXdrStatus[] = [
  "New",
  "In Progress",
  "Escalated",
  "Resolved",
  "Dismissed",
];

export const XDR_STATUS_LABEL: Record<NetXdrStatus, TranslationKey> = {
  New: "netXdrStatusNew",
  "In Progress": "netXdrStatusInProgress",
  Resolved: "netXdrStatusResolved",
  Dismissed: "netXdrStatusDismissed",
  Escalated: "netXdrStatusEscalated",
};

const XDR_STATUS_STYLE: Record<NetXdrStatus, string> = {
  New: "bg-primary/10 text-primary ring-primary/25",
  "In Progress":
    "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400",
  Escalated: "bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-400",
  Resolved:
    "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
  Dismissed: "bg-muted text-muted-foreground ring-border",
};

export function XdrStatusBadge({
  status,
  t,
}: {
  status: NetXdrStatus;
  t: (k: TranslationKey) => string;
}) {
  return (
    <span className={cn(pill, XDR_STATUS_STYLE[status])}>
      {t(XDR_STATUS_LABEL[status])}
    </span>
  );
}

// Хуваарилалтын мөрүүд — хэрэгслүүдийн дундын бүрдэл
export { DistributionBars } from "@/components/shared/tool-ui";

// ─── Туслах ────────────────────────────────────────────────────────────────

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Анхдагч хугацаа — сүүлийн 30 хоног */
export function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return { startDate: ymd(start), endDate: ymd(end) };
}

/** Одоогийн шүүлтүүрийн мөрүүдийг Excel болгон татаж авна (клиент талд). */
export async function downloadXlsx(
  fileName: string,
  sheetName: string,
  columns: { header: string; width: number }[],
  rows: (string | number)[][],
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Голомт Банк — Дотоод аудит";
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
