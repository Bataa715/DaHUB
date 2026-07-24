import axios from "axios";
import api from "@/lib/api";

// DaHUB-ийн өөрийн backend-ийг ашиглана — тусдаа API URL хэрэггүй.
// Программын дундын `api` (axios) instance-ыг ашигладаг тул access token
// хугацаа дуусахад silent-refresh-and-retry автоматаар ажилладаг (401 ирэхэд
// шууд "Нэвтрэх шаардлагатай" гэж харагдахгүй, дуу чимээгүй дахин нэвтэрдэг).
async function req(path: string, opts?: { signal?: AbortSignal }) {
  try {
    const res = await api.get(path, { signal: opts?.signal });
    const data = res.data;
    if (data?.error) {
      let msg = data?.message || data?.error || "Хүсэлт амжилтгүй боллоо";
      if (data?.table) msg += ` [хүснэгт: ${data.table}]`;
      throw new Error(msg);
    }
    return data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const data = e.response?.data as
        | { message?: string; error?: string; table?: string }
        | undefined;
      let msg = data?.message || data?.error || e.message;
      if (data?.table) msg += ` [хүснэгт: ${data.table}]`;
      throw new Error(msg);
    }
    throw e;
  }
}

export async function abFetchAlerts(
  minDashboards = 2,
  limit = 200,
  signal?: AbortSignal,
) {
  return req(
    `/oracle/search/alerts?min_dashboards=${minDashboards}&limit=${limit}`,
    { signal },
  );
}

export async function abSearchAlertByCif(cif: string, minDashboards = 1) {
  return req(
    `/oracle/search/alerts?min_dashboards=${minDashboards}&cif=${encodeURIComponent(cif.trim())}`,
  );
}

export async function abSearchByCif(
  cif: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const params = new URLSearchParams({ cif });
  if (dateFrom) params.set("from", dateFrom);
  if (dateTo) params.set("to", dateTo);
  return req(`/oracle/search/cif?${params}`);
}

export async function abFetchRedFlags() {
  return req("/oracle/search/redflag");
}

export async function abFetchDashboards(): Promise<
  {
    id: number;
    name: string;
    tableName: string;
    cifColumn: string;
    dateColumn: string | null;
    amountColumn: string | null;
    enabled: boolean;
  }[]
> {
  return req("/oracle/search/dashboards");
}

export async function abFetchNotifications(limit = 20) {
  return req(`/oracle/search/alerts?min_dashboards=2&limit=${limit}`);
}

export async function abFetchDashboardSummaries(): Promise<
  {
    id: number;
    name: string;
    totalCount: number | null;
    totalAmount: number | null;
    hasAmount: boolean;
    error?: string;
  }[]
> {
  return req("/oracle/search/dashboard-summaries");
}

export async function abFetchDashboardTop(
  id: number,
  limit = 10,
  search = "",
): Promise<{
  dashboardId: number;
  dashboardName: string;
  tableName: string;
  hasAmount: boolean;
  rows: { cif: string; count: number; totalAmount: number }[];
}> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search) params.set("search", search);
  return req(`/oracle/search/dashboard/${id}/top?${params}`);
}
