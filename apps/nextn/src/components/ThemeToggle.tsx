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

export function ThemeToggle({ small }: { small?: boolean } = {}) {
  const { setTheme, theme: activeTheme } = useTheme();

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
          <span className="sr-only">Загвар солих</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => setTheme(t.name)}
            className={
              activeTheme === t.name
                ? "bg-accent text-accent-foreground font-semibold"
                : ""
            }
          >
            {t.labelMn}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
