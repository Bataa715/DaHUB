import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import MainLayout from "@/components/MainLayout";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrainsMono",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "DaHUB",
  description: "Дотоод аудитын систем - DaHUB",
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://internalaudit.mn"),
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
        {/* Preconnect to critical external resources */}
        <link rel="dns-prefetch" href="https://cdn.simpleicons.org" />
      </head>
      <body
        className={`${jetbrainsMono.variable} min-h-screen bg-background font-body antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <MainLayout>{children}</MainLayout>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
