"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Home,
  Newspaper,
  Shield,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  LogOut,
  Palette,
  Check,
  Users,
  User as UserIcon,
  Globe,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { themes } from "@/lib/themes";
import { usersApi } from "@/lib/api";
import { getTools } from "@/lib/tools-config";
import { useChromeFullscreen } from "@/lib/chrome-fullscreen";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

const SIDEBAR_WIDTH_KEY = "dahub-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "dahub-sidebar-collapsed";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 72;

/**
 * Shared nav item list for the persistent desktop sidebar rail.
 */
export function SidebarNavItems({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const allTools = getTools(t);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      if (user.isAdmin) {
        if (!cancelled) {
          setAllowedTools(allTools.map((tool) => tool.id));
          setIsLoading(false);
        }
        return;
      }
      try {
        const fresh = await usersApi.getOne(user.id);
        if (!cancelled) setAllowedTools(fresh.allowedTools || []);
      } catch {
        if (!cancelled) setAllowedTools(user.allowedTools || []);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const available = allTools.filter((tool) => {
    const ids = tool.matchIds ?? [tool.id];
    return ids.some((id) => allowedTools.includes(id));
  });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const baseLinkClass = cn(
    "flex items-start gap-2.5 rounded-xl text-sm font-semibold transition-colors",
    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
  );
  const activeClass = "bg-muted text-foreground font-bold";
  const inactiveClass =
    "text-foreground hover:bg-muted/50";

  return (
    <nav className="flex flex-col gap-1">
      <Link
        href="/"
        onClick={onNavigate}
        title={t("navHome")}
        className={cn(
          baseLinkClass,
          isActive("/") ? activeClass : inactiveClass,
        )}
      >
        <Home className="w-4 h-4 shrink-0 mt-0.5" />
        {!collapsed && <span className="leading-snug">{t("navHome")}</span>}
      </Link>
      <Link
        href="/knowledge"
        onClick={onNavigate}
        title={t("navNews")}
        className={cn(
          baseLinkClass,
          isActive("/knowledge") ? activeClass : inactiveClass,
        )}
      >
        <Newspaper className="w-4 h-4 shrink-0 mt-0.5" />
        {!collapsed && <span className="leading-snug">{t("navNews")}</span>}
      </Link>

      {!!user && (
        <>
          {!collapsed && (
            <div className="mt-3 mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
              {t("navTools")}
            </div>
          )}
          {collapsed && <div className="my-2 mx-2 h-px bg-border/60" />}

          {authLoading || isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
            </div>
          ) : available.length === 0 ? (
            !collapsed && (
              <p className="px-3 py-2 text-xs text-muted-foreground/50">
                {t("toolsNoneFound")}
              </p>
            )
          ) : (
            available.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  onClick={onNavigate}
                  title={tool.title}
                  className={cn(
                    baseLinkClass,
                    isActive(tool.href) ? activeClass : inactiveClass,
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  {!collapsed && (
                    <span className="leading-snug break-words whitespace-normal">
                      {tool.title}
                    </span>
                  )}
                </Link>
              );
            })
          )}

          {user.isAdmin && (
            <>
              <div className="mt-3 mb-1 h-px bg-border/60" />
              <Link
                href="/admin"
                onClick={onNavigate}
                title={t("navAdmin")}
                className={cn(baseLinkClass, inactiveClass)}
              >
                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                {!collapsed && (
                  <span className="leading-snug">{t("navAdmin")}</span>
                )}
              </Link>
            </>
          )}
        </>
      )}
    </nav>
  );
}

