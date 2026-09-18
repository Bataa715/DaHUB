"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type {
  ExpenseTxRow,
  ExpenseVerificationStatus,
  ExpenseVerificationTypeRow,
  ContractCurrency,
  BudgetStatusOverride,
} from "@/lib/api";
import {
  STATUS_META,
  fmtAmount,
  CONTRACT_CURRENCIES,
  BUDGET_STATE_META,
} from "./expense-format";
import { VarianceHint, MoneyInput } from "./expense-ui";

/**
 * Аудиторын баталгаажуулалт — дүгнэлт, төрөл, гэрээний мэдээлэл, тайлбар.
 * Маягтын state үндсэн хэрэгсэлд (хадгалсны дараа хүснэгтийн мөрийг шинэчилдэг).
 */
export function ExpenseVerificationDialog({
  verificationDialogTx,
  setVerificationDialogTx,
  verStatus,
  setVerStatus,
  verType,
  setVerType,
  verContractDate,
  setVerContractDate,
  verContractAmount,
  setVerContractAmount,
  verContractCurrency,
  setVerContractCurrency,
  verContractNumber,
  setVerContractNumber,
  verRemainingAmount,
  setVerRemainingAmount,
  verBudgetOverride,
  setVerBudgetOverride,
  verComment,
  setVerComment,
  verAuthorityViolated,
  setVerAuthorityViolated,
  verAuthorityComment,
  setVerAuthorityComment,
  savingVerification,
  verificationTypes,
  typesLoading,
  isSuperAdmin,
  saveVerification,
}: {
  verificationDialogTx: ExpenseTxRow | null;
  setVerificationDialogTx: (tx: ExpenseTxRow | null) => void;
  verStatus: ExpenseVerificationStatus | "";
  setVerStatus: (status: ExpenseVerificationStatus) => void;
  verType: string;
  setVerType: (value: string) => void;
  verContractDate: string;
  setVerContractDate: (value: string) => void;
  verContractAmount: number;
  setVerContractAmount: (value: number) => void;
  verContractCurrency: ContractCurrency;
  setVerContractCurrency: (value: ContractCurrency) => void;
  verContractNumber: string;
  setVerContractNumber: (value: string) => void;
  verRemainingAmount: number;
  setVerRemainingAmount: (value: number) => void;
  verBudgetOverride: BudgetStatusOverride;
  setVerBudgetOverride: (value: BudgetStatusOverride) => void;
  verComment: string;
  setVerComment: (value: string) => void;
  verAuthorityViolated: boolean;
  setVerAuthorityViolated: (value: boolean) => void;
  verAuthorityComment: string;
  setVerAuthorityComment: (value: string) => void;
  savingVerification: boolean;
  verificationTypes: ExpenseVerificationTypeRow[];
  typesLoading: boolean;
  isSuperAdmin: boolean;
  saveVerification: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Dialog
      open={verificationDialogTx != null}
      onOpenChange={(open) => {
        if (!open) setVerificationDialogTx(null);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            {t("zaExpVerificationDialogTitle")}
          </DialogTitle>
        </DialogHeader>

        {/* ── Гүйлгээний контекст — аудитор юуг үнэлж байгаагаа
               дэлгэц солилгүй харна ────────────────────────────────── */}
        {verificationDialogTx && (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              {t("zaExpVerContextTitle")}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
              <div className="min-w-0">
                <div className="text-muted-foreground">
                  {t("zaExpDialogBookNumberLabel")}
                </div>
                <div className="font-mono font-medium text-foreground truncate">
                  {verificationDialogTx.book_number || "—"}
                </div>
              </div>
              <div className="min-w-0 col-span-2">
                <div className="text-muted-foreground">
                  {t("zaExpDialogCustomerLabel")}
                </div>
                <div className="font-medium text-foreground truncate">
                  {verificationDialogTx.customer_name || "—"}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground">
                  {t("zaExpDialogAmountLabel")}
                </div>
                <div className="font-semibold tabular-nums text-foreground">
                  ₮{fmtAmount(verificationDialogTx.debit_amount)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1">
          {/* ── Аудитын дүгнэлт — сонголт биш, харагдахуйц товчнууд ── */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              {t("zaExpStatusLabel")}
              <span className="ml-2 normal-case font-normal tracking-normal text-[11px] text-muted-foreground/80">
                {t("zaExpVerStatusHint")}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["normal", "emerald"],
                  ["questionable", "amber"],
                  ["attention", "rose"],
                ] as const
              ).map(([value, tone]) => {
                const active = verStatus === value;
                const meta = STATUS_META[value];
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setVerStatus(value as ExpenseVerificationStatus)
                    }
                    disabled={savingVerification}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-xs font-medium transition-all",
                      "flex items-center justify-center gap-2",
                      active
                        ? tone === "emerald"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                          : tone === "amber"
                            ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30"
                            : "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-1 ring-rose-500/30"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block w-2 h-2 rounded-full shrink-0",
                        meta.dot,
                      )}
                    />
                    {t(meta.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Төрөл + Гэрээний огноо + Гэрээний дүн ─────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {t("zaExpVerTypeLabel")}
                </label>
                {isSuperAdmin && (
                  <Link
                    href="/admin/zainii-audit"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-3 h-3" />
                    {t("zaExpManageTypesBtn")}
                  </Link>
                )}
              </div>
              <Select value={verType || undefined} onValueChange={setVerType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("zaExpVerTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {typesLoading && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t("loading")}
                    </div>
                  )}
                  {verificationTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.name}>
                      {vt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {t("zaExpContractDateLabel")}
              </label>
              <Input
                type="date"
                value={verContractDate}
                onChange={(e) => setVerContractDate(e.target.value)}
                disabled={savingVerification}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {t("zaExpContractAmountLabel")}
              </label>
              <div className="flex gap-1.5">
                <Select
                  value={verContractCurrency}
                  onValueChange={(v) =>
                    setVerContractCurrency(v as ContractCurrency)
                  }
                  disabled={savingVerification}
                >
                  <SelectTrigger
                    className="w-[84px] shrink-0"
                    aria-label={t("zaExpContractCurrencyLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MoneyInput
                  value={verContractAmount}
                  onChange={setVerContractAmount}
                  disabled={savingVerification}
                  className="flex-1"
                />
              </div>
              {/* Гэрээний дүн ба гүйлгээний дүнгийн зөрүүг шууд харуулна —
                  аудитор тооцоолол хийхгүйгээр хазайлтыг олж харна. */}
              {verContractAmount > 0 && verificationDialogTx && (
                <VarianceHint
                  contract={verContractAmount}
                  actual={verificationDialogTx.debit_amount}
                />
              )}
            </div>
          </div>

          {/* ── Гэрээний дугаар + Үлдэгдэл төлбөр + Төсөвтэй эсэх (гараар) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("zaExpContractNumberLabel")}
              </label>
              <Input
                value={verContractNumber}
                onChange={(e) => setVerContractNumber(e.target.value)}
                disabled={savingVerification}
                placeholder={t("zaExpContractNumberPlaceholder")}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("zaExpRemainingAmountLabel")}
              </label>
              <MoneyInput
                value={verRemainingAmount}
                onChange={setVerRemainingAmount}
                disabled={savingVerification}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("zaExpBudgetOverrideLabel")}
              </label>
              <Select
                value={verBudgetOverride || "auto"}
                onValueChange={(v) =>
                  setVerBudgetOverride(
                    v === "auto" ? "" : (v as BudgetStatusOverride),
                  )
                }
                disabled={savingVerification}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {t("zaExpBudgetOverrideAuto")}
                  </SelectItem>
                  <SelectItem value="has_budget">
                    {t(BUDGET_STATE_META.has_budget.labelKey)}
                  </SelectItem>
                  <SelectItem value="additional_budget">
                    {t(BUDGET_STATE_META.additional_budget.labelKey)}
                  </SelectItem>
                  <SelectItem value="no_budget">
                    {t(BUDGET_STATE_META.no_budget.labelKey)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {t("zaExpPaymentPurposeLabel")}
            </label>
            <Textarea
              value={verComment}
              onChange={(e) => setVerComment(e.target.value)}
              placeholder={t("zaExpCommentPlaceholder")}
              rows={4}
              disabled={savingVerification}
            />
          </div>

          {/* ── Эрхийн матриц зөрчсөн эсэх ─────────────────────────────── */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Checkbox
                checked={verAuthorityViolated}
                onCheckedChange={(v) => setVerAuthorityViolated(v === true)}
                disabled={savingVerification}
              />
              {t("zaExpAuthorityViolatedLabel")}
            </label>
            {verAuthorityViolated && (
              <Textarea
                className="mt-2"
                value={verAuthorityComment}
                onChange={(e) => setVerAuthorityComment(e.target.value)}
                placeholder={t("zaExpAuthorityCommentPlaceholder")}
                rows={3}
                disabled={savingVerification}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setVerificationDialogTx(null)}
            disabled={savingVerification}
          >
            {t("cancel")}
          </Button>
          <Button onClick={saveVerification} disabled={savingVerification}>
            {savingVerification && (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            )}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
