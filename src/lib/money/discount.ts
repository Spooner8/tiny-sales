import type { LineDiscount, SaleDiscount } from "../../types/sale";

// Mirrors src-tauri/src/money.rs and SaleService so the checkout preview
// matches what the backend charges - keep both in sync. The backend stays
// authoritative.

/** Rounds to the nearest 5 Rappen, the smallest Swiss cash unit. */
export function roundTo5Rappen(cents: number): number {
  return Math.round(cents / 5) * 5;
}

/** Unit price after an optional line discount. */
export function lineUnitPriceCents(priceCents: number, discount: LineDiscount | null): number {
  if (!discount) return priceCents;
  if (discount.kind === "price") return discount.value;
  return roundTo5Rappen((priceCents * (100 - discount.value)) / 100);
}

export interface DiscountableLine {
  /** quantity * unit price after promotion and line discount. */
  lineTotalCents: number;
  /** True if the line already has a promotion or line discount. */
  discounted: boolean;
}

/** Discount on the whole sale in Rappen. */
export function saleDiscountCents(lines: DiscountableLine[], discount: SaleDiscount | null): number {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (!discount) return 0;
  if (discount.kind === "total") return Math.max(0, subtotal - discount.value);
  const base = lines
    .filter((line) => discount.cumulative || !line.discounted)
    .reduce((sum, line) => sum + line.lineTotalCents, 0);
  return Math.min(roundTo5Rappen((base * discount.value) / 100), base);
}

/**
 * Parses a decimal input like "12", "12.5" or "12,50". Empty is null; NaN
 * marks an invalid entry.
 */
export function parseDecimalInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return Number.NaN;
  return Number.parseFloat(trimmed.replace(",", "."));
}

/** What the cashier typed for a line discount, before validation. */
export interface LineDiscountDraft {
  kind: "none" | LineDiscount["kind"];
  input: string;
}

export const EMPTY_LINE_DISCOUNT: LineDiscountDraft = { kind: "none", input: "" };

/** Validates a line discount draft against the line's current unit price. */
export function parseLineDiscount(
  draft: LineDiscountDraft,
  priceCents: number,
): { discount: LineDiscount | null; error: string | null } {
  if (draft.kind === "none") return { discount: null, error: null };
  const value = parseDecimalInput(draft.input);
  if (value === null) return { discount: null, error: null };
  if (Number.isNaN(value)) return { discount: null, error: "Ungültige Eingabe" };
  if (draft.kind === "percent") {
    if (value === 0) return { discount: null, error: null };
    return value <= 100 ? { discount: { kind: "percent", value }, error: null } : { discount: null, error: "Max. 100 %" };
  }
  const cents = Math.round(value * 100);
  return cents <= priceCents
    ? { discount: { kind: "price", value: cents }, error: null }
    : { discount: null, error: "Höher als der aktuelle Preis" };
}

/** What the cashier typed for the sale discount, before validation. */
export interface SaleDiscountDraft {
  kind: "none" | SaleDiscount["kind"];
  input: string;
  cumulative: boolean;
}

export const EMPTY_SALE_DISCOUNT: SaleDiscountDraft = { kind: "none", input: "", cumulative: false };

/** Validates a sale discount draft against the subtotal it applies to. */
export function parseSaleDiscount(
  draft: SaleDiscountDraft,
  subtotalCents: number,
): { discount: SaleDiscount | null; error: string | null } {
  if (draft.kind === "none") return { discount: null, error: null };
  const value = parseDecimalInput(draft.input);
  if (value === null) return { discount: null, error: null };
  if (Number.isNaN(value)) return { discount: null, error: "Ungültige Eingabe" };
  if (draft.kind === "percent") {
    if (value === 0) return { discount: null, error: null };
    return value <= 100
      ? { discount: { kind: "percent", value, cumulative: draft.cumulative }, error: null }
      : { discount: null, error: "Rabatt darf höchstens 100 % sein" };
  }
  const cents = Math.round(value * 100);
  return cents <= subtotalCents
    ? { discount: { kind: "total", value: cents }, error: null }
    : { discount: null, error: "Der Endbetrag darf nicht höher als die Zwischensumme sein" };
}

/**
 * Refund for returning `quantity` more units of a line whose `paidCents` were
 * paid for `soldQuantity` units, after `alreadyReturned` units. Same
 * cumulative rounding as the backend, so partial returns add up exactly.
 */
export function refundCents(paidCents: number, soldQuantity: number, alreadyReturned: number, quantity: number): number {
  if (soldQuantity <= 0 || quantity <= 0) return 0;
  const share = (units: number) => Math.round((paidCents * units) / soldQuantity);
  return share(alreadyReturned + quantity) - share(alreadyReturned);
}

/** e.g. "20 %" or "12.5 %" */
export function formatPercent(percent: number): string {
  return `${percent.toLocaleString("de-CH", { maximumFractionDigits: 2 })} %`;
}
