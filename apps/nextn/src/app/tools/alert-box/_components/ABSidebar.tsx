"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  X,
  Search,
  Flag,
  BellDot,
  ChevronLeft,
} from "lucide-react";
import { abFetchNotifications } from "../_lib/api";

const BASE = "/tools/alert-box";

const navItems = [
  { href: `${BASE}/alerts`, icon: AlertTriangle, label: "Alert" },
  { href: `${BASE}/search`, icon: Search, label: "Search" },
  { href: `${BASE}/redflag`, icon: Flag, label: "Red Flag" },
];

export default function ABSidebar() {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any>(null);
  const notifBtnRef = useRef<HTMLDivElement>(null);
  const notifPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        notifBtnRef.current &&
        !notifBtnRef.current.contains(t) &&
        notifPopupRef.current &&
        !notifPopupRef.current.contains(t)
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
        .catch(() => {});
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const notifCount = notifications?.total || 0;

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-surface-card border-r border-surface-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
            <BellDot size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-txt">Alert Box</p>
            <p className="text-[9px] text-txt-dim uppercase tracking-wide">
              Голомт Банк
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
        <p className="text-[9px] font-semibold text-txt-dim uppercase tracking-wider px-2 pt-1 pb-1.5">
          Хэрэгслүүд
        </p>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
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

        {/* Notifications */}
        <div ref={notifBtnRef} className="relative pt-1">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all w-full ${
              notifOpen
                ? "bg-golomt-500/10 text-golomt-400"
                : "text-txt-muted hover:text-txt hover:bg-surface-hover"
            }`}
          >
            <Bell size={14} />
            <span>Мэдэгдэл</span>
            {notifCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Notification popup */}
      {notifOpen && (
        <div
          ref={notifPopupRef}
          className="fixed left-[230px] bottom-16 w-[320px] max-h-[380px] bg-surface-card border border-surface-border rounded-xl shadow-2xl overflow-hidden z-[60]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <span className="text-xs font-bold text-txt">Мэдэгдэл</span>
            <button
              onClick={() => setNotifOpen(false)}
              className="text-txt-dim hover:text-txt"
            >
              <X size={13} />
            </button>
          </div>
          {notifications?.criticalCount > 0 && (
            <div className="mx-3 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-[11px] text-red-300 font-medium">
                {notifications.criticalCount} өндөр эрсдэл
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
                <p className="text-xs text-txt-dim">Мэдэгдэл байхгүй</p>
              </div>
            ) : (
              notifications.items?.map((n: any) => (
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

      {/* Back to Tools */}
      <div className="border-t border-surface-border p-3">
        <Link
          href="/tools"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-txt-muted hover:text-txt hover:bg-surface-hover transition-all"
        >
          <ChevronLeft size={13} />
          <span>Tools руу буцах</span>
        </Link>
      </div>
    </aside>
  );
}
