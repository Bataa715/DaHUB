// DaHUB-ийн өөрийн backend-ийг ашиглана — тусдаа API URL хэрэггүй
import Cookies from "js-cookie";

const AB_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken() {
  if (typeof window === "undefined") return null;
  return window.location.pathname.startsWith("/admin")
    ? Cookies.get("adminToken")
    : Cookies.get("token");
}

async function req(path: string, opts?: RequestInit) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${AB_API}${path}`, {
    cache: "no-store",
    ...opts,
    headers,
  });
  const data = await res.json();
  if (!res.ok || data?.error) {
    let msg = data?.message || data?.error || "Request failed";
    if (data?.table) msg += ` [хүснэгт: ${data.table}]`;
    throw new Error(msg);
  }
  return data;
}

export async function abFetchAlerts(minDashboards = 2, limit = 200) {
  return req(
    `/oracle/search/alerts?min_dashboards=${minDashboards}&limit=${limit}`,
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
