"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import MainLayout from "@/components/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { themes, defaultThemeName } from "@/lib/themes";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
