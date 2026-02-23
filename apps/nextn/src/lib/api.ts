import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
      `/auth/users/search?q=${encodeURIComponent(query)}`,
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
    const response = await api.get('/users/admins');
    return response.data;
  },

  setAdminRole: async (id: string, isAdmin: boolean, isSuperAdmin: boolean) => {
    const response = await api.patch(`/users/${id}/admin-role`, { isAdmin, isSuperAdmin });
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
