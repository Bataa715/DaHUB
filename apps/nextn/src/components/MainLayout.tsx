"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Minimize2 } from "lucide-react";
import Footer from "@/components/footer";
import PageTransition from "@/components/PageTransition";
import { cn } from "@/lib/utils";
import { useChromeFullscreen } from "@/lib/chrome-fullscreen";

const Sidebar = dynamic(() => import("@/components/Sidebar"), {
  ssr: false,
});

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { fullscreen, toggle, mounted } = useChromeFullscreen();

  const isPublicPath =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/admin");

  const isAlertBox = pathname.startsWith("/tools/alert-box");
  // Avoid SSR/client chrome mismatch — wait until localStorage is read
  const chromeFullscreen = mounted && fullscreen;

  useEffect(() => {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = 0;
  }, [pathname]);

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
        <div className="animated-border-wrapper flex flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden relative">
          {!chromeFullscreen && <Sidebar />}
          <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-background">
            <main
              id="main-content"
              className={cn(
                "relative flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full overflow-x-hidden",
                isAlertBox
                  ? "overflow-hidden"
                  : "overflow-y-auto scroll-smooth scrollbar-none",
              )}
            >
              <PageTransition>{children}</PageTransition>
            </main>
            {!isAlertBox && <Footer />}
          </div>

          {chromeFullscreen && (
            <button
              type="button"
              onClick={toggle}
              title="Sidebar-тай харах"
              aria-label="Sidebar-тай харах"
              className="absolute bottom-3 left-3 z-50 flex items-center justify-center w-8 h-8 rounded-lg border border-border/60 bg-background/90 backdrop-blur-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-premium transition-colors"
            >
              <Minimize2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
          <main className="relative min-w-0">{children}</main>
        </div>
      )}
    </div>
  );
}
