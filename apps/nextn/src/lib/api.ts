import axios from "axios";
import Cookies from "js-cookie";

const API_URL: string = process.env.NEXT_PUBLIC_API_URL ?? "";
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is not set");
}

// [PERF] fails fast instead of hanging forever; slow endpoints (docx/report
// generation, heavy DB scans) override with TIMEOUT_LONG per-call.
const TIMEOUT_DEFAULT = 60_000; // 60s
const TIMEOUT_LONG = 180_000; // 3min

// [N-2] withCredentials: true so the browser sends HttpOnly token cookies with every request
const api = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT_DEFAULT,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// [N-2] No request interceptor for Authorization header —
// HttpOnly cookies are sent automatically by the browser.

// Shared in-flight refresh promise — prevents concurrent 401s from each
// triggering their own /auth/refresh call.
let _refreshPromise: Promise<{ data?: { user?: unknown } }> | null = null;

/**
 * Бүх апп даяар ЯГ НЭГ /auth/refresh хүсэлт зэрэг явахыг баталгаажуулна.
 *
 * ⚠️ Refresh token нь single-use — сервер ашиглагдсан токеныг устгаад шинээр
 * олгодог (rotation). Хэрэв AuthContext-ийн mount refresh болон axios
 * interceptor-ийн 401 refresh хоёр НЭГ ижил refresh cookie-гоор зэрэг явбал
 * нэг нь токеныг устгаж, нөгөө нь "Invalid or expired refresh token" 401 авч
 * session-expired → login руу шидэгддэг байсан. Энэ бол "token дахин дахин
 * дуудагдаад web гацдаг" гэсэн шинжийн үндсэн шалтгаан. Нэг in-flight promise-ийг
 * хуваалцаснаар тэр race бүрэн арилна.
 */
export function refreshSession(): Promise<{ data?: { user?: unknown } }> {
  if (!_refreshPromise) {
    _refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .finally(() => {
        _refreshPromise = null;
      });
  }
  return _refreshPromise;
}

/**
 * Axios болон ерөнхий алдааны мессежийг аюулгүй гаргаж авна.
 * catch блокуудад `catch (e: unknown)` гэж бичихэд хэрэглэнэ.
 */
export function getApiErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return getApiResponseMessage(e) ?? e.message;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Зөвхөн серверийн буцаасан мессеж (Nest: `message`, Next route: `error`).
 * Байхгүй бол undefined — дуудагч өөрийн ойлгомжтой fallback-ийг харуулна.
 */
export function getApiResponseMessage(e: unknown): string | undefined {
  if (!axios.isAxiosError(e)) return undefined;
  const data = e.response?.data as
    | { message?: unknown; error?: unknown }
    | undefined;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  return undefined;
}

/**
 * [AUDIT] Session дуусахад шууд location.replace хийхийн оронд cancelable
 * event илгээнэ — хадгалаагүй ажилтай хуудас (тайлан бичих г.м)
 * `auth:session-expired` дээр `preventDefault()` дуудаж redirect-ийг зогсоон
 * re-login modal үзүүлэх боломжтой. Хэн ч барихгүй бол login руу шилжинэ.
 */
function redirectToLogin(isAdmin: boolean): void {
  if (typeof window === "undefined") return;
  const loginPath = isAdmin ? "/admin/login" : "/login";
  if (window.location.pathname.startsWith(loginPath)) return;
  const ev = new CustomEvent("auth:session-expired", { cancelable: true });
  const proceed = window.dispatchEvent(ev); // false = preventDefault() дуудсан
  if (proceed) {
    window.location.replace(loginPath);
  }
}

// Response interceptor — silent token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === "undefined") return Promise.reject(error);
    const originalRequest = error.config;
    const isAdmin =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin");
    const userKey = isAdmin ? "adminUser" : "user";

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry auth management endpoints — causes extra round-trips and loops
      const url = originalRequest.url ?? "";
      const isAuthMgmt =
        url.endsWith("/auth/logout") || url.endsWith("/auth/refresh");
      if (!isAuthMgmt) {
        originalRequest._retry = true;

        try {
          // Reuse the app-wide single-flight refresh so concurrent 401s AND the
          // AuthContext mount refresh all share ONE network call (rotation-safe).
          // [N-2] No body needed — browser sends HttpOnly refreshToken cookie automatically
          const refreshRes = await refreshSession();
          // Update the user display cookie from the refresh response
          const freshUser = refreshRes.data?.user;
          if (freshUser) {
            const secure =
              typeof window !== "undefined" &&
              window.location.protocol === "https:";
            Cookies.set(userKey, JSON.stringify(freshUser), {
              expires: 3 / 24,
              sameSite: "strict",
              secure,
            });
          }
          // Retry original — browser sends new HttpOnly token cookie automatically
          return api(originalRequest);
        } catch {
          Cookies.remove(userKey);
          redirectToLogin(isAdmin);
        }
      }
    }

    if (error.response?.status === 401) {
      Cookies.remove(userKey);
      redirectToLogin(isAdmin);
    }

    // Network error (backend unreachable) — don't clear session (may be temporary)
    if (!error.response && error.code !== "ERR_CANCELED") {
      console.warn("Network error — backend may be unreachable");
    }

    return Promise.reject(error);
  },
);

export default api;

