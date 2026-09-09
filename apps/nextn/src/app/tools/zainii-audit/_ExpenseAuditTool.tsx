"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
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
  PieChart,
  Users2,
  List,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
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
  downloadExpenseOverviewXlsx,
  downloadExpenseTotalXlsx,
} from "./_lib/expenseExcel";
import {
  zainiiAuditExpenseApi,
  getApiErrorMessage,
  ExpenseOverviewResult,
  ExpenseTxRow,
  ExpensePaymentRequestRow,
  ExpenseAttachmentRow,
  ExpenseBudgetChangeRow,
  ExpenseVerificationTypeRow,
  ExpenseVerificationStatus,
  ExpenseTotalResult,
  ExpenseTotalTxRow,
} from "@/lib/api";

const DEFAULT_MIN_AMOUNT = 50_000_000;
// Серверийн тохиргоо ирэх хүртэлх түр утга (админаас өөрчилнө).
const DEFAULT_DAYS_BACK = 7;

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
/** Өнөөдрөөс n хоногийн өмнөх огноо (локал цагийн бүсээр). */
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtLocalDate(d);
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(
    n ?? 0,
  );
}

function rowSearchHaystack(tx: {
  book_date?: string;
  customer_code?: string;
  customer_name?: string;
  account_code?: string;
  account_name?: string;
  currency_code?: string;
  debit_amount?: number;
  description?: string;
  department_name?: string;
  co_a_group_code?: string;
  co_a_group_name?: string;
  recievable_type_code?: string;
  recievable_type_name?: string;
  book_number?: string;
  has_payment_request?: 0 | 1;
  verification_type?: string;
  verification_status?: string;
  contract_total_amount?: number;
}): string {
  return [
    tx.book_date,
    tx.customer_code,
    tx.customer_name,
    tx.account_code,
    tx.account_name,
    tx.currency_code,
    tx.debit_amount,
    fmtAmount(Number(tx.debit_amount) || 0),
    tx.description,
    tx.department_name,
    tx.co_a_group_code,
    tx.co_a_group_name,
    tx.recievable_type_code,
    tx.recievable_type_name,
    tx.book_number,
    Number(tx.has_payment_request)
      ? "төлбөрийн хүсэлттэй has payment request"
      : "төлбөрийн хүсэлтгүй no payment request",
    tx.verification_type,
    tx.verification_status,
    tx.contract_total_amount,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");
}

const STATUS_META: Record<
  string,
  { labelKey: TranslationKey; dot: string; text: string }
> = {
  normal: {
    labelKey: "zaExpStatusNormal",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  questionable: {
    labelKey: "zaExpStatusQuestionable",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  attention: {
    labelKey: "zaExpStatusAttention",
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

export function ExpenseAuditTool() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  // Тохиргооны холбоос зөвхөн супер админд — админ хуудас нь superadmin-only.
  const isSuperAdmin = !!user?.isSuperAdmin;
  const searchAbort = useRef<AbortController | null>(null);

  const [startDate, setStartDate] = useState(daysAgo(DEFAULT_DAYS_BACK));
  const [endDate, setEndDate] = useState(today());
  const [minAmount, setMinAmount] = useState(DEFAULT_MIN_AMOUNT);
  // Нийт зардлын жагсаалтын доод дүнгийн шүүлтүүр — админы анхдагчаас
  // эхэлнэ. ⚠️ KPI болон задаргаанууд нь ХУГАЦААНЫ БҮТЭН дүн хэвээр;
  // энэ шүүлтүүр зөвхөн доорх гүйлгээний жагсаалтад үйлчилнэ.
  const [totalMinAmount, setTotalMinAmount] = useState(DEFAULT_MIN_AMOUNT);

  // Админы тохируулсан анхдагч утгыг mount дээр нэг удаа авна. Алдаа гарвал
  // кодын анхдагчаар (7 хоног / 50 сая) үргэлжилнэ — tool ажиллахаа болихгүй.
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    zainiiAuditExpenseApi
      .getSettings()
      .then((cfg) => {
        if (cancelled) return;
        setMinAmount(cfg.defaultMinAmount);
        setTotalMinAmount(cfg.defaultMinAmount);
        setStartDate(daysAgo(cfg.defaultDaysBack));
      })
      .catch(() => {
        /* анхдагч утга хэвээр */
      })
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Анхдагч утга бэлэн болмогц АВТОМАТААР нэг удаа хайна — хэрэглэгч
  // "Хайх" товч дарах шаардлагагүй. Дээрх setState-ууд нэг render-т
  // багцлагдсан тул энэ effect ажиллах үед state аль хэдийн шинэ утгатай.
  useEffect(() => {
    if (!bootstrapped) return;
    void handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseOverviewResult | null>(null);
  // [REVIEW/PERF] Хэдэн мөр DOM-д зурагдсан бэ (incremental render)
  const [visibleTxCount, setVisibleTxCount] = useState(TX_PAGE);
  const [visibleTotalCount, setVisibleTotalCount] = useState(TX_PAGE);
  const [tableSearchDraft, setTableSearchDraft] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [totalSearchDraft, setTotalSearchDraft] = useState("");
  const [totalSearch, setTotalSearch] = useState("");

  // Drill-down dialog (payment requests for one transaction's customer)
  const [selectedTx, setSelectedTx] = useState<ExpenseTxRow | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<ExpensePaymentRequestRow[]>([]);

  // Per-tulbur-row inline expand sections, keyed by invoice_id / book_number
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
      const types = await zainiiAuditExpenseApi.listVerificationTypes(true);
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
      const row = await zainiiAuditExpenseApi.upsertVerification({
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

  async function handleSearch() {
    if (!startDate || !endDate) {
      toast({
        title: t("zaRptDateMissingTitle"),
        description: t("zaRptDateMissingDesc"),
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
      const res = await zainiiAuditExpenseApi.getOverview(
        { startDate, endDate, minAmount },
        ac.signal,
      );
      setResult(res);
      setVisibleTxCount(TX_PAGE);
      setTableSearch("");
      setTableSearchDraft("");
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
        title: t("zaRptDateMissingTitle"),
        description: t("zaRptDateMissingDesc"),
        variant: "destructive",
      });
      return;
    }
    setTotalOpen(true);
    setTotalLoading(true);
    setTotalError(null);
    setVisibleTotalCount(TX_PAGE);
    setTotalSearch("");
    setTotalSearchDraft("");
    try {
      const res = await zainiiAuditExpenseApi.getTotal({ startDate, endDate });
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
    // Дараагийн удаа шинээр татахын тулд кэшийг хоослоно
    setAttachSections({});
    setBudgetSections({});
  }

  /**
   * Төлбөрийн хүсэлт бүрийн хавсралт болон төсвийн шилжүүлгийг зэрэг татна.
   * Өмнө нь мөр бүр дээр товч дарж нээдэг байсныг больж, нэг дэлгэцэнд
   * бүтнээр нь харуулдаг болгосон (аудиторын ажлыг хөнгөвчлөх).
   */
  function prefetchRowDetails(rows: ExpensePaymentRequestRow[]) {
    for (const row of rows) {
      const invoiceId = String(row.invoice_id ?? "");
      const bookNumber = String(row.book_number ?? "");

      if (invoiceId && !attachSections[invoiceId]) {
        setAttachSections((prev) => ({
          ...prev,
          [invoiceId]: { loading: true, error: null, rows: null },
        }));
        zainiiAuditExpenseApi
          .getAttachmentsByInvoice({ invoiceId })
          .then((res) =>
            setAttachSections((prev) => ({
              ...prev,
              [invoiceId]: { loading: false, error: null, rows: res.rows },
            })),
          )
          .catch((e) =>
            setAttachSections((prev) => ({
              ...prev,
              [invoiceId]: {
                loading: false,
                error: getApiErrorMessage(e),
                rows: null,
              },
            })),
          );
      }

      if (bookNumber && !budgetSections[bookNumber]) {
        setBudgetSections((prev) => ({
          ...prev,
          [bookNumber]: { loading: true, error: null, rows: null },
        }));
        zainiiAuditExpenseApi
          .getBudgetChangesByBookNumber({ bookNumber })
          .then((res) =>
            setBudgetSections((prev) => ({
              ...prev,
              [bookNumber]: { loading: false, error: null, rows: res.rows },
            })),
          )
          .catch((e) =>
            setBudgetSections((prev) => ({
              ...prev,
              [bookNumber]: {
                loading: false,
                error: getApiErrorMessage(e),
                rows: null,
              },
            })),
          );
      }
    }
  }

  async function openDrilldown(tx: ExpenseTxRow) {
    setSelectedTx(tx);
    setDrillLoading(true);
    setDrillError(null);
    setDrillRows([]);
    try {
      const res = await zainiiAuditExpenseApi.getPaymentRequestsByCustomer({
        customerCode: tx.customer_code,
        startDate,
        endDate,
      });
      setDrillRows(res.rows);
      // Аудитор товч дарж яваад байхгүйгээр бүх нэмэлт мэдээлэл нэг дор
      // харагдах ёстой — хавсралт болон төсвийн шилжүүлгийг урьдчилан татна.
      void prefetchRowDetails(res.rows);
    } catch (e) {
      setDrillError(getApiErrorMessage(e));
    } finally {
      setDrillLoading(false);
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
      if (!tx.has_payment_request) category = t("zaExpChartNoBudget");
      else if (!tx.budget_type) category = t("zaExpChartUnspecified");
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

  const filteredTx = useMemo(() => {
    if (!result) return [];
    const q = tableSearch.trim().toLowerCase();
    if (!q) return result.transactions;
    return result.transactions.filter((tx) =>
      rowSearchHaystack(tx).includes(q),
    );
  }, [result, tableSearch]);

  const filteredTotalTx = useMemo(() => {
    if (!totalResult) return [];
    const q = totalSearch.trim().toLowerCase();
    return totalResult.transactions.filter((tx) => {
      if (totalMinAmount > 0 && Number(tx.debit_amount) < totalMinAmount) {
        return false;
      }
      return q ? rowSearchHaystack(tx).includes(q) : true;
    });
  }, [totalResult, totalSearch, totalMinAmount]);

  const [exporting, setExporting] = useState(false);

  async function exportOverview() {
    if (exporting || filteredTx.length === 0) return;
    setExporting(true);
    try {
      await downloadExpenseOverviewXlsx({
        rows: filteredTx,
        startDate,
        endDate,
        minAmount,
        searchTerm: tableSearch,
        qualifyingCount: result?.qualifyingCount,
        qualifyingTotalDebit: result?.qualifyingTotalDebit,
      });
      toast({ title: t("zaExpExportDone") });
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  async function exportTotal() {
    if (exporting || !totalResult || filteredTotalTx.length === 0) return;
    setExporting(true);
    try {
      await downloadExpenseTotalXlsx({
        rows: filteredTotalTx,
        byGlGroup: totalResult.byGlGroup,
        byReceivableType: totalResult.byReceivableType,
        totalAmount: totalResult.totalAmount,
        startDate,
        endDate,
        minAmount: totalMinAmount,
        searchTerm: totalSearch,
      });
      toast({ title: t("zaExpExportDone") });
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  function applyTableSearch() {
    setTableSearch(tableSearchDraft);
    setVisibleTxCount(TX_PAGE);
  }

  function applyTotalSearch() {
    setTotalSearch(totalSearchDraft);
    setVisibleTotalCount(TX_PAGE);
  }

  if (totalOpen) {
    return (
      <div className="bg-background text-foreground min-h-screen">
        <ToolPageHeader
          onBack={() => setTotalOpen(false)}
          icon={<PieChart className="w-4 h-4 text-sky-500" />}
          title={t("zaExpTotalDialogTitle")}
        />

        {/* Зардлын хяналтын хуудастай ЯГ ИЖИЛ шүүлтүүрийн мөр —
            огноо, доод дүн, хайлт, Excel татах. */}
        <div className="sticky top-14 z-[19] w-full min-w-0 border-b border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl shadow-premium">
          <div className="px-4 md:px-6 py-2.5 flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[138px]">
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("tailan_startDateLabel")}
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={totalLoading}
                  className="text-sm h-8"
                />
              </div>
              <div className="w-[138px]">
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("tailan_endDateLabel")}
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={totalLoading}
                  className="text-sm h-8"
                />
              </div>
              <div className="w-[160px]">
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("zaExpMinAmountLabel")}
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1_000_000}
                  value={totalMinAmount}
                  onChange={(e) => {
                    setTotalMinAmount(Number(e.target.value) || 0);
                    setVisibleTotalCount(TX_PAGE);
                  }}
                  disabled={totalLoading}
                  className="text-sm h-8"
                />
              </div>
              <Button
                onClick={openTotalDialog}
                disabled={totalLoading}
                className="gap-1.5 h-8"
              >
                {totalLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                {t("zaRptSearchBtn")}
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 h-8"
                onClick={() => void exportTotal()}
                disabled={
                  exporting || totalLoading || filteredTotalTx.length === 0
                }
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                {exporting ? t("zaExpExporting") : t("zaExpExportBtn")}
              </Button>
            </div>
            <div className="hidden sm:block w-px self-stretch min-h-[36px] bg-border/80" />
            <div className="flex flex-wrap items-end gap-2 sm:ml-auto">
              <div className="w-[240px]">
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("zaExpTableSearchLabel")}
                </label>
                <Input
                  value={totalSearchDraft}
                  onChange={(e) => setTotalSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyTotalSearch();
                  }}
                  placeholder={t("zaExpTableSearchPlaceholder")}
                  className="text-sm h-8"
                  disabled={!totalResult}
                />
              </div>
              <Button
                variant="secondary"
                className="h-8 gap-1.5"
                onClick={applyTotalSearch}
                disabled={!totalResult}
              >
                <Search className="w-3.5 h-3.5" />
                {t("zaRptSearchBtn")}
              </Button>
              {totalResult && (totalSearch || totalMinAmount > 0) && (
                <span className="pb-1.5 text-[11px] text-muted-foreground tabular-nums">
                  {filteredTotalTx.length}/{totalResult.transactions.length}
                </span>
              )}
            </div>
          </div>
        </div>

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
              <TotalKpiRow
                rows={totalResult.transactions}
                totalAmount={totalResult.totalAmount}
              />

              {totalResult.truncated && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t("zaExpTruncatedWarning")}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownChart
                  title={t("zaExpByGlGroupTitle")}
                  data={totalResult.byGlGroup}
                />
                <BreakdownChart
                  title={t("zaExpByReceivableTypeTitle")}
                  data={totalResult.byReceivableType}
                />
              </div>

              <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
                {filteredTotalTx.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("zaExpTableSearchEmpty")}
                  </p>
                ) : (
                  <ExpenseTxTable
                    rows={filteredTotalTx}
                    visibleCount={visibleTotalCount}
                    stickyHeader
                  />
                )}
                {visibleTotalCount < filteredTotalTx.length && (
                  <div className="border-t border-border px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() =>
                        setVisibleTotalCount((n) =>
                          Math.min(n + TX_PAGE_STEP, filteredTotalTx.length),
                        )
                      }
                    >
                      {t("zaExpShowMore")} ({visibleTotalCount}/
                      {filteredTotalTx.length})
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
        href="/tools/zainii-audit"
        icon={<Wallet className="w-4 h-4 text-sky-500" />}
        title={t("zaBoxExpenseTitle")}
      />

      <div className="sticky top-14 z-[19] w-full min-w-0 border-b border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl shadow-premium">
        <div className="px-4 md:px-6 py-2.5 flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[138px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t("tailan_startDateLabel")}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                className="text-sm h-8"
              />
            </div>
            <div className="w-[138px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t("tailan_endDateLabel")}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                className="text-sm h-8"
              />
            </div>
            <div className="w-[160px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t("zaExpMinAmountLabel")}
              </label>
              <Input
                type="number"
                min={0}
                step={1_000_000}
                value={minAmount}
                onChange={(e) => setMinAmount(Number(e.target.value) || 0)}
                disabled={loading}
                className="text-sm h-8"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="gap-1.5 h-8"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {t("zaRptSearchBtn")}
            </Button>
            <Button
              variant="outline"
              onClick={openTotalDialog}
              className="gap-1.5 h-8"
            >
              <PieChart className="w-3.5 h-3.5" />
              {t("zaExpTotalBtn")}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => void exportOverview()}
              disabled={exporting || loading || filteredTx.length === 0}
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              {exporting ? t("zaExpExporting") : t("zaExpExportBtn")}
            </Button>
          </div>
          <div className="hidden sm:block w-px self-stretch min-h-[36px] bg-border/80" />
          <div className="flex flex-wrap items-end gap-2 sm:ml-auto">
            <div className="w-[240px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t("zaExpTableSearchLabel")}
              </label>
              <Input
                value={tableSearchDraft}
                onChange={(e) => setTableSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyTableSearch();
                }}
                placeholder={t("zaExpTableSearchPlaceholder")}
                className="text-sm h-8"
                disabled={!result}
              />
            </div>
            <Button
              variant="secondary"
              className="h-8 gap-1.5"
              onClick={applyTableSearch}
              disabled={!result}
            >
              <Search className="w-3.5 h-3.5" />
              {t("zaRptSearchBtn")}
            </Button>
            {tableSearch && result && (
              <span className="pb-1.5 text-[11px] text-muted-foreground tabular-nums">
                {filteredTx.length}/{result.transactions.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 py-5 space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("zaExpEmptyState")}
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
                {t("zaExpTruncatedWarning")}
              </div>
            )}

            {Number(result.qualifyingCount) === 0 ? (
              <div className="rounded-sm border border-dashed border-border bg-card/40 px-6 py-10 text-center shadow-premium ring-hairline">
                <p className="text-sm font-medium text-foreground">
                  {t("zaExpNoQualifyingCustomers")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("zaExpKpiTitle")}
                      </h3>
                    </div>
                    <div className="flex-1 divide-y divide-border">
                      <StatRow
                        icon={Users2}
                        label={t("zaExpQualifyingCustomers")}
                        value={String(Number(result.qualifyingCount) || 0)}
                        tint="text-sky-500 bg-sky-500/10 border-sky-500/20"
                      />
                      <StatRow
                        icon={List}
                        label={t("zaExpListedTxCount")}
                        value={String(result.transactions.length)}
                        tint="text-sky-500 bg-sky-500/10 border-sky-500/20"
                      />
                      <StatRow
                        icon={Wallet}
                        label={t("zaExpTotalDebit")}
                        value={`₮${fmtAmount(Number(result.qualifyingTotalDebit) || 0)}`}
                        tint="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2 rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/40 to-muted/20">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("zaExpChartTitle")}
                      </h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center flex-1">
                      <BudgetTypePie data={chartData} />
                      <BudgetTypeTable data={chartData} />
                    </div>
                  </div>
                </div>

                <div className="rounded-sm border border-border bg-card overflow-hidden shadow-premium ring-hairline">
                  {filteredTx.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("zaExpTableSearchEmpty")}
                    </p>
                  ) : (
                    <ExpenseTxTable
                      rows={filteredTx}
                      visibleCount={visibleTxCount}
                      showVerification
                      onBookClick={openDrilldown}
                      onVerifyClick={openVerificationDialog}
                    />
                  )}
                  {visibleTxCount < filteredTx.length && (
                    <div className="border-t border-border px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() =>
                          setVisibleTxCount((n) =>
                            Math.min(n + TX_PAGE_STEP, filteredTx.length),
                          )
                        }
                      >
                        {t("zaExpShowMore")} ({visibleTxCount}/
                        {filteredTx.length})
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
                                  className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline text-left"
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
                                className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs border-b border-border/40 last:border-0 pb-2 last:pb-0"
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

      {/* Verification dialog */}
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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
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
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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

            {/* ── Төрөл + Гэрээний дүн зэрэгцээ ─────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("zaExpContractAmountLabel")}
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1_000_000}
                  value={verContractAmount}
                  onChange={(e) =>
                    setVerContractAmount(Number(e.target.value) || 0)
                  }
                  disabled={savingVerification}
                  className="tabular-nums"
                />
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

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("zaExpBudgetColDescription")}
              </label>
              <Textarea
                value={verComment}
                onChange={(e) => setVerComment(e.target.value)}
                placeholder={t("zaExpCommentPlaceholder")}
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
    </div>
  );
}

/**
 * Төлбөрийн хүсэлтийн доорх нэмэлт мэдээллийн самбар (хавсралт / төсөв).
 * Товч дарах шаардлагагүй — агуулга нь ачаалагдмагц шууд харагдана.
 */
function DetailPanel({
  icon,
  title,
  count,
  loading,
  error,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  loading?: boolean;
  error?: string | null;
  empty: string;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const isEmpty = !loading && !error && (count ?? 0) === 0;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/50 bg-muted/40">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[11px] font-semibold text-foreground">
          {title}
        </span>
        {!loading && !error && (count ?? 0) > 0 && (
          <span className="ml-auto rounded-full bg-foreground/10 px-1.5 text-[10px] font-medium tabular-nums text-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="p-2.5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {t("loading")}
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
        {isEmpty && (
          <div className="text-xs text-muted-foreground/70 italic">{empty}</div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Гэрээний дүн ба бодит гүйлгээний дүнгийн зөрүү.
 * Аудитор нэмэлт тооцоолол хийхгүйгээр хазайлтыг шууд харна.
 */
function VarianceHint({
  contract,
  actual,
}: {
  contract: number;
  actual: number;
}) {
  const { t } = useLanguage();
  const diff = actual - contract;
  const pct = contract > 0 ? (diff / contract) * 100 : 0;

  if (Math.abs(diff) < 1) {
    return (
      <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
        {t("zaExpVerVarianceEqual")}
      </p>
    );
  }

  const over = diff > 0;
  return (
    <p
      className={cn(
        "mt-1.5 text-[11px] tabular-nums",
        over ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
      )}
    >
      {t("zaExpVerVariance")}: {over ? "+" : "−"}₮{fmtAmount(Math.abs(diff))}
      {" · "}
      {over ? t("zaExpVerVarianceOver") : t("zaExpVerVarianceUnder")}
      {contract > 0 && ` (${over ? "+" : "−"}${Math.abs(pct).toFixed(1)}%)`}
    </p>
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

function colSortValue(
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
    case "book":
      return Number(tx.has_payment_request) || 0;
    case "verification":
      return (
        tx.verification_type ||
        tx.verification_status ||
        ""
      ).toLowerCase();
  }
}

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

/**
 * Төлбөрийн хүсэлтийн холбоосын ГУРВАН төлөв.
 *
 * Аудиторын хувьд "яг тохирсон" ба "харилцагчаар нь таамагласан" хоёрын
 * ялгаа чухал тул нэг өнгөөр харуулж болохгүй:
 *
 *   matched   — gl_number нь гүйлгээний дугаартай ЯГ тохирсон  → ногоон
 *   inferred  — зөвхөн харилцагчийн кодоор олдсон              → цагаан
 *   none      — огт олдоогүй                                   → улаавтар
 */
type PayState = "matched" | "inferred" | "none";

function payState(tx: {
  has_payment_request?: 0 | 1;
  has_customer_payment_request?: 0 | 1;
}): PayState {
  if (Number(tx.has_payment_request)) return "matched";
  if (Number(tx.has_customer_payment_request)) return "inferred";
  return "none";
}

const PAY_BADGE: Record<
  PayState,
  { cls: string; labelKey: TranslationKey; hintKey: TranslationKey }
> = {
  matched: {
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    labelKey: "zaExpPayMatch",
    hintKey: "zaExpPayMatchHint",
  },
  inferred: {
    // Цагаан дэвсгэр — "байгаа ч шууд нотлогдоогүй" гэдгийг зөөлөн илэрхийлнэ
    cls: "border-border bg-background text-foreground",
    labelKey: "zaExpPayInferred",
    hintKey: "zaExpPayInferredHint",
  },
  none: {
    cls: "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400",
    labelKey: "zaExpPayNone",
    hintKey: "zaExpPayNoneHint",
  },
};

function PayRequestBadge({
  state,
  onClick,
  title,
}: {
  state: PayState;
  onClick?: () => void;
  title?: string;
}) {
  const { t } = useLanguage();
  const meta = PAY_BADGE[state];
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.cls,
      )}
    >
      {state === "matched" && <CheckCircle2 className="w-3 h-3 shrink-0" />}
      {state === "inferred" && <Users2 className="w-3 h-3 shrink-0" />}
      {state === "none" && <AlertTriangle className="w-3 h-3 shrink-0" />}
      {t(meta.labelKey)}
    </span>
  );

  const hint = `${t(meta.hintKey)}${title ? ` \u2014 ${title}` : ""}`;

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

function ExpenseTxTable({
  rows,
  visibleCount,
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
  visibleCount?: number;
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
    return all;
  }, [showVerification, t]);

  const [widths, setWidths] = useState<Partial<Record<ExpColKey, number>>>({});
  const [sort, setSort] = useState<{
    key: ExpColKey;
    dir: "asc" | "desc";
  } | null>(null);
  useEffect(() => {
    setWidths(readExpStoredWidths());
  }, []);

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
      <div
        className={
          stickyHeader
            ? "max-h-[calc(100vh-8rem)] overflow-auto"
            : "overflow-x-auto"
        }
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
              {cols.map((col, i) => (
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
                    "relative px-2 py-2.5 text-xs font-bold text-foreground select-none border-b border-border cursor-pointer hover:bg-muted/50 group bg-card",
                    stickyHeader && "sticky top-0 z-[1]",
                    i < cols.length - 1 && "border-r border-border",
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
                  <Td className={cellLine}>{tx.book_date || "—"}</Td>
                  <Td className={cellLine}>
                    <CellPair code={tx.customer_code} name={tx.customer_name} />
                  </Td>
                  <Td className={cellLine}>
                    <CellPair code={tx.account_code} name={tx.account_name} />
                  </Td>
                  <Td
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      cellLine,
                    )}
                  >
                    {fmtAmount(tx.debit_amount)} {tx.currency_code}
                  </Td>
                  <Td className={cellLine}>{tx.description || "—"}</Td>
                  <Td className={cellLine}>{tx.department_name || "—"}</Td>
                  <Td className={cellLine}>
                    <CellPair
                      code={tx.co_a_group_code}
                      name={tx.co_a_group_name}
                    />
                  </Td>
                  <Td className={cellLine}>
                    <CellPair
                      code={tx.recievable_type_code}
                      name={tx.recievable_type_name}
                    />
                  </Td>
                  <Td className={showVerification ? cellLine : undefined}>
                    <PayRequestBadge
                      state={payState(tx)}
                      title={tx.book_number}
                      onClick={
                        onBookClick
                          ? () => onBookClick(tx as ExpenseTxRow)
                          : undefined
                      }
                    />
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
                            title={t("zaExpVerificationDialogTitle")}
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
        {t("zaExpBreakdownEmpty")}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <Th className="text-xs font-bold text-foreground bg-background border-b border-border">
              {t("zaExpChartTitle")}
            </Th>
            <Th className="text-right text-xs font-bold text-foreground bg-background border-b border-border">
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
function TotalKpiRow({
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
      tint: "text-sky-500 bg-sky-500/10 border-sky-500/20",
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
            className="rounded-xl border border-border bg-card shadow-premium ring-hairline px-4 py-3 flex items-center gap-3 min-w-0"
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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
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
function BreakdownChart({
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
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-premium ring-hairline flex flex-col min-h-0">
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
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {r.code} · {fmtAmount(r.count)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold tabular-nums text-foreground">
                        ₮{fmtAmount(r.total)}
                      </div>
                      <div className="text-[10px] tabular-nums text-muted-foreground">
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
