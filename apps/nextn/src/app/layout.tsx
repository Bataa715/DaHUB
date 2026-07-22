import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeStyleInjector } from "@/components/ThemeStyleInjector";
import "./globals.css";
import Providers from "./providers";

// CSS variable only — system monospace fallback (Google Fonts татахгүй)
const jetbrainsMono = {
  variable: "--font-jetbrainsMono",
};

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
  // [FIX] middleware.ts sets a per-request CSP nonce (x-nonce) required for
  // any inline <script>. next-themes injects a blocking inline script to set
  // the theme class before paint (FOUC prevention) — without this nonce that
  // script is silently blocked by CSP, so the theme class never gets applied
  // and CSS-variable-driven text/background colors can end up mismatched
  // (e.g. text color from one theme rendered on a background from another).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        {/* All theme CSS variables — single source of truth: lib/themes.ts */}
        <ThemeStyleInjector />
        {/* Preconnect to critical external resources */}
        <link rel="dns-prefetch" href="https://cdn.simpleicons.org" />
      </head>
      <body
        className={`${jetbrainsMono.variable} min-h-screen bg-background font-body antialiased`}
      >
        {/* Skip navigation — keyboard / screen reader users */}
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
