import axios from "axios";
import Cookies from "js-cookie";

const API_URL: string = process.env.NEXT_PUBLIC_API_URL ?? "";
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is not set");
}

/**
 * Local Nest (`:3001`) has no `/api` prefix. Prod reverse-proxy sends
 * `/api/*` to Nest; `/monitoring/*` on the public host hits Next → 404.
 */
function monitoringPath(path: string): string {
  const base = API_URL.replace(/\/$/, "");
  const alreadyOnNest =
    base === "/api" ||
    base.endsWith("/api") ||
    /localhost|127\.0\.0\.1|:3001/i.test(base);
  return alreadyOnNest ? path : `/api${path}`;
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
    return (
      (e.response?.data as { message?: string } | undefined)?.message ??
      e.message
    );
  }
  if (e instanceof Error) return e.message;
  return String(e);
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

  // [N-2] No arg needed — browser sends HttpOnly refreshToken cookie automatically
  refreshToken: async () => {
    const response = await api.post("/auth/refresh", {});
    return response.data;
  },

  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

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
// Tailan (Quarterly Report) APIs
export interface TailanReportPayload {
  year: number;
  quarter: number;
  sections: Record<string, unknown>;
  dynamicSections?: { order: number; title: string; content?: string }[];
  hiddenSections?: string[];
  status?: "draft" | "submitted";
}

