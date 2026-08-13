"use client";

import { Bell, AlertTriangle, X, Search, Flag, LayoutDashboard } from "lucide-react";
import { abFetchNotifications } from "../_lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const BASE = "/tools/alert-box";

const navItems = [
  { href: `${BASE}/alerts`, icon: AlertTriangle, label: "Alert" },
  { href: `${BASE}/search`, icon: Search, label: "Search" },
  { href: `${BASE}/redflag`, icon: Flag, label: "Red Flag" },
  { href: `${BASE}/dashboards`, icon: LayoutDashboard, label: "Dashboards" },
];

interface NotifItem {
  id: string | number;
  title: string;
  severity: string;
}
interface NotifData {
  total: number;
  criticalCount?: number;
  items?: NotifItem[];
}

/**
 * Alert Box-ийн дотоод дэд-навигаци — урьд нь бүтэн өндөртэй, өөрийн
 * лого/branding-тай босоо sidebar байсан бөгөөд энэ нь webiin үндсэн
 * Sidebar-тай давхцаж, дэлгэцийн өргөнийг илүүц эзэлж байсан. Одоо header-ийн
 * доор нэг мөр хэвтээ tab-strip хэлбэрээр харагдана — үндсэн sidebar ганцхан
 * үлдэнэ, branding давхардахгүй.
 */
export default function ABSidebar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifData | null>(null);
  const notifBtnRef = useRef<HTMLDivElement>(null);
  const notifPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        notifBtnRef.current &&
        !notifBtnRef.current.contains(target) &&
        notifPopupRef.current &&
        !notifPopupRef.current.contains(target)
      )
        setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const load = () =>
      abFetchNotifications(20)
        .then(setNotifications)
        .catch(() => {
          /* intentional: notification poll; failure just shows no badge */
        });
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const notifCount = notifications?.total || 0;

  return (
    <nav className="relative shrink-0 w-full min-w-0 bg-surface-card border-b border-surface-border flex items-center gap-1 px-3 py-2 z-40">
      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                active
                  ? "bg-golomt-500/10 text-golomt-400"
                  : "text-txt-muted hover:text-txt hover:bg-surface-hover"
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Notifications */}
      <div ref={notifBtnRef} className="relative shrink-0">
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all ${
            notifOpen
              ? "bg-golomt-500/10 text-golomt-400"
              : "text-txt-muted hover:text-txt hover:bg-surface-hover"
          }`}
        >
          <Bell size={14} />
          <span className="hidden sm:inline">
            {t("abSidebarNotifications")}
          </span>
          {notifCount > 0 && (
            <span className="bg-red-500 text-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {notifCount > 99 ? "99+" : notifCount}
            </span>
          )}
        </button>

        {/* Notification popup */}
        {notifOpen && (
          <div
            ref={notifPopupRef}
            className={cn(
              "absolute right-0 top-full mt-2 w-[320px] max-h-[380px] bg-surface-card border border-surface-border rounded-xl shadow-2xl overflow-hidden z-[60]",
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
              <span className="text-xs font-bold text-txt">
                {t("abSidebarNotifications")}
              </span>
              <button
                onClick={() => setNotifOpen(false)}
                className="text-txt-dim hover:text-txt"
              >
                <X size={13} />
              </button>
            </div>
            {(notifications?.criticalCount ?? 0) > 0 && (
              <div className="mx-3 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertTriangle size={12} className="text-red-400" />
                <span className="text-[11px] text-red-300 font-medium">
                  {notifications?.criticalCount} {t("abSidebarHighRisk")}
                </span>
              </div>
            )}
            <div className="overflow-y-auto max-h-[280px] py-1">
              {!notifications || notifCount === 0 ? (
                <div className="text-center py-8">
                  <Bell
                    size={18}
                    className="text-txt-dim mx-auto mb-2 opacity-40"
                  />
                  <p className="text-xs text-txt-dim">
                    {t("abSidebarNoNotifications")}
                  </p>
                </div>
              ) : (
                notifications.items?.map((n: NotifItem) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-2.5 border-b border-surface-border/50 last:border-0"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${n.severity === "critical" ? "bg-red-500" : "bg-orange-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-txt truncate">
                        {n.title}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
