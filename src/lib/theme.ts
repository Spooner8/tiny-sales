export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "Wie System",
};

const STORAGE_KEY = "tiny-sales-theme";
const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

let preference: ThemePreference = readStoredPreference();
let printing = false;

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEME_PREFERENCES.includes(stored as ThemePreference) ? (stored as ThemePreference) : "light";
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
  listeners.forEach((listener) => listener());
}

/** Applies the stored theme before the first render and keeps it in sync with the OS and printing. */
export function initTheme() {
  apply();
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

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
