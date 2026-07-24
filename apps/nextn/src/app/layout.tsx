import type { Metadata } from "next";
import { headers } from "next/headers";
import { Source_Sans_3 } from "next/font/google";
import { ThemeStyleInjector } from "@/components/ThemeStyleInjector";
import "./globals.css";
import Providers from "./providers";

/** Банк / дотоод аудитын UI — Cyrillic дэмжсэн мэргэжлийн sans (self-hosted via next/font) */
const sourceSans = Source_Sans_3({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <ThemeStyleInjector />
        <link rel="dns-prefetch" href="https://cdn.simpleicons.org" />
      </head>
      <body
        className={`${sourceSans.variable} min-h-screen bg-background font-body antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Үндсэн агуулга руу үсрэх
        </a>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
