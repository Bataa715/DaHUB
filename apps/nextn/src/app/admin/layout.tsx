"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BASE_NAV = [
  {
    href: "/admin/users",
    label: "Хэрэглэгчид",
    superOnly: false,
    section: "main",
  },
  {
    href: "/admin/departments",
    label: "Хэлтсүүд",
    superOnly: false,
    section: "main",
  },
  {
    href: "/admin/tools",
    label: "Хэрэгслүүд",
    superOnly: false,
    section: "main",
  },
  {
    href: "/admin/change-password",
    label: "Нууц үг солих",
    superOnly: false,
    section: "mgmt",
  },
  {
    href: "/admin/admins",
    label: "Админ удирдлага",
    superOnly: true,
    section: "mgmt",
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
  const mainNav = nav.filter((i) => i.section === "main");
  const mgmtNav = nav.filter((i) => i.section === "mgmt");

  const NavItem = ({ item }: { item: (typeof BASE_NAV)[0] }) => {
    const active = pathname.startsWith(item.href);
    return (
      <Link href={item.href}>
        <motion.div
          whileHover={{ x: 2 }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            active
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <span className="flex-1">{item.label}</span>
          {item.superOnly && !active && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/20">
              SA
            </span>
          )}
          {active && (
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
        </motion.div>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-slate-950 border-r border-slate-800/60 min-h-screen sticky top-0 z-30">
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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNav.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}

        {/* Удирдлага section */}
        <div className="pt-3 pb-1">
          <div className="flex items-center gap-2 px-3 mb-1"></div>
        </div>
        {mgmtNav.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-600">DaHUB</p>
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
    <div className="flex min-h-screen bg-slate-950">
      <AdminSidebar
        pathname={pathname}
        isSuperAdmin={mounted ? !!user?.isSuperAdmin : false}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
