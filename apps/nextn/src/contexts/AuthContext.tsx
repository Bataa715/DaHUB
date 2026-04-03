"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authApi } from "@/lib/api";
import Cookies from "js-cookie";

interface User {
  id: string;
  email?: string;
  userId?: string;
  name: string;
  position?: string;
  profileImage?: string;
  department?: string;
  departmentId?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  allowedTools: string[];
  grantableTools?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    department: string,
    username: string,
    password: string,
  ) => Promise<void>;
  loginById: (userId: string, password: string) => Promise<void>;
  adminLogin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Returns true when running inside an /admin route */
const isAdminPath = () =>
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/admin");

/** Read cached user from cookie synchronously - avoids header flicker on refresh */
const getCachedUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const adminPath = window.location.pathname.startsWith("/admin");
    const raw = adminPath ? Cookies.get("adminUser") : Cookies.get("user");
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const adminPath = isAdminPath();
    const token = adminPath ? Cookies.get("adminToken") : Cookies.get("token");
    const refreshKey = adminPath ? "adminRefreshToken" : "refreshToken";
    const tokenKey = adminPath ? "adminToken" : "token";
    const userKey = adminPath ? "adminUser" : "user";
    const storedRefreshToken = Cookies.get(refreshKey);

    if (!token && !storedRefreshToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Always re-issue the access token on load so the JWT cookie has the
    // latest allowedTools (in case an admin granted/revoked tools).
    const doRefresh = async () => {
      if (storedRefreshToken) {
        try {
          const {
            user: freshUser,
            accessToken,
            refreshToken: newRefreshToken,
          } = await authApi.refreshToken(storedRefreshToken);
          const secure =
            typeof window !== "undefined" &&
            window.location.protocol === "https:";
          Cookies.set(tokenKey, accessToken, {
            expires: 1 / 24,
            sameSite: "strict",
            secure,
          });
          Cookies.set(refreshKey, newRefreshToken, {
            expires: 7,
            sameSite: "strict",
            secure,
          });
          Cookies.set(userKey, JSON.stringify(freshUser), {
            expires: 7,
            sameSite: "strict",
            secure,
          });
          setUser(freshUser);
          setLoading(false);
          return;
        } catch {
          // Fall through to getProfile if refresh fails
        }
      }

      authApi
        .getProfile()
        .then((profile) => {
          setUser(profile);
        })
        .catch((error) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("Profile fetch failed:", error);
          }
          if (adminPath) {
            Cookies.remove("adminToken");
            Cookies.remove("adminRefreshToken");
            Cookies.remove("adminUser");
          } else {
            Cookies.remove("token");
            Cookies.remove("refreshToken");
            Cookies.remove("user");
          }
          setUser(null);
          const loginPath = adminPath ? "/admin/login" : "/login";
          if (
            typeof window !== "undefined" &&
            !window.location.pathname.startsWith(loginPath)
          ) {
            window.location.replace(loginPath);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    };

    doRefresh();
  }, []);

  const saveUserSession = (
    userData: User,
    accessToken: string,
    refreshToken: string,
  ) => {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:";
    Cookies.set("token", accessToken, {
      expires: 1 / 24,
      sameSite: "strict",
      secure,
    });
    Cookies.set("refreshToken", refreshToken, {
      expires: 7,
      sameSite: "strict",
      secure,
    });
    Cookies.set("user", JSON.stringify(userData), {
      expires: 7,
      sameSite: "strict",
      secure,
    });
    setUser(userData);
  };

  const saveAdminSession = (
    userData: User,
    accessToken: string,
    refreshToken: string,
  ) => {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:";
    Cookies.set("adminToken", accessToken, {
      expires: 1 / 24,
      sameSite: "strict",
      secure,
    });
    Cookies.set("adminRefreshToken", refreshToken, {
      expires: 30,
      sameSite: "strict",
      secure,
    });
    Cookies.set("adminUser", JSON.stringify(userData), {
      expires: 30,
      sameSite: "strict",
      secure,
    });
    setUser(userData);
  };

  const login = async (
    department: string,
    username: string,
    password: string,
  ) => {
    try {
      const { user, accessToken, refreshToken } = await authApi.login(
        department,
        username,
        password,
      );
      saveUserSession(user, accessToken, refreshToken);
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Нэвтрэх үед алдаа гарлаа",
      );
    }
  };

  const loginById = async (userId: string, password: string) => {
    try {
      const { user, accessToken, refreshToken } = await authApi.loginById(
        userId,
        password,
      );
      saveUserSession(user, accessToken, refreshToken);
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Нэвтрэх үед алдаа гарлаа",
      );
    }
  };

  const adminLogin = async (userId: string, password: string) => {
    try {
      const { user, accessToken, refreshToken } = await authApi.adminLogin(
        userId,
        password,
      );
      if (!user.isAdmin) throw new Error("Та админ эрхгүй байна");
      saveAdminSession(user, accessToken, refreshToken);
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Нэвтрэх үед алдаа гарлаа",
      );
    }
  };

  const logout = () => {
    if (user?.isAdmin) {
      Cookies.remove("adminToken");
      Cookies.remove("adminRefreshToken");
      Cookies.remove("adminUser");
    } else {
      Cookies.remove("token");
      Cookies.remove("refreshToken");
      Cookies.remove("user");
    }
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const adminPath = isAdminPath();
      const refreshKey = adminPath ? "adminRefreshToken" : "refreshToken";
      const tokenKey = adminPath ? "adminToken" : "token";
      const userKey = adminPath ? "adminUser" : "user";
      const storedRefreshToken = Cookies.get(refreshKey);

      if (storedRefreshToken) {
        // Re-issue access token so the JWT cookie contains the latest allowedTools.
        // The middleware reads allowedTools from the JWT cookie directly, so without
        // this step newly-granted tool permissions would not take effect until re-login.
        try {
          const {
            user: freshUser,
            accessToken,
            refreshToken: newRefreshToken,
          } = await authApi.refreshToken(storedRefreshToken);
          const secure =
            typeof window !== "undefined" &&
            window.location.protocol === "https:";
          Cookies.set(tokenKey, accessToken, {
            expires: 1 / 24,
            sameSite: "strict",
            secure,
          });
          Cookies.set(refreshKey, newRefreshToken, {
            expires: 7,
            sameSite: "strict",
            secure,
          });
          Cookies.set(userKey, JSON.stringify(freshUser), {
            expires: 7,
            sameSite: "strict",
            secure,
          });
          setUser(freshUser);
          return;
        } catch {
          // If token refresh fails, fall back to getProfile only
        }
      }

      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to refresh user profile:", error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginById,
        adminLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
