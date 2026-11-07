import { useSyncExternalStore } from "react";

import {
  getColorScheme,
  getResolvedTheme,
  getThemePreference,
  setColorScheme,
  setThemePreference,
  subscribeTheme,
} from "../lib/theme";

export function useTheme() {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference);
  const resolvedTheme = useSyncExternalStore(subscribeTheme, getResolvedTheme);
  const colorScheme = useSyncExternalStore(subscribeTheme, getColorScheme);
  return { preference, resolvedTheme, colorScheme, setPreference: setThemePreference, setColorScheme };
}
