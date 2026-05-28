import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is not set");
}

// [N-2] withCredentials: true so the browser sends HttpOnly token cookies with every request
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// [N-2] No request interceptor for Authorization header —
// HttpOnly cookies are sent automatically by the browser.

// Shared in-flight refresh promise — prevents concurrent 401s from each
// triggering their own /auth/refresh call.
let _refreshPromise: Promise<any> | null = null;

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
          // Reuse an in-flight refresh so concurrent 401s share one network call
          if (!_refreshPromise) {
            _refreshPromise = axios
              .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
              .finally(() => {
                _refreshPromise = null;
              });
          }
          // [N-2] No body needed — browser sends HttpOnly refreshToken cookie automatically
          const refreshRes = await _refreshPromise;
          // Update the user display cookie from the refresh response
          const freshUser = refreshRes.data?.user;
          if (freshUser) {
            const secure =
              typeof window !== "undefined" &&
              window.location.protocol === "https:";
            Cookies.set(userKey, JSON.stringify(freshUser), {
              expires: 3,
              sameSite: "strict",
              secure,
            });
          }
          // Retry original — browser sends new HttpOnly token cookie automatically
          return api(originalRequest);
        } catch {
          Cookies.remove(userKey);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:session-expired"));
            const loginPath = isAdmin ? "/admin/login" : "/login";
            if (!window.location.pathname.startsWith(loginPath)) {
              window.location.replace(loginPath);
            }
          }
        }
      }
    }

    if (error.response?.status === 401) {
      Cookies.remove(userKey);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
        const loginPath = isAdmin ? "/admin/login" : "/login";
        if (!window.location.pathname.startsWith(loginPath)) {
          window.location.replace(loginPath);
        }
      }
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
  createUser: async (data: {
    password: string;
    name: string;
    department: string;
    position: string;
  }) => {
    const response = await api.post("/auth/signup", data);
    return response.data;
  },

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

  getUsersByDepartment: async (department: string) => {
    const response = await api.get(
      `/auth/departments/${encodeURIComponent(department)}/users`,
    );
    return response.data;
  },

  searchUsers: async (query: string) => {
    const response = await api.get(
      `/auth/search?q=${encodeURIComponent(query)}`,
    );
    return response.data;
  },
};

