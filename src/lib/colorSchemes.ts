// In the order of the colour wheel, which is how the settings show them.
export const COLOR_SCHEME_IDS = ["red", "orange", "yellow", "green", "turquoise", "blue", "violet", "magenta"] as const;
export type ColorSchemeId = (typeof COLOR_SCHEME_IDS)[number];

interface ModeColors {
  /** Buttons, the active menu item, badges. */
  primary: string;
  /** Whether text on `primary` is light or dark. */
  foreground: "light" | "dark";
  /** Text on cards and backgrounds. Yellow can't be read on white, so it differs from `primary`. */
  text: string;
  /** Series in the statistics, checked for this mode's card colour with the dataviz palette validator. */
  chart: string;
}

export interface ColorScheme {
  label: string;
  /** Tints the sidebar and the text on `primary`. */
  hue: number;
  light: ModeColors;
  dark: ModeColors;
}

function lightOnPrimary(primary: string, text: string, chart: string): ModeColors {
  return { primary, foreground: "light", text, chart };
}

function darkOnPrimary(primary: string, text: string, chart: string): ModeColors {
  return { primary, foreground: "dark", text, chart };
}

export const COLOR_SCHEMES: Record<ColorSchemeId, ColorScheme> = {
  red: {
    label: "Rot",
    hue: 25,
    light: lightOnPrimary("#d92d20", "#c8281c", "#d92d20"),
    dark: darkOnPrimary("#f97066", "#f97066", "#e8574c"),
  },
  orange: {
    label: "Orange",
    hue: 50,
    light: lightOnPrimary("#cc420d", "#be3d0b", "#cc420d"),
    dark: darkOnPrimary("#fb8c3c", "#fb8c3c", "#dd6c1a"),
  },
  yellow: {
    label: "Gelb",
    hue: 95,
    light: darkOnPrimary("#f5c400", "#7d6300", "#b08c00"),
    dark: darkOnPrimary("#f5c400", "#f5c400", "#ae8a00"),
  },
  green: {
    label: "Grün",
    hue: 150,
    light: lightOnPrimary("#1b7f37", "#18732f", "#1f8f3f"),
    dark: darkOnPrimary("#4fc46f", "#4fc46f", "#38ab59"),
  },
  turquoise: {
    label: "Türkis",
    hue: 200,
    light: lightOnPrimary("#0b7f86", "#0a737a", "#00909a"),
    dark: darkOnPrimary("#2cc5c9", "#2cc5c9", "#12a8ad"),
  },
  blue: {
    label: "Blau",
    hue: 255,
    light: lightOnPrimary("#1570d6", "#1363bf", "#1570d6"),
    dark: darkOnPrimary("#6aa9f5", "#6aa9f5", "#4f90e6"),
  },
  violet: {
    label: "Violett",
    hue: 290,
    light: lightOnPrimary("#7c3aed", "#7c3aed", "#7c3aed"),
    dark: darkOnPrimary("#a78bfa", "#a78bfa", "#9173f0"),
  },
  magenta: {
    label: "Magenta",
    hue: 328,
    light: lightOnPrimary("#e5097f", "#e5097f", "#e5097f"),
    dark: darkOnPrimary("oklch(0.68 0.22 328)", "oklch(0.68 0.22 328)", "#cd59cb"),
  },
};

/** The colour of text on `primary`. */
export function foregroundColor(scheme: ColorScheme, mode: "light" | "dark"): string {
  return scheme[mode].foreground === "light" ? `oklch(0.99 0.01 ${scheme.hue})` : `oklch(0.15 0.02 ${scheme.hue})`;
}
