"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import {
  BellDot,
  Database,
  Home,
  Network,
  Newspaper,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import { GolomtMark } from "@/components/GolomtMark";
import { cn } from "@/lib/utils";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Icon-ы дэвсгэр градиент — самбарын таних өнгө */
  gradient: string;
  /** Аль нэг нь байхад нээгдэнэ (allowedTools id — backend @RequireTools-той ижил) */
  accessIds: string[];
  /** Энэ самбарын бүх дэд хуудсыг хамарсан зам */
  match: string;
};

/** Sidebar-тай дашбоардын shell-ээр харагдах маршрутууд (MainLayout-ын scroll-д хэрэгтэй). */
const DASHBOARD_ROUTE_PREFIXES = [
  "/tools/alert-box",
  "/tools/zainii-audit/expense",
  "/tools/network-analysis",
  "/tools/negative-news/dashboard",
  "/tools/db-changes/dashboard",
];

export const isDashboardRoute = (pathname: string) =>
  DASHBOARD_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

/**
 * Дашбоардын цэс — зөвхөн самбарууд өөрсдөө. Самбарын дотоод хуудсууд
 * (ж: Alert Box-ийн Alert/Search/Red Flag) нь тухайн самбарын толгойд байна.
 * Эхний мөр нь /dashboard дарахад анхныг нь нээнэ — удирдлагын хамгийн их
 * ашигладаг самбарыг эхэнд тавина. Шинэ дашбоард нэмбэл энд нэг мөр нэмнэ.
 * Эрхийн id-ууд нь tool модулийн `_access.ts`-тэй ижил утга
 * (өөр модулийн `_` файлаас import хийхгүй).
 */
export function getDashboardNav(
  t: (key: TranslationKey) => string,
): DashboardNavItem[] {
  return [
    {
      href: "/tools/zainii-audit/expense",
      label: t("zaBoxExpenseTitle"),
      icon: Wallet,
      gradient: "from-sky-500 to-blue-600",
      accessIds: ["zainii_audit_expense"],
      match: "/tools/zainii-audit/expense",
    },
    {
      href: "/tools/alert-box/alerts",
      label: t("toolAlertBoxTitle"),
      icon: BellDot,
      gradient: "from-red-500 to-rose-500",
      accessIds: ["alert_box"],
      match: "/tools/alert-box",
    },
    {
      href: "/tools/network-analysis/config-changes",
      label: t("netConfigTitle"),
      icon: Network,
      gradient: "from-orange-500 to-amber-600",
      accessIds: ["net_config_changes"],
      match: "/tools/network-analysis/config-changes",
    },
    {
      href: "/tools/network-analysis/xdr",
      label: t("netXdrTitle"),
      icon: ShieldAlert,
      gradient: "from-sky-500 to-indigo-600",
      accessIds: ["net_xdr"],
      match: "/tools/network-analysis/xdr",
    },
    {
      href: "/tools/negative-news/dashboard",
      label: t("nnDashboardTitle"),
      icon: Newspaper,
      gradient: "from-rose-500 to-pink-600",
      accessIds: ["negative_news_dashboard"],
      match: "/tools/negative-news/dashboard",
    },
    {
      href: "/tools/db-changes/dashboard",
      label: t("dbcDashboardTitle"),
      icon: Database,
      gradient: "from-violet-500 to-purple-600",
      accessIds: ["db_changes_dashboard"],
      match: "/tools/db-changes/dashboard",
    },
  ];
}

function NavIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon className={className} aria-hidden />;
}

function useNavState() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { loading, canAccess } = useAllowedTools();
  const isActive = (item: DashboardNavItem) =>
    pathname === item.match || pathname.startsWith(`${item.match}/`);
  // Эрхгүй самбарыг огт харуулахгүй. Эрх ачаалж дуустал хоосон — харуулаад
  // дараа нь алга болох анивчилт гарахгүй. Жинхэнэ хамгаалалт нь proxy + backend.
  const items = loading
    ? []
    : getDashboardNav(t).filter((item) => canAccess(item.accessIds));
  return { isActive, items };
}

function SidebarNav() {
  const { isActive, items } = useNavState();

  return (
    <nav>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-white text-[#07070c]"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white",
                    item.gradient,
                  )}
                >
                  <NavIcon icon={item.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Жижиг дэлгэц — sidebar-ийн оронд толгой хэсгийн дээр хэвтээ самбар сонгогч. */
function MobileNav() {
  const { isActive, items } = useNavState();

  return (
    <nav className="dark-surface flex shrink-0 items-center gap-1.5 overflow-x-auto bg-[#07070c] px-4 py-2 text-white scrollbar-none lg:hidden">
      <Link
        href="/"
        aria-label="DaHUB"
        className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"
      >
        <GolomtMark className="h-5 w-5" />
      </Link>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item) ? "page" : undefined}
          className={cn(
            "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold",
            isActive(item)
              ? "bg-white text-[#07070c]"
              : "bg-white/10 text-white/80",
          )}
        >
          <NavIcon icon={item.icon} className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Дашбоардын бүтэц — зүүн талд самбаруудын цэс (нэр нь үргэлж харагдана),
 * баруун талд сонгосон самбар. Нүүр → Дашбоард нэг даралтаар шууд самбар нээгдэнэ.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);

  // Контент нь өөрөө scroll хийдэг тул самбар солигдоход дээш нь буцаана.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-0 w-full flex-1">
      <aside className="dark-surface hidden h-full w-64 shrink-0 flex-col border-r border-white/5 bg-[#07070c] text-white lg:flex">
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-5">
          <GolomtMark className="h-6 w-6 shrink-0" />
          <h2 className="truncate text-xl font-black tracking-tight">
            {t("homeSectionDashboard")}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 scrollbar-none">
          <SidebarNav />
        </div>
        <div className="shrink-0 border-t border-white/10 p-3">
          <Link
            href="/"
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Home className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {t("knowledgeGoHome")}
          </Link>
        </div>
      </aside>

      <div
        ref={contentRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-none"
      >
        <MobileNav />
        {children}
      </div>
    </div>
  );
}
