"use client";

import { ExpenseReportDialog } from "./_expense/ExpenseReportDialog";
import { ExpenseVerificationDialog } from "./_expense/ExpenseVerificationDialog";
import { ExpenseDrilldownDialog } from "./_expense/ExpenseDrilldownDialog";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  Wallet,
  Search,
  Loader2,
  AlertTriangle,
  PieChart,
  Users2,
  List,
  FileSpreadsheet,
  FileText,
  Eye,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  HamaaralRow,
} from "@/lib/api";
import {
  DEFAULT_MIN_AMOUNT,
  DEFAULT_DAYS_BACK,
  TX_PAGE,
  TX_PAGE_STEP,
  AUTO_SEARCH_DEBOUNCE_MS,
  today,
  daysAgo,
  fmtAmount,
  rowSearchHaystack,
  CHART_COLORS,
  DrillSectionState,
} from "./_expense/expense-format";
import { StatRow } from "./_expense/expense-ui";
import { ExpenseTxTable } from "./_expense/ExpenseTxTable";
import {
  BudgetTypePie,
  BudgetTypeTable,
  TotalKpiRow,
  BreakdownChart,
} from "./_expense/ExpenseTotalCharts";

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

  // [FIX] Өмнө нь энэ effect зөвхөн mount дээр НЭГ удаа хайдаг байсан тул
  // хэрэглэгч эхлэх огноог сольсон ч жагсаалт хуучин хэвээр үлдэж "шүүлтүүр
  // ажиллахгүй байна" гэсэн мэдрэмж төрүүлдэг байв. Одоо шүүлтүүр
  // (огноо / доод дүн) өөрчлөгдөх БҮРД автоматаар дахин татна: анхны
  // ачаалалт шууд, дараагийнх нь debounce-оор.
  const filterKey = `${startDate}|${endDate}|${minAmount}`;
  const appliedFilterRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bootstrapped) return;
    if (appliedFilterRef.current === filterKey) return;
    const isFirst = appliedFilterRef.current === null;
    const timer = setTimeout(
      () => {
        void handleSearch();
      },
      isFirst ? 0 : AUTO_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, filterKey]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseOverviewResult | null>(null);
  // Одоо дэлгэц дээр харагдаж буй өгөгдлийг ЯГ ямар шүүлтүүр гаргасныг
  // хадгална — "шүүлтүүр ажилласан уу?" гэсэн эргэлзээг арилгана.
  const [appliedFilter, setAppliedFilter] = useState<{
    startDate: string;
    endDate: string;
    minAmount: number;
  } | null>(null);
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
  const [verContractDate, setVerContractDate] = useState("");
  const [verContractNumber, setVerContractNumber] = useState("");
  const [verRemainingAmount, setVerRemainingAmount] = useState(0);
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

  // "Нийт зардал" нээлттэй байхад огноо солиход мөн адил автоматаар татна.
  // Хаагдахад ref-ийг цэвэрлэнэ — дараагийн удаа нээхэд шинээр татагдана.
  const totalFilterKey = `${startDate}|${endDate}`;
  const appliedTotalRef = useRef<string | null>(null);

  useEffect(() => {
    if (!totalOpen) {
      appliedTotalRef.current = null;
      return;
    }
    if (appliedTotalRef.current === totalFilterKey) return;
    const isFirst = appliedTotalRef.current === null;
    const timer = setTimeout(
      () => {
        void loadTotal();
      },
      isFirst ? 0 : AUTO_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalOpen, totalFilterKey]);

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
    setVerContractDate(tx.contract_date || "");
    setVerContractNumber(tx.contract_number || "");
    setVerRemainingAmount(tx.remaining_amount || 0);
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
        contractDate: verContractDate || undefined,
        contractNumber: verContractNumber || undefined,
        remainingAmount: verRemainingAmount,
        status: verStatus || undefined,
      });
      patchTransaction(verificationDialogTx.book_number, {
        comment: row.comment,
        verification_type: row.verificationType,
        contract_total_amount: row.contractTotalAmount,
        contract_date: row.contractDate,
        contract_number: row.contractNumber,
        remaining_amount: row.remainingAmount,
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
    // "Хайх" товчоор гараар дуудсан үед ч тэмдэглэнэ — дараа нь авто-effect
    // ижил шүүлтүүрээр давхар query явуулахгүй.
    appliedFilterRef.current = `${startDate}|${endDate}|${minAmount}`;
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
      setAppliedFilter({ startDate, endDate, minAmount });
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

  /** "Нийт зардал"-ын өгөгдлийг татна (нээх үйлдлээс ТУСДАА — ингэснээр
   *  огноо солиход дахин татах боломжтой). */
  async function loadTotal() {
    if (!startDate || !endDate) {
      toast({
        title: t("zaRptDateMissingTitle"),
        description: t("zaRptDateMissingDesc"),
        variant: "destructive",
      });
      return;
    }
    appliedTotalRef.current = `${startDate}|${endDate}`;
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

  function openTotalDialog() {
    setTotalOpen(true);
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

  // ── Word тайлан (Гүйлгээний анализын тайлан) татах диалог ────────────────
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportNumber, setReportNumber] = useState("");
  const [reportConclusion, setReportConclusion] = useState("");
  const [downloadingReport, setDownloadingReport] = useState(false);

  async function downloadReport() {
    if (!reportNumber.trim()) {
      toast({
        title: t("errorBoundaryTitle"),
        description: t("zaExpReportNumberRequired"),
        variant: "destructive",
      });
      return;
    }
    setDownloadingReport(true);
    try {
      const blob = await zainiiAuditExpenseApi.downloadExpenseReportDocx({
        startDate,
        endDate,
        minAmount,
        reportNumber: reportNumber.trim(),
        conclusionText: reportConclusion,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Гүйлгээний-анализын-тайлан-${reportNumber.trim()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setReportDialogOpen(false);
    } catch (e) {
      toast({
        title: t("errorBoundaryTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setDownloadingReport(false);
    }
  }

  // ── Хамааралтай / Холбоотой (hamaaral / holbootoi) ───────────────────────
  // "Дэлгэрэнгүй харах" асаах үед л дэлгэц дээрх мөрүүдийн харилцагчийн
  // кодоор нэг удаа batch татна — мөр бүрт тусад нь дуудахгүй.
  const [showRelations, setShowRelations] = useState(false);
  const [relationsMap, setRelationsMap] = useState<
    Record<string, HamaaralRow[]>
  >({});
  const [holbootoiSet, setHolbootoiSet] = useState<Set<string>>(new Set());
  const [relationsLoading, setRelationsLoading] = useState(false);
  const fetchedRelationCodes = useRef<Set<string>>(new Set());

  const loadRelationsFor = useCallback(
    async (codes: string[]) => {
      const toFetch = Array.from(new Set(codes)).filter(
        (c) => c && !fetchedRelationCodes.current.has(c),
      );
      if (toFetch.length === 0) return;
      toFetch.forEach((c) => fetchedRelationCodes.current.add(c));
      setRelationsLoading(true);
      try {
        const CHUNK = 1000;
        for (let i = 0; i < toFetch.length; i += CHUNK) {
          const chunk = toFetch.slice(i, i + CHUNK);
          const res = await zainiiAuditExpenseApi.getExpenseRelations(chunk);
          setRelationsMap((prev) => ({ ...prev, ...res.hamaaral }));
          setHolbootoiSet((prev) => {
            const next = new Set(prev);
            res.holbootoi.forEach((c) => next.add(c));
            return next;
          });
        }
      } catch (e) {
        toast({
          title: t("errorBoundaryTitle"),
          description: getApiErrorMessage(e),
          variant: "destructive",
        });
      } finally {
        setRelationsLoading(false);
      }
    },
    [toast, t],
  );

  useEffect(() => {
    if (!showRelations || !result) return;
    void loadRelationsFor(result.transactions.map((tx) => tx.customer_code));
  }, [showRelations, result, loadRelationsFor]);

  useEffect(() => {
    if (!showRelations || !totalOpen || !totalResult) return;
    void loadRelationsFor(
      totalResult.transactions.map((tx) => tx.customer_code),
    );
  }, [showRelations, totalOpen, totalResult, loadRelationsFor]);

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
      <div className="min-h-full bg-background text-foreground">
        <ToolPageHeader
          onBack={() => setTotalOpen(false)}
          icon={<PieChart className="w-4 h-4 text-sky-500" />}
          title={t("zaExpTotalDialogTitle")}
        />

        {/* Зардлын хяналтын хуудастай ЯГ ИЖИЛ шүүлтүүрийн мөр —
            огноо, доод дүн, хайлт, Excel татах. */}
        <div className="sticky top-14 z-[19] w-full min-w-0 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8 flex flex-wrap items-end gap-3 py-2.5">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[138px]">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
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
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
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
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
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
                onClick={() => void loadTotal()}
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
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
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

        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8 space-y-5 py-6">
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

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {filteredTotalTx.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("zaExpTableSearchEmpty")}
                  </p>
                ) : (
                  <ExpenseTxTable
                    rows={filteredTotalTx}
                    visibleCount={visibleTotalCount}
                    stickyHeader
                    showRelations={showRelations}
                    relationsMap={relationsMap}
                    holbootoiSet={holbootoiSet}
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
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        icon={<Wallet className="w-4 h-4 text-sky-500" />}
        title={t("zaBoxExpenseTitle")}
      />

      <div className="sticky top-14 z-[19] w-full min-w-0 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8 flex flex-wrap items-end gap-3 py-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[138px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
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
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
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
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
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
            <Button
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => setReportDialogOpen(true)}
              disabled={loading || filteredTx.length === 0}
            >
              <FileText className="w-3.5 h-3.5" />
              {t("zaExpReportBtn")}
            </Button>
            <Button
              variant={showRelations ? "secondary" : "outline"}
              className="gap-1.5 h-8"
              onClick={() => setShowRelations((v) => !v)}
              disabled={!result}
            >
              {relationsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {t("zaExpShowRelationsBtn")}
            </Button>
          </div>
          <div className="hidden sm:block w-px self-stretch min-h-[36px] bg-border/80" />
          <div className="flex flex-wrap items-end gap-2 sm:ml-auto">
            <div className="w-[240px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
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

      <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8 space-y-5 py-6">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
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

        {result && appliedFilter && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground">
              {appliedFilter.startDate} → {appliedFilter.endDate}
            </span>
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/40 px-2 py-0.5">
              {t("zaExpMinAmountLabel")}: ₮{fmtAmount(appliedFilter.minAmount)}
            </span>
            <span>
              {t("zaExpListedTxCount")}: {result.transactions.length}
            </span>
          </div>
        )}

        {result && (
          <>
            {result.truncated && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t("zaExpTruncatedWarning")}
              </div>
            )}

            {Number(result.qualifyingCount) === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("zaExpNoQualifyingCustomers")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/40">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("zaExpKpiTitle")}
                      </h3>
                    </div>
                    <div className="flex-1 divide-y divide-border">
                      <StatRow
                        icon={Users2}
                        label={t("zaExpQualifyingCustomers")}
                        value={String(Number(result.qualifyingCount) || 0)}
                        tint="text-primary bg-primary/10 border-primary/20"
                      />
                      <StatRow
                        icon={List}
                        label={t("zaExpListedTxCount")}
                        value={String(result.transactions.length)}
                        tint="text-primary bg-primary/10 border-primary/20"
                      />
                      <StatRow
                        icon={Wallet}
                        label={t("zaExpTotalDebit")}
                        value={`₮${fmtAmount(Number(result.qualifyingTotalDebit) || 0)}`}
                        tint="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/40">
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

                <div className="rounded-2xl border border-border bg-card overflow-hidden">
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
                      showRelations={showRelations}
                      relationsMap={relationsMap}
                      holbootoiSet={holbootoiSet}
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
      <ExpenseDrilldownDialog
        selectedTx={selectedTx}
        closeDrilldown={closeDrilldown}
        drillLoading={drillLoading}
        drillError={drillError}
        drillRows={drillRows}
        attachSections={attachSections}
        budgetSections={budgetSections}
      />

      {/* Verification dialog */}
      <ExpenseVerificationDialog
        verificationDialogTx={verificationDialogTx}
        setVerificationDialogTx={setVerificationDialogTx}
        verStatus={verStatus}
        setVerStatus={setVerStatus}
        verType={verType}
        setVerType={setVerType}
        verContractDate={verContractDate}
        setVerContractDate={setVerContractDate}
        verContractAmount={verContractAmount}
        setVerContractAmount={setVerContractAmount}
        verContractNumber={verContractNumber}
        setVerContractNumber={setVerContractNumber}
        verRemainingAmount={verRemainingAmount}
        setVerRemainingAmount={setVerRemainingAmount}
        verComment={verComment}
        setVerComment={setVerComment}
        savingVerification={savingVerification}
        verificationTypes={verificationTypes}
        typesLoading={typesLoading}
        isSuperAdmin={isSuperAdmin}
        saveVerification={saveVerification}
      />

      {/* Word тайлан (Гүйлгээний анализын тайлан) татах диалог */}
      <ExpenseReportDialog
        reportDialogOpen={reportDialogOpen}
        setReportDialogOpen={setReportDialogOpen}
        downloadingReport={downloadingReport}
        reportNumber={reportNumber}
        setReportNumber={setReportNumber}
        reportConclusion={reportConclusion}
        setReportConclusion={setReportConclusion}
        downloadReport={downloadReport}
      />
    </div>
  );
}
