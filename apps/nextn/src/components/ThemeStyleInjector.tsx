/**
 * ThemeStyleInjector — Server Component
 *
 * Reads all theme token definitions from lib/themes.ts and renders a single
 * <style> tag that sets every CSS variable for every theme.
 * This is the ONLY place where CSS custom properties are declared for theming.
 */
import { themes } from "@/lib/themes";
import type { ThemeTokens } from "@/lib/themes";

// ── CSS generation helpers ────────────────────────────────────────────────────

function shadcnVars(t: ThemeTokens): string {
  return [
    `--background:${t.background}`,
    `--foreground:${t.foreground}`,
    `--card:${t.card}`,
    `--card-foreground:${t.cardForeground}`,
    `--popover:${t.popover}`,
    `--popover-foreground:${t.popoverForeground}`,
    `--primary:${t.primary}`,
    `--primary-foreground:${t.primaryForeground}`,
    `--secondary:${t.secondary}`,
    `--secondary-foreground:${t.secondaryForeground}`,
    `--muted:${t.muted}`,
    `--muted-foreground:${t.mutedForeground}`,
    `--accent:${t.accent}`,
    `--accent-foreground:${t.accentForeground}`,
    `--destructive:${t.destructive}`,
    `--destructive-foreground:${t.destructiveForeground}`,
    `--border:${t.border}`,
    `--input:${t.input}`,
    `--ring:${t.ring}`,
    `--radius:${t.radius}`,
    `--chart-1:${t.chart1}`,
    `--chart-2:${t.chart2}`,
    `--chart-3:${t.chart3}`,
    `--chart-4:${t.chart4}`,
    `--chart-5:${t.chart5}`,
    `--sidebar-background:${t.sidebarBackground}`,
    `--sidebar-foreground:${t.sidebarForeground}`,
    `--sidebar-primary:${t.sidebarPrimary}`,
    `--sidebar-primary-foreground:${t.sidebarPrimaryForeground}`,
    `--sidebar-accent:${t.sidebarAccent}`,
    `--sidebar-accent-foreground:${t.sidebarAccentForeground}`,
    `--sidebar-border:${t.sidebarBorder}`,
    `--sidebar-ring:${t.sidebarRing}`,
  ]
    .map((v) => `  ${v};`)
    .join("\n");
}

function surfaceVars(t: ThemeTokens): string {
  return [
    `--surface:${t.surface}`,
    `--surface-card:${t.surfaceCard}`,
    `--surface-elevated:${t.surfaceElevated}`,
    `--surface-border:${t.surfaceBorder}`,
    `--surface-hover:${t.surfaceHover}`,
    `--txt:${t.txt}`,
    `--txt-muted:${t.txtMuted}`,
    `--txt-dim:${t.txtDim}`,
  ]
    .map((v) => `  ${v};`)
    .join("\n");
}

function buildCSS(): string {
  const blocks: string[] = [];

  for (const theme of themes) {
    // Main theme selector
    const sel = theme.name === "default" ? ":root" : `html.${theme.name}`;

    // Surface selector (scoped to .ab-theme)
    const surfSel =
      theme.name === "default" ? ".ab-theme" : `html.${theme.name} .ab-theme`;

    blocks.push(
      `${sel} {\n${shadcnVars(theme.tokens)}\n}`,
      `${surfSel} {\n${surfaceVars(theme.tokens)}\n}`,
    );
  }

  return blocks.join("\n\n");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ThemeStyleInjector() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: buildCSS() }}
      data-theme-tokens="true"
    />
  );
}
