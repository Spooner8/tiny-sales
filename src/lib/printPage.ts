import { withPrintTheme } from "./theme";

/**
 * Sets the paper for the next print. Receipts, label sheets and invoices
 * share one style element, so a page size set earlier on another page can
 * never win over the current one.
 */
export function applyPrintPageStyle(pageRule: string) {
  const styleId = "print-page-style";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = pageRule;
}

/** Resolves once the fonts and the images in `root` (e.g. the logo) are loaded. */
export async function documentAssetsLoaded(root: HTMLElement): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => (img.onload = img.onerror = resolve)),
    ),
  );
}

/** Runs `print`, which prints the window to an A4 PDF, on paper settings and in the print theme. */
export async function printDocumentToPdf(print: () => Promise<void>): Promise<void> {
  applyPrintPageStyle("@page { size: A4; margin: 0; }");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await withPrintTheme(print);
}
