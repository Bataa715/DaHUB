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
    pathname === "/admin/login";

  // Middleware handles all redirects, so no useEffect needed here

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        !isPublicPath && "p-3 md:p-4 lg:p-6",
      )}
    >
      {!isPublicPath ? (
        <div className="animated-border-wrapper">
          <div className="relative min-h-screen w-full overflow-x-hidden bg-background rounded-[1.6rem]">
            <Header />
            <main className="relative">{children}</main>
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
