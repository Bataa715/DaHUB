"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { themes } from "@/lib/themes";
import { cn } from "@/lib/utils";

const DARK_THEME = themes.find((theme) => theme.isDark)?.name ?? "default";
const LIGHT_THEME = themes.find((theme) => !theme.isDark)?.name ?? "light";

/**
 * Бараан / цайвар горимыг нэг даралтаар солино.
 * Icon-ыг CSS (`dark:` variant)-ээр сонгодог тул SSR/hydration зөрөхгүй.
 */
export function ThemeQuickToggle({
  tone = "glass",
  className,
}: {
  /** glass — бараан толгой хэсэг дээр; plain — theme-ийн дэвсгэр дээр */
  tone?: "glass" | "plain";
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() =>
        setTheme(resolvedTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME)
      }
      aria-label={t("navTheme")}
      title={t("navTheme")}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2",
        tone === "glass"
          ? "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/60"
          : "bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring",
        className,
      )}
    >
      {/* Бараан горимд → нар (цайвар руу), цайвар горимд → сар (бараан руу) */}
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden />
    </button>
  );
}
