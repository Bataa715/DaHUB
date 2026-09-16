"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  FileClock,
  Lock,
  ScrollText,
  Shield,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";
import { registrationRequestsApi } from "@/lib/api";
import { GolomtMark } from "@/components/GolomtMark";
import { AccountMenu } from "@/components/shared/AccountMenu";
import { HUB_BG, HUB_CONTAINER, HubCard } from "@/components/shared/HubPage";
import { cn } from "@/lib/utils";

const ADMIN_LINKS: {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  superOnly: boolean;
}[] = [
  {
    href: "/admin/tools",
    labelKey: "navTools",
    icon: Wrench,
    gradient: "from-emerald-500 to-teal-600",
    superOnly: false,
  },
  {
    href: "/admin/users",
    labelKey: "admLayoutNavUsers",
    icon: Users,
    gradient: "from-blue-500 to-indigo-600",
    superOnly: true,
  },
  {
    href: "/admin/registrations",
    labelKey: "admLayoutNavRegistrations",
    icon: UserPlus,
    gradient: "from-amber-500 to-orange-600",
    superOnly: true,
  },
  {
    href: "/admin/homepage-ethics",
    labelKey: "admLayoutNavEthics",
    icon: ScrollText,
    gradient: "from-violet-500 to-purple-600",
    superOnly: true,
  },
  {
    href: "/admin/departments",
    labelKey: "admDeptPageTitle",
    icon: Building2,
    gradient: "from-cyan-500 to-blue-600",
    superOnly: true,
  },
  {
    href: "/admin/medleg",
    labelKey: "admMedlegPageTitle",
    icon: BookOpen,
    gradient: "from-sky-500 to-indigo-600",
    superOnly: true,
  },
  {
    href: "/admin/log",
    labelKey: "admLayoutNavLog",
    icon: FileClock,
    gradient: "from-slate-500 to-slate-700",
    superOnly: true,
  },
  {
    href: "/admin/admins",
    labelKey: "admAdminsPageTitle",
    icon: Shield,
    gradient: "from-rose-500 to-red-600",
    superOnly: true,
  },
  {
    href: "/admin/change-password",
    labelKey: "passwordChangeBtn",
    icon: Lock,
    gradient: "from-zinc-500 to-zinc-700",
    superOnly: false,
  },
];

/** Админ вэбийн нүүр — үндсэн вэбийн хаб хуудастай ижил карттай навигаци (sidebar-ийн оронд). */
export default function AdminHubPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Registrations нь super-only — энгийн admin-д pending тооны хүсэлт хийхгүй.
    if (!user?.isSuperAdmin) return;
    let cancelled = false;
    registrationRequestsApi
      .list("pending")
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) setPendingCount(data.length);
      })
      .catch(() => {
        /* ignore — badge is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.isSuperAdmin]);

  const links = ADMIN_LINKS.filter(
    (link) => !link.superOnly || user?.isSuperAdmin,
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <section className={cn("relative overflow-hidden text-white", HUB_BG)}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-56 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-blue-600 to-slate-700 opacity-30 blur-3xl"
        />
        <div className={cn("relative", HUB_CONTAINER)}>
          <header className="flex items-center gap-4 py-5">
            <span className="flex items-center gap-2.5">
              <GolomtMark className="h-7 w-7" />
              <span className="text-xl font-black tracking-tight">DaHUB</span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white/80">
                Admin
              </span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <AccountMenu admin />
            </div>
          </header>
          <div className="pb-8 pt-1">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {t("navAdmin")}
            </h1>
          </div>
        </div>
      </section>

      <div className={cn(HUB_CONTAINER, "pt-8")}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {links.map((link, i) => (
            <HubCard
              key={link.href}
              href={link.href}
              icon={link.icon}
              title={t(link.labelKey)}
              tag={
                link.href === "/admin/registrations" && pendingCount > 0
                  ? `${pendingCount > 99 ? "99+" : pendingCount} ${t("admHubPending")}`
                  : undefined
              }
              gradient={link.gradient}
              index={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
