"use client";

import { useRouter } from "next/navigation";
import {
  Lock,
  LogOut,
  Settings,
  Shield,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Профайл цэс — хуудас руу шилжих холбоос ба гарах.
 * Загвар (dark/light) болон хэл нь нүүр хуудасны тусдаа товчнуудад шилжсэн.
 */
export function AccountMenu({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    // Бүтэн дахин ачаална — клиент талын кэш/төлөв үлдэхгүй (login page-тэй ижил).
    window.location.replace(admin ? "/admin/login" : "/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("sidebarOpenSettings")}
          title={t("sidebarOpenSettings")}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
            {initials(user.name || user.userId || "?")}
          </span>
          <span className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            {user.position && (
              <p className="truncate text-xs text-muted-foreground">
                {user.position}
              </p>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {admin ? (
          <DropdownMenuItem
            onClick={() => router.push("/admin/change-password")}
          >
            <Lock className="mr-2 h-4 w-4" />
            {t("passwordChangeBtn")}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <UserIcon className="mr-2 h-4 w-4" />
              {t("navProfileSettings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/employee")}>
              <Users className="mr-2 h-4 w-4" />
              {t("navEmployees")}
            </DropdownMenuItem>
            {user.isAdmin && (
              <DropdownMenuItem onClick={() => router.push("/admin")}>
                <Shield className="mr-2 h-4 w-4" />
                {t("navAdmin")}
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
