import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/** Pick the right token based on which part of the app is making the request */
const getActiveToken = () => {
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin")
  ) {
    return Cookies.get("adminToken");
  }
  return Cookies.get("token");
};

// Request interceptor - token нэмэх
api.interceptors.request.use((config) => {
  const token = getActiveToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - алдаа шийдвэрлэх
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAdmin =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin");

    const tokenKey = isAdmin ? "adminToken" : "token";
    const refreshKey = isAdmin ? "adminRefreshToken" : "refreshToken";
    const userKey = isAdmin ? "adminUser" : "user";

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get(refreshKey);
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          const { accessToken, refreshToken: newRefreshToken } = response.data;

          Cookies.set(tokenKey, accessToken, {
            expires: 1 / 24,
            sameSite: "lax",
          });
          Cookies.set(refreshKey, newRefreshToken, {
            expires: 30,
            sameSite: "lax",
          });

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch {
        Cookies.remove(tokenKey);
        Cookies.remove(refreshKey);
        Cookies.remove(userKey);
      }
    }

    if (error.response?.status === 401) {
      Cookies.remove(tokenKey);
      Cookies.remove(refreshKey);
      Cookies.remove(userKey);
    }

    return Promise.reject(error);
  },
);

export default api;

// Helper: build full URL for an image served from the API (e.g. /users/:id/avatar)
export const getImageUrl = (
  src: string | null | undefined,
): string | undefined => {
  if (!src) return undefined;
  if (src.startsWith("/")) return `${API_URL}${src}`;
  return undefined; // ignore legacy disk paths
};

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

  refreshToken: async (refreshToken: string) => {
    const response = await api.post("/auth/refresh", { refreshToken });
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

  setAdminRole: async (id: string, isAdmin: boolean, isSuperAdmin: boolean) => {
    const response = await api.patch(`/users/${id}/admin-role`, {
      isAdmin,
      isSuperAdmin,
    });
    return response.data;
  },

  uploadAvatar: async (id: string, base64DataUrl: string): Promise<void> => {
    await api.patch(`/users/${id}`, { profileImage: base64DataUrl });
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
    base64DataUrl: string,
    caption?: string,
  ) => {
    const response = await api.post(`/departments/${deptId}/photos`, {
      imageData: base64DataUrl,
      departmentName,
      caption: caption ?? "",
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

// Fitness APIs
export const fitnessApi = {
  // Get all dashboard data (exercises, workout logs, body stats)
  getDashboard: async () => {
    const response = await api.get("/fitness/dashboard");
    return response.data;
  },

  // Exercises
  getExercises: async () => {
    const response = await api.get("/fitness/exercises");
    return response.data;
  },

  createExercise: async (data: {
    name: string;
    category?: string;
    description?: string;
  }) => {
    const response = await api.post("/fitness/exercises", data);
    return response.data;
  },

  deleteExercise: async (id: string) => {
    const response = await api.delete(`/fitness/exercises/${id}`);
    return response.data;
  },

  // Workout Logs
  getWorkoutLogs: async (limit?: number) => {
    const response = await api.get("/fitness/workout-logs", {
      params: { limit },
    });
    return response.data;
  },

  createWorkoutLog: async (data: {
    exerciseId: string;
    sets?: number;
    repetitions?: number;
    weight?: number;
    notes?: string;
  }) => {
    const response = await api.post("/fitness/workout-logs", data);
    return response.data;
  },

  deleteWorkoutLog: async (id: string) => {
    const response = await api.delete(`/fitness/workout-logs/${id}`);
    return response.data;
  },

  // Body Stats
  getBodyStats: async (limit?: number) => {
    const response = await api.get("/fitness/body-stats", {
      params: { limit },
    });
    return response.data;
  },

  createBodyStats: async (data: { weight: number; height: number }) => {
    const response = await api.post("/fitness/body-stats", data);
    return response.data;
  },

  deleteBodyStats: async (id: string) => {
    const response = await api.delete(`/fitness/body-stats/${id}`);
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

  // Grantors
  getGrantors: async () => {
    const response = await api.get("/db-access/grantors");
    return response.data;
  },
};

// Chess (Оюуны спорт) APIs
export const chessApi = {
  getInvitations: async () => {
    const response = await api.get("/chess/invitations");
    return response.data as ChessInvitation[];
  },

  sendInvite: async (toUserId: string, toUserName: string) => {
    const response = await api.post("/chess/invite", { toUserId, toUserName });
    return response.data as { id: string; message: string };
  },

  acceptInvite: async (id: string) => {
    const response = await api.post(`/chess/invite/${id}/accept`);
    return response.data as { gameId: string; message: string };
  },

  declineInvite: async (id: string) => {
    const response = await api.post(`/chess/invite/${id}/decline`);
    return response.data as { message: string };
  },

  getMyGames: async () => {
    const response = await api.get("/chess/games");
    return response.data as ChessGame[];
  },

  getGame: async (id: string) => {
    const response = await api.get(`/chess/game/${id}`);
    return response.data as ChessGame;
  },

  makeMove: async (gameId: string, move: string) => {
    const response = await api.post(`/chess/game/${gameId}/move`, { move });
    return response.data as { success: boolean; moveCount: number };
  },

  finishGame: async (gameId: string, status: string, resultReason: string) => {
    const response = await api.post(`/chess/game/${gameId}/finish`, {
      status,
      resultReason,
    });
    return response.data as { message: string };
  },

  getHistory: async () => {
    const response = await api.get("/chess/history");
    return response.data as {
      games: { id: string; opponent: string; result: string; resultReason: string; createdAt: string }[];
      wins: number; losses: number; draws: number; total: number;
    };
  },

  getRankings: async () => {
    const response = await api.get("/chess/rankings");
    return response.data as { id: string; name: string; wins: number; losses: number; draws: number }[];
  },
};

interface ChessInvitation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: string;
  createdAt: string;
}

interface ChessGame {
  id: string;
  whiteUserId: string;
  whiteUserName: string;
  blackUserId: string;
  blackUserName: string;
  moves: string; // JSON string array
  status: string; // active | white_won | black_won | draw
  resultReason: string;
  createdAt: string;
}
