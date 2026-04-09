const API = process.env.NEXT_PUBLIC_API_URL || '';

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res: Response) {
  const data = await res.json();
  if (res.status === 401) {
    // Token expired or invalid — clear and redirect
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error(data.message || 'Нэвтрэлт дууссан');
  }
  if (!res.ok || data.error) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

export async function loginUser(username: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
}

export async function fetchMe() {
  const res = await fetch(`${API}/api/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${API}/api/auth/users`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createUserAPI(username: string, password: string, displayName: string, role: string) {
  const res = await fetch(`${API}/api/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username, password, displayName, role }),
  });
  return handleResponse(res);
}

export async function deleteUserAPI(userId: string) {
  const res = await fetch(`${API}/api/auth/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function updateUserRoleAPI(userId: string, role: string) {
  const res = await fetch(`${API}/api/auth/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ role }),
  });
  return handleResponse(res);
}

export async function changePasswordAPI(userId: string, newPassword: string) {
  const res = await fetch(`${API}/api/auth/users/${encodeURIComponent(userId)}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ newPassword }),
  });
  return handleResponse(res);
}

export async function fetchDashboards() {
  const res = await fetch(`${API}/api/dashboards/`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchStats() {
  // Stats are derived from groups — no separate endpoint needed
  return null;
}

export async function fetchDashboard(id: string, params: Record<string, any> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') query.set(k, String(v));
  });
  const res = await fetch(`${API}/api/dashboards/${encodeURIComponent(id)}?${query}`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchTopCustomers(id: string, topN = 10) {
  const res = await fetch(`${API}/api/dashboards/${encodeURIComponent(id)}/top-customers?top_n=${topN}`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function globalSearch(query: string) {
  const res = await fetch(`${API}/api/dashboards/search?q=${encodeURIComponent(query)}`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchDashboardConfig() {
  const res = await fetch(`${API}/api/dashboards/config`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function addDashboard(dashboardDef: any) {
  const res = await fetch(`${API}/api/dashboards/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(dashboardDef),
  });
  return handleResponse(res);
}

export async function createDashboard(params: any) {
  const res = await fetch(`${API}/api/dashboards/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

export async function deleteDashboard(id: string) {
  const res = await fetch(`${API}/api/dashboards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ confirm: true }),
  });
  return handleResponse(res);
}

export async function refreshDashboard(id: string) {
  const res = await fetch(`${API}/api/dashboards/${encodeURIComponent(id)}/refresh`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function fetchNotifications(limit = 20) {
  const res = await fetch(`${API}/api/dashboards/notifications?limit=${limit}`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchRawResults(id: string) {
  const res = await fetch(`${API}/api/dashboards/${encodeURIComponent(id)}/raw-results`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

// ── Search Engine: CIF хайлт ──
export async function searchByCif(cif: string, dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams({ cif });
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);
  const res = await fetch(`${API}/api/search/cif?${params}`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

// ── Alert: 2+ dashboard-д илэрсэн CIF жагсаалт ──
export async function fetchAlerts(minDashboards = 2, limit = 100) {
  const res = await fetch(`${API}/api/search/alerts?min_dashboards=${minDashboards}&limit=${limit}`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

// ── Red Flag: Event Chain илэрцүүд ──
export async function fetchRedFlags() {
  const res = await fetch(`${API}/api/search/redflag`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

// ── Dashboard жагсаалт (search module) ──
export async function fetchSearchDashboardList() {
  const res = await fetch(`${API}/api/search/dashboard-list`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

// ── Admin Config: Oracle Dashboard CRUD ──
export async function fetchOracleDashboards() {
  const res = await fetch(`${API}/api/config/oracle-dashboards`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function addOracleDashboard(data: { name: string; tableName: string; cifColumn: string; dateColumn?: string; amountColumn?: string }) {
  const res = await fetch(`${API}/api/config/oracle-dashboards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateOracleDashboard(id: number, data: any) {
  const res = await fetch(`${API}/api/config/oracle-dashboards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteOracleDashboard(id: number) {
  const res = await fetch(`${API}/api/config/oracle-dashboards/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Admin Config: Event Chain CRUD ──
export async function fetchEventChains() {
  const res = await fetch(`${API}/api/config/event-chains`, { cache: 'no-store', headers: authHeaders() });
  return handleResponse(res);
}

export async function addEventChain(data: { name: string; description?: string; sourceLabel?: string; targetLabel?: string; sourceIds: number[]; targetIds: number[] }) {
  const res = await fetch(`${API}/api/config/event-chains`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateEventChain(id: number, data: any) {
  const res = await fetch(`${API}/api/config/event-chains/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteEventChain(id: number) {
  const res = await fetch(`${API}/api/config/event-chains/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}
