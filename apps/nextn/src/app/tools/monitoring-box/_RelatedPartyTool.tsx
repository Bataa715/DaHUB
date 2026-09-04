"use client";

import { useMemo, useState } from "react";
import {
  monitoringApi,
  getApiErrorMessage,
  RelatedPartyResult,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users2,
  X,
  Search,
  Loader2,
  Download,
  ArrowRightLeft,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { downloadRelatedPartyWorkbook } from "./related-party-transactions/export";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type ResultTab = "summary" | "accounts" | "transactions";

const TX_PAGE = 200;
const TX_PAGE_STEP = 500;

// [AUDIT] toISOString() нь UTC тул UTC+8 бүсэд өглөө 08:00-аас өмнө "өчигдөр"
// буцааж сүүлийн өдрийн гүйлгээг алгасдаг байсан — локал огноо ашиглана.
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

export function RelatedPartyTool() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [cifInput, setCifInput] = useState("");
  const [cifIds, setCifIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(monthsAgo(3));
  const [endDate, setEndDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<RelatedPartyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");
  const [visibleTxCount, setVisibleTxCount] = useState(TX_PAGE);

  function addCifTokens(raw: string) {
    const tokens = raw
      .split(/[\s,;]+/)
      .map((tok) => tok.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setCifIds((prev) => Array.from(new Set([...prev, ...tokens])));
    setCifInput("");
  }

  function removeCif(id: string) {
    setCifIds((prev) => prev.filter((x) => x !== id));
  }

  async function handleSearch() {
    if (cifInput.trim()) addCifTokens(cifInput);
    const finalIds = cifInput.trim()
      ? Array.from(
          new Set([
            ...cifIds,
            ...cifInput
              .trim()
              .split(/[\s,;]+/)
              .map((x) => x.trim())
              .filter(Boolean),
          ]),
        )
      : cifIds;

    if (finalIds.length < 2) {
      toast({
        title: t("monRptCifMissingTitle"),
        description: t("monRptCifMissingDesc"),
        variant: "destructive",
      });
      return;
    }
    if (!startDate || !endDate) {
      toast({
        title: t("monRptDateMissingTitle"),
        description: t("monRptDateMissingDesc"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await monitoringApi.findRelatedPartyTransactions({
        customerIds: finalIds,
        startDate,
        endDate,
      });
      setResult(res);
      setVisibleTxCount(TX_PAGE);
      setActiveTab(
        res.summary.length > 0
          ? "summary"
          : res.transactions.length > 0
            ? "transactions"
            : "accounts",
      );
      if (res.transactions.length === 0) {
        toast({
          title: t("monRptNoTxTitle"),
          description: t("monRptNoTxDesc"),
        });
      }
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setError(msg);
      toast({
        title: t("errorBoundaryTitle"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!result || result.transactions.length === 0) return;
    setExporting(true);
    try {
      await downloadRelatedPartyWorkbook(result, startDate, endDate);
    } catch (e) {
      toast({
        title: t("monRptDownloadErrorTitle"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  const totalsByCurrency = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, number>();
    for (const s of result.summary) {
      map.set(s.CURRENCY, (map.get(s.CURRENCY) ?? 0) + s.TOTAL_AMOUNT);
    }
    return Array.from(map.entries());
  }, [result]);

  const canExport = !!result && result.transactions.length > 0;

  const tabs: { id: ResultTab; labelKey: TranslationKey; count: number }[] =
    result
      ? [
          {
            id: "summary",
            labelKey: "monRptTabSummary",
            count: result.summary.length,
          },
          {
            id: "accounts",
            labelKey: "monRptTabAccounts",
            count: result.accounts.length,
          },
          {
            id: "transactions",
            labelKey: "monRptTabTransactions",
            count: result.transactions.length,
          },
        ]
      : [];

  return (
    <div className="bg-background text-foreground min-h-screen">
      <ToolPageHeader
        href="/tools/monitoring-box"
        icon={<Users2 className="w-4 h-4 text-orange-500" />}
        title={t("monBoxRelatedPartyTitle")}
        rightContent={
          canExport ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-1.5 h-8"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {t("reportsOutputExcel")}
            </Button>
          ) : null
        }
      />

      <div className="w-full px-4 md:px-6 py-5 space-y-5 max-w-6xl">
        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {t("monRptCifListLabel")}
              </label>
              {cifIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <AnimatePresence>
                    {cifIds.map((id) => (
                      <motion.span
                        key={id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1 rounded-md bg-muted text-foreground border border-border pl-2 pr-1 py-0.5 text-xs font-mono"
                      >
                        {id}
                        <button
                          type="button"
                          onClick={() => removeCif(id)}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-background/60"
                          aria-label={`Remove ${id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <Input
                value={cifInput}
                onChange={(e) => setCifInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === " ") {
                    e.preventDefault();
                    addCifTokens(cifInput);
                  }
                }}
                onBlur={() => cifInput.trim() && addCifTokens(cifInput)}
                placeholder={t("monRptCifPlaceholder")}
                disabled={loading}
                className="text-sm h-9"
              />
            </div>

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

            <Button
              onClick={handleSearch}
              disabled={loading}
              className="gap-2 h-9"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {t("monRptSearchBtn")}
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
            <p className="text-sm font-medium text-foreground mb-3">
              {t("monRptEmptyState")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
              <span>1. {t("monRptEmptyHint1")}</span>
              <span className="hidden sm:inline text-border">·</span>
              <span>2. {t("monRptEmptyHint2")}</span>
            </div>
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
            {/* ── KPI strip ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard
                icon={Users2}
                label={t("monRptMatchedAccounts")}
                value={result.accounts.length}
                tint="text-sky-500 bg-sky-500/10 border-sky-500/20"
              />
              <StatCard
                icon={ArrowRightLeft}
                label={t("monRptFoundTx")}
                value={result.transactions.length}
                tint={
                  result.transactions.length > 0
                    ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                    : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                }
              />
              {totalsByCurrency.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="w-8 h-8 rounded-lg border border-border bg-muted/50 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    </span>
                    {t("monRptTotalByCurrency")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {totalsByCurrency.map(([ccy, amt]) => (
                      <div
                        key={ccy}
                        className="rounded-md bg-muted/50 border border-border px-2.5 py-1 text-xs"
                      >
                        <span className="text-muted-foreground mr-1.5">
                          {ccy}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {fmtAmount(amt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {result.truncated && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t("monExpTruncatedWarning")}
              </div>
            )}

            {/* ── Tabs ──────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-1 px-2 pt-2 border-b border-border overflow-x-auto scrollbar-none">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-3 py-2 text-xs font-semibold rounded-t-md border-b-2 -mb-px transition-colors whitespace-nowrap",
                      activeTab === tab.id
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(tab.labelKey)}
                    <span className="ml-1.5 tabular-nums text-muted-foreground font-normal">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="p-3">
                {activeTab === "summary" && (
                  result.summary.length === 0 ? (
                    <EmptyTab message={t("monRptNoTxDesc")} />
                  ) : (
                    <TableScroll>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b border-border sticky top-0 bg-card">
                            <Th>FROM_CIF</Th>
                            <Th>TO_CIF</Th>
                            <Th>{t("monRptColCurrency")}</Th>
                            <Th className="text-right">
                              {t("monRptColTotalAmount")}
                            </Th>
                            <Th className="text-right">
                              {t("monRptColTxCount")}
                            </Th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.summary.map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-border/40 hover:bg-muted/30"
                            >
                              <Td className="font-mono">{row.FROM_CIF}</Td>
                              <Td className="font-mono">{row.TO_CIF}</Td>
                              <Td>{row.CURRENCY}</Td>
                              <Td className="text-right font-semibold tabular-nums">
                                {fmtAmount(row.TOTAL_AMOUNT)}
                              </Td>
                              <Td className="text-right tabular-nums">
                                {row.TX_COUNT}
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableScroll>
                  )
                )}

                {activeTab === "accounts" && (
                  result.accounts.length === 0 ? (
                    <EmptyTab message={t("monRptNoTxDesc")} />
                  ) : (
                    <TableScroll maxHeight="360px">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b border-border sticky top-0 bg-card">
                            <Th>CIF</Th>
                            <Th>{t("monRptColAccount")}</Th>
                            <Th>ACID</Th>
                            <Th>{t("monRptColName")}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.accounts.map((a, i) => (
                            <tr
                              key={i}
                              className="border-b border-border/40 hover:bg-muted/30"
                            >
                              <Td className="font-mono">{a.CIF_ID}</Td>
                              <Td className="font-mono">{a.FORACID}</Td>
                              <Td className="font-mono text-muted-foreground">
                                {a.ACID}
                              </Td>
                              <Td>{a.ACCT_NAME}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableScroll>
                  )
                )}

                {activeTab === "transactions" && (
                  result.transactions.length === 0 ? (
                    <EmptyTab message={t("monRptNoTxDesc")} />
                  ) : (
                    <div>
                    <TableScroll maxHeight="480px">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border sticky top-0 bg-card">
                            <Th>{t("tailan_dateLabel")}</Th>
                            <Th>{t("monRptColTxAmount")}</Th>
                            <Th>{t("monRptColCurrency")}</Th>
                            <Th>{t("monRptColFrom")}</Th>
                            <Th>{t("monRptColTo")}</Th>
                            <Th>{t("monRptColChannel")}</Th>
                            <Th>{t("monRptColBank")}</Th>
                            <Th>{t("monRptColSourceSol")}</Th>
                            <Th>{t("monRptColParticular")}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.transactions
                            .slice(0, visibleTxCount)
                            .map((tx, i) => (
                            <tr
                              key={`${tx.TRAN_ID}-${tx.FROM_CIF}-${tx.TO_CIF}-${i}`}
                              className="border-b border-border/30 hover:bg-muted/30 align-top"
                            >
                              <Td>{tx.TRAN_DATE}</Td>
                              <Td className="font-semibold whitespace-nowrap tabular-nums">
                                {fmtAmount(tx.TRAN_AMOUNT)}
                              </Td>
                              <Td>{tx.CURRENCY}</Td>
                              <Td>
                                <div className="font-mono">
                                  {tx.FROM_CIF} / {tx.FROM_ACCOUNT}
                                </div>
                                <div className="text-muted-foreground">
                                  {tx.FROM_NAME}
                                </div>
                              </Td>
                              <Td>
                                <div className="font-mono">
                                  {tx.TO_CIF} / {tx.TO_ACCOUNT}
                                </div>
                                <div className="text-muted-foreground">
                                  {tx.TO_NAME}
                                </div>
                              </Td>
                              <Td>{tx.CHANNEL_ID}</Td>
                              <Td>{tx.BANK}</Td>
                              <Td>{tx.DTH_INIT_SOL_ID}</Td>
                              <Td>{tx.DEBIT_PARTICULAR}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableScroll>
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
                  )
                )}
              </div>
            </div>
          </>
        )}
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
  value: number;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div
        className={cn(
          "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
          tint,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-semibold tabular-nums leading-none mb-1">
          {value}
        </div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function TableScroll({
  children,
  maxHeight,
}: {
  children: React.ReactNode;
  maxHeight?: string;
}) {
  return (
    <div
      className="overflow-auto rounded-lg border border-border"
      style={{ maxHeight: maxHeight ?? "320px" }}
    >
      {children}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 font-medium whitespace-nowrap bg-card ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