// Auth APIs
export const authApi = {
  login: async (department: string, username: string, password: string) => {
    const response = await api.post("/auth/login", {
      department,
      username,
      password,
    });
    return response.data;
  },

  loginById: async (userId: string, password: string) => {
    const response = await api.post("/auth/login-by-id", { userId, password });
    return response.data;
  },

  adminLogin: async (userId: string, password: string) => {
    const response = await api.post("/auth/admin-login", {
      username: userId,
      password,
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
};

// ─── Нэвтрэхээс өмнөх / сесс хаах дуудлагууд ───────────────────────────────
// [AUTH] 401-ийн silent-refresh interceptor-гүй тусдаа client. Буруу нууц үгийн
// 401 нь "сесс дууссан" гэсэн үг БИШ — refresh оролдож login руу шидэх ёсгүй.
// Logout ч мөн interceptor-оос гадуур явна (refresh-logout гогцооноос сэргийлнэ).
const publicApi = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT_DEFAULT,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Next-ийн өөрийн route handler-ууд (app/api/**, app/team-gallery) — ижил origin.
const sameOriginApi = axios.create({
  timeout: TIMEOUT_DEFAULT,
  withCredentials: true,
});

/** Алдааны HTTP статус (сүлжээний алдаа бол undefined) */
export function getApiErrorStatus(e: unknown): number | undefined {
  return axios.isAxiosError(e) ? e.response?.status : undefined;
}

export interface AuthUserCheckResult {
  exists: boolean;
  hasPassword: boolean;
  userId: string | null;
  name?: string | null;
  isActive?: boolean;
  needsPasswordSetup?: boolean;
  registrationStatus?: "pending" | "rejected";
}

export interface DepartmentEmployee {
  userId: string;
  name: string;
  position?: string;
}

export const publicAuthApi = {
  register: async (
    body: Record<string, unknown>,
  ): Promise<{ userId: string; name: string }> => {
    const res = await publicApi.post("/auth/register", body);
    return res.data;
  },

  checkUser: async (body: {
    userId: string;
  }): Promise<AuthUserCheckResult> => {
    const res = await publicApi.post("/auth/check-user", body);
    return res.data;
  },

  /** Backend token cookie-г HttpOnly-гаар тавина; хариунд зөвхөн user */
  setPassword: async (body: {
    userId: string;
    password: string;
    claimToken: string;
  }): Promise<{ user: unknown }> => {
    const res = await publicApi.post("/auth/set-password", body);
    return res.data;
  },

  loginById: async (body: {
    userId: string;
    password: string;
  }): Promise<{ user: unknown }> => {
    const res = await publicApi.post("/auth/login-by-id", body);
    return res.data;
  },

  /** Best-effort — HttpOnly token cookie-г сервер цэвэрлэнэ */
  logout: async (): Promise<void> => {
    await publicApi.post("/auth/logout", {});
  },

  /** Login хуудасны хэлтсийн ажилтны жагсаалт (Next proxy route-оор) */
  listByDepartment: async (
    department: string,
  ): Promise<DepartmentEmployee[]> => {
    const res = await sameOriginApi.get("/api/auth/by-department", {
      params: { department },
    });
    return Array.isArray(res.data?.users) ? res.data.users : [];
  },
};

// ─── Нүүр хуудасны хамт олны зураг (Next route handler: app/team-gallery) ──
export interface TeamGallerySlide {
  id: string;
  src: string;
  alt: string;
}

export const teamGalleryApi = {
  list: async (): Promise<TeamGallerySlide[]> => {
    const res = await sameOriginApi.get("/team-gallery", {
      headers: { "Cache-Control": "no-store" },
    });
    return Array.isArray(res.data?.slides) ? res.data.slides : [];
  },

  upload: async (file: File): Promise<TeamGallerySlide[]> => {
    const form = new FormData();
    form.append("file", file);
    const res = await sameOriginApi.post("/team-gallery", form);
    return Array.isArray(res.data?.slides) ? res.data.slides : [];
  },

  remove: async (id: string): Promise<TeamGallerySlide[]> => {
    const res = await sameOriginApi.delete(
      `/team-gallery/${encodeURIComponent(id)}`,
    );
    return Array.isArray(res.data?.slides) ? res.data.slides : [];
  },
};

/**
 * Хуудас хаагдах (beforeunload) үед хадгалаагүй гарын утгуудыг илгээнэ.
 * axios `keepalive` дэмждэггүй тул native fetch — хуудас хаагдсан ч хүсэлт
 * дуусна. Fire-and-forget: хариуг хүлээхгүй. Token нь HttpOnly cookie-гоор явна.
 */
export function flushManualIndicatorsOnUnload(payloads: unknown[]): void {
  for (const p of payloads) {
    fetch(`${API_URL}/risk-assessment/manual-indicators`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
      keepalive: true,
    }).catch(() => {
      /* intentional: keepalive fire-and-forget on beforeunload */
    });
  }
}

// Registration requests (admin approval workflow) APIs
export const registrationRequestsApi = {
  list: async (status?: "pending" | "approved" | "rejected") => {
    const response = await api.get("/auth/registration-requests", {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  review: async (
    id: string,
    action: "approve" | "reject",
    reviewNote?: string,
  ) => {
    const response = await api.patch(`/auth/registration-requests/${id}`, {
      action,
      reviewNote,
    });
    return response.data;
  },
};

// Users APIs
export const usersApi = {
  getAll: async (opts?: { excludeAdmins?: boolean; limit?: number }) => {
    const response = await api.get("/users", {
      params: {
        ...(opts?.excludeAdmins ? { excludeAdmins: true } : {}),
        ...(opts?.limit ? { limit: opts.limit } : {}),
      },
    });
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  },

  removeProfileImage: async (id: string) => {
    const response = await api.delete(`/users/${id}/profile-image`);
    return response.data;
  },

  unlock: async (id: string) => {
    const response = await api.patch(`/users/${id}/unlock`);
    return response.data;
  },

  updateTools: async (id: string, allowedTools: string[]) => {
    const response = await api.patch(`/users/${id}/tools`, { allowedTools });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  getAdmins: async () => {
    const response = await api.get("/users/admins");
    return response.data;
  },

  setAdminRole: async (
    id: string,
    isAdmin: boolean,
    isSuperAdmin: boolean,
    grantableTools?: string[],
  ) => {
    const response = await api.patch(`/users/${id}/admin-role`, {
      isAdmin,
      isSuperAdmin,
      grantableTools,
    });
    return response.data;
  },

  resetPassword: async (id: string, newPassword: string) => {
    const response = await api.patch(`/users/${id}/reset-password`, {
      newPassword,
    });
    return response.data;
  },
};

// Departments APIs
export const departmentsApi = {
  getAll: async () => {
    const response = await api.get("/departments");
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/departments/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/departments/${id}`);
    return response.data;
  },
};
// DB Access APIs
export const dbAccessApi = {
  // Tables
  getTables: async () => {
    const response = await api.get("/db-access/tables");
    return response.data as { database: string; table: string; full: string }[];
  },

  // Requests
  createRequest: async (data: {
    tables: string[];
    columns?: string[];
    accessTypes: string[];
    validUntil: string;
    reason?: string;
  }) => {
    const response = await api.post("/db-access/requests", data);
    return response.data;
  },

  getPendingRequests: async () => {
    const response = await api.get("/db-access/requests/pending");
    return response.data;
  },

  getAllRequests: async () => {
    const response = await api.get("/db-access/requests");
    return response.data;
  },

  reviewRequest: async (
    id: string,
    action: "approve" | "reject",
    reviewNote?: string,
  ) => {
    const response = await api.patch(`/db-access/requests/${id}/review`, {
      action,
      reviewNote,
    });
    return response.data;
  },

  // Grants
  getMyGrants: async () => {
    const response = await api.get("/db-access/grants/my");
    return response.data;
  },

  getAllGrants: async () => {
    const response = await api.get("/db-access/grants");
    return response.data;
  },

  revokeGrant: async (id: string, reason?: string) => {
    const response = await api.delete(`/db-access/grants/${id}`, {
      data: { reason },
    });
    return response.data;
  },

  cancelMyGrant: async (id: string) => {
    const response = await api.delete(`/db-access/grants/${id}/cancel`);
    return response.data;
  },

  deleteRequest: async (id: string) => {
    const response = await api.delete(
      `/db-access/requests/${encodeURIComponent(id)}`,
    );
    return response.data;
  },

  cleanupChUser: async (requesterUserId: string) => {
    const response = await api.post(
      `/db-access/grants/cleanup-ch/${encodeURIComponent(requesterUserId)}`,
    );
    return response.data;
  },
};

// ── Систем лог (Админ → Систем лог) ─────────────────────────────────────────
// [ROUTE] `/users/` nginx-д нээлттэй тул `/users/audit-logs` ашиглана.
export interface AuditLogRow {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  method?: string;
  status: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LoginAttemptRow {
  lockKey: string;
  attemptedAt: string;
  success: boolean;
}

export const auditLogApi = {
  getAuditLogs: async (limit = 300): Promise<AuditLogRow[]> => {
    const r = await api.get("/users/audit-logs", { params: { limit } });
    return r.data;
  },
  getLoginAttempts: async (limit = 300): Promise<LoginAttemptRow[]> => {
    const r = await api.get("/users/audit-logs/login-attempts", {
      params: { limit },
    });
    return r.data;
  },
};

// ── Risk Assessment ─────────────────────────────────────────────────────────

export interface RiskHistoryEntry {
  id: string;
  name: string;
  pDate: string;
  pDateBeg: string;
  branchCount: number;
  oracleFetchedAt: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface RiskCurrentRow {
  rowKey: string;
  rowType: "oracle" | "manual_indicator";
  fetchedAt: string;
  pDate: string;
  pDateBeg: string;
  SOLID: string;
  BRANCHNAME: string;
  STATUS: string;
  RESULT: string;
  RESULT_TYPE: string;
  DESCRIPTION_TEXT: string;
  P_DATEBEG: string;
  P_DATE: string;
  ID: string;
  SUBID: string;
  OPERATION_TYPE: string;
  isManual: number;
  indicatorId: string;
  indicatorValue: number | null;
  /** Тухайн RESULT-ийн бодит fetchedDate (fill-forward шалгалтад) */
  sourceFetchedDate?: string;
  /** @deprecated DB-ээс хасагдсан — SOLID ашиглана уу */
  BRANCHID?: string;
  /** @deprecated DB-ээс хасагдсан */
  PARENTBRANCH?: string;
}

/**
 * Hold-ийн нэгдсэн period. Hold нь огноо/улирлаас үл хамаарч бүх тооцоонд
 * нэгэн зэрэг үйлчилнэ (сар тутмын period-ийг халсан).
 */
export const HOLD_GLOBAL_PERIOD = "ALL";

export const riskApi = {
  // ── Riskbranch (Хянах) ────────────────────────────────────────────────────

  /** riskbranch дахь өдрүүдийн жагсаалт (in-flight deduplication — MonitorTab + WorkTab зэрэг дуудна) */
  listRiskbranchDates: (() => {
    let _inflight: Promise<string[]> | null = null;
    return async (): Promise<string[]> => {
      if (_inflight) return _inflight;
      _inflight = api
        .get(`/risk-assessment/riskbranch/dates`)
        .then((res) => res.data as string[])
        .finally(() => {
          _inflight = null;
        });
      return _inflight;
    };
  })(),

  /** Riskbranch хамгийн сүүлийн буюу тодорхой өдрийн өгөгдөл */
  getRiskbranch: async (
    date?: string,
  ): Promise<{
    fetchedDate: string;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> => {
    const res = await api.get(`/risk-assessment/riskbranch`, {
      params: date ? { date } : {},
    });
    return res.data;
  },

  /** Lock хийгдсэн огноог авах */
  getRiskbranchLock: async (): Promise<{ lockedDate: string | null }> => {
    const res = await api.get(`/risk-assessment/riskbranch/lock`);
    return res.data;
  },

  /** Огноог lock хийх */
  lockRiskbranchDate: async (date: string): Promise<void> => {
    await api.post(`/risk-assessment/riskbranch/lock`, { date });
  },

  /** Огноог unlock хийх */
  unlockRiskbranchDate: async (date: string): Promise<void> => {
    await api.delete(`/risk-assessment/riskbranch/lock/${date}`);
  },

  /** Аудиторын үнэлэмжийн жагсаалт */
  listJudgements: async (
    date?: string,
  ): Promise<
    {
      branchId: string;
      branchName: string;
      fetchedDate: string;
      score: number;
      comment: string;
    }[]
  > => {
    const res = await api.get(`/risk-assessment/judgement`, {
      params: date ? { date } : {},
    });
    return res.data;
  },

  /** Аудиторын үнэлэмж хадгалах */
  upsertJudgement: async (args: {
    branchId: string;
    branchName: string;
    fetchedDate: string;
    score: number;
    comment?: string;
  }): Promise<void> => {
    await api.put(`/risk-assessment/judgement`, args);
  },

  /** Riskbranch дата + judgement ашиглан history-д хадгалах (сервер дээр дахин татна) */
  saveHistoryFromRiskbranch: async (
    fetchedDate: string,
    name: string,
  ): Promise<RiskHistoryEntry> => {
    const res = await api.post(`/risk-assessment/history/from-riskbranch`, {
      fetchedDate,
      name,
    });
    return res.data;
  },

  /** Гарын үзүүлэлтийн бүх утгыг авах */
  listManualIndicators: async (): Promise<
    Record<string, Record<string, number>>
  > => {
    const res = await api.get(`/risk-assessment/manual-indicators`);
    return res.data ?? {};
  },

  /** Гарын үзүүлэлтийн нэг утгыг хадгалах (debounce-тай дуудагдана) */
  upsertManualIndicator: async (args: {
    branchId: string;
    indicatorId: string;
    value: number;
  }): Promise<void> => {
    await api.put(`/risk-assessment/manual-indicators`, args);
  },

  // ── History ──────────────────────────────────────────────────────────────

  /** History жагсаалт (meta-г л буцаана, rows байхгүй) */
  listHistory: async (): Promise<RiskHistoryEntry[]> => {
    const res = await api.get(`/risk-assessment/history`);
    return res.data;
  },

  /** History нэг бичлэгийн дэлгэрэнгүй (rows + manualMap) */
  getHistory: async (
    id: string,
  ): Promise<{
    entry: RiskHistoryEntry;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
    judgementComments: Record<string, string>;
  }> => {
    const res = await api.get(`/risk-assessment/history/${id}`);
    return res.data;
  },

  /** History бичлэг устгах */
  deleteHistory: async (id: string): Promise<void> => {
    await api.delete(`/risk-assessment/history/${id}`);
  },

  // ── Indicator holds ───────────────────────────────────────────────────────

  /** Тухайн сарын hold жагсаалтыг авах (period = "YYYY-MM") */
  listHolds: async (
    period: string,
  ): Promise<{ indicatorId: string; isHeld: number }[]> => {
    const res = await api.get(`/risk-assessment/holds`, { params: { period } });
    return res.data ?? [];
  },

  /** Тухайн үзүүлэлтийг hold/unhold хийх */
  setHold: async (body: {
    indicatorId: string;
    period: string;
    isHeld: boolean;
  }): Promise<void> => {
    await api.put(`/risk-assessment/holds`, body);
  },
};

// ── Risk Indicator Config API ─────────────────────────────────────────────────

export interface IndicatorConfig {
  id: string;
  subid: string;
  name: string;
  group_num: number;
  sort_order: number;
  weight: number;
  is_manual: 0 | 1;
  is_judgment: 0 | 1;
  is_active: 0 | 1;
  score_scale: string; // JSON
  hint: string;
  updated_by: string;
  seq: number;
  updated_at: string;
}

export const riskIndicatorConfigApi = {
  list: async (): Promise<IndicatorConfig[]> => {
    const res = await api.get("/risk-indicator-config");
    return res.data;
  },

  create: async (
    dto: Omit<
      IndicatorConfig,
      "id" | "seq" | "updated_at" | "is_active" | "updated_by"
    >,
  ): Promise<IndicatorConfig> => {
    const res = await api.post("/risk-indicator-config", dto);
    return res.data;
  },

  update: async (
    id: string,
    dto: Partial<IndicatorConfig>,
  ): Promise<IndicatorConfig> => {
    const res = await api.patch(`/risk-indicator-config/${id}`, dto);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/risk-indicator-config/${id}`);
  },
};

// ── Homepage ethics carousel (Аудиторын ёс зүйн код) ─────────────────────────
export interface EthicsSlide {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  is_active?: number;
}

export const homepageEthicsApi = {
  list: async (): Promise<EthicsSlide[]> => {
    const res = await api.get("/homepage-ethics");
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  },

  create: async (dto: {
    title: string;
    body: string;
    sort_order?: number;
  }): Promise<EthicsSlide> => {
    const res = await api.post("/homepage-ethics", dto);
    return res.data;
  },

  update: async (
    id: string,
    dto: Partial<{ title: string; body: string; sort_order: number }>,
  ): Promise<EthicsSlide> => {
    const res = await api.patch(`/homepage-ethics/${id}`, dto);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/homepage-ethics/${id}`);
  },
};

// ── Зайны аудит (continuous auditing monitor cards) ──────────────────────
export interface MatchedAccountRow {
  CIF_ID: string;
  FORACID: string;
  ACID: string;
  ACCT_NAME: string;
  SCHM_CODE: string;
}

export interface RelatedPartyTxRow {
  TRAN_DATE: string;
  TRAN_ID: string;
  DTH_INIT_SOL_ID: string;
  ENTRY_DATE: string;
  ENTRY_USER_ID: string;
  PSTD_DATE: string;
  PSTD_USER_ID: string;
  VFD_DATE: string;
  VFD_USER_ID: string;
  TRAN_TYPE: string;
  TRAN_SUB_TYPE: string;
  FROM_CIF: string;
  FROM_ACCOUNT: string;
  FROM_NAME: string;
  FROM_SCHM_CODE: string;
  TO_CIF: string;
  TO_ACCOUNT: string;
  TO_NAME: string;
  TO_SCHM_CODE: string;
  TRAN_AMOUNT: number;
  AMOUNT_MNT: number;
  CURRENCY: string;
  CHANNEL_ID: string;
  BANK: string;
  BANK_TYPE: string;
  A_TRAN_ID: string;
  SOL_ID: string;
  GL_SUB_HEAD_CODE: string;
  ACCT_PRTY_NUMBER: string;
  REF_NUM: string;
  DEBIT_PARTICULAR: string;
  CREDIT_PARTICULAR: string;
  DEBIT_RMKS: string;
  CREDIT_RMKS: string;
}

export interface RelatedPartySummaryRow {
  FROM_CIF: string;
  TO_CIF: string;
  CURRENCY: string;
  TOTAL_AMOUNT: number;
  TX_COUNT: number;
}

export interface RelatedPartyResult {
  accounts: MatchedAccountRow[];
  transactions: RelatedPartyTxRow[];
  summary: RelatedPartySummaryRow[];
  /** Сервер мөрийн таазаа давсан тул үр дүн тайрагдсан. */
  truncated?: boolean;
}

export interface RelatedPartyRequest {
  customerIds: string[];
  startDate: string;
  endDate: string;
}

export const zainiiAuditRptApi = {
  findRelatedPartyTransactions: async (
    req: RelatedPartyRequest,
  ): Promise<RelatedPartyResult> => {
    const res = await api.post(
      "/zainii-audit/related-party-transactions",
      req,
      {
        timeout: TIMEOUT_LONG,
      },
    );
    return res.data;
  },
};

// ── Зайны аудит: Expense monitoring (Зардлын хяналт) ────────────────────
export type ExpenseVerificationStatus = "normal" | "questionable" | "attention";

export interface ExpenseTxRow {
  load_date: string;
  book_date: string;
  customer_code: string;
  customer_name: string;
  account_name: string;
  account_code: string;
  currency_code: string;
  debit_amount: number;
  description: string;
  book_number: string;
  department_code: string;
  department_name: string;
  co_a_group_code: string;
  co_a_group_name: string;
  recievable_type_code: string;
  recievable_type_name: string;
  has_payment_request: 0 | 1;
  has_customer_payment_request: 0 | 1;
  has_verification: 0 | 1;
  verification_type: string;
  contract_total_amount: number;
  contract_date: string;
  contract_number: string;
  remaining_amount: number;
  verification_status: string;
  comment: string;
  budget_type: string;
}

export interface ExpenseVerificationRow {
  bookNumber: string;
  comment: string;
  verificationType: string;
  contractTotalAmount: number;
  contractDate: string;
  contractNumber: string;
  remainingAmount: number;
  status: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

export interface ExpenseVerificationTypeRow {
  id: string;
  name: string;
  isActive: 0 | 1;
}

export interface ExpenseOverviewResult {
  qualifyingCount: number;
  qualifyingTotalDebit: number;
  transactions: ExpenseTxRow[];
  truncated?: boolean;
}

export interface ExpenseTotalTxRow {
  load_date: string;
  book_date: string;
  customer_code: string;
  customer_name: string;
  account_name: string;
  account_code: string;
  currency_code: string;
  debit_amount: number;
  description: string;
  book_number: string;
  department_code: string;
  department_name: string;
  co_a_group_code: string;
  co_a_group_name: string;
  recievable_type_code: string;
  recievable_type_name: string;
  has_payment_request: 0 | 1;
  has_customer_payment_request: 0 | 1;
}

export interface ExpenseGroupBreakdown {
  code: string;
  name: string;
  count: number;
  total: number;
}

export interface ExpenseTotalResult {
  transactions: ExpenseTotalTxRow[];
  byGlGroup: ExpenseGroupBreakdown[];
  byReceivableType: ExpenseGroupBreakdown[];
  totalAmount: number;
  truncated?: boolean;
}

export interface ExpenseOverviewRequest {
  startDate: string;
  endDate: string;
  minAmount?: number;
}

export interface ExpensePaymentRequestRow {
  load_date: string;
  invoice_id: string;
  description: string;
  request_date: string;
  employee_name: string;
  sol_id: string;
  employee_code: string;
  department_name: string;
  book_number: string;
  request_amount: number;
  book_date: string;
  account_number: string;
  bank_name: string;
  customer_code: string;
  customer_name: string;
  currency_code: string;
  gl_number: string;
  tender_method_name: string;
  info_name: string;
  purpose: string;
}

export interface ExpenseAttachmentRow {
  invoice_id: string;
  book_number: string;
  customer_code: string;
  customer_name: string;
  content_id: string;
  file_name: string;
  file_extension: string;
  full_url: string;
}

export interface ExpenseBudgetChangeRow {
  load_date: string;
  book_date: string;
  book_number: string;
  employee_name: string;
  sol_id: string;
  employee_code: string;
  department_name: string;
  request_amount: number;
  description: string;
  total_amount: number;
  to_activity_name: string;
  from_activity_name: string;
  from_activity_dtl_name: string;
  to_activity_dtl_name: string;
  amount: number;
  related_book_number: string;
  from_employee_name: string;
  purpose: string;
}

/** Зайны аудитын анхдагч тохиргоо — админ хуудаснаас өөрчилнө. */
export interface ZainiiAuditSettings {
  /** Зардлын хяналтын "доод дүн" шүүлтүүрийн анхдагч утга (₮) */
  defaultMinAmount: number;
  /** Хайлтын анхдагч хугацаа — хэдэн ХОНОГ ухрахыг заана */
  defaultDaysBack: number;
}

// ── Хамааралтай / Холбоотой (hamaaral / holbootoi) ──────────────────────
export interface HamaaralRow {
  cif: string;
  cifname: string;
  empid: string;
  empname: string;
  typename: string;
  status: string;
}

export interface ExpenseRelationsResult {
  hamaaral: Record<string, HamaaralRow[]>;
  holbootoi: string[];
}

// ── Зайны аудит: Word тайлан ─────────────────────────────────────────────
export interface GenerateExpenseReportRequest {
  startDate: string;
  endDate: string;
  minAmount?: number;
  reportNumber: string;
  conclusionText?: string;
}

export const zainiiAuditExpenseApi = {
  getOverview: async (
    req: ExpenseOverviewRequest,
    signal?: AbortSignal,
  ): Promise<ExpenseOverviewResult> => {
    const res = await api.post("/zainii-audit/expense-overview", req, {
      timeout: TIMEOUT_LONG,
      signal,
    });
    return res.data;
  },

  getPaymentRequestsByCustomer: async (req: {
    customerCode: string;
    startDate: string;
    endDate: string;
  }): Promise<{ rows: ExpensePaymentRequestRow[]; truncated?: boolean }> => {
    const res = await api.post("/zainii-audit/expense-payment-requests", req, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  getAttachmentsByInvoice: async (req: {
    invoiceId: string;
  }): Promise<{ rows: ExpenseAttachmentRow[] }> => {
    const res = await api.post("/zainii-audit/expense-attachments", req, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  getBudgetChangesByBookNumber: async (req: {
    bookNumber: string;
  }): Promise<{ rows: ExpenseBudgetChangeRow[] }> => {
    const res = await api.post("/zainii-audit/expense-budget-changes", req, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  upsertVerification: async (req: {
    bookNumber: string;
    comment?: string;
    verificationType?: string;
    contractTotalAmount?: number;
    contractDate?: string;
    contractNumber?: string;
    remainingAmount?: number;
    status?: ExpenseVerificationStatus;
  }): Promise<ExpenseVerificationRow> => {
    const res = await api.post("/zainii-audit/expense-verification", req, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  getTotal: async (req: {
    startDate: string;
    endDate: string;
  }): Promise<ExpenseTotalResult> => {
    const res = await api.post("/zainii-audit/expense-total", req, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  listVerificationTypes: async (
    activeOnly = false,
  ): Promise<ExpenseVerificationTypeRow[]> => {
    const res = await api.get("/zainii-audit/expense-verification-types", {
      params: { activeOnly: activeOnly ? "1" : "0" },
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  createVerificationType: async (
    name: string,
  ): Promise<ExpenseVerificationTypeRow> => {
    const res = await api.post(
      "/zainii-audit/expense-verification-types",
      { name },
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  updateVerificationType: async (
    id: string,
    patch: { name?: string; isActive?: boolean },
  ): Promise<ExpenseVerificationTypeRow> => {
    const res = await api.patch(
      `/zainii-audit/expense-verification-types/${encodeURIComponent(id)}`,
      patch,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  // ── Анхдагч тохиргоо (админ хуудаснаас удирдана) ──────────────────────
  getSettings: async (): Promise<ZainiiAuditSettings> => {
    const res = await api.get("/zainii-audit/settings");
    return res.data;
  },

  updateSettings: async (
    patch: Partial<ZainiiAuditSettings>,
  ): Promise<ZainiiAuditSettings> => {
    const res = await api.patch("/zainii-audit/settings", patch);
    return res.data;
  },

  deleteVerificationType: async (id: string): Promise<{ success: true }> => {
    const res = await api.delete(
      `/zainii-audit/expense-verification-types/${encodeURIComponent(id)}`,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  // ── Хамааралтай / Холбоотой ─────────────────────────────────────────────
  getExpenseRelations: async (
    customerCodes: string[],
  ): Promise<ExpenseRelationsResult> => {
    const res = await api.post(
      "/zainii-audit/expense-relations",
      { customerCodes },
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  // ── Word тайлан ─────────────────────────────────────────────────────────
  downloadExpenseReportDocx: async (
    req: GenerateExpenseReportRequest,
  ): Promise<Blob> => {
    const res = await api.post("/zainii-audit/expense-report-docx", req, {
      responseType: "blob",
      timeout: TIMEOUT_LONG,
    });
    return res.data as Blob;
  },
};

// ── Oracle / Alert Box config (admin) ───────────────────────────────────────
export interface OracleDashboardConfig {
  id: number;
  name: string;
  tableName: string;
  fromClause?: string;
  cifColumn: string;
  dateColumn: string | null;
  amountColumn: string | null;
  enabled: boolean;
}

export interface OracleEventChainConfig {
  id: number;
  name: string;
  description: string;
  sourceLabel: string;
  targetLabel: string;
  sourceIds: number[];
  targetIds: number[];
  enabled: boolean;
}

export const oracleConfigApi = {
  listDashboards: async (): Promise<OracleDashboardConfig[]> => {
    const res = await api.get("/oracle/search/admin/dashboards");
    return res.data;
  },

  createDashboard: async (
    body: Omit<OracleDashboardConfig, "id">,
  ): Promise<OracleDashboardConfig> => {
    const res = await api.post("/oracle/search/admin/dashboards", body);
    return res.data;
  },

  updateDashboard: async (
    id: number,
    body: Partial<Omit<OracleDashboardConfig, "id">>,
  ): Promise<OracleDashboardConfig> => {
    const res = await api.put(`/oracle/search/admin/dashboards/${id}`, body);
    return res.data;
  },

  deleteDashboard: async (id: number): Promise<void> => {
    await api.delete(`/oracle/search/admin/dashboards/${id}`);
  },

  setDashboardEnabled: async (
    id: number,
    enabled: boolean,
  ): Promise<OracleDashboardConfig> => {
    const res = await api.patch(`/oracle/search/admin/dashboards/${id}`, {
      enabled,
    });
    return res.data;
  },

  listChains: async (): Promise<OracleEventChainConfig[]> => {
    const res = await api.get("/oracle/search/admin/chains");
    return res.data;
  },

  createChain: async (
    body: Omit<OracleEventChainConfig, "id">,
  ): Promise<OracleEventChainConfig> => {
    const res = await api.post("/oracle/search/admin/chains", body);
    return res.data;
  },

  updateChain: async (
    id: number,
    body: Partial<Omit<OracleEventChainConfig, "id">>,
  ): Promise<OracleEventChainConfig> => {
    const res = await api.put(`/oracle/search/admin/chains/${id}`, body);
    return res.data;
  },

  deleteChain: async (id: number): Promise<void> => {
    await api.delete(`/oracle/search/admin/chains/${id}`);
  },

  setChainEnabled: async (
    id: number,
    enabled: boolean,
  ): Promise<OracleEventChainConfig> => {
    const res = await api.patch(`/oracle/search/admin/chains/${id}`, {
      enabled,
    });
    return res.data;
  },
};

/** Backend NestJS route (DB: medleg) — frontend-д knowledge гэж нэрлэнэ */
const KNOWLEDGE_BACKEND = "/medleg";

export const knowledgeApi = {
  listPublished: async () => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}?published=true`);
    return r.data;
  },

  create: async (data: Record<string, unknown>) => {
    const r = await api.post(KNOWLEDGE_BACKEND, data);
    return r.data;
  },

  delete: async (id: string) => {
    const r = await api.delete(`${KNOWLEDGE_BACKEND}/${id}`);
    return r.data;
  },

  getOne: async (id: string) => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/${id}`);
    return r.data;
  },

  /**
   * Backend path → { id, index }.
   * `/medleg/:id/image` → index 0
   * `/medleg/:id/images/2` → index 2
   */
  parseImageRef: (path?: string): { id: string; index: number } | null => {
    if (!path) return null;
    const multi = path.match(/\/(?:medleg|knowledge)\/([^/]+)\/images\/(\d+)/);
    if (multi) return { id: multi[1], index: Number(multi[2]) };
    const single = path.match(/\/(?:medleg|knowledge)\/([^/]+)\/image$/);
    if (single) return { id: single[1], index: 0 };
    return null;
  },

  parseImageId: (path?: string): string | null => {
    return knowledgeApi.parseImageRef(path)?.id ?? null;
  },

  /** Auth cookie-тэй backend-ээс зураг татаж object URL буцаана */
  fetchImageObjectUrl: async (path?: string): Promise<string | null> => {
    const ref = knowledgeApi.parseImageRef(path);
    if (!ref) return null;
    const url =
      ref.index === 0
        ? `${KNOWLEDGE_BACKEND}/${ref.id}/image`
        : `${KNOWLEDGE_BACKEND}/${ref.id}/images/${ref.index}`;
    const r = await api.get(url, { responseType: "blob" });
    return URL.createObjectURL(r.data as Blob);
  },
};

/** Админ: Мэдлэг мэдээллийн бүх нийтлэлийг харах/засах/устгах (эзэмшигчээс үл хамааран) */
export const adminKnowledgeApi = {
  listAll: async () => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/admin/all`);
    return r.data;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const r = await api.patch(`${KNOWLEDGE_BACKEND}/admin/${id}`, data);
    return r.data;
  },
  delete: async (id: string) => {
    const r = await api.delete(`${KNOWLEDGE_BACKEND}/admin/${id}`);
    return r.data;
  },
};

/** DAG news хуудасны QUIZ хэсэг */
export interface QuizQuestionInput {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizAnswerItem {
  questionId: string;
  selectedIndex: number;
}

export const quizApi = {
  list: async () => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/quiz`);
    return r.data;
  },
  create: async (data: { title: string; questions: QuizQuestionInput[] }) => {
    const r = await api.post(`${KNOWLEDGE_BACKEND}/quiz`, data);
    return r.data;
  },
  // [MULTI-Q] Quiz-ийн бүх асуултад НЭГ дор хариулна.
  answer: async (
    quizId: string,
    answers: QuizAnswerItem[],
    timeTakenMs: number,
  ) => {
    const r = await api.post(`${KNOWLEDGE_BACKEND}/quiz/${quizId}/answer`, {
      answers,
      timeTakenMs,
    });
    return r.data;
  },
  results: async (quizId: string) => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/quiz/${quizId}/results`);
    return r.data;
  },
  leaderboard: async () => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/quiz/leaderboard`);
    return r.data;
  },
  delete: async (quizId: string) => {
    const r = await api.delete(`${KNOWLEDGE_BACKEND}/quiz/${quizId}`);
    return r.data;
  },
};

// ─── Сүлжээний шинжилгээ (Palo Alto тохиргооны өөрчлөлт, Defender XDR) ───────
export type NetRiskLevel = "Critical" | "High" | "Medium" | "Low";
export type NetReviewStatus = "pending" | "approved" | "rejected";
export type NetXdrStatus =
  "New" | "In Progress" | "Resolved" | "Dismissed" | "Escalated";

export interface NetConfigChangesRequest {
  startDate: string;
  endDate: string;
  riskLevel?: NetRiskLevel;
  reviewStatus?: NetReviewStatus;
  search?: string;
}

export interface NetConfigChangeItem {
  seqno: string;
  deviceName: string;
  receiveTime: string;
  cmd: string;
  result: string;
  path: string;
  adminUsername: string;
  adminSourceIp: string;
  adminClientType: string;
  riskLevel: NetRiskLevel;
  riskScore: number;
  riskRule: string | null;
  reviewStatus: NetReviewStatus;
  description: string;
  comment: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
}

export interface NetConfigChangeDetail extends NetConfigChangeItem {
  before: string;
  after: string;
}

export interface NetConfigChangesResult {
  items: NetConfigChangeItem[];
  matched: number;
  truncated: boolean;
  stats: {
    total: number;
    devices: number;
    admins: number;
    highRisk: number;
    pendingReview: number;
    byRisk: Record<string, number>;
    byCmd: Record<string, number>;
    byReview: Record<string, number>;
    topAdmins: { username: string; changes: number; highRisk: number }[];
  };
}

export interface NetXdrRequest {
  startDate: string;
  endDate: string;
  riskLevel?: NetRiskLevel;
  status?: NetXdrStatus;
}

export interface NetXdrItem {
  notificationId: string;
  detectedAt: string;
  rawText: string;
  device: string;
  userName: string;
  alertId: string;
  detectionSource: string;
  investigationUrl: string;
  actionKeyword: string;
  category: string;
  baseRisk: NetRiskLevel;
  riskLevel: NetRiskLevel;
  privilegedAction: boolean;
  requiresReview: boolean;
  adjustments: string[];
  status: NetXdrStatus;
  note: string;
  assignedTo: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
}

export interface NetXdrResult {
  items: NetXdrItem[];
  matched: number;
  truncated: boolean;
  stats: {
    total: number;
    highRisk: number;
    openReview: number;
    privileged: number;
    devices: number;
    byRisk: Record<string, number>;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export const networkAnalysisApi = {
  listConfigChanges: async (
    req: NetConfigChangesRequest,
    signal?: AbortSignal,
  ): Promise<NetConfigChangesResult> => {
    const res = await api.post("/network-analysis/config-changes", req, {
      timeout: TIMEOUT_LONG,
      signal,
    });
    return res.data;
  },

  getConfigChange: async (seqno: string): Promise<NetConfigChangeDetail> => {
    const res = await api.get(
      `/network-analysis/config-changes/${encodeURIComponent(seqno)}`,
    );
    return res.data;
  },

  reviewConfigChange: async (
    seqno: string,
    body: {
      reviewStatus?: NetReviewStatus;
      description?: string;
      comment?: string;
    },
  ) => {
    const res = await api.patch(
      `/network-analysis/config-changes/${encodeURIComponent(seqno)}/review`,
      body,
    );
    return res.data;
  },

  listXdr: async (
    req: NetXdrRequest,
    signal?: AbortSignal,
  ): Promise<NetXdrResult> => {
    const res = await api.post("/network-analysis/xdr", req, {
      timeout: TIMEOUT_LONG,
      signal,
    });
    return res.data;
  },

  updateXdrStatus: async (
    notificationId: string,
    body: { status: NetXdrStatus; note?: string; assignedTo?: string },
  ) => {
    const res = await api.patch(
      `/network-analysis/xdr/${encodeURIComponent(notificationId)}/status`,
      body,
    );
    return res.data;
  },
};

// ─── Сөрөг мэдээ (Excel бүртгэл + дашбоард) ───────────────────────────────
export interface NegativeNewsRowInput {
  newsDate: string;
  channel: string;
  bank: string;
  category: string;
  content: string;
}

export interface NegativeNewsImportResult {
  batchId: string;
  received: number;
  inserted: number;
  duplicates: number;
  skipped: number;
}

export interface NegativeNewsBatch {
  batchId: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  newRows: number;
  duplicateRows: number;
  skippedRows: number;
  minDate: string;
  maxDate: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface NegativeNewsItem extends NegativeNewsRowInput {
  rowHash: string;
}

export interface NegativeNewsDashboardRequest {
  startDate: string;
  endDate: string;
  bank?: string;
  channel?: string;
  category?: string;
  search?: string;
}

export interface NegativeNewsDashboardResult {
  stats: { total: number; golomt: number; banks: number; channels: number };
  daily: { date: string; count: number }[];
  byChannel: { name: string; count: number }[];
  byBank: { name: string; count: number }[];
  byCategory: { name: string; count: number }[];
  items: NegativeNewsItem[];
  matched: number;
  options: { banks: string[]; channels: string[]; categories: string[] };
  truncated: boolean;
}

/** AI шинжилгээ — дашбоардын шүүлтүүр + даалгавар (хоосон бол анхдагч) */
export interface NegativeNewsAiRequest extends NegativeNewsDashboardRequest {
  instruction?: string;
}

export interface NegativeNewsAiResult {
  lines: string[];
  /** AI руу илгээсэн мэдээний тоо */
  newsCount: number;
  /** Шүүлтүүрт таарсан (хязгаараас өмнөх) мэдээний тоо */
  candidateCount: number;
  model: string;
  bank: string;
}

export const negativeNewsApi = {
  importRows: async (body: {
    batchId?: string;
    fileName: string;
    sheetName?: string;
    rows: NegativeNewsRowInput[];
  }): Promise<NegativeNewsImportResult> => {
    const res = await api.post("/negative-news/import", body, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  listBatches: async (): Promise<NegativeNewsBatch[]> => {
    const res = await api.get("/negative-news/batches");
    return res.data;
  },

  deleteBatch: async (
    batchId: string,
  ): Promise<{ batchId: string; deletedRows: number }> => {
    const res = await api.delete(
      `/negative-news/batches/${encodeURIComponent(batchId)}`,
    );
    return res.data;
  },

  aiInsights: async (
    req: NegativeNewsAiRequest,
  ): Promise<NegativeNewsAiResult> => {
    const res = await api.post("/negative-news/ai-insights", req, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  dashboard: async (
    req: NegativeNewsDashboardRequest,
    signal?: AbortSignal,
  ): Promise<NegativeNewsDashboardResult> => {
    const res = await api.post("/negative-news/dashboard", req, {
      timeout: TIMEOUT_LONG,
      signal,
    });
    return res.data;
  },
};

// ─── Өгөгдлийн сангийн өөрчлөлт (Oracle audit trail) ──────────────────────
export interface DbChangeRowInput {
  /** YYYY-MM-DD HH:MM:SS */
  actionTime: string;
  username: string;
  machine: string;
  action: string;
  owner: string;
  objectName: string;
  domain: string;
  sqlText: string;
  sourceDescription: string;
  jira: string;
}

export type DbChangeImportResult = NegativeNewsImportResult;

export interface DbChangeBatch {
  batchId: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  newRows: number;
  duplicateRows: number;
  skippedRows: number;
  minTime: string;
  maxTime: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface DbChangeRecord extends DbChangeRowInput {
  rowHash: string;
  systemType: string;
  sqlCommand: string;
  flagged: boolean;
  note: string;
  reviewedByName: string;
  reviewedAt: string;
}

export interface DbChangesRangeRequest {
  startDate: string;
  endDate: string;
  systemType?: string;
}

export interface DbChangesRecordsRequest extends DbChangesRangeRequest {
  sqlCommand?: string;
  username?: string;
  search?: string;
  flaggedOnly?: boolean;
}

export interface DbChangesRecordsResult {
  items: DbChangeRecord[];
  truncated: boolean;
  usernames: string[];
}

export interface DbChangeReviewResult {
  rowHash: string;
  flagged: boolean;
  note: string;
  reviewedByName: string;
  reviewedAt: string;
}

type DbChangeCount = { name: string; count: number };

export interface DbChangesDashboardResult {
  stats: {
    total: number;
    users: number;
    objects: number;
    flagged: number;
    drops: number;
  };
  bySystem: DbChangeCount[];
  byCommand: DbChangeCount[];
  domainsBySystem: DbChangeCount[];
  topUsers: DbChangeCount[];
  actionsBySystem: { systemType: string; action: string; count: number }[];
  daily: { date: string; count: number }[];
  flagged: DbChangeRecord[];
}

export const dbChangesApi = {
  importRows: async (body: {
    batchId?: string;
    fileName: string;
    sheetName?: string;
    rows: DbChangeRowInput[];
  }): Promise<DbChangeImportResult> => {
    const res = await api.post("/db-changes/import", body, {
      timeout: TIMEOUT_LONG,
    });
    return res.data;
  },

  listBatches: async (): Promise<DbChangeBatch[]> => {
    const res = await api.get("/db-changes/batches");
    return res.data;
  },

  deleteBatch: async (
    batchId: string,
  ): Promise<{ batchId: string; deletedRows: number }> => {
    const res = await api.delete(
      `/db-changes/batches/${encodeURIComponent(batchId)}`,
    );
    return res.data;
  },

  records: async (
    req: DbChangesRecordsRequest,
    signal?: AbortSignal,
  ): Promise<DbChangesRecordsResult> => {
    const res = await api.post("/db-changes/records", req, {
      timeout: TIMEOUT_LONG,
      signal,
    });
    return res.data;
  },

  review: async (
    rowHash: string,
    body: { flagged: boolean; note: string },
  ): Promise<DbChangeReviewResult> => {
    const res = await api.patch(
      `/db-changes/records/${encodeURIComponent(rowHash)}/review`,
      body,
    );
    return res.data;
  },

  dashboard: async (
    req: DbChangesRangeRequest,
    signal?: AbortSignal,
  ): Promise<DbChangesDashboardResult> => {
    const res = await api.post("/db-changes/dashboard", req, {
      timeout: TIMEOUT_LONG,
      signal,
    });
    return res.data;
  },
};
