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
import { z } from "zod";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Token expiry constants — 3 hours (js-cookie expires нь өдрөөр: 3/24) */
const REFRESH_TOKEN_EXPIRY_DAYS = 3 / 24;

/** Zod schema — guards against tampered/malformed cookie data */
const UserSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  userId: z.string().optional(),
  name: z.string(),
  position: z.string().optional(),
  profileImage: z.string().optional(),
  department: z.string().optional(),
  departmentId: z.string().optional(),
  isAdmin: z.boolean(),
  isSuperAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  allowedTools: z.array(z.string()),
  grantableTools: z.array(z.string()).optional(),
});

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
  logout: () => Promise<void>;
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
    const parsed = UserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const adminPath = isAdminPath();

    // Always re-issue the access token on load so the JWT cookie has the
    // latest allowedTools (in case an admin granted/revoked tools).
    // If userCookie is missing but the HttpOnly refreshToken is still valid,
    // doRefresh will restore the session instead of flashing "please log in".
    const doRefresh = async () => {
      const userKey = adminPath ? "adminUser" : "user";
      const loginPath = adminPath ? "/admin/login" : "/login";
      // Already on login page — no tokens to refresh, skip to avoid loading spinner
      if (
        typeof window !== "undefined" &&
        window.location.pathname === loginPath
      ) {
        if (isMounted) setLoading(false);
        return;
      }
      // [N-2] No refreshToken arg — browser sends HttpOnly cookie automatically
      try {
        const { user: freshUser } = await authApi.refreshToken();
        if (!isMounted) return;
        const secure =
          typeof window !== "undefined" &&
          window.location.protocol === "https:";
        Cookies.set(userKey, JSON.stringify(freshUser), {
          expires: REFRESH_TOKEN_EXPIRY_DAYS,
          sameSite: "strict",
          secure,
        });
        setUser(freshUser);
        setLoading(false);
        return;
      } catch {
        // Fall through to getProfile if refresh fails
      }

      try {
        const profile = await authApi.getProfile();
        if (isMounted) setUser(profile);
      } catch (error) {
        if (!isMounted) return;
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
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith(loginPath)
        ) {
          window.location.replace(loginPath);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    doRefresh();
    return () => {
      isMounted = false;
    };
  }, []);

  // [N-2] saveUserSession only saves the user display cookie; token cookies set by backend
  const saveUserSession = (userData: User) => {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:";
    Cookies.set("user", JSON.stringify(userData), {
      expires: REFRESH_TOKEN_EXPIRY_DAYS,
      sameSite: "strict",
      secure,
    });
    setUser(userData);
  };

  // [N-2] saveAdminSession only saves adminUser display cookie
  const saveAdminSession = (userData: User) => {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:";
    Cookies.set("adminUser", JSON.stringify(userData), {
      expires: REFRESH_TOKEN_EXPIRY_DAYS,
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
      const { user } = await authApi.login(department, username, password);
      saveUserSession(user);
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | undefined)
        : undefined;
      throw new Error(msg ?? "Нэвтрэх үед алдаа гарлаа");
    }
  };

  const loginById = async (userId: string, password: string) => {
    try {
      const { user } = await authApi.loginById(userId, password);
      saveUserSession(user);
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | undefined)
        : undefined;
      throw new Error(msg ?? "Нэвтрэх үед алдаа гарлаа");
    }
  };

  const adminLogin = async (userId: string, password: string) => {
    try {
      const { user } = await authApi.adminLogin(userId, password);
      if (!user.isAdmin) throw new Error("Та админ эрхгүй байна");
      saveAdminSession(user);
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | undefined)
        : error instanceof Error
          ? error.message
          : undefined;
      throw new Error(msg ?? "Нэвтрэх үед алдаа гарлаа");
    }
  };

  const logout = async () => {
    // Call backend to clear HttpOnly token cookies. best-effort — local cleanup proceeds regardless.
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch {
      // ignore
    }
    Cookies.remove("user");
    Cookies.remove("adminUser");
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const adminPath = isAdminPath();
      const userKey = adminPath ? "adminUser" : "user";
      // [N-2] No refreshToken arg — browser sends HttpOnly cookie automatically.
      // Re-issue so the JWT cookie contains the latest allowedTools.
      try {
        const { user: freshUser } = await authApi.refreshToken();
        const secure =
          typeof window !== "undefined" &&
          window.location.protocol === "https:";
        Cookies.set(userKey, JSON.stringify(freshUser), {
          expires: REFRESH_TOKEN_EXPIRY_DAYS,
          sameSite: "strict",
          secure,
        });
        setUser(freshUser);
        return;
      } catch {
        // If token refresh fails, fall back to getProfile only
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
