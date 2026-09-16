"use client";

import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Sidebar-гүй — үндсэн вэбтэй ижил: навигаци нь /admin хаб болон
  // хуудас бүрийн AdminPageHeader (буцах товч, профайл цэс).
  return <div className="min-h-screen bg-background">{children}</div>;
}
