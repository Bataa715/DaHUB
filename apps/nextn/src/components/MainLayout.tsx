"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import { isDashboardRoute } from "@/components/shared/DashboardShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isPublicPath =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/admin");

  // Дашбоардын shell өөрийн контентыг scroll хийдэг (sidebar тогтмол үлдэнэ).
  const isDashboard = isDashboardRoute(pathname);

  useEffect(() => {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = 0;
  }, [pathname]);

  const skipLink = (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
    >
      {t("skipToContent")}
    </a>
  );

  if (isPublicPath) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
        {skipLink}
        <main className="relative min-w-0">{children}</main>
      </div>
    );
  }

  // Sidebar-гүй бүтэн дэлгэцийн бүтэц — навигаци нь нүүр хуудасны үндсэн хэсгүүд
  // (DAG news, Dashboard, Хэрэгсэл, Эрсдэлийн үнэлгээ) болон хуудас бүрийн толгой хэсэгт.
  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      {skipLink}
      <main
        id="main-content"
        className={cn(
          "relative flex h-full w-full min-w-0 flex-col overflow-x-hidden",
          isDashboard ? "overflow-hidden" : "overflow-y-auto scroll-smooth scrollbar-none",
        )}
      >
        {isDashboard ? (
          // PageTransition нь pathname-аар remount хийдэг — самбар солих бүрт sidebar
          // анивчихгүй, хурдан шилжихийн тулд дашбоардад хэрэглэхгүй.
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>
        ) : (
          <PageTransition>{children}</PageTransition>
        )}
      </main>
    </div>
  );
}
