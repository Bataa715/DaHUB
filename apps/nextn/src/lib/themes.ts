/**
 * ── Theme System — Single Source of Truth ─────────────────────────────────
 *
 * ALL theme color tokens are defined here.
 * ThemeStyleInjector reads this file and injects a <style> tag into the
 * document, so globals.css contains zero hardcoded theme blocks.
 *
 * HSL tokens: stored as "H S% L%" — consumed via hsl(var(--token))
 * Raw tokens: stored as literal hex/rgb — consumed via var(--token)
 */

// ── Token type ────────────────────────────────────────────────────────────────

/** "H S% L%" — no hsl() wrapper; used as: color: hsl(var(--token)) */
type HSL = string;

/** Literal CSS value — hex, rgb(), etc. */
type Raw = string;

export type ThemeTokens = {
  // Core surfaces
  background: HSL;
  foreground: HSL;
  card: HSL;
  cardForeground: HSL;
  popover: HSL;
  popoverForeground: HSL;

  // Brand
  primary: HSL;
  primaryForeground: HSL;
  secondary: HSL;
  secondaryForeground: HSL;
  muted: HSL;
  mutedForeground: HSL;
  accent: HSL;
  accentForeground: HSL;
  destructive: HSL;
  destructiveForeground: HSL;

  // Utilities
  border: HSL;
  input: HSL;
  ring: HSL;
  radius: Raw;

  // Charts
  chart1: HSL;
  chart2: HSL;
  chart3: HSL;
  chart4: HSL;
  chart5: HSL;

  // Sidebar
  sidebarBackground: HSL;
  sidebarForeground: HSL;
  sidebarPrimary: HSL;
  sidebarPrimaryForeground: HSL;
  sidebarAccent: HSL;
  sidebarAccentForeground: HSL;
  sidebarBorder: HSL;
  sidebarRing: HSL;

  // Surface — raw hex values for .ab-theme scoped components
  surface: Raw;
  surfaceCard: Raw;
  surfaceElevated: Raw;
  surfaceBorder: Raw;
  surfaceHover: Raw;
  txt: Raw;
  txtMuted: Raw;
  txtDim: Raw;
};

export type ThemeDef = {
  /** CSS class applied to <html> by next-themes.  "default" → :root */
  name: string;
  /** English display label */
  label: string;
  /** Mongolian display label */
  labelMn: string;
  isDark: boolean;
  tokens: ThemeTokens;
};

// ── Theme Definitions ─────────────────────────────────────────────────────────

/**
 * Deep Space — dark indigo / violet
 * Inspired by: VS Code dark, Vercel dark dashboard
 */
const deepSpaceTheme: ThemeDef = {
  name: "default",
  label: "Deep Space",
  labelMn: "Dark",
  isDark: true,
  tokens: {
    background: "240 10% 3.9%",
    foreground: "0 0% 98%",
    card: "240 10% 5.5%",
    cardForeground: "0 0% 98%",
    popover: "240 10% 5.5%",
    popoverForeground: "0 0% 98%",

    primary: "251 78% 79%", // soft indigo #a5b4fc
    primaryForeground: "251 78% 12%",

    secondary: "240 4% 16%",
    secondaryForeground: "0 0% 98%",
    muted: "240 4% 16%",
    mutedForeground: "240 8% 82%",

    accent: "182 100% 74%", // cyan #67e8f9
    accentForeground: "182 100% 18%",

    destructive: "0 62% 30%",
    destructiveForeground: "0 0% 98%",

    border: "240 4% 16%",
    input: "240 4% 16%",
    ring: "251 78% 79%",
    radius: "0.8rem",

    chart1: "251 78% 79%", // indigo
    chart2: "182 100% 74%", // cyan
    chart3: "130 80% 68%", // green
    chart4: "38 95% 72%", // amber
    chart5: "354 70% 72%", // rose

    sidebarBackground: "240 10% 3.9%",
    sidebarForeground: "0 0% 98%",
    sidebarPrimary: "251 78% 79%",
    sidebarPrimaryForeground: "251 78% 12%",
    sidebarAccent: "240 4% 16%",
    sidebarAccentForeground: "0 0% 98%",
    sidebarBorder: "240 4% 16%",
    sidebarRing: "251 78% 79%",

    surface: "#111118",
    surfaceCard: "#18181f",
    surfaceElevated: "#1e1e28",
    surfaceBorder: "#2a2a3a",
    surfaceHover: "#222230",
    txt: "#f2f2f8",
    txtMuted: "#c8c8d8",
    txtDim: "#a8a8be",
  },
};

/**
 * Clean Light — soft off-white background with white cards (Linear/Vercel style)
 * Easier on the eyes than pure white — reduces glare while maintaining clarity.
 * Text contrast ratios meet WCAG AA (foreground on background ≥ 4.5:1)
 */
const cleanLightTheme: ThemeDef = {
  name: "light",
  label: "Clean Light",
  labelMn: "Light",
  isDark: false,
  tokens: {
    background: "220 20% 97%", // soft cool gray (~#f4f5f8) — not harsh white
    foreground: "222 39% 12%", // slightly softer dark navy (still WCAG AAA)
    card: "0 0% 100%", // pure white cards stand out on gray bg (hierarchy)
    cardForeground: "222 39% 12%",
    popover: "0 0% 100%",
    popoverForeground: "222 39% 12%",

    primary: "221 83% 53%", // #2563eb — blue-600
    primaryForeground: "0 0% 100%",

    secondary: "210 16% 93%", // #f1f5f9 slate-100
    secondaryForeground: "222 39% 14%",

    muted: "210 16% 91%", // slightly lighter than before to match new bg
    mutedForeground: "222 35% 22%", // solid dark gray — readable on light bg

    accent: "213 93% 97%", // #eff6ff pale blue
    accentForeground: "221 83% 38%", // deep blue

    destructive: "0 84% 50%", // #ef4444 red-500
    destructiveForeground: "0 0% 100%",

    border: "214 28% 84%", // subtle borders — a bit warmer
    input: "214 28% 76%", // clearly visible input borders
    ring: "221 83% 53%",
    radius: "0.8rem",

    chart1: "221 83% 53%", // blue
    chart2: "142 72% 40%", // green  #16a34a
    chart3: "262 83% 58%", // purple #7c3aed
    chart4: "32 95% 50%", // amber  #f59e0b
    chart5: "0 84% 58%", // red    #dc2626

    sidebarBackground: "210 20% 98%", // very slightly lighter for sidebar
    sidebarForeground: "222 39% 12%",
    sidebarPrimary: "221 83% 53%",
    sidebarPrimaryForeground: "0 0% 100%",
    sidebarAccent: "210 16% 93%",
    sidebarAccentForeground: "222 39% 14%",
    sidebarBorder: "214 28% 88%",
    sidebarRing: "221 83% 53%",

    surface: "#f4f5f8", // soft background
    surfaceCard: "#ffffff",
    surfaceElevated: "#f1f5f9", // slate-100
    surfaceBorder: "#dde1ea", // slightly warmer border
    surfaceHover: "#eff6ff", // blue-50
    txt: "#0f172a",
    txtMuted: "#1f2937",
    txtDim: "#374151",
  },
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const themes: ThemeDef[] = [
  deepSpaceTheme,
  cleanLightTheme,
];

export const defaultThemeName = "default";
