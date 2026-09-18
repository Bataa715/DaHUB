"use client";

// Зардлын гүйлгээний хүснэгт — багана, эрэмбэ, төлбөрийн хүсэлт/хамааралтай тэмдэг.
import { useMemo, useState, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Landmark,
  Building2,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  Link2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ExpenseTxRow, HamaaralRow, ManagementRow } from "@/lib/api";
import {
  fmtAmount,
  STATUS_META,
  budgetState,
  BUDGET_STATE_META,
  BudgetState,
} from "./expense-format";
import { CellPair, Field, Td } from "./expense-ui";

export type ExpColKey =
  | "date"
  | "customer"
  | "account"
  | "amount"
  | "description"
  | "department"
  | "gl"
  | "receivable"
  | "book"
  | "verification"
  | "related"
  | "connected"
  | "management";

export type ExpColDef = {
  key: ExpColKey;
  label: string;
  align: "left" | "right";
  defaultWidth: number;
  minWidth: number;
};

export function colSortValue(
  tx: {
    book_date?: string;
    customer_code?: string;
    customer_name?: string;
    account_code?: string;
    account_name?: string;
    debit_amount?: number;
    description?: string;
    department_name?: string;
    co_a_group_code?: string;
    co_a_group_name?: string;
    recievable_type_code?: string;
    recievable_type_name?: string;
    book_number?: string;
    has_payment_request?: 0 | 1;
    budget_type?: string;
    budget_status_override?: string;
    verification_type?: string;
    verification_status?: string;
    contract_total_amount?: number;
  },
  key: ExpColKey,
): string | number {
  switch (key) {
    case "date":
      return tx.book_date || "";
    case "customer":
      return (tx.customer_name || tx.customer_code || "").toLowerCase();
    case "account":
      return (tx.account_name || tx.account_code || "").toLowerCase();
    case "amount":
      return Number(tx.debit_amount) || 0;
    case "description":
      return (tx.description || "").toLowerCase();
    case "department":
      return (tx.department_name || "").toLowerCase();
    case "gl":
      return (tx.co_a_group_name || tx.co_a_group_code || "").toLowerCase();
    case "receivable":
      return (
        tx.recievable_type_name ||
        tx.recievable_type_code ||
        ""
      ).toLowerCase();
    case "book": {
      const rank: Record<BudgetState, number> = {
        no_budget: 0,
        has_budget: 1,
        additional_budget: 2,
      };
      return rank[budgetState(tx)];
    }
    case "verification":
      return (
        tx.verification_type ||
        tx.verification_status ||
        ""
      ).toLowerCase();
    case "related":
    case "connected":
    case "management":
      return (tx.customer_code || "").toLowerCase();
  }
}

export const EXP_WIDTHS_KEY = "dahub.expense-tx-col-widths";

export function readExpStoredWidths(): Partial<Record<ExpColKey, number>> {
  try {
    const raw = localStorage.getItem(EXP_WIDTHS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<ExpColKey, number>>;
  } catch {
    return {};
  }
}

/**
 * "Төсөвтэй эсэх" гурван төлөвийн тэмдэг ("book" багана) — логик нь
 * `expense-format.ts`-ийн `budgetState()`-д бүрэн байрлана.
 */
export function BudgetStatusBadge({
  tx,
  onClick,
  title,
}: {
  tx: {
    has_payment_request?: 0 | 1;
    budget_type?: string;
    budget_status_override?: string;
  };
  onClick?: () => void;
  title?: string;
}) {
  const { t } = useLanguage();
  const state = budgetState(tx);
  const meta = BUDGET_STATE_META[state];
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.cls,
      )}
    >
      {state === "has_budget" && <CheckCircle2 className="w-3 h-3 shrink-0" />}
      {state === "additional_budget" && (
        <Landmark className="w-3 h-3 shrink-0" />
      )}
      {state === "no_budget" && <AlertTriangle className="w-3 h-3 shrink-0" />}
      {t(meta.labelKey)}
    </span>
  );

  const hint = `${t(meta.labelKey)}${title ? ` \u2014 ${title}` : ""}`;

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className="text-left hover:opacity-80 transition-opacity"
    >
      {content}
    </button>
  ) : (
    <span title={hint}>{content}</span>
  );
}

