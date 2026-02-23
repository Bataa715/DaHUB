"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Building2,
  Newspaper,
  Wrench,
  Shield,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BASE_NAV = [
  {
    href: "/admin",
    label: "Самбар",
    icon: LayoutDashboard,
    exact: true,
    superOnly: false,
  },
  { href: "/admin/users", label: "Хэрэглэгчид", icon: Users, superOnly: false },
  {
    href: "/admin/departments",
    label: "Хэлтсүүд",
    icon: Building2,
    superOnly: false,
  },
  { href: "/admin/news", label: "Мэдээ", icon: Newspaper, superOnly: false },
  { href: "/admin/tools", label: "Хэрэгслүүд", icon: Wrench, superOnly: false },
  {
    href: "/admin/admins",
    label: "Админ удирдлага",
    icon: ShieldCheck,
    superOnly: true,
  },
];

function AdminSidebar({
  pathname,
  isSuperAdmin,
}: {
  pathname: string;
  isSuperAdmin: boolean;
}) {
  const nav = BASE_NAV.filter((item) => !item.superOnly || isSuperAdmin);
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-slate-900/80 backdrop-blur-xl border-r border-slate-700/50 min-h-screen sticky top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-slate-500 leading-none mb-0.5">DaHUB</p>
          <p className="text-sm font-bold text-white leading-none">
            Admin Panel
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/10 text-white border border-blue-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                } ${item.superOnly ? "border border-amber-500/10" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? "text-blue-400" : item.superOnly ? "text-amber-400" : ""}`}
                />
                <span className="flex-1">{item.label}</span>
                {item.superOnly && !active && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/20">
                    SA
                  </span>
                )}
                {active && (
                  <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-600">DaHUB Internal Audit v2</p>
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        pathname={pathname}
        isSuperAdmin={mounted ? !!user?.isSuperAdmin : false}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
