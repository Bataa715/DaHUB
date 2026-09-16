"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Paperclip,
  PiggyBank,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type {
  ExpenseAttachmentRow,
  ExpenseBudgetChangeRow,
  ExpensePaymentRequestRow,
  ExpenseTxRow,
} from "@/lib/api";
import { fmtAmount, type DrillSectionState } from "./expense-format";
import { DetailPanel, Field } from "./expense-ui";
import { PayRequestBadge, payState } from "./ExpenseTxTable";

/**
 * Нэг гүйлгээний харилцагчийн төлбөрийн хүсэлтүүд — хавсралт, төсвийн
 * шилжүүлгийн хамт. Өгөгдлийг үндсэн хэрэгсэл ачаалж дамжуулна.
 */
export function ExpenseDrilldownDialog({
  selectedTx,
  closeDrilldown,
  drillLoading,
  drillError,
  drillRows,
  attachSections,
  budgetSections,
}: {
  selectedTx: ExpenseTxRow | null;
  closeDrilldown: () => void;
  drillLoading: boolean;
  drillError: string | null;
  drillRows: ExpensePaymentRequestRow[];
  attachSections: Record<string, DrillSectionState<ExpenseAttachmentRow>>;
  budgetSections: Record<string, DrillSectionState<ExpenseBudgetChangeRow>>;
}) {
  const { t } = useLanguage();
  return (
    <Dialog
      open={selectedTx != null}
      onOpenChange={(open) => {
        if (!open) closeDrilldown();
      }}
    >
      <DialogContent className="max-w-[min(1400px,97vw)] max-h-[93vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("zaExpDialogTitle")}</DialogTitle>
        </DialogHeader>

        {/* Гүйлгээний контекст — нэг харцаар ойлгогдох хураангуй самбар */}
        {selectedTx && (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 -mt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
              <div className="min-w-0">
                <div className="text-muted-foreground">
                  {t("zaExpDialogBookNumberLabel")}
                </div>
                <div className="font-mono font-medium text-foreground truncate">
                  {selectedTx.book_number || "—"}
                </div>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <div className="text-muted-foreground">
                  {t("zaExpDialogCustomerLabel")}
                </div>
                <div className="font-medium text-foreground truncate">
                  {selectedTx.customer_name || "—"}
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                    {selectedTx.customer_code}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground">
                  {t("zaExpDialogAmountLabel")}
                </div>
                <div className="font-semibold tabular-nums text-foreground">
                  ₮{fmtAmount(selectedTx.debit_amount)}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-border/60 flex flex-wrap items-center gap-3">
              <PayRequestBadge state={payState(selectedTx)} />
              {!drillLoading && !drillError && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {t("zaExpDialogSummary")}: {drillRows.length}
                </span>
              )}
            </div>
          </div>
        )}

        {drillLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("loading")}
          </div>
        )}

        {drillError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {drillError}
          </div>
        )}

        {!drillLoading && !drillError && drillRows.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t("zaExpDialogNoMatch")}
          </div>
        )}

        {!drillLoading && !drillError && drillRows.length > 0 && (
          <div className="space-y-3">
            {drillRows.map((row, i) => {
              const matched = row.gl_number === selectedTx?.book_number;
              const attachKey = String(row.invoice_id ?? "");
              const budgetKey = String(row.book_number ?? "");
              const attachState = attachSections[attachKey];
              const budgetState = budgetSections[budgetKey];
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border px-3.5 py-3",
                    matched
                      ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : "border-border/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {row.invoice_id}
                    </span>
                    {matched && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("zaExpDialogMatchedBadge")}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    <Field
                      label={t("zaExpColCustomer")}
                      value={row.customer_code}
                    />
                    <Field label="" value={row.customer_name} />
                    <Field
                      label={t("zaExpColRequestDate")}
                      value={row.request_date}
                    />
                    <Field
                      label={t("zaExpColRequestAmount")}
                      value={`₮${fmtAmount(row.request_amount)} ${row.currency_code}`}
                    />
                    <Field
                      label={t("zaExpColEmployee")}
                      value={row.employee_name}
                    />
                    <Field label={t("zaRptColBank")} value={row.bank_name} />
                    <Field
                      label={t("zaExpColAccountNumber")}
                      value={row.account_number}
                    />
                    <Field
                      label={t("zaExpColTenderMethod")}
                      value={row.tender_method_name}
                    />
                    <Field
                      label={t("zaExpColInfoName")}
                      value={row.description}
                    />
                    <Field label={t("zaExpColPurpose")} value={row.purpose} />
                  </div>

                  {/* Хавсралт ба Төсвийн шилжүүлэг — товчгүйгээр,
                      үргэлж зэрэгцээ харагдана. */}
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <DetailPanel
                      icon={<Paperclip className="w-3.5 h-3.5" />}
                      title={t("zaExpBtnAttachment")}
                      count={attachState?.rows?.length}
                      loading={attachState?.loading}
                      error={attachState?.error}
                      empty={t("zaExpNoAttachShort")}
                    >
                      {attachState?.rows && attachState.rows.length > 0 && (
                        <ul className="space-y-1">
                          {attachState.rows.map((a, j) => (
                            <li key={j}>
                              <button
                                type="button"
                                onClick={() =>
                                  window.open(
                                    a.full_url,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline text-left"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {a.file_name}
                                  {a.file_extension
                                    ? `.${a.file_extension}`
                                    : ""}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </DetailPanel>

                    <DetailPanel
                      icon={<PiggyBank className="w-3.5 h-3.5" />}
                      title={t("zaExpBtnBudgetChange")}
                      count={budgetState?.rows?.length}
                      loading={budgetState?.loading}
                      error={budgetState?.error}
                      empty={t("zaExpNoBudgetShort")}
                    >
                      {budgetState?.rows && budgetState.rows.length > 0 && (
                        <div className="space-y-2">
                          {budgetState.rows.map((b, k) => (
                            <div
                              key={k}
                              className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs border-b border-border last:border-0 pb-2 last:pb-0"
                            >
                              <Field
                                label={t("zaExpBudgetColFromActivity")}
                                value={b.from_activity_dtl_name}
                              />
                              <Field
                                label={t("zaExpBudgetColToActivity")}
                                value={b.to_activity_dtl_name}
                              />
                              <Field
                                label={t("zaExpBudgetColAmount")}
                                value={`₮${fmtAmount(b.amount)}`}
                              />
                              <Field
                                label={t("zaExpBudgetColTotalAmount")}
                                value={`₮${fmtAmount(b.total_amount)}`}
                              />
                              <Field
                                label={t("zaExpBudgetColDescription")}
                                value={b.description}
                              />
                              <Field
                                label={t("zaExpColPurpose")}
                                value={b.purpose}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </DetailPanel>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
