import type { Metadata } from "next";
import { ThemeStyleInjector } from "@/components/ThemeStyleInjector";
/** Source Sans 3 (variable, weight 200–900) — хуучин үндсэн фонт. */
import "@fontsource-variable/source-sans-3/wght.css";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "DaHUB",
  description: "Дотоод аудитын систем - DaHUB",
  icons: {
    icon: "/golomt.jpg",
  },
  openGraph: {
    title: "DaHUB",
    description: "Дотоод аудитын систем - DaHUB",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <ThemeStyleInjector />
        <link rel="dns-prefetch" href="https://cdn.simpleicons.org" />
      </head>
      <body className="min-h-screen bg-background font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
