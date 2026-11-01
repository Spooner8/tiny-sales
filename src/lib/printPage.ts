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
