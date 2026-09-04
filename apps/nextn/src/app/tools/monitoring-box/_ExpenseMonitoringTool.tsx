"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Wallet,
  Search,
  Loader2,
  AlertTriangle,
  Paperclip,
  PiggyBank,
  ExternalLink,
  CheckCircle2,
  Pencil,
  Settings,
  Plus,
  Trash2,
  PieChart,
  Users2,
  List,
} from "lucide-react";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  expenseMonitoringApi,
  getApiErrorMessage,
  ExpenseOverviewResult,
  ExpenseTxRow,
  ExpensePaymentRequestRow,
  ExpenseAttachmentRow,
  ExpenseBudgetChangeRow,
  ExpenseVerificationTypeRow,
  ExpenseVerificationStatus,
  ExpenseTotalResult,
} from "@/lib/api";

const DEFAULT_MIN_AMOUNT = 50_000_000;

// [REVIEW/PERF] Сервер 20-30 мянган мөр буцааж болдог — бүгдийг зэрэг DOM-д
// зурвал browser царцана. Эхэндээ TX_PAGE мөр зурж, "Цааш үзэх" товчоор
// нэмж зурна (өгөгдөл бүрэн санах ойд байгаа тул KPI/график бүрэн хэвээр).
const TX_PAGE = 50;
const TX_PAGE_STEP = 50;

// [AUDIT] toISOString() нь UTC тул UTC+8 бүсэд огноо буруу шилждэг —
// _RelatedPartyTool.tsx-тэй ижил локал огнооны туслах функцүүд.
function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function today() {
  return fmtLocalDate(new Date());
}
function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return fmtLocalDate(d);
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(
    n ?? 0,
  );
}

const STATUS_META: Record<
  string,
  { labelKey: TranslationKey; dot: string; text: string }
