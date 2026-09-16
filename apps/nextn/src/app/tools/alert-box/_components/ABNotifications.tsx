"use client";

import { Bell, AlertTriangle, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState, useRef, useEffect } from "react";
import { abFetchNotifications } from "../_lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

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
 * Alert Box-ийн мэдэгдэл — толгой хэсгийн баруун талд. Дэд цэс (Alert/Search/…)
 * нь DashboardShell-ийн sidebar руу шилжсэн. Толгойн rightContent нь overflow-той
 * тул popup-ыг body руу portal-оор fixed байрлуулна; `.ab-theme` token-ууд
 * portal дотор ч үйлчлэхээр popup өөрөө тэр класстай.
 */
export default function ABNotifications() {
  const { t } = useLanguage();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifData | null>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
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
    <>
      <button
        ref={notifBtnRef}
        type="button"
        onClick={() => setNotifOpen((v) => !v)}
        aria-expanded={notifOpen}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white transition-colors ${
          notifOpen ? "bg-white/25" : "bg-white/10 hover:bg-white/20"
        }`}
      >
        <Bell size={14} aria-hidden />
        <span className="hidden sm:inline">{t("abSidebarNotifications")}</span>
        {notifCount > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {notifCount > 99 ? "99+" : notifCount}
          </span>
        )}
      </button>

      {notifOpen &&
        createPortal(
          <div
            ref={notifPopupRef}
            className="ab-theme fixed right-4 top-16 z-[60] max-h-[380px] w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <span className="text-xs font-bold text-txt">
                {t("abSidebarNotifications")}
              </span>
              <button
                type="button"
                onClick={() => setNotifOpen(false)}
                className="text-txt-dim hover:text-txt"
              >
                <X size={13} />
              </button>
            </div>
            {(notifications?.criticalCount ?? 0) > 0 && (
              <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                <AlertTriangle size={12} className="text-red-400" />
                <span className="text-[11px] font-medium text-red-300">
                  {notifications?.criticalCount} {t("abSidebarHighRisk")}
                </span>
              </div>
            )}
            <div className="max-h-[280px] overflow-y-auto py-1">
              {!notifications || notifCount === 0 ? (
                <div className="py-8 text-center">
                  <Bell
                    size={18}
                    className="mx-auto mb-2 text-txt-dim opacity-40"
                  />
                  <p className="text-xs text-txt-dim">
                    {t("abSidebarNoNotifications")}
                  </p>
                </div>
              ) : (
                notifications.items?.map((n: NotifItem) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 border-b border-surface-border/50 px-4 py-2.5 last:border-0"
                  >
                    <div
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.severity === "critical" ? "bg-red-500" : "bg-orange-500"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-txt">
                        {n.title}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
