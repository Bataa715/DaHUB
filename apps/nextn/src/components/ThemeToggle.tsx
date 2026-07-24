"use client";

import { useTheme } from "next-themes";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { themes } from "@/lib/themes";
import { useLanguage } from "@/contexts/LanguageContext";

export function ThemeToggle({ small }: { small?: boolean } = {}) {
  const { setTheme, theme: activeTheme } = useTheme();
  const { language, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={
            small
              ? "h-6 w-6 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              : "text-primary border-primary hover:bg-primary hover:text-primary-foreground"
          }
        >
          <Palette className={small ? "h-3 w-3" : "h-[1.2rem] w-[1.2rem]"} />
          <span className="sr-only">{t("changeThemeSr")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.name}
            onClick={() => setTheme(theme.name)}
            className={
              activeTheme === theme.name
                ? "bg-accent text-accent-foreground font-semibold"
                : ""
            }
          >
            {language === "mn" ? theme.labelMn : theme.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
