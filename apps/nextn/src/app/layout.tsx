import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeStyleInjector } from "@/components/ThemeStyleInjector";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import MainLayout from "@/components/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { themes, defaultThemeName } from "@/lib/themes";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <ThemeProvider
          attribute="class"
          defaultTheme={defaultThemeName}
          themes={themes.map((t) => t.name)}
          enableSystem={false}
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <AuthProvider>
              <LanguageProvider>
                <MainLayout>{children}</MainLayout>
                <Toaster />
              </LanguageProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
