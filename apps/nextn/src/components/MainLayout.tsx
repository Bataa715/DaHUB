"use client";

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

  // Middleware handles all redirects, so no useEffect needed here

  if (isSelfLayoutTool) {
    return (
      <div className="min-h-screen bg-background">
        <main className="relative">{children}</main>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background",
        !isPublicPath
          ? "h-dvh flex flex-col p-1.5 md:p-2 lg:p-2.5"
          : "min-h-screen",
      )}
    >
      {!isPublicPath ? (
        <div className="animated-border-wrapper flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-background rounded-2xl">
            <Header />
            <main
              id="main-content"
              className="relative flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth"
            >
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
          </div>
        </div>
      ) : (
        <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
          <main className="relative">{children}</main>
        </div>
      )}
    </div>
  );
}
