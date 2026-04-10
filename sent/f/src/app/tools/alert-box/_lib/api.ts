// DaHUB-ийн өөрийн backend-ийг ашиглана — тусдаа API URL хэрэггүй
import Cookies from 'js-cookie';

const AB_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.location.pathname.startsWith('/admin')
    ? Cookies.get('adminToken')
    : Cookies.get('token');
}

async function req(path: string, opts?: RequestInit) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${AB_API}${path}`, {
    cache: 'no-store',
    ...opts,
    headers,
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error || data?.message || 'Request failed');
  return data;
}

export async function abFetchAlerts(minDashboards = 2, limit = 200) {
  return req(`/oracle/search/alerts?min_dashboards=${minDashboards}&limit=${limit}`);
}

export async function abSearchByCif(cif: string, dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams({ cif });
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);
  return req(`/oracle/search/cif?${params}`);
}

export async function abFetchRedFlags() {
  return req('/oracle/search/redflag');
}

export async function abFetchNotifications(limit = 20) {
  return req(`/oracle/search/alerts?min_dashboards=2&limit=${limit}`);
}
