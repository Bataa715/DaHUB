"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/header";
import Footer from "@/components/footer";
import PageTransition from "@/components/PageTransition";
import { cn } from "@/lib/utils";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isPublicPath =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/admin");

  // Tools that manage their own layout (no DaHUB header/footer)
  const isSelfLayoutTool = pathname.startsWith("/tools/alert-box");

  // Хуудас шилжихэд scroll + overflow reset — header алга болох layout bug засах
  useEffect(() => {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = 0;
  }, [pathname]);

  if (isSelfLayoutTool) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-background">
        <main className="relative min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background w-full overflow-x-hidden",
        !isPublicPath
          ? "h-dvh flex flex-col p-1.5 md:p-2 lg:p-2.5 min-w-0"
          : "min-h-screen",
      )}
    >
      {!isPublicPath ? (
        <div className="animated-border-wrapper flex flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden">
          <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-background">
            <Header />
            <main
              id="main-content"
              className="relative flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden scroll-smooth"
            >
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
          </div>
        </div>
      ) : (
        <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
          <main className="relative min-w-0">{children}</main>
        </div>
      )}
    </div>
  );
}