/**
 * Хамааралтай баганын 3 төлөв: "cif" hamaaral хүснэгтэд олдоогүй бол
 * саарал, олдоод empid бөглөгдсөн (банкны ажилтантай холбоотой) бол улаан,
 * олдоод ажилтан биш бол ногоон.
 */
export type RelatedState = "employee" | "related" | "none";

export function relatedState(rows: HamaaralRow[] | undefined): RelatedState {
  if (!rows || rows.length === 0) return "none";
  return rows.some((r) => (r.empid ?? "").trim() !== "")
    ? "employee"
    : "related";
}

export const RELATED_BADGE: Record<
  RelatedState,
  { cls: string; labelKey: TranslationKey }
> = {
  employee: {
    cls: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    labelKey: "zaExpRelatedEmployee",
  },
  related: {
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    labelKey: "zaExpRelatedYes",
  },
  none: {
    cls: "border-border bg-muted/30 text-muted-foreground",
    labelKey: "zaExpRelatedNo",
  },
};

export function HamaaralBadge({
  rows,
  onClick,
}: {
  rows: HamaaralRow[] | undefined;
  onClick?: () => void;
}) {
  const { t } = useLanguage();
  const state = relatedState(rows);
  const meta = RELATED_BADGE[state];
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.cls,
      )}
    >
      <ShieldAlert className="w-3 h-3 shrink-0" />
      {t(meta.labelKey)}
    </span>
  );
  if (state === "none" || !onClick) {
    return content;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left hover:opacity-80 transition-opacity"
    >
      {content}
    </button>
  );
}