// Users APIs
export const usersApi = {
  getAll: async () => {
    const response = await api.get("/users");
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, isActive: boolean) => {
    const response = await api.patch(`/users/${id}/status`, { isActive });
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
  create: async (data: {
    name: string;
    description?: string;
    manager?: string;
    employeeCount?: number;
  }) => {
    const response = await api.post("/departments", data);
    return response.data;
  },

  getAll: async () => {
    const response = await api.get("/departments");
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/departments/${id}`);
    return response.data;
  },

  getByName: async (name: string) => {
    const response = await api.get(
      `/departments/by-name/${encodeURIComponent(name)}`,
    );
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/departments/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/departments/${id}`);
    return response.data;
  },

  // Photo album
  getPhotos: async (deptId: string) => {
    const response = await api.get(`/departments/${deptId}/photos`);
    return response.data as {
      id: string;
      departmentId: string;
      departmentName: string;
      uploadedBy: string;
      uploadedByName: string;
      caption: string;
      imageData: string;
      uploadedAt: string;
    }[];
  },

  uploadPhoto: async (
    deptId: string,
    departmentName: string,
    imageData: string,
    caption?: string,
  ) => {
    const response = await api.post(`/departments/${deptId}/photos`, {
      imageData,
      caption: caption ?? "",
      departmentName,
    });
    return response.data;
  },

  deletePhoto: async (deptId: string, photoId: string) => {
    const response = await api.delete(
      `/departments/${deptId}/photos/${photoId}`,
    );
    return response.data;
  },
};
// Tailan (Quarterly Report) APIs
export const tailanApi = {
  getRole: async () => {
    const response = await api.get("/tailan/role");
    return response.data as { isDeptHead: boolean };
  },

  saveDraft: async (data: {
    year: number;
    quarter: number;
    plannedTasks: any[];
    dynamicSections: any[];
    otherWork?: string;
    teamActivities: any[];
    section2Tasks?: any[];
    section1Dashboards?: any[];
    section3AutoTasks?: any[];
    section3Dashboards?: any[];
    section4Trainings?: any[];
    section4KnowledgeText?: string;
    section5Tasks?: any[];
    section6Activities?: any[];
    section7Text?: string;
    status?: string;
  }) => {
    const response = await api.post("/tailan/save", data);
    return response.data;
  },

  submitReport: async (year: number, quarter: number) => {
    const response = await api.post("/tailan/submit", { year, quarter });
    return response.data;
  },

  getMyReports: async () => {
    const response = await api.get("/tailan/my");
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

  getDeptMemberReport: async (
    userId: string,
    year: number,
    quarter: number,
  ) => {
    const response = await api.get(
      `/tailan/dept/member/${encodeURIComponent(userId)}/${year}/${quarter}`,
    );
    return response.data;
  },

  downloadDeptWord: async (year: number, quarter: number): Promise<Blob> => {
    const response = await api.get(`/tailan/dept/${year}/${quarter}/word`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  generateDeptWord: async (data: {
    year: number;
    quarter: number;
    tasks: any[];
    sections: any[];
    otherEntries: any[];
    activities: any[];
    rawSections?: Record<string, unknown>;
  }): Promise<Blob> => {
    const response = await api.post("/tailan/dept/generate-word", data, {
      responseType: "blob",
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

  getDeptImages: async (year: number, quarter: number) => {
    const response = await api.get(`/tailan/images/dept/${year}/${quarter}`);
    return response.data as {
      id: string;
      userId: string;
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

  getColumns: async (db: string, table: string) => {
    const response = await api.get(`/db-access/tables/${db}/${table}/columns`);
    return response.data as { name: string; type: string }[];
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

  getMyRequests: async () => {
    const response = await api.get("/db-access/requests/my");
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

  bulkReview: async (action: "approve" | "reject") => {
    const response = await api.post("/db-access/requests/bulk-review", {
      action,
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

  getGrantsByUser: async (userId: string) => {
    const response = await api.get(`/db-access/grants/user/${userId}`);
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

  deleteRequestHistory: async () => {
    const response = await api.delete("/db-access/requests/history");
    return response.data;
  },

  cleanupChUser: async (requesterUserId: string) => {
    const response = await api.post(
      `/db-access/grants/cleanup-ch/${encodeURIComponent(requesterUserId)}`,
    );
    return response.data;
  },

  // Grantors
  getGrantors: async () => {
    const response = await api.get("/db-access/grantors");
    return response.data;
  },
};

// ── Python API Tools ──────────────────────────────────────────────────────────

export interface FilterDef {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
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
  ): Promise<{ columns: string[]; rows: any[][]; totalCount: number }> => {
    const res = await api.post(
      "/python-api/preview",
      {
        toolId,
        startDate,
        endDate,
        filters,
      },
      { signal },
    );
    return res.data as { columns: string[]; rows: any[][]; totalCount: number };
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
  updatedBy: string;
  pDate: string;
  pDateBeg: string;
  SOLID: string;
  BRANCHNAME: string;
  BRANCHID: string;
  PARENTBRANCH: string;
  RESULT: string;
  RESULT_TYPE: string;
  DESCRIPTION_TEXT: string;
  P_DATEBEG: string;
  P_DATE: string;
  ID: string;
  SUBID: string;
  OPERATION_TYPE: string;
  isManual: number;
  manualResult: string;
  indicatorId: string;
  indicatorValue: number | null;
}

export const riskApi = {
  /** Oracle-аас татаж current-д хадгалах */
  branchRiskass: async (args: {
    pDate: string;
    pDateBeg: string;
    branchIds?: number[];
  }): Promise<{
    pDate: string;
    pDateBeg: string;
    branchCount: number;
    rowCount: number;
    failed: { branchId: number; error: string }[];
    rows: RiskCurrentRow[];
  }> => {
    const res = await api.post(`/risk-assessment/branch-riskass`, args);
    return res.data;
  },

  /** Current table-аас бүгдийг уншина (oracle мөрүүд + manual indicator мөрүүд) */
  getCurrent: async (): Promise<{
    pDate: string;
    pDateBeg: string;
    oracleFetchedAt: string | null;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> => {
    const res = await api.get(`/risk-assessment/current`);
    return res.data;
  },

  /** Нэг Oracle мөрийн RESULT утгыг гараар засах */
  overrideBranchRiskassRow: async (
    rowKey: string,
    manualResult: string,
  ): Promise<void> => {
    await api.patch(`/risk-assessment/branch-riskass/row`, {
      rowKey,
      manualResult,
    });
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

  /** Current байдлыг нэр өгч History-д хадгалах */
  saveHistory: async (name: string): Promise<RiskHistoryEntry> => {
    const res = await api.post(`/risk-assessment/history`, { name });
    return res.data;
  },

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
  listHolds: async (period: string): Promise<{ indicatorId: string; isHeld: number }[]> => {
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

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Report API
// ─────────────────────────────────────────────────────────────────────────────
export type WeeklyReportRole = "audit" | "daa" | "director" | "none";

export interface WeeklyReportRoleInfo {
  role: WeeklyReportRole;
  departmentId: string;
  departmentName: string;
  canWrite: boolean;
  canViewAll: boolean;
}

export interface WeeklyReport {
  id: string;
  userId: string;
  userName: string;
  departmentId: string;
  departmentName: string;
  role: string;
  year: number;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  status: "draft" | "submitted";
  sections: Record<string, unknown>;
  submittedAt?: string;
  updatedAt?: string;
}

export const weeklyReportApi = {
  getRole: async (): Promise<WeeklyReportRoleInfo> => {
    const res = await api.get("/weekly-report/role");
    return res.data;
  },

  save: async (data: {
    year: number;
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    role: "audit" | "daa";
    sections: Record<string, unknown>;
    status?: "draft" | "submitted";
  }) => {
    const res = await api.post("/weekly-report/save", data);
    return res.data as { id: string; status: string; savedAt: string };
  },

  submit: async (year: number, weekNumber: number) => {
    const res = await api.post("/weekly-report/submit", { year, weekNumber });
    return res.data;
  },

  listMine: async (): Promise<WeeklyReport[]> => {
    const res = await api.get("/weekly-report/my");
    return res.data;
  },

  getMine: async (
    year: number,
    weekNumber: number,
  ): Promise<WeeklyReport | null> => {
    const res = await api.get(`/weekly-report/my/${year}/${weekNumber}`);
    return res.data;
  },

  listWeeks: async (): Promise<
    {
      year: number;
      weekNumber: number;
      weekStart: string;
      weekEnd: string;
      cnt: number;
    }[]
  > => {
    const res = await api.get("/weekly-report/weeks");
    return res.data;
  },

  consolidated: async (
    year: number,
    weekNumber: number,
  ): Promise<WeeklyReport[]> => {
    const res = await api.get(
      `/weekly-report/consolidated?year=${year}&week=${weekNumber}`,
    );
    return res.data;
  },

  getMember: async (
    userId: string,
    year: number,
    weekNumber: number,
  ): Promise<WeeklyReport> => {
    const res = await api.get(
      `/weekly-report/member/${userId}/${year}/${weekNumber}`,
    );
    return res.data;
  },

  directorEdit: async (
    reportId: string,
    sections: Record<string, unknown>,
  ): Promise<{ id: string; savedAt: string }> => {
    const res = await api.post(`/weekly-report/director-edit/${reportId}`, {
      sections,
    });
    return res.data;
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

export interface GroupConfig {
  region: string;
  group_num: number;
  weight: number;
  label: string;
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

  reorder: async (ids: string[]): Promise<void> => {
    await api.post("/risk-indicator-config/reorder", { ids });
  },

  seed: async (): Promise<{ count: number }> => {
    const res = await api.post("/risk-indicator-config/seed");
    return res.data;
  },

  listGroupConfig: async (): Promise<GroupConfig[]> => {
    const res = await api.get("/risk-indicator-config/group-config");
    return res.data;
  },

  upsertGroupConfig: async (dto: {
    region: string;
    group_num: number;
    weight: number;
    label: string;
  }): Promise<void> => {
    await api.post("/risk-indicator-config/group-config", dto);
  },

  seedGroups: async (): Promise<void> => {
    await api.post("/risk-indicator-config/seed-groups");
  },
};