> = {
  normal: {
    labelKey: "monExpStatusNormal",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  questionable: {
    labelKey: "monExpStatusQuestionable",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  attention: {
    labelKey: "monExpStatusAttention",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
};

const CHART_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

interface DrillSectionState<T> {
  loading: boolean;
  error: string | null;
  rows: T[] | null;
}

export function ExpenseMonitoringTool() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin || !!user?.isSuperAdmin;
  const searchAbort = useRef<AbortController | null>(null);

  const [startDate, setStartDate] = useState(monthsAgo(1));
  const [endDate, setEndDate] = useState(today());
  const [minAmount, setMinAmount] = useState(DEFAULT_MIN_AMOUNT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseOverviewResult | null>(null);
  // [REVIEW/PERF] Хэдэн мөр DOM-д зурагдсан бэ (incremental render)
  const [visibleTxCount, setVisibleTxCount] = useState(TX_PAGE);
  const [visibleTotalCount, setVisibleTotalCount] = useState(TX_PAGE);

  // Drill-down dialog (payment requests for one transaction's customer)
  const [selectedTx, setSelectedTx] = useState<ExpenseTxRow | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<ExpensePaymentRequestRow[]>([]);

  // Per-tulbur-row inline expand sections, keyed by invoice_id / book_number
  const [visibleAttach, setVisibleAttach] = useState<Set<string>>(new Set());
  const [visibleBudget, setVisibleBudget] = useState<Set<string>>(new Set());
  const [attachSections, setAttachSections] = useState<
    Record<string, DrillSectionState<ExpenseAttachmentRow>>
  >({});
  const [budgetSections, setBudgetSections] = useState<
    Record<string, DrillSectionState<ExpenseBudgetChangeRow>>
  >({});

  // Verification dialog (comment / type / contract amount / status)
  const [verificationDialogTx, setVerificationDialogTx] =
    useState<ExpenseTxRow | null>(null);
  const [verComment, setVerComment] = useState("");
  const [verType, setVerType] = useState("");
  const [verContractAmount, setVerContractAmount] = useState(0);
  const [verStatus, setVerStatus] = useState<ExpenseVerificationStatus | "">(
    "",
  );
  const [savingVerification, setSavingVerification] = useState(false);
  const [verificationTypes, setVerificationTypes] = useState<
    ExpenseVerificationTypeRow[]
  >([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // Verification-type manager (admin only)
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [allTypes, setAllTypes] = useState<ExpenseVerificationTypeRow[]>([]);
  const [typeManagerLoading, setTypeManagerLoading] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [savingNewType, setSavingNewType] = useState(false);

  // "Нийт зардал" (total expense, no customer/threshold filter) dialog
  const [totalOpen, setTotalOpen] = useState(false);
  const [totalLoading, setTotalLoading] = useState(false);
  const [totalError, setTotalError] = useState<string | null>(null);
  const [totalResult, setTotalResult] = useState<ExpenseTotalResult | null>(
    null,
  );

  function patchTransaction(bookNumber: string, patch: Partial<ExpenseTxRow>) {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            transactions: prev.transactions.map((tx) =>
              tx.book_number === bookNumber ? { ...tx, ...patch } : tx,
            ),
          }
        : prev,
    );
  }

  async function loadVerificationTypes() {
    if (verificationTypes.length > 0 || typesLoading) return;
    setTypesLoading(true);
    try {
      const types = await expenseMonitoringApi.listVerificationTypes(true);
      setVerificationTypes(types);
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setTypesLoading(false);
    }
  }

  function openVerificationDialog(tx: ExpenseTxRow) {
    setVerificationDialogTx(tx);
    setVerComment(tx.comment);
    setVerType(tx.verification_type);
    setVerContractAmount(tx.contract_total_amount);
    setVerStatus((tx.verification_status as ExpenseVerificationStatus) || "");
    void loadVerificationTypes();
  }

  async function saveVerification() {
    if (!verificationDialogTx) return;
    setSavingVerification(true);
    try {
      const row = await expenseMonitoringApi.upsertVerification({
        bookNumber: verificationDialogTx.book_number,
        comment: verComment,
        verificationType: verType,
        contractTotalAmount: verContractAmount,
        status: verStatus || undefined,
      });
      patchTransaction(verificationDialogTx.book_number, {
        comment: row.comment,
        verification_type: row.verificationType,
        contract_total_amount: row.contractTotalAmount,
        verification_status: row.status,
        has_verification: 1,
      });
      setVerificationDialogTx(null);
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setSavingVerification(false);
    }
  }

  async function openTypeManager() {
    setTypeManagerOpen(true);
    setTypeManagerLoading(true);
    try {
      const types = await expenseMonitoringApi.listVerificationTypes(false);
      setAllTypes(types);
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setTypeManagerLoading(false);
    }
  }

  async function addType() {
    const name = newTypeName.trim();
    if (!name) return;
    setSavingNewType(true);
    try {
      const type = await expenseMonitoringApi.createVerificationType(name);
      setAllTypes((prev) => [...prev, type]);
      setVerificationTypes((prev) => [...prev, type]);
      setNewTypeName("");
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setSavingNewType(false);
    }
  }

  async function toggleTypeActive(type: ExpenseVerificationTypeRow) {
    try {
      const updated = await expenseMonitoringApi.updateVerificationType(
        type.id,
        { isActive: !type.isActive },
      );
      setAllTypes((prev) =>
        prev.map((x) => (x.id === type.id ? updated : x)),
      );
      setVerificationTypes((prev) =>
        updated.isActive
          ? [...prev.filter((x) => x.id !== type.id), updated]
          : prev.filter((x) => x.id !== type.id),
      );
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    }
  }

  async function removeType(id: string) {
    try {
      await expenseMonitoringApi.deleteVerificationType(id);
      setAllTypes((prev) => prev.filter((x) => x.id !== id));
      setVerificationTypes((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    }
  }

  async function handleSearch() {
    if (!startDate || !endDate) {
      toast({
        title: t("monRptDateMissingTitle"),
        description: t("monRptDateMissingDesc"),
        variant: "destructive",
      });
      return;
    }
    searchAbort.current?.abort();
    const ac = new AbortController();
    searchAbort.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await expenseMonitoringApi.getOverview(
        { startDate, endDate, minAmount },
        ac.signal,
      );
      setResult(res);
      setVisibleTxCount(TX_PAGE);
    } catch (e) {
      if ((e as { code?: string })?.code === "ERR_CANCELED") return;
      const msg = getApiErrorMessage(e);
      setError(msg);
      toast({
        title: t("errorBoundaryTitle"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      if (searchAbort.current === ac) setLoading(false);
    }
  }

  async function openTotalDialog() {
    if (!startDate || !endDate) {
      toast({
        title: t("monRptDateMissingTitle"),
        description: t("monRptDateMissingDesc"),
        variant: "destructive",
      });
      return;
    }
    setTotalOpen(true);
    setTotalLoading(true);
    setTotalError(null);
    setVisibleTotalCount(TX_PAGE);
    try {
      const res = await expenseMonitoringApi.getTotal({ startDate, endDate });
      setTotalResult(res);
    } catch (e) {
      setTotalError(getApiErrorMessage(e));
    } finally {
      setTotalLoading(false);
    }
  }

  function closeDrilldown() {
    setSelectedTx(null);
    setDrillRows([]);
    setDrillError(null);
    setVisibleAttach(new Set());
    setVisibleBudget(new Set());
  }

  async function openDrilldown(tx: ExpenseTxRow) {
    setSelectedTx(tx);
    setDrillLoading(true);
    setDrillError(null);
    setDrillRows([]);
    try {
      const res = await expenseMonitoringApi.getPaymentRequestsByCustomer({
        customerCode: tx.customer_code,
        startDate,
        endDate,
      });
      setDrillRows(res.rows);
    } catch (e) {
      setDrillError(getApiErrorMessage(e));
    } finally {
      setDrillLoading(false);
    }
  }

  function toggleAttachments(invoiceId: string) {
    setVisibleAttach((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
    if (!attachSections[invoiceId]) {
      setAttachSections((prev) => ({
        ...prev,
        [invoiceId]: { loading: true, error: null, rows: null },
      }));
      expenseMonitoringApi
        .getAttachmentsByInvoice({ invoiceId })
        .then((res) => {
          setAttachSections((prev) => ({
            ...prev,
            [invoiceId]: { loading: false, error: null, rows: res.rows },
          }));
        })
        .catch((e) => {
          setAttachSections((prev) => ({
            ...prev,
            [invoiceId]: {
              loading: false,
              error: getApiErrorMessage(e),
              rows: null,
            },
          }));
        });
    }
  }

  function toggleBudgetChanges(bookNumber: string) {
    setVisibleBudget((prev) => {
      const next = new Set(prev);
      if (next.has(bookNumber)) next.delete(bookNumber);
      else next.add(bookNumber);
      return next;
    });
    if (!budgetSections[bookNumber]) {
      setBudgetSections((prev) => ({
        ...prev,
        [bookNumber]: { loading: true, error: null, rows: null },
      }));
      expenseMonitoringApi
        .getBudgetChangesByBookNumber({ bookNumber })
        .then((res) => {
          setBudgetSections((prev) => ({
            ...prev,
            [bookNumber]: { loading: false, error: null, rows: res.rows },
          }));
        })
        .catch((e) => {
          setBudgetSections((prev) => ({
            ...prev,
            [bookNumber]: {
              loading: false,
              error: getApiErrorMessage(e),
              rows: null,
            },
          }));
        });
    }
  }

  // "Төсвийн төрөл" barchart — төлбөрийн хүсэлтгүй бол "Төсөвгүй", хүсэлттэй
  // ч холбогдох budget мөргүй бол "Тодорхойгүй", үгүй бол latest budget
  // мөрийн description-оор ангилна (backend аль хэдийн argMax-аар сонгосон).
  const chartData = useMemo(() => {
    if (!result) return [];
    const counts = new Map<string, number>();
    for (const tx of result.transactions) {
      let category: string;
      if (!tx.has_payment_request) category = t("monExpChartNoBudget");
      else if (!tx.budget_type) category = t("monExpChartUnspecified");
      else category = tx.budget_type;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value], i) => ({
        name,
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [result, t]);

  if (totalOpen) {
    return (
      <div className="bg-background text-foreground min-h-screen">
        <ToolPageHeader
          onBack={() => setTotalOpen(false)}
          icon={<PieChart className="w-4 h-4 text-sky-500" />}
          title={t("monExpTotalDialogTitle")}
          rightContent={
            <span className="text-xs text-muted-foreground tabular-nums">
              {startDate} – {endDate}
            </span>
          }
        />
        <div className="w-full px-4 md:px-6 py-5 space-y-5">
          {totalLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("loading")}
            </div>
          )}

          {totalError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {totalError}
            </div>
          )}

          {!totalLoading && !totalError && totalResult && (
            <>
              <StatCard
                icon={Wallet}
                label={t("monExpTotalDebit")}
                value={`₮${fmtAmount(totalResult.totalAmount)}`}
                tint="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
              />

              {totalResult.truncated && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t("monExpTruncatedWarning")}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownTable
                  title={t("monExpByGlGroupTitle")}
                  data={totalResult.byGlGroup}
                />
                <BreakdownTable
                  title={t("monExpByReceivableTypeTitle")}
                  data={totalResult.byReceivableType}
                />
              </div>

              <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
                <ExpenseTxTable
                  rows={totalResult.transactions.slice(0, visibleTotalCount)}
                  stickyHeader
                />
                {visibleTotalCount < totalResult.transactions.length && (
                  <div className="border-t border-border px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() =>
                        setVisibleTotalCount((n) =>
                          Math.min(
                            n + TX_PAGE_STEP,
                            totalResult.transactions.length,
                          ),
                        )
                      }
                    >
                      {t("monExpShowMore")} ({visibleTotalCount}/
                      {totalResult.transactions.length})
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <ToolPageHeader
        href="/tools/monitoring-box"
        icon={<Wallet className="w-4 h-4 text-sky-500" />}
        title={t("monBoxExpenseTitle")}
      />

      <div className="w-full px-4 md:px-6 py-5 space-y-5">
        {/* Filters */}
        <div className="rounded-sm border border-border bg-card p-4 shadow-premium ring-hairline">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[150px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("tailan_startDateLabel")}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                className="text-sm h-9"
              />
            </div>
            <div className="w-[150px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("tailan_endDateLabel")}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                className="text-sm h-9"
              />
            </div>
            <div className="w-[190px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("monExpMinAmountLabel")}
              </label>
              <Input
                type="number"
                min={0}
                step={1_000_000}
                value={minAmount}
                onChange={(e) => setMinAmount(Number(e.target.value) || 0)}
                disabled={loading}
                className="text-sm h-9"
              />
            </div>

            <Button onClick={handleSearch} disabled={loading} className="gap-2 h-9">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {t("monRptSearchBtn")}
            </Button>

            <Button
              variant="outline"
              onClick={openTotalDialog}
              className="gap-2 h-9"
            >
              <PieChart className="w-4 h-4" />
              {t("monExpTotalBtn")}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("monExpEmptyState")}
            </p>
          </div>
        )}

        {loading && !result && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("loading")}
          </div>
        )}

        {result && (
          <>
            {result.truncated && (
              <div className="flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400 shadow-premium ring-hairline">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t("monExpTruncatedWarning")}
              </div>
            )}

            {Number(result.qualifyingCount) === 0 ? (
              <div className="rounded-sm border border-dashed border-border bg-card/40 px-6 py-10 text-center shadow-premium ring-hairline">
                <p className="text-sm font-medium text-foreground">
                  {t("monExpNoQualifyingCustomers")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("monExpKpiTitle")}
                      </h3>
                    </div>
                    <div className="flex-1 divide-y divide-border">
                      <StatRow
                        icon={Users2}
                        label={t("monExpQualifyingCustomers")}
                        value={String(Number(result.qualifyingCount) || 0)}
                        tint="text-sky-500 bg-sky-500/10 border-sky-500/20"
                      />
                      <StatRow
                        icon={List}
                        label={t("monExpListedTxCount")}
                        value={String(result.transactions.length)}
                        tint="text-sky-500 bg-sky-500/10 border-sky-500/20"
                      />
                      <StatRow
                        icon={Wallet}
                        label={t("monExpTotalDebit")}
                        value={`₮${fmtAmount(Number(result.qualifyingTotalDebit) || 0)}`}
                        tint="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2 rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("monExpChartTitle")}
                      </h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center flex-1">
                      <BudgetTypePie data={chartData} />
                      <BudgetTypeTable data={chartData} />
                    </div>
                  </div>
                </div>

                <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
                  <ExpenseTxTable
                    rows={result.transactions.slice(0, visibleTxCount)}
                    showVerification
                    onBookClick={openDrilldown}
                    onVerifyClick={openVerificationDialog}
                  />
                  {visibleTxCount < result.transactions.length && (
                    <div className="border-t border-border px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() =>
                          setVisibleTxCount((n) =>
                            Math.min(
                              n + TX_PAGE_STEP,
                              result.transactions.length,
                            ),
                          )
                        }
                      >
                        {t("monExpShowMore")} ({visibleTxCount}/
                        {result.transactions.length})
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drill-down dialog: payment requests for one transaction's customer */}
      <Dialog
        open={selectedTx != null}
        onOpenChange={(open) => {
          if (!open) closeDrilldown();
        }}
      >
        <DialogContent className="max-w-[min(960px,96vw)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("monExpDialogTitle")}</DialogTitle>
          </DialogHeader>

          {selectedTx && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground -mt-2 mb-1">
              <span>
                {t("monExpDialogBookNumberLabel")}:{" "}
                <span className="font-mono text-foreground">
                  {selectedTx.book_number}
                </span>
              </span>
              <span>
                {t("monExpDialogCustomerLabel")}:{" "}
                <span className="text-foreground">
                  {selectedTx.customer_name}
                </span>
              </span>
              <span>
                {t("monExpDialogAmountLabel")}:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  ₮{fmtAmount(selectedTx.debit_amount)}
                </span>
              </span>
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
              {t("monExpDialogNoMatch")}
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
                          {t("monExpDialogMatchedBadge")}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                      <Field label={t("monExpColCustomer")} value={row.customer_code} />
                      <Field label="" value={row.customer_name} />
                      <Field label={t("monExpColRequestDate")} value={row.request_date} />
                      <Field
                        label={t("monExpColRequestAmount")}
                        value={`₮${fmtAmount(row.request_amount)} ${row.currency_code}`}
                      />
                      <Field label={t("monExpColEmployee")} value={row.employee_name} />
                      <Field label={t("monRptColBank")} value={row.bank_name} />
                      <Field
                        label={t("monExpColAccountNumber")}
                        value={row.account_number}
                      />
                      <Field
                        label={t("monExpColTenderMethod")}
                        value={row.tender_method_name}
                      />
                      <Field label={t("monExpColInfoName")} value={row.description} />
                      <Field label={t("monExpColPurpose")} value={row.purpose} />
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => toggleAttachments(attachKey)}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {t("monExpBtnAttachment")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => toggleBudgetChanges(budgetKey)}
                      >
                        <PiggyBank className="w-3.5 h-3.5" />
                        {t("monExpBtnBudgetChange")}
                      </Button>
                    </div>

                    {visibleAttach.has(attachKey) && (
                      <div className="mt-2.5 rounded-md border border-border/60 bg-muted/20 p-2.5">
                        {attachState?.loading && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {t("loading")}
                          </div>
                        )}
                        {attachState?.error && (
                          <div className="text-xs text-destructive">
                            {attachState.error}
                          </div>
                        )}
                        {attachState?.rows && attachState.rows.length === 0 && (
                          <div className="text-xs text-muted-foreground">
                            {t("monExpAttachmentsEmpty")}
                          </div>
                        )}
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
                                  className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {a.file_name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {visibleBudget.has(budgetKey) && (
                      <div className="mt-2.5 rounded-md border border-border/60 bg-muted/20 p-2.5">
                        {budgetState?.loading && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {t("loading")}
                          </div>
                        )}
                        {budgetState?.error && (
                          <div className="text-xs text-destructive">
                            {budgetState.error}
                          </div>
                        )}
                        {budgetState?.rows && budgetState.rows.length === 0 && (
                          <div className="text-xs text-muted-foreground">
                            {t("monExpBudgetChangesEmpty")}
                          </div>
                        )}
                        {budgetState?.rows && budgetState.rows.length > 0 && (
                          <div className="space-y-2">
                            {budgetState.rows.map((b, k) => (
                              <div
                                key={k}
                                className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs border-b border-border/40 last:border-0 pb-2 last:pb-0"
                              >
                                <Field
                                  label={t("monExpBudgetColFromActivity")}
                                  value={b.from_activity_dtl_name}
                                />
                                <Field
                                  label={t("monExpBudgetColToActivity")}
                                  value={b.to_activity_dtl_name}
                                />
                                <Field
                                  label={t("monExpBudgetColAmount")}
                                  value={`₮${fmtAmount(b.amount)}`}
                                />
                                <Field
                                  label={t("monExpBudgetColTotalAmount")}
                                  value={`₮${fmtAmount(b.total_amount)}`}
                                />
                                <Field
                                  label={t("monExpColEmployee")}
                                  value={b.employee_name}
                                />
                                <Field
                                  label={t("monExpBudgetColFromEmployee")}
                                  value={b.from_employee_name}
                                />
                                <Field
                                  label={t("monExpBudgetColDescription")}
                                  value={b.description}
                                />
                                <Field
                                  label={t("monExpColPurpose")}
                                  value={b.purpose}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verification dialog */}
      <Dialog
        open={verificationDialogTx != null}
        onOpenChange={(open) => {
          if (!open) setVerificationDialogTx(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("monExpVerificationDialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("monExpVerTypeLabel")}
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openTypeManager}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-3 h-3" />
                    {t("monExpManageTypesBtn")}
                  </button>
                )}
              </div>
              <Select value={verType || undefined} onValueChange={setVerType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("monExpVerTypePlaceholder")} />
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
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("monExpContractAmountLabel")}
              </label>
              <Input
                type="number"
                min={0}
                value={verContractAmount}
                onChange={(e) =>
                  setVerContractAmount(Number(e.target.value) || 0)
                }
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("monExpStatusLabel")}
              </label>
              <Select
                value={verStatus || undefined}
                onValueChange={(v) =>
                  setVerStatus(v as ExpenseVerificationStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("monExpVerTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t("monExpStatusNormal")}</SelectItem>
                  <SelectItem value="questionable">
                    {t("monExpStatusQuestionable")}
                  </SelectItem>
                  <SelectItem value="attention">
                    {t("monExpStatusAttention")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("monExpBudgetColDescription")}
              </label>
              <Textarea
                value={verComment}
                onChange={(e) => setVerComment(e.target.value)}
                placeholder={t("monExpCommentPlaceholder")}
                rows={4}
                disabled={savingVerification}
              />
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

      {/* Verification-type manager (admin only) */}
      <Dialog open={typeManagerOpen} onOpenChange={setTypeManagerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("monExpTypeManagerTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Input
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder={t("monExpNewTypePlaceholder")}
              disabled={savingNewType}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addType();
              }}
            />
            <Button
              size="sm"
              onClick={addType}
              disabled={savingNewType || !newTypeName.trim()}
              className="gap-1.5 shrink-0"
            >
              {savingNewType ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {t("monExpAddTypeBtn")}
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {typeManagerLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("loading")}
              </div>
            )}
            {!typeManagerLoading && allTypes.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("monExpNoTypes")}
              </div>
            )}
            {!typeManagerLoading &&
              allTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <span
                    className={cn(
                      "text-sm",
                      !type.isActive && "text-muted-foreground line-through",
                    )}
                  >
                    {type.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleTypeActive(type)}
                      className={cn(
                        "text-[11px] font-medium rounded-md px-2 py-1 border",
                        type.isActive
                          ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {t("monExpTypeActiveLabel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeType(type.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CellPair({ code, name }: { code?: string; name?: string }) {
  const c = (code ?? "").trim();
  const n = (name ?? "").trim();
  if (!c && !n) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      {c ? <div className="font-mono break-all">{c}</div> : null}
      {n ? <div className="text-muted-foreground break-words">{n}</div> : null}
    </div>
  );
}

type ExpColKey =
  | "date"
  | "customer"
  | "account"
  | "amount"
  | "description"
  | "department"
  | "gl"
  | "receivable"
  | "book"
  | "verification";

type ExpColDef = {
  key: ExpColKey;
  label: string;
  align: "left" | "right";
  defaultWidth: number;
  minWidth: number;
};

const EXP_WIDTHS_KEY = "dahub.expense-tx-col-widths";

function readExpStoredWidths(): Partial<Record<ExpColKey, number>> {
  try {
    const raw = localStorage.getItem(EXP_WIDTHS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<ExpColKey, number>>;
  } catch {
    return {};
  }
}

function payRequestClass(tx: {
  has_payment_request?: 0 | 1;
  has_customer_payment_request?: 0 | 1;
}): string {
  if (Number(tx.has_payment_request)) {
    return "text-emerald-600 dark:text-emerald-400 font-semibold";
  }
  if (Number(tx.has_customer_payment_request)) {
    return "text-foreground";
  }
  return "text-amber-600 dark:text-amber-400";
}

function ExpenseTxTable({
  rows,
  showVerification = false,
  stickyHeader = false,
  onBookClick,
  onVerifyClick,
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
        >
      >
  >;
  showVerification?: boolean;
  stickyHeader?: boolean;
  onBookClick?: (tx: ExpenseTxRow) => void;
  onVerifyClick?: (tx: ExpenseTxRow) => void;
}) {
  const { t } = useLanguage();
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
        label: t("monExpColCustomer"),
        align: "left",
        defaultWidth: 160,
        minWidth: 100,
      },
      {
        key: "account",
        label: t("monExpColAccount"),
        align: "left",
        defaultWidth: 140,
        minWidth: 90,
      },
      {
        key: "amount",
        label: t("monExpColAmount"),
        align: "right",
        defaultWidth: 120,
        minWidth: 88,
      },
      {
        key: "description",
        label: t("monExpColDescription"),
        align: "left",
        defaultWidth: 200,
        minWidth: 110,
      },
      {
        key: "department",
        label: t("monExpColDepartment"),
        align: "left",
        defaultWidth: 140,
        minWidth: 90,
      },
      {
        key: "gl",
        label: t("monExpColGlGroup"),
        align: "left",
        defaultWidth: 150,
        minWidth: 90,
      },
      {
        key: "receivable",
        label: t("monExpColReceivableType"),
        align: "left",
        defaultWidth: 150,
        minWidth: 90,
      },
      {
        key: "book",
        label: t("monExpColBookNumber"),
        align: "left",
        defaultWidth: 130,
        minWidth: 88,
      },
    ];
    if (showVerification) {
      all.push({
        key: "verification",
        label: `${t("monExpColVerType")} / ${t("monExpColContractAmount")}`,
        align: "left",
        defaultWidth: 160,
        minWidth: 100,
      });
    }
    return all;
  }, [showVerification, t]);

  const [widths, setWidths] = useState<Partial<Record<ExpColKey, number>>>({});
  useEffect(() => {
    setWidths(readExpStoredWidths());
  }, []);

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
      {onBookClick && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[10px] border-b border-border text-muted-foreground bg-gradient-to-r from-muted/40 to-muted/20">
          <span className="text-xs font-semibold text-foreground mr-2">
            {t("monExpColBookNumber")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t("monExpPayMatch")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-foreground" />
            {t("monExpPayGuess")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {t("monExpPayNone")}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
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
          <thead
            className={
              stickyHeader
                ? "sticky top-14 z-10 bg-background"
                : "bg-background"
            }
          >
            <tr>
              {cols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "relative px-2 py-2.5 text-xs font-bold text-foreground bg-background select-none border-b border-border",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <span className="truncate block font-bold">{col.label}</span>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={(e) => onResizeStart(e, col)}
                    className="absolute top-0 -right-0.5 w-2 h-full cursor-col-resize z-10 group flex justify-center"
                  >
                    <span className="w-px h-full bg-transparent group-hover:bg-foreground/30" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((tx, i) => {
              const statusMeta = STATUS_META[tx.verification_status ?? ""];
              const payTitle = Number(tx.has_payment_request)
                ? t("monExpPayMatch")
                : Number(tx.has_customer_payment_request)
                  ? t("monExpPayGuess")
                  : t("monExpPayNone");
              return (
                <tr
                  key={`${tx.book_number}-${tx.customer_code}-${i}`}
                  className={cn(
                    "border-t border-border hover:bg-accent/10",
                    tx.has_verification && "bg-sky-500/5",
                  )}
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
                  <Td>
                    {onBookClick ? (
                      <button
                        type="button"
                        onClick={() => onBookClick(tx as ExpenseTxRow)}
                        title={payTitle}
                        className={cn(
                          "font-mono hover:underline break-all text-left",
                          payRequestClass(tx),
                        )}
                      >
                        {tx.book_number || "—"}
                      </button>
                    ) : (
                      <span
                        className={cn("font-mono break-all", payRequestClass(tx))}
                      >
                        {tx.book_number || "—"}
                      </span>
                    )}
                  </Td>
                  {showVerification && (
                    <Td>
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
                            title={t("monExpVerificationDialogTitle")}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BudgetTypePie({
  data,
}: {
  data: { name: string; value: number; fill: string }[];
}) {
  const { t } = useLanguage();
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t("monExpBreakdownEmpty")}
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

function BudgetTypeTable({
  data,
}: {
  data: { name: string; value: number; fill: string }[];
}) {
  const { t } = useLanguage();
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {t("monExpBreakdownEmpty")}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <Th className="text-xs font-bold text-foreground bg-background border-b border-border">
              {t("monExpChartTitle")}
            </Th>
            <Th className="text-right text-xs font-bold text-foreground bg-background border-b border-border">
              {t("monExpColCount")}
            </Th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const value = Number(d.value) || 0;
            return (
              <tr key={d.name} className="border-t border-border hover:bg-accent/10">
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

function BreakdownTable({
  title,
  data,
}: {
  title: string;
  data: { code: string; name: string; count: number; total: number }[];
}) {
  const { t } = useLanguage();
  const rows = data.map((d) => ({
    code: d.code?.trim() || "—",
    name: d.name?.trim() || "—",
    count: Number(d.count) || 0,
    total: Number(d.total) || 0,
  }));
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20">
        <div className="text-sm font-semibold text-foreground">{title}</div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("monExpBreakdownEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[480px]">
            <thead>
              <tr>
                <Th className="text-xs font-bold text-foreground bg-background border-b border-border">
                  {t("monExpColCode")}
                </Th>
                <Th className="text-xs font-bold text-foreground bg-background border-b border-border">
                  {t("monExpColName")}
                </Th>
                <Th className="text-right text-xs font-bold text-foreground bg-background border-b border-border">
                  {t("monExpColCount")}
                </Th>
                <Th className="text-right text-xs font-bold text-foreground bg-background border-b border-border">
                  {t("monExpColAmount")}
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.code}-${r.name}-${i}`}
                  className="border-t border-border hover:bg-accent/10"
                >
                  <Td className="font-mono font-semibold">{r.code}</Td>
                  <Td>{r.name}</Td>
                  <Td className="text-right tabular-nums font-semibold" nowrap>
                    {fmtAmount(r.count)}
                  </Td>
                  <Td>
                    <div className="text-right font-semibold tabular-nums">
                      ₮{fmtAmount(r.total)}
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{
                          width: `${Math.max(2, (r.total / max) * 100)}%`,
                        }}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      {label && <div className="text-muted-foreground">{label}</div>}
      <div className="text-foreground whitespace-pre-wrap break-words">
        {value || "—"}
      </div>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="px-4 py-4 flex items-center gap-3 flex-1">
      <div
        className={cn(
          "w-9 h-9 rounded-md border flex items-center justify-center shrink-0",
          tint,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold tabular-nums leading-none mb-1 break-words">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-card p-4 flex items-center gap-3 shadow-premium ring-hairline">
      <div
        className={cn(
          "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
          tint,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold tabular-nums leading-none mb-1 break-words">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-2 py-2 font-medium text-left align-bottom whitespace-normal break-words bg-card ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  nowrap = false,
}: {
  children: React.ReactNode;
  className?: string;
  nowrap?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 py-2 align-top text-foreground",
        nowrap ? "whitespace-nowrap" : "whitespace-normal break-words",
        className,
      )}
    >
      {children}
    </td>
  );
}
