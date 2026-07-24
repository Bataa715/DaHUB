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
import { downloadRelatedPartyWorkbook } from "./export";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(
    n ?? 0,
  );
}

export default function RelatedPartyTransactionsPage() {
  const { toast } = useToast();

  const [cifInput, setCifInput] = useState("");
  const [cifIds, setCifIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(monthsAgo(3));
  const [endDate, setEndDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<RelatedPartyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addCifTokens(raw: string) {
    const tokens = raw
      .split(/[\s,;]+/)
      .map((t) => t.trim())
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
      ? Array.from(new Set([...cifIds, ...cifInput.trim().split(/[\s,;]+/)]))
      : cifIds;

    if (finalIds.length < 2) {
      toast({
        title: "CIF дугаар дутуу",
        description: "Хамгийн багадаа 2 CIF/FORACID оруулна уу.",
        variant: "destructive",
      });
      return;
    }
    if (!startDate || !endDate) {
      toast({
        title: "Огноо дутуу",
        description: "Эхлэх ба дуусах огноог сонгоно уу.",
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
      if (res.transactions.length === 0) {
        toast({
          title: "Гүйлгээ олдсонгүй",
          description: "Сонгосон CIF-үүдийн хооронд шууд гүйлгээ олдсонгүй.",
        });
      }
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setError(msg);
      toast({
        title: "Алдаа гарлаа",
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
      // Already-fetched `result` is written straight to the workbook here —
      // no second server round-trip / re-query, so the download is instant.
      await downloadRelatedPartyWorkbook(result, startDate, endDate);
    } catch (e) {
      toast({
        title: "Татаж авахад алдаа гарлаа",
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

  return (
    <div className="min-h-screen bg-background">
      <ToolPageHeader
        href="/tools/monitoring-box"
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
            <Users2 className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Харилцсан гүйлгээ"
      />

      <div className="w-full px-4 md:px-6 py-6 space-y-6">
        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-4 items-start">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                CIF / FORACID жагсаалт (хамгийн багадаа 2)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[2rem]">
                <AnimatePresence>
                  {cifIds.map((id) => (
                    <motion.span
                      key={id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 pl-2.5 pr-1.5 py-1 text-xs font-medium"
                    >
                      {id}
                      <button
                        onClick={() => removeCif(id)}
                        className="rounded-full hover:bg-orange-500/20 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
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
                placeholder="CIF эсвэл дансны дугаар оруулна уу"
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Эхлэх огноо
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm w-[150px]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Дуусах огноо
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm w-[150px]"
              />
            </div>

            <div className="flex items-end h-full">
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white gap-2 w-full lg:w-auto"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Хайх
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <>
            {/* ── Stat cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={Users2}
                label="Тохирсон дансууд"
                value={result.accounts.length}
                gradient="from-cyan-500 to-blue-500"
              />
              <StatCard
                icon={ArrowRightLeft}
                label="Илэрсэн гүйлгээ"
                value={result.transactions.length}
                gradient={
                  result.transactions.length > 0
                    ? "from-red-500 to-rose-500"
                    : "from-emerald-500 to-teal-500"
                }
              />
            </div>

            {totalsByCurrency.length > 0 && (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold">Нийт дүн (валютаар)</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {totalsByCurrency.map(([ccy, amt]) => (
                    <div
                      key={ccy}
                      className="rounded-xl bg-muted/40 px-4 py-2 text-sm"
                    >
                      <span className="text-muted-foreground mr-1.5">
                        {ccy}
                      </span>
                      <span className="font-semibold">{fmtAmount(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.transactions.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={exporting}
                  className="gap-2"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Excel татах
                </Button>
              </div>
            )}

            {/* ── Summary table ───────────────────────────────────────── */}
            {result.summary.length > 0 && (
              <SectionCard title="Хосолсон дансны нэгтгэл">
                <TableScroll>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                        <Th>FROM_CIF</Th>
                        <Th>TO_CIF</Th>
                        <Th>Валют</Th>
                        <Th className="text-right">Нийт дүн</Th>
                        <Th className="text-right">Гүйлгээний тоо</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.summary.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/30 hover:bg-muted/30"
                        >
                          <Td className="font-mono">{row.FROM_CIF}</Td>
                          <Td className="font-mono">{row.TO_CIF}</Td>
                          <Td>{row.CURRENCY}</Td>
                          <Td className="text-right font-semibold">
                            {fmtAmount(row.TOTAL_AMOUNT)}
                          </Td>
                          <Td className="text-right">{row.TX_COUNT}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </SectionCard>
            )}

            {/* ── Matched accounts ────────────────────────────────────── */}
            <SectionCard title={`Тохирсон дансууд (${result.accounts.length})`}>
              <TableScroll maxHeight="240px">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                      <Th>CIF</Th>
                      <Th>Данс (FORACID)</Th>
                      <Th>ACID</Th>
                      <Th>Нэр</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.accounts.map((a, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/30 hover:bg-muted/30"
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
            </SectionCard>

            {/* ── Full transactions ───────────────────────────────────── */}
            {result.transactions.length > 0 && (
              <SectionCard
                title={`Дэлгэрэнгүй гүйлгээ (${result.transactions.length})`}
              >
                <TableScroll maxHeight="480px">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border/50 sticky top-0 bg-card">
                        <Th>Огноо</Th>
                        <Th>Гүйлгээний дүн</Th>
                        <Th>Валют</Th>
                        <Th>FROM (CIF / данс / нэр)</Th>
                        <Th>TO (CIF / данс / нэр)</Th>
                        <Th>Суваг</Th>
                        <Th>Банк</Th>
                        <Th>Эх SOL</Th>
                        <Th>Гүйлгээний утга</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.transactions.map((tx, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/20 hover:bg-muted/30 align-top"
                        >
                          <Td>{tx.TRAN_DATE}</Td>
                          <Td className="font-semibold whitespace-nowrap">
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
              </SectionCard>
            )}
          </>
        )}

        {!result && !loading && !error && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            CIF/FORACID жагсаалт, огнооны хугацаа оруулж "Хайх" товч дарна уу.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  gradient: string;
}) {
  return (
    <div className="p-5 flex items-center gap-4">
      <div
        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shrink-0`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
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
      className="overflow-auto rounded-lg border border-border/30"
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
    <th className={`px-3 py-2 font-medium whitespace-nowrap ${className}`}>
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
