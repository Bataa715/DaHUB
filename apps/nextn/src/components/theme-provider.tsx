"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Хуучин устгасан "tokyo-night" theme-г "default" (Dark) рүү шилжүүлэх
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "tokyo-night") {
        localStorage.setItem("theme", "default");
        document.documentElement.classList.remove("tokyo-night");
        document.documentElement.classList.add("default");
      }
    } catch {
      /* localStorage боломжгүй үед алгасах */
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