export const tailanApi = {
  getRole: async () => {
    const response = await api.get("/tailan/role");
    return response.data as { isDeptHead: boolean };
  },

  saveDraft: async (data: TailanReportPayload) => {
    const response = await api.post("/tailan/save", data);
    return response.data;
  },

  // ─── Live "real docx" preview from unsaved editor state ─────────────────
  previewWord: async (data: TailanReportPayload): Promise<Blob> => {
    const response = await api.post("/tailan/preview", data, {
      responseType: "blob",
      timeout: TIMEOUT_LONG,
    });
    return response.data as Blob;
  },

  submitReport: async (year: number, quarter: number) => {
    const response = await api.post("/tailan/submit", { year, quarter });
    return response.data;
  },

  getMyReport: async (year: number, quarter: number) => {
    const response = await api.get(`/tailan/my/${year}/${quarter}`);
    return response.data;
  },

  downloadMyWord: async (
    year: number,
    quarter: number,
    displayName?: string,
  ): Promise<Blob> => {
    const params = displayName ? { name: displayName } : {};
    const response = await api.get(`/tailan/my/${year}/${quarter}/word`, {
      responseType: "blob",
      params,
    });
    return response.data as Blob;
  },

  getDeptReports: async (year: number, quarter: number) => {
    const response = await api.get(`/tailan/dept/${year}/${quarter}`);
    return response.data;
  },

  getDeptOverview: async (year: number, quarter: number) => {
    const response = await api.get(`/tailan/dept/${year}/${quarter}/overview`);
    return response.data;
  },

  viewDeptMemberWord: async (
    userId: string,
    year: number,
    quarter: number,
  ): Promise<Blob> => {
    const response = await api.get(
      `/tailan/dept/member/${encodeURIComponent(userId)}/${year}/${quarter}/word`,
      { responseType: "blob" },
    );
    return response.data as Blob;
  },

  generateDeptWord: async (data: {
    year: number;
    quarter: number;
    tasks: unknown[];
    sections: unknown[];
    otherEntries: unknown[];
    activities: unknown[];
    rawSections?: Record<string, unknown>;
  }): Promise<Blob> => {
    const response = await api.post("/tailan/dept/generate-word", data, {
      responseType: "blob",
      timeout: TIMEOUT_LONG,
    });
    return response.data as Blob;
  },

  // Image methods
  uploadImage: async (year: number, quarter: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("year", String(year));
    formData.append("quarter", String(quarter));
    const response = await api.post("/tailan/images", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  getImages: async (year: number, quarter: number) => {
    const response = await api.get(`/tailan/images/my/${year}/${quarter}`);
    return response.data as {
      id: string;
      filename: string;
      mimeType: string;
      uploadedAt: string;
    }[];
  },

  fetchImageDataUrl: async (id: string): Promise<string> => {
    const response = await api.get(`/tailan/images/${id}/data`, {
      responseType: "blob",
    });
    return URL.createObjectURL(response.data as Blob);
  },

  deleteImage: async (id: string) => {
    await api.delete(`/tailan/images/${id}`);
  },

  // ─── Department BSC (ТҮЗ) report ────────────────────────────────────────
  saveDeptBsc: async (
    year: number,
    quarter: number,
    sections: Record<string, unknown>,
  ) => {
    const response = await api.post("/tailan/dept-bsc", {
      year,
      quarter,
      sections,
    });
    return response.data as { ok: boolean; message: string };
  },

  getDeptBsc: async (year: number, quarter: number) => {
    const response = await api.get(`/tailan/dept-bsc/${year}/${quarter}`);
    return response.data as {
      sections: Record<string, unknown>;
      savedByName: string;
      updatedAt: string;
    } | null;
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

// ── Python API Tools ──────────────────────────────────────────────────────────

export interface FilterDef {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** "list" — олон утга (CIF/дугаар зэрэг) шинэ мөр эсвэл ","-аар зааглаж
   * нэг талбарт оруулах боломжтой textarea. Дараа нь Python код талд
   * `filters["<key>"]` нь ","-аар холбогдсон нэг string байдлаар ирнэ —
   * `filters["<key>"].split(",")` гэж бичиж жагсаалт болгоно. */
  type?: "text" | "list";
}

export interface PythonTool {
  id: string;
  name: string;
  apiPath: string;
  description: string;
  connectionType: "clickhouse" | "oracle" | "clickhouse_oracle";
  outputFormat: "excel" | "csv";
  dateMode: "none" | "single" | "range";
  color: string;
  filters: string; // JSON string of FilterDef[]
  createdAt: string;
  updatedAt: string;
  isActive: number;
}

export interface PythonToolAdmin extends PythonTool {
  pythonCode: string;
  connectionConfig: string; // JSON string (ClickHouse/Oracle/MSSQL параметрүүд)
}

export const pythonToolApi = {
  // ── User ──────────────────────────────────────────────────────────────────
  getTools: async (): Promise<PythonTool[]> => {
    const res = await api.get("/python-api/tools");
    return res.data;
  },

  runTool: async (
    toolId: string,
    startDate?: string,
    endDate?: string,
    filters?: Record<string, string>,
    onProgress?: (pct: number) => void,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    const res = await api.post(
      "/python-api/run",
      { toolId, startDate, endDate, filters },
      {
        responseType: "blob",
        timeout: TIMEOUT_LONG,
        signal,
        onDownloadProgress: (e) => {
          if (!onProgress) return;
          const pct =
            e.total && e.total > 0
              ? Math.min(99, Math.round((e.loaded / e.total) * 100))
              : 0;
          onProgress(pct);
        },
      },
    );
    onProgress?.(100);
    return res.data as Blob;
  },

  previewTool: async (
    toolId: string,
    startDate?: string,
    endDate?: string,
    filters?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ columns: string[]; rows: unknown[][]; totalCount: number }> => {
    const res = await api.post(
      "/python-api/preview",
      {
        toolId,
        startDate,
        endDate,
        filters,
      },
      { signal, timeout: TIMEOUT_LONG },
    );
    return res.data as {
      columns: string[];
      rows: unknown[][];
      totalCount: number;
    };
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  adminGetAll: async (): Promise<PythonToolAdmin[]> => {
    const res = await api.get("/python-api/admin/tools");
    return res.data;
  },

  adminCreate: async (data: {
    name: string;
    apiPath: string;
    description?: string;
    pythonCode: string;
    connectionType?: "clickhouse" | "oracle" | "clickhouse_oracle";
    connectionConfig?: string;
    outputFormat?: "excel" | "csv";
    dateMode?: "none" | "single" | "range";
    color?: string;
    filters?: string;
  }): Promise<PythonToolAdmin> => {
    const res = await api.post("/python-api/admin/tools", data);
    return res.data;
  },

  adminUpdate: async (
    id: string,
    data: Partial<{
      name: string;
      apiPath: string;
      description: string;
      pythonCode: string;
      connectionType: "clickhouse" | "oracle" | "clickhouse_oracle";
      connectionConfig: string;
      outputFormat: "excel" | "csv";
      dateMode: "none" | "single" | "range";
      color: string;
      filters: string;
    }>,
  ): Promise<PythonToolAdmin> => {
    const res = await api.patch(`/python-api/admin/tools/${id}`, data);
    return res.data;
  },

  adminToggle: async (
    id: string,
    isActive: boolean,
  ): Promise<PythonToolAdmin> => {
    const res = await api.patch(`/python-api/admin/tools/${id}/toggle`, {
      isActive,
    });
    return res.data;
  },

  adminDelete: async (id: string): Promise<void> => {
    await api.delete(`/python-api/admin/tools/${id}`);
  },

  adminReorder: async (ids: string[]): Promise<void> => {
    await api.post("/python-api/admin/tools/reorder", { ids });
  },

  /** Editor: кодыг ажиллуулахгүйгээр syntax + аюулгүй байдлын шалгалт */
  adminValidateCode: async (
    code: string,
  ): Promise<{
    ok: boolean;
    error?: string;
    warning?: string | null;
    line?: number | null;
  }> => {
    const res = await api.post("/python-api/admin/validate-code", { code });
    return res.data;
  },

  /** Editor: хадгалаагүй кодыг шууд тест ажиллуулах (эхний 50 мөр) */
  adminPreviewCode: async (input: {
    code: string;
    connectionType?: string;
    connectionConfig?: string;
    startDate?: string;
    endDate?: string;
    filters?: Record<string, string>;
  }): Promise<{ columns: string[]; rows: unknown[][]; totalCount: number }> => {
    const res = await api.post("/python-api/admin/preview-code", input);
    return res.data;
  },

  // ── Permissions ────────────────────────────────────────────────────────────

  adminGetPermissions: async (): Promise<
    {
      userId: string;
      templateId: string;
      grantedBy: string;
      grantedAt: string;
    }[]
  > => {
    const res = await api.get("/python-api/admin/permissions");
    return res.data;
  },

  adminGrantPermission: async (
    userId: string,
    templateId: string,
  ): Promise<void> => {
    await api.post("/python-api/admin/permissions", { userId, templateId });
  },

  adminRevokePermission: async (
    userId: string,
    templateId: string,
  ): Promise<void> => {
    await api.delete("/python-api/admin/permissions", {
      data: { userId, templateId },
    });
  },

  // ── Run logs ──────────────────────────────────────────────────────────────

  adminGetRunLogs: async (
    limit = 200,
  ): Promise<
    {
      id: string;
      userId: string;
      userName: string;
      toolId: string;
      toolName: string;
      ranAt: string;
    }[]
  > => {
    const res = await api.get(`/python-api/admin/run-logs?limit=${limit}`);
    return res.data;
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

  // ── ETL pre-computed branch scores ────────────────────────────────────────

  /** ETL-аас тооцоолсон оноог ClickHouse-с авах */
  getBranchScores: async (date?: string): Promise<BranchScore[]> => {
    const res = await api.get(`/risk-assessment/branch-scores`, {
      params: date ? { date } : {},
    });
    return res.data ?? [];
  },

  /** ETL-аас тооцоолсон оноог ClickHouse-д хадгалах */
  upsertBranchScores: async (
    fetchDate: string,
    scores: Omit<BranchScore, "fetchDate">[],
  ): Promise<void> => {
    await api.post(`/risk-assessment/branch-scores`, { fetchDate, scores });
  },
};

// ── ETL pre-computed branch scores ──────────────────────────────────────────

export interface BranchScore {
  fetchDate: string;
  branchId: string;
  branchName: string;
  solid: string;
  rating: string;
  region: string;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s4: number;
  j: number;
  total: number | null;
  level: string;
}

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

// ── Monitoring Box (continuous auditing monitor cards) ──────────────────────
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

export const monitoringApi = {
  findRelatedPartyTransactions: async (
    req: RelatedPartyRequest,
  ): Promise<RelatedPartyResult> => {
    const res = await api.post(
      monitoringPath("/monitoring/related-party-transactions"),
      req,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },
};

// ── Monitoring Box: Expense monitoring (Зардлын хяналт) ────────────────────
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
  verification_status: string;
  comment: string;
  budget_type: string;
}

export interface ExpenseVerificationRow {
  bookNumber: string;
  comment: string;
  verificationType: string;
  contractTotalAmount: number;
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

export const expenseMonitoringApi = {
  getOverview: async (
    req: ExpenseOverviewRequest,
    signal?: AbortSignal,
  ): Promise<ExpenseOverviewResult> => {
    const res = await api.post(
      monitoringPath("/monitoring/expense-overview"),
      req,
      { timeout: TIMEOUT_LONG, signal },
    );
    return res.data;
  },

  getPaymentRequestsByCustomer: async (req: {
    customerCode: string;
    startDate: string;
    endDate: string;
  }): Promise<{ rows: ExpensePaymentRequestRow[]; truncated?: boolean }> => {
    const res = await api.post(
      monitoringPath("/monitoring/expense-payment-requests"),
      req,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  getAttachmentsByInvoice: async (req: {
    invoiceId: string;
  }): Promise<{ rows: ExpenseAttachmentRow[] }> => {
    const res = await api.post(
      monitoringPath("/monitoring/expense-attachments"),
      req,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  getBudgetChangesByBookNumber: async (req: {
    bookNumber: string;
  }): Promise<{ rows: ExpenseBudgetChangeRow[] }> => {
    const res = await api.post(
      monitoringPath("/monitoring/expense-budget-changes"),
      req,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  upsertVerification: async (req: {
    bookNumber: string;
    comment?: string;
    verificationType?: string;
    contractTotalAmount?: number;
    status?: ExpenseVerificationStatus;
  }): Promise<ExpenseVerificationRow> => {
    const res = await api.post(
      monitoringPath("/monitoring/expense-verification"),
      req,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  getTotal: async (req: {
    startDate: string;
    endDate: string;
  }): Promise<ExpenseTotalResult> => {
    const res = await api.post(
      monitoringPath("/monitoring/expense-total"),
      req,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  listVerificationTypes: async (
    activeOnly = false,
  ): Promise<ExpenseVerificationTypeRow[]> => {
    const res = await api.get(
      monitoringPath("/monitoring/expense-verification-types"),
      {
        params: { activeOnly: activeOnly ? "1" : "0" },
        timeout: TIMEOUT_LONG,
      },
    );
    return res.data;
  },

  createVerificationType: async (
    name: string,
  ): Promise<ExpenseVerificationTypeRow> => {
    const res = await api.post(
      monitoringPath("/monitoring/expense-verification-types"),
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
      monitoringPath(
        `/monitoring/expense-verification-types/${encodeURIComponent(id)}`,
      ),
      patch,
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },

  deleteVerificationType: async (id: string): Promise<{ success: true }> => {
    const res = await api.delete(
      monitoringPath(
        `/monitoring/expense-verification-types/${encodeURIComponent(id)}`,
      ),
      { timeout: TIMEOUT_LONG },
    );
    return res.data;
  },
};

// ── Tailan templates (admin: template builder) ──────────────────────────────
export type TailanSectionType = "richtext" | "taskList" | "table";
export type TailanTemplateScope = "employee" | "department";

export interface TailanTableColumnDef {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "center" | "right";
  richtext?: boolean;
  numeric?: boolean;
}

export interface TailanTaskListConfig {
  showCompletion?: boolean;
  showPeriod?: boolean;
  showDescription?: boolean;
  showImages?: boolean;
  showAverage?: boolean;
  titleLabel?: string;
  completionLabel?: string;
  periodLabel?: string;
  descriptionLabel?: string;
}

export interface TailanTableConfig {
  columns: TailanTableColumnDef[];
  averageColumnKey?: string;
  showImages?: boolean;
}

export interface TailanSectionDef {
  key: string;
  titleMn: string;
  titleEn?: string;
  subtitleMn?: string;
  headingLevel: "main" | "sub";
  type: TailanSectionType;
  order: number;
  orientation?: "portrait" | "landscape";
  defaultHidden?: boolean;
  taskList?: TailanTaskListConfig;
  table?: TailanTableConfig;
}

export interface TailanTemplate {
  id: string;
  departmentId: string;
  scope: TailanTemplateScope;
  name: string;
  sections: TailanSectionDef[];
  isActive: 0 | 1;
  updatedBy: string;
  seq: number;
  updatedAt: string;
}

export const DEFAULT_TAILAN_DEPARTMENT_ID = "default";

export const tailanTemplateApi = {
  list: async (scope?: TailanTemplateScope): Promise<TailanTemplate[]> => {
    const res = await api.get("/tailan-templates", { params: { scope } });
    return res.data;
  },

  getActive: async (
    departmentId: string | undefined,
    scope: TailanTemplateScope,
  ): Promise<TailanTemplate> => {
    const res = await api.get("/tailan-templates/active", {
      params: { departmentId, scope },
    });
    return res.data;
  },

  upsert: async (dto: {
    id?: string;
    departmentId: string;
    scope: TailanTemplateScope;
    name: string;
    sections: TailanSectionDef[];
  }): Promise<TailanTemplate> => {
    const res = await api.post("/tailan-templates", dto);
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/tailan-templates/${id}`);
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

  getTopPublishers: async () => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/stats/top-publishers`);
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
  parseImageRef: (
    path?: string,
  ): { id: string; index: number } | null => {
    if (!path) return null;
    const multi = path.match(
      /\/(?:medleg|knowledge)\/([^/]+)\/images\/(\d+)/,
    );
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

/** Мэдлэг мэдээлэл хуудасны QUIZ хэсэг */
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

export const knowledgeReactionsApi = {
  get: async (itemId: string) => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/${itemId}/reactions`);
    return r.data as {
      counts: Record<string, number>;
      myReaction: string | null;
    };
  },
  react: async (itemId: string, emoji: string) => {
    const r = await api.post(`${KNOWLEDGE_BACKEND}/${itemId}/react`, { emoji });
    return r.data;
  },
  remove: async (itemId: string) => {
    const r = await api.delete(`${KNOWLEDGE_BACKEND}/${itemId}/react`);
    return r.data;
  },
};

export const knowledgeCommentsApi = {
  get: async (itemId: string) => {
    const r = await api.get(`${KNOWLEDGE_BACKEND}/${itemId}/comments`);
    return r.data as {
      id: string;
      newsId: string;
      authorId: string;
      authorName: string;
      content: string;
      createdAt: string;
    }[];
  },
  add: async (itemId: string, content: string) => {
    const r = await api.post(`${KNOWLEDGE_BACKEND}/${itemId}/comments`, {
      content,
    });
    return r.data;
  },
  delete: async (itemId: string, commentId: string) => {
    const r = await api.delete(
      `${KNOWLEDGE_BACKEND}/${itemId}/comments/${commentId}`,
    );
    return r.data;
  },
};
