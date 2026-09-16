import { startAsync } from "@/lib/start-async";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { abFetchAlerts, abSearchByCif, abSearchAlertByCif } from "../_lib/api";
import { getApiErrorMessage } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ML_DASH_IDS,
  ALERTS_PAGE_SIZE,
  AlertItem,
  CifDetail,
  AlertData,
  createTop10Tooltip,
} from "./_alerts-shared";

/**
 * Alert жагсаалтын state — Oracle-оос ачаалах, CIF хайлт, дэлгэрэнгүй нээх,
 * графикийн өгөгдөл. Хуудас болон дэд хэсгүүд нэг instance-ийг хуваалцана.
 */
export function useAlertsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Том жагсаалт (10000 хүртэл CIF) нэг дор renderлэхэд удаашрах тул
  // "Load more"-оор алхам алхмаар харуулна.
  const [visibleCount, setVisibleCount] = useState(ALERTS_PAGE_SIZE);
  const [expandedCif, setExpandedCif] = useState<string | null>(null);
  const [cifDetail, setCifDetail] = useState<CifDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [minDash, setMinDash] = useState(2);
  const [cifSearch, setCifSearch] = useState("");
  const [cifSearchResult, setCifSearchResult] = useState<{
    loading: boolean;
    alerts: AlertItem[];
    searched: boolean;
  }>({ loading: false, alerts: [], searched: false });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCifSearch = (val: string) => {
    setCifSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) {
      setCifSearchResult({ loading: false, alerts: [], searched: false });
      return;
    }
    setCifSearchResult((p) => ({ ...p, loading: true, searched: false }));
    const searchedVal = val.trim().toLowerCase();
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await abSearchAlertByCif(val.trim(), minDash);
        // Client-side exact match guard — backend may return unfiltered list
        const filtered = (res.alerts || []).filter(
          (a: AlertItem) =>
            String(a.cif || "")
              .trim()
              .toLowerCase() === searchedVal,
        );
        setCifSearchResult({
          loading: false,
          alerts: filtered,
          searched: true,
        });
      } catch {
        setCifSearchResult({ loading: false, alerts: [], searched: true });
      }
    }, 400);
  };

  const loadAlerts = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await abFetchAlerts(minDash, 10000, signal);
        setError("");
        setData(res);
        setVisibleCount(ALERTS_PAGE_SIZE);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(getApiErrorMessage(e) || t("alertNoResult"));
      } finally {
        setLoading(false);
      }
    },
    [minDash, t],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    startAsync(() => loadAlerts(ctrl.signal));
    return () => ctrl.abort();
  }, [loadAlerts]);

  const handleExpand = async (cifId: string) => {
    if (expandedCif === cifId) {
      setExpandedCif(null);
      setCifDetail(null);
      return;
    }
    setExpandedCif(cifId);
    setCifDetail(null);
    setLoadingDetail(true);
    try {
      const detail = await abSearchByCif(cifId);
      setCifDetail(detail);
    } catch {
      setCifDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ML dashboard (ID 13–16)-ийг хасваад стандарт дүнгийн тооцоолл
  const getStdAmount = (alert: AlertItem) =>
    alert.dashboards
      .filter((d) => !ML_DASH_IDS.has(d.id))
      .reduce((s, d) => s + (d.totalAmount || 0), 0);

  const chartData = useMemo(() => {
    if (!data?.alerts?.length) return null;
    const alerts = data.alerts;

    const totalTxns = alerts.reduce((s, a) => s + a.totalTransactions, 0);
    const totalStdAmt = alerts.reduce((s, a) => s + getStdAmount(a), 0);
    const totalMLAmt = alerts.reduce((s, a) => s + (a.mlAmount || 0), 0);

    const sevMap: Record<string, number> = {
      "2 DB": 0,
      "3 DB": 0,
      "4 DB": 0,
      "5+ DB": 0,
    };
    alerts.forEach((a) => {
      if (a.dashboardCount >= 5) sevMap["5+ DB"]++;
      else if (a.dashboardCount === 4) sevMap["4 DB"]++;
      else if (a.dashboardCount === 3) sevMap["3 DB"]++;
      else sevMap["2 DB"]++;
    });
    const sevData = Object.entries(sevMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));

    const dbFreq: Record<string, number> = {};
    alerts.forEach((a) =>
      a.dashboards.forEach((d) => {
        const k = `DB${d.id}`;
        dbFreq[k] = (dbFreq[k] || 0) + 1;
      }),
    );
    const dbFreqData = Object.entries(dbFreq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => Number(a.name.slice(2)) - Number(b.name.slice(2)));

    const top10 = [...alerts]
      .sort((a, b) => getStdAmount(b) - getStdAmount(a))
      .slice(0, 10)
      .map((a) => ({ ...a, stdAmount: getStdAmount(a) }));
    const reversedTop10 = [...top10].reverse();

    return {
      totalTxns,
      totalStdAmt,
      totalMLAmt,
      sevData,
      dbFreqData,
      top10,
      reversedTop10,
    };
  }, [data]);

  const getSeverityColor = (count: number) => {
    if (count >= 5) return "text-red-400 bg-red-500/10 border-red-500/25";
    if (count >= 3) return "text-amber-400 bg-amber-500/10 border-amber-500/25";
    return "text-blue-400 bg-blue-500/10 border-blue-500/25";
  };

  const Top10TooltipContent = useMemo(() => createTop10Tooltip(t), [t]);

  return {
    router,
    t,
    data,
    setData,
    loading,
    setLoading,
    error,
    setError,
    visibleCount,
    setVisibleCount,
    expandedCif,
    setExpandedCif,
    cifDetail,
    setCifDetail,
    loadingDetail,
    setLoadingDetail,
    minDash,
    setMinDash,
    cifSearch,
    setCifSearch,
    cifSearchResult,
    setCifSearchResult,
    searchTimer,
    handleCifSearch,
    loadAlerts,
    handleExpand,
    getStdAmount,
    chartData,
    getSeverityColor,
    Top10TooltipContent,
  };
}

export type AlertsPageState = ReturnType<typeof useAlertsPage>;
