"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { Wrench, Users, Building2, Shield, Lock, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const OTHER_LINKS = [
  { href: "/admin/users", label: "Хэрэглэгчид", icon: Users, superOnly: false },
  {
    href: "/admin/departments",
    label: "Хэлтсүүд",
    icon: Building2,
    superOnly: false,
  },
  {
    href: "/admin/admins",
    label: "Админ удирдлага",
    icon: Shield,
    superOnly: true,
  },
  {
    href: "/admin/change-password",
    label: "Нууц үг солих",
    icon: Lock,
    superOnly: false,
  },
];

function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isTools = pathname.startsWith("/admin/tools");

  const handleLogout = async () => {
    await logout();
    router.replace("/admin/login");
  };

  const visibleOthers = OTHER_LINKS.filter(
    (l) => !l.superOnly || user?.isSuperAdmin,
  );

  return (
    <aside className="flex flex-col w-48 shrink-0 border-r border-border bg-background min-h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center overflow-hidden ring-1 ring-border/70 shadow-sm">
          <Image
            src="/golomt.jpg"
            alt="Golomt"
            width={20}
            height={20}
            className="rounded object-contain"
          />
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {/* Хэрэгсэл */}
        <Link
          href="/admin/tools"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            isTools
              ? "bg-muted text-foreground font-semibold ring-hairline shadow-sm"
              : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          Хэрэгсэл
        </Link>

        {/* Бусад */}
        <div className="pt-3 pb-1 px-3">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Бусад
          </p>
        </div>
        {visibleOthers.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-muted text-foreground font-semibold ring-hairline shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        <div className="flex items-center justify-between px-3 py-1.5">
          <ThemeToggle small />
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-foreground/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          Гарах
        </button>
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

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="admin-shell flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
