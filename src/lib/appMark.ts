import { COLOR_SCHEMES } from "./colorSchemes";
import type { ColorSchemeId } from "./colorSchemes";

/** The detailed till, or a simpler one with larger parts for sizes up to about 32 pixels. */
export type AppMarkVariant = "full" | "small";

const SCREEN_COLOR = "#1a1d24";
const PAPER_LINE_COLOR = "#a9afba";

function mix(hex: string, target: string, amount: number): string {
  const channel = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  const channels = [0, 1, 2].map((i) =>
    Math.round(channel(hex, i) + (channel(target, i) - channel(hex, i)) * amount)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

function rect(x: number, y: number, width: number, height: number, radius: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`;
}

function keys(x: number, y: number, columns: number, rows: number, width: number, height: number, gapX: number, gapY: number, radius: number): string {
  const all: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      all.push(rect(x + column * (width + gapX), y + row * (height + gapY), width, height, radius, "#fff"));
    }
  }
  return all.join("");
}

function appMarkSvg(id: ColorSchemeId, variant: AppMarkVariant): string {
  const base = COLOR_SCHEMES[id].light.primary;
  const hi = mix(base, "#ffffff", 0.28);
  const top = mix(base, "#ffffff", 0.6);
  const pale = mix(base, "#ffffff", 0.88);
  const lo = mix(base, "#000000", 0.22);
  const deep = mix(base, "#000000", 0.45);
  const small = variant === "small";

  const defs = `<defs>
    <linearGradient id="housing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${base}"/></linearGradient>
    <linearGradient id="drawer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lo}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
  </defs>`;

  // The outline keeps the white paper visible on a light taskbar.
  const receipt = `<path d="M186 148V34L202 20 218 34 234 20 250 34 266 20 282 34 298 20 314 34 326 22V148Z" fill="#fff" stroke="${deep}" stroke-width="${small ? 12 : 6}" stroke-linejoin="round"/>`;
  const receiptLines = small
    ? ""
    : rect(208, 54, 96, 9, 4.5, PAPER_LINE_COLOR) + rect(208, 76, 72, 9, 4.5, PAPER_LINE_COLOR) + rect(208, 98, 96, 9, 4.5, PAPER_LINE_COLOR);
  const housing = `<path d="M108 124H404Q428 124 434 148L480 366H32L78 148Q84 124 108 124Z" fill="url(#housing)"/>`;

  const front = small
    ? rect(104, 146, 304, 76, 14, SCREEN_COLOR) + rect(130, 172, 252, 24, 12, top) + keys(92, 244, 3, 2, 96, 36, 22, 16, 10)
    : rect(122, 146, 268, 64, 14, SCREEN_COLOR) +
      rect(212, 164, 30, 28, 5, top) +
      rect(250, 164, 30, 28, 5, top) +
      `<circle cx="292" cy="188" r="4.5" fill="${top}"/>` +
      rect(304, 164, 30, 28, 5, top) +
      rect(342, 164, 30, 28, 5, top) +
      keys(112, 228, 4, 3, 56, 26, 16, 12, 7) +
      rect(376, 266, 48, 64, 7, top);

  const drawer = small
    ? rect(16, 356, 480, 136, 26, "url(#drawer)") + rect(176, 404, 160, 34, 17, pale)
    : rect(16, 356, 480, 124, 26, "url(#drawer)") +
      rect(196, 402, 120, 22, 11, pale) +
      `<rect x="44" y="372" width="424" height="6" rx="3" fill="#fff" fill-opacity=".22"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${defs}${receipt}${receiptLines}${housing}${front}${drawer}</svg>`;
}

/** The app's till in the given colour, usable as an image source. */
export function appMarkUrl(id: ColorSchemeId, variant: AppMarkVariant = "full"): string {
  return `data:image/svg+xml,${encodeURIComponent(appMarkSvg(id, variant))}`;
}