function SettingsMenu({
  side = "top",
  align = "start",
}: {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isAdminPage = pathname.startsWith("/admin");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    const loginPath = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    await logout();
    window.location.href = loginPath;
  };

  if (!mounted || !user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Тохиргоо нээх"
          aria-haspopup="menu"
          title={t("navProfileSettings")}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="min-w-[200px]">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>{t("navTheme")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="p-2 min-w-[180px]">
            <div className="grid gap-1">
              {themes.map((themeOption) => (
                <DropdownMenuItem
                  key={themeOption.name}
                  onClick={() => setTheme(themeOption.name)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                    theme === themeOption.name
                      ? "bg-primary/15 border border-primary/30"
                      : "hover:bg-accent/60",
                  )}
                >
                  <div
                    className="w-4 h-4 rounded-full ring-1 ring-border shadow-sm"
                    style={{
                      backgroundColor: `hsl(${themeOption.tokens.background})`,
                    }}
                  />
                  <span className="flex-1 font-medium">
                    {themeOption.labelMn}
                  </span>
                  {theme === themeOption.name && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>{t("navProfileSettings")}</span>
        </DropdownMenuItem>
        {!isAdminPage && (
          <DropdownMenuItem onClick={() => router.push("/employee")}>
            <Users className="mr-2 h-4 w-4" />
            <span>{t("navEmployees")}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger aria-label="Хэл солих">
            <Globe className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{language === "mn" ? "🇲🇳 Монгол" : "🇺🇸 English"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => setLanguage("mn")}
              aria-current={language === "mn" ? "true" : undefined}
              className={language === "mn" ? "bg-primary/15" : ""}
            >
              🇲🇳 Монгол{" "}
              {language === "mn" && (
                <Check className="ml-auto h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage("en")}
              aria-current={language === "en" ? "true" : undefined}
              className={language === "en" ? "bg-primary/15" : ""}
            >
              🇺🇸 English{" "}
              {language === "en" && (
                <Check className="ml-auto h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  const n = raw ? Number(raw) : DEFAULT_WIDTH;
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

export default function Sidebar() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  const { toggle: toggleFullscreen } = useChromeFullscreen();

  useEffect(() => {
    setWidth(readStoredWidth());
    setCollapsed(readStoredCollapsed());
    setMounted(true);
  }, []);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const onResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = widthRef.current;

      const onMove = (ev: MouseEvent) => {
        const next = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)),
        );
        setWidth(next);
      };

      const onUp = () => {
        setIsResizing(false);
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(widthRef.current));
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [collapsed],
  );

  const railWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <aside
      className="flex flex-col shrink-0 mr-1.5 lg:mr-2 relative"
      style={{
        width: mounted ? railWidth : DEFAULT_WIDTH,
        transition: isResizing ? "none" : "width 180ms ease",
      }}
    >
      <div className="flex flex-col h-full rounded-2xl border border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl shadow-premium ring-hairline overflow-hidden">
        <div
          className={cn(
            "flex items-center border-b border-border/50 shrink-0",
            collapsed
              ? "justify-center px-2 py-3"
              : "justify-between px-3 py-3",
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 min-w-0",
              collapsed && "justify-center",
            )}
            title="DaHUB"
          >
            <Image
              src="/golomt.jpg"
              alt="Golomt"
              width={28}
              height={28}
              className="rounded-lg ring-1 ring-border/70 shadow-sm shrink-0"
            />
            {!collapsed && (
              <span className="font-bold text-lg tracking-tight text-foreground truncate">
                DaHUB
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
              title="Хураах"
              aria-label="Хураах"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-border/40">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Дэлгэх"
              aria-label="Дэлгэх"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-2 py-3">
          <SidebarNavItems collapsed={collapsed} />
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-border/50 gap-1",
            collapsed
              ? "flex flex-col items-center p-2"
              : "flex items-center justify-between p-2",
          )}
        >
          <SettingsMenu
            side="top"
            align={collapsed ? "center" : "start"}
          />
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Бүтэн дэлгэцээр харах"
            aria-label="Бүтэн дэлгэцээр харах"
            className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Sidebar өргөн өөрчлөх"
          onMouseDown={onResizeStart}
          className={cn(
            "absolute top-0 -right-1 w-2 h-full cursor-col-resize z-20 group flex justify-center",
            isResizing && "bg-foreground/5",
          )}
        >
          <div
            className={cn(
              "w-0.5 h-full rounded-full transition-colors",
              isResizing
                ? "bg-foreground/40"
                : "bg-transparent group-hover:bg-foreground/25",
            )}
          />
        </div>
      )}
    </aside>
  );
}
