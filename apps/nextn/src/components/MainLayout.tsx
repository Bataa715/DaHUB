"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/header";
import Footer from "@/components/footer";
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
        "min-h-screen bg-background",
        !isPublicPath && "p-1.5 md:p-2 lg:p-2.5",
      )}
    >
      {!isPublicPath ? (
        <div className="animated-border-wrapper">
          <div className="flex flex-col min-h-screen w-full overflow-x-hidden bg-background rounded-2xl">
            <Header />
            <main className="relative flex-1">{children}</main>
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
