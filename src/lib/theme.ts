import { updateWindowIcon } from "./appIcon";
import { COLOR_SCHEME_IDS, COLOR_SCHEMES, foregroundColor } from "./colorSchemes";
import type { ColorSchemeId } from "./colorSchemes";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "Wie System",
};

const STORAGE_KEY = "tiny-sales-theme";
const COLOR_STORAGE_KEY = "tiny-sales-color";
const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

let preference: ThemePreference = readStoredPreference();
let colorScheme: ColorSchemeId = readStoredColorScheme();
let printing = false;

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEME_PREFERENCES.includes(stored as ThemePreference) ? (stored as ThemePreference) : "light";
}

function readStoredColorScheme(): ColorSchemeId {
  const stored = localStorage.getItem(COLOR_STORAGE_KEY);
  return COLOR_SCHEME_IDS.includes(stored as ColorSchemeId) ? (stored as ColorSchemeId) : "blue";
}

function resolve(): ResolvedTheme {
  if (preference === "system") return systemDarkQuery.matches ? "dark" : "light";
  return preference;
}

function apply() {
  // Receipts and label sheets are always printed on white paper.
  const theme = printing ? "light" : resolve();
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  applyColors(root, theme);
  listeners.forEach((listener) => listener());
}

function applyColors(root: HTMLElement, theme: ResolvedTheme) {
  const scheme = COLOR_SCHEMES[colorScheme];
  const colors = scheme[theme];
  const foreground = foregroundColor(scheme, theme);
  const properties = {
    "--brand-hue": String(scheme.hue),
    "--primary": colors.primary,
    "--primary-foreground": foreground,
    "--primary-text": colors.text,
    "--ring": `color-mix(in oklch, ${colors.primary} ${theme === "dark" ? 50 : 71}%, transparent)`,
    "--sidebar-accent": colors.primary,
    "--sidebar-accent-foreground": foreground,
    // Receipts are paper: white, whichever mode is on screen.
    "--print-accent": scheme.light.text,
  };
  Object.entries(properties).forEach(([name, value]) => root.style.setProperty(name, value));
}

/** Applies the stored theme before the first render and keeps it in sync with the OS and printing. */
export function initTheme() {
  apply();
  void updateWindowIcon(colorScheme);
  systemDarkQuery.addEventListener("change", () => {
    if (preference === "system") apply();
  });
  window.addEventListener("beforeprint", () => {
    printing = true;
    apply();
  });
  window.addEventListener("afterprint", () => {
    printing = false;
    apply();
  });
}

/**
 * Shows the light theme while `task` runs, for printing without the print
 * dialog (e.g. to PDF), which doesn't fire `beforeprint`.
 */
export async function withPrintTheme<T>(task: () => Promise<T>): Promise<T> {
  printing = true;
  apply();
  try {
    return await task();
  } finally {
    printing = false;
    apply();
  }
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function getResolvedTheme(): ResolvedTheme {
  return printing ? "light" : resolve();
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  localStorage.setItem(STORAGE_KEY, next);
  apply();
}

export function getColorScheme(): ColorSchemeId {
  return colorScheme;
}

export function setColorScheme(next: ColorSchemeId) {
  colorScheme = next;
  localStorage.setItem(COLOR_STORAGE_KEY, next);
  apply();
  void updateWindowIcon(next);
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