/** "Хамааралтай" баганын дэлгэрэнгүй (hamaaral мөрүүд) жижиг диалог. */
export function HamaaralDetailDialog({
  customerCode,
  rows,
  onClose,
  onVerify,
}: {
  customerCode: string | null;
  rows: HamaaralRow[];
  onClose: () => void;
  onVerify?: (row: HamaaralRow, status: "" | "confirmed") => void;
}) {
  const { t } = useLanguage();
  return (
    <Dialog
      open={customerCode != null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            {t("zaExpRelatedDialogTitle")} — {customerCode}
          </DialogTitle>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("zaExpDialogNoMatch")}
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {rows.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs"
              >
                <Field label={t("zaExpRelatedColCif")} value={r.cif} />
                <Field label={t("zaExpRelatedColCifName")} value={r.cifname} />
                <Field
                  label={t("zaExpRelatedColEmpId")}
                  value={r.empid || "—"}
                />
                <Field
                  label={t("zaExpRelatedColEmpName")}
                  value={r.empname || "—"}
                />
                <Field label={t("zaExpRelatedColType")} value={r.typename} />
                <Field label={t("zaExpRelatedColStatus")} value={r.status} />
                <div className="col-span-2">
                  <div className="text-muted-foreground mb-1">
                    {t("zaExpRelatedVerifiedLabel")}
                  </div>
                  <Select
                    value={r.verifiedStatus || "unverified"}
                    onValueChange={(v) =>
                      onVerify?.(r, v === "confirmed" ? "confirmed" : "")
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unverified">
                        {t("zaExpRelatedUnverified")}
                      </SelectItem>
                      <SelectItem value="confirmed">
                        {t("zaExpRelatedConfirmed")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Харилцагчид "Удирдлага" (management) мэдээлэл бар эсэхийг шалгана. */
export function hasManagementInfo(row: ManagementRow | undefined): boolean {
  if (!row) return false;
  return Boolean(
    (row.shareholders || "").trim() ||
      (row.executives || "").trim() ||
      (row.ultimate_owner || "").trim(),
  );
}

/** "Удирдлага" баганын дэлгэрэнгүй — хувьцаа эзэмшигч/гүйцэтгэх удирдлага/
 *  эцсийн өмчлөгч (гадны ETL `management` хүснэгт). */
export function ManagementDetailDialog({
  customerCode,
  row,
  onClose,
}: {
  customerCode: string | null;
  row: ManagementRow | undefined;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Dialog
      open={customerCode != null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-500" />
            {t("zaExpManagementDialogTitle")} — {customerCode}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Field
            label={t("zaExpManagementShareholders")}
            value={row?.shareholders || "—"}
          />
          <Field
            label={t("zaExpManagementExecutives")}
            value={row?.executives || "—"}
          />
          <Field
            label={t("zaExpManagementUltimateOwner")}
            value={row?.ultimate_owner || "—"}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseTxTable({
  rows,
  visibleCount,
  showVerification = false,
  stickyHeader = false,
  onBookClick,
  onVerifyClick,
  showRelations = false,
  relationsMap = {},
  holbootoiSet = new Set(),
  managementMap = {},
  onHamaaralVerify,
}: {
  rows: Array<
    Pick<
      ExpenseTxRow,
      | "book_date"
      | "customer_code"
      | "customer_name"
      | "account_code"
      | "account_name"
      | "currency_code"
      | "debit_amount"
      | "description"
      | "department_name"
      | "co_a_group_code"
      | "co_a_group_name"
      | "recievable_type_code"
      | "recievable_type_name"
      | "book_number"
    > &
      Partial<
        Pick<
          ExpenseTxRow,
          | "verification_type"
          | "contract_total_amount"
          | "verification_status"
          | "has_verification"
          | "has_payment_request"
          | "has_customer_payment_request"
          | "budget_type"
          | "budget_status_override"
        >
      >
  >;
  visibleCount?: number;
  showVerification?: boolean;
  stickyHeader?: boolean;
  onBookClick?: (tx: ExpenseTxRow) => void;
  onVerifyClick?: (tx: ExpenseTxRow) => void;
  showRelations?: boolean;
  relationsMap?: Record<string, HamaaralRow[]>;
  holbootoiSet?: Set<string>;
  managementMap?: Record<string, ManagementRow>;
  onHamaaralVerify?: (
    row: HamaaralRow,
    status: "" | "confirmed",
  ) => void;
}) {
  const { t } = useLanguage();
  const [hamaaralDialogCustomer, setHamaaralDialogCustomer] = useState<
    string | null
  >(null);
  const [managementDialogCustomer, setManagementDialogCustomer] = useState<
    string | null
  >(null);
  const cols = useMemo<ExpColDef[]>(() => {
    const all: ExpColDef[] = [
      {
        key: "date",
        label: t("tailan_dateLabel"),
        align: "left",
        defaultWidth: 96,
        minWidth: 72,
      },
      {
        key: "customer",
        label: t("zaExpColCustomer"),
        align: "left",
        defaultWidth: 160,
        minWidth: 100,
      },
      {
        key: "account",
        label: t("zaExpColAccount"),
        align: "left",
        defaultWidth: 140,
        minWidth: 90,
      },
      {
        key: "amount",
        label: t("zaExpColAmount"),
        align: "right",
        defaultWidth: 120,
        minWidth: 88,
      },
      {
        key: "description",
        label: t("zaExpColDescription"),
        align: "left",
        defaultWidth: 200,
        minWidth: 110,
      },
      {
        key: "department",
        label: t("zaExpColDepartment"),
        align: "left",
        defaultWidth: 140,
        minWidth: 90,
      },
      {
        key: "gl",
        label: t("zaExpColGlGroup"),
        align: "left",
        defaultWidth: 150,
        minWidth: 90,
      },
      {
        key: "receivable",
        label: t("zaExpColReceivableType"),
        align: "left",
        defaultWidth: 150,
        minWidth: 90,
      },
      {
        key: "book",
        label: t("zaExpColBookNumber"),
        align: "left",
        defaultWidth: 168,
        minWidth: 120,
      },
    ];
    if (showVerification) {
      all.push({
        key: "verification",
        label: `${t("zaExpColVerType")} / ${t("zaExpColContractAmount")}`,
        align: "left",
        defaultWidth: 160,
        minWidth: 100,
      });
    }
    if (showRelations) {
      all.push(
        {
          key: "related",
          label: t("zaExpColRelated"),
          align: "left",
          defaultWidth: 130,
          minWidth: 100,
        },
        {
          key: "connected",
          label: t("zaExpColConnected"),
          align: "left",
          defaultWidth: 90,
          minWidth: 70,
        },
        {
          key: "management",
          label: t("zaExpColManagement"),
          align: "left",
          defaultWidth: 110,
          minWidth: 80,
        },
      );
    }
    return all;
  }, [showVerification, showRelations, t]);

  // Хүснэгт нь өгөгдөл ачаалсны дараа (клиент дээр) л зурагддаг тул localStorage-оос
  // шууд уншина — mount-ийн дараа effect-ээр дахин render хийх шаардлагагүй.
  const [widths, setWidths] =
    useState<Partial<Record<ExpColKey, number>>>(readExpStoredWidths);
  const [sort, setSort] = useState<{
    key: ExpColKey;
    dir: "asc" | "desc";
  } | null>(null);

  const toggleSort = useCallback((key: ExpColKey) => {
    setSort((prev) => {
      if (prev?.key !== key) {
        return {
          key,
          dir: key === "amount" || key === "book" ? "desc" : "asc",
        };
      }
      if (key === "amount" || key === "book") {
        return prev.dir === "desc" ? { key, dir: "asc" } : null;
      }
      return prev.dir === "asc" ? { key, dir: "desc" } : null;
    });
  }, []);

  const displayedRows = useMemo(() => {
    const sorted = sort
      ? [...rows].sort((a, b) => {
          const av = colSortValue(a, sort.key);
          const bv = colSortValue(b, sort.key);
          let cmp = 0;
          if (typeof av === "number" && typeof bv === "number") {
            cmp = av - bv;
          } else {
            cmp = String(av).localeCompare(String(bv), "mn", {
              numeric: true,
              sensitivity: "base",
            });
          }
          if (cmp === 0 && sort.key === "verification") {
            cmp =
              (Number(a.contract_total_amount) || 0) -
              (Number(b.contract_total_amount) || 0);
          }
          return sort.dir === "asc" ? cmp : -cmp;
        })
      : rows;
    return visibleCount != null ? sorted.slice(0, visibleCount) : sorted;
  }, [rows, sort, visibleCount]);

  const widthOf = useCallback(
    (col: ExpColDef) => widths[col.key] ?? col.defaultWidth,
    [widths],
  );

  const onResizeStart = useCallback(
    (e: ReactMouseEvent, col: ExpColDef) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widthOf(col);
      const onMove = (ev: MouseEvent) => {
        const next = Math.max(col.minWidth, startW + (ev.clientX - startX));
        setWidths((prev) => ({ ...prev, [col.key]: next }));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setWidths((prev) => {
          const merged = { ...prev };
          try {
            localStorage.setItem(EXP_WIDTHS_KEY, JSON.stringify(merged));
          } catch {
            /* ignore */
          }
          return merged;
        });
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [widthOf],
  );

  return (
    <div>
      {/* [FIX] "Дэлгэрэнгүй харах" (Хамааралтай/Холбоотой/Удирдлага багана
          нэмэгдэх) үед хүснэгт хажуу тийш гүйлгэгдэхгүй байсан асуудлыг
          шийдэхийн тулд `resize-y` (native drag handle-аар өндрийг
          томруулж/жижигрүүлэх) + `overflow-auto` (хоёр чиглэлд гүйлгэх)
          хослуулав — шинэ сан шаардахгүй хамгийн бага эрсдэлтэй шийдэл. */}
      <div
        className={cn(
          "resize-y overflow-auto min-h-[240px]",
          stickyHeader ? "max-h-[calc(100vh-8rem)]" : "max-h-[80vh]",
        )}
      >
        <table
          className="text-sm border-collapse"
          style={{
            tableLayout: "fixed",
            width: "max-content",
            minWidth: "100%",
          }}
        >
          <colgroup>
            {cols.map((col) => (
              <col key={col.key} style={{ width: widthOf(col) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.key}
                  aria-sort={
                    sort?.key === col.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    "group relative cursor-pointer select-none border-b border-border bg-muted/40 px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground",
                    stickyHeader && "sticky top-0 z-[1]",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-0.5 min-w-0",
                      col.align === "right" ? "justify-end" : "justify-start",
                    )}
                  >
                    <span className="truncate font-bold whitespace-nowrap">
                      {col.label}
                    </span>
                    {sort?.key === col.key ? (
                      sort.dir === "asc" ? (
                        <ChevronUp className="w-3 h-3 shrink-0 opacity-80" />
                      ) : (
                        <ChevronDown className="w-3 h-3 shrink-0 opacity-80" />
                      )
                    ) : (
                      <ChevronDown className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-30" />
                    )}
                  </span>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={(e) => onResizeStart(e, col)}
                    className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-10 group/resize flex justify-end"
                  >
                    <span className="w-px h-full bg-transparent group-hover/resize:bg-foreground/30" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((tx, i) => {
              const statusMeta = STATUS_META[tx.verification_status ?? ""];
              const cellLine = "border-r border-border";
              return (
                <tr
                  key={`${tx.book_number}-${tx.customer_code}-${i}`}
                  className="border-t border-border hover:bg-muted/40"
                >
                  <Td>{tx.book_date || "—"}</Td>
                  <Td>
                    <CellPair code={tx.customer_code} name={tx.customer_name} />
                  </Td>
                  <Td>
                    <CellPair code={tx.account_code} name={tx.account_name} />
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">
                    {fmtAmount(tx.debit_amount)} {tx.currency_code}
                  </Td>
                  <Td>{tx.description || "—"}</Td>
                  <Td>{tx.department_name || "—"}</Td>
                  <Td>
                    <CellPair
                      code={tx.co_a_group_code}
                      name={tx.co_a_group_name}
                    />
                  </Td>
                  <Td>
                    <CellPair
                      code={tx.recievable_type_code}
                      name={tx.recievable_type_name}
                    />
                  </Td>
                  <Td
                    className={
                      showVerification || showRelations ? cellLine : undefined
                    }
                  >
                    <BudgetStatusBadge
                      tx={tx}
                      title={tx.book_number}
                      onClick={
                        onBookClick
                          ? () => onBookClick(tx as ExpenseTxRow)
                          : undefined
                      }
                    />
                  </Td>
                  {showVerification && (
                    <Td className={showRelations ? cellLine : undefined}>
                      <div>{tx.verification_type || "—"}</div>
                      <div className="tabular-nums text-muted-foreground">
                        {tx.contract_total_amount
                          ? `₮${fmtAmount(tx.contract_total_amount)}`
                          : "—"}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={cn(
                            "inline-block w-2 h-2 rounded-full shrink-0",
                            statusMeta?.dot ?? "bg-muted-foreground/30",
                          )}
                        />
                        <span
                          className={cn(
                            statusMeta?.text ?? "text-muted-foreground",
                          )}
                        >
                          {statusMeta ? t(statusMeta.labelKey) : "—"}
                        </span>
                        {onVerifyClick && (
                          <button
                            type="button"
                            onClick={() => onVerifyClick(tx as ExpenseTxRow)}
                            className="text-muted-foreground hover:text-foreground"
                            title={t("zaExpVerificationDialogTitle")}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </Td>
                  )}
                  {showRelations && (
                    <>
                      <Td className={cellLine}>
                        <HamaaralBadge
                          rows={relationsMap[tx.customer_code]}
                          onClick={() =>
                            setHamaaralDialogCustomer(tx.customer_code)
                          }
                        />
                      </Td>
                      <Td className={cellLine}>
                        {holbootoiSet.has(tx.customer_code) ? (
                          <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td>
                        {hasManagementInfo(managementMap[tx.customer_code]) ? (
                          <button
                            type="button"
                            onClick={() =>
                              setManagementDialogCustomer(tx.customer_code)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:opacity-80"
                          >
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            {t("zaExpColManagement")}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showRelations && (
        <>
          <HamaaralDetailDialog
            customerCode={hamaaralDialogCustomer}
            rows={
              hamaaralDialogCustomer
                ? (relationsMap[hamaaralDialogCustomer] ?? [])
                : []
            }
            onClose={() => setHamaaralDialogCustomer(null)}
            onVerify={onHamaaralVerify}
          />
          <ManagementDetailDialog
            customerCode={managementDialogCustomer}
            row={
              managementDialogCustomer
                ? managementMap[managementDialogCustomer]
                : undefined
            }
            onClose={() => setManagementDialogCustomer(null)}
          />
        </>
      )}
    </div>
  );
}
