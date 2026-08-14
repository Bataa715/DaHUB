import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeStyleInjector } from "@/components/ThemeStyleInjector";
/** Golos Text (variable, weight 400–900) — кирилл-нативе, уншихад гоё & тод.
 *  Нэг variable файл бүх жинг (400/500/600/700 г.м.) агуулна. */
import "@fontsource-variable/golos-text/wght.css";
/** JetBrains Mono (variable) — тод тоо/ID/оноо/огноо/код-д accent. */
import "@fontsource-variable/jetbrains-mono/wght.css";
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
      <body className="min-h-screen bg-background font-body antialiased">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
