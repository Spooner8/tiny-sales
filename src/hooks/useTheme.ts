import { useSyncExternalStore } from "react";

import { getResolvedTheme, getThemePreference, setThemePreference, subscribeTheme } from "../lib/theme";

export function useTheme() {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference);
  const resolvedTheme = useSyncExternalStore(subscribeTheme, getResolvedTheme);
  return { preference, resolvedTheme, setPreference: setThemePreference };
}
