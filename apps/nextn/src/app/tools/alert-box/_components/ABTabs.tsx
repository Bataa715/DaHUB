"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Flag, LayoutDashboard, Search } from "lucide-react";
import { TOOL_CONTAINER } from "@/components/shared/tool-ui";
import { cn } from "@/lib/utils";

const BASE = "/tools/alert-box";

const TABS = [
  { href: `${BASE}/alerts`, icon: AlertTriangle, label: "Alert" },
  { href: `${BASE}/search`, icon: Search, label: "Search" },
  { href: `${BASE}/redflag`, icon: Flag, label: "Red Flag" },
  { href: `${BASE}/dashboards`, icon: LayoutDashboard, label: "Dashboards" },
];

/**
 * Alert Box-ийн дотоод цэс — самбарын өөрийн хуудсууд. Дашбоардын зүүн цэс нь
 * зөвхөн самбаруудыг харуулдаг тул эдгээр нь самбар дотроо товч хэлбэрээр байна.
 */
export default function ABTabs() {
  const pathname = usePathname();

  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div
        className={cn(
          TOOL_CONTAINER,
          "flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none",
        )}
      >
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
