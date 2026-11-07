import { formatChf } from "./money/change";
import { formatPercent } from "./money/discount";
import type { Customer } from "../types/customer";
import type { Sale, SaleItemDetail } from "../types/sale";

// Wording shared by receipts and invoices.

export function customerSalutation(customer: Customer): string {
  if (customer.gender === "male") return `Sehr geehrter Herr ${customer.lastName}`;
  if (customer.gender === "female") return `Sehr geehrte Frau ${customer.lastName}`;
  return `Guten Tag ${customer.firstName} ${customer.lastName}`;
}

/** Explains why a line costs less than its regular price, e.g. "Aktion −20 %". */
export function lineDiscountNote(item: SaleItemDetail): string | null {
  if (item.unitPriceCents >= item.listPriceCents) return null;
  let reason = "Rabatt";
  if (item.lineDiscountKind === "percent" && item.lineDiscountValue !== null) {
    reason = `Rabatt −${formatPercent(item.lineDiscountValue)}`;
  } else if (item.lineDiscountKind === "amount" && item.lineDiscountValue !== null) {
    reason = `Nachlass −${formatChf(item.lineDiscountValue)}`;
  } else if (item.lineDiscountKind === "price") {
    reason = "Preis angepasst";
  } else if (item.articleDiscountPercent > 0) {
    reason = `Aktion −${formatPercent(item.articleDiscountPercent)}`;
  }
  return `${reason} · statt ${formatChf(item.listPriceCents)}`;
}

/** e.g. "inkl. 8.1 % MWST"; null if the sale shows no VAT. */
export function vatLabel(sale: Sale): string | null {
  if (!sale.vatRatePercent || sale.vatCents === null) return null;
  return `inkl. ${formatPercent(sale.vatRatePercent)} MWST`;
}

export function saleDiscountLabel(sale: Sale): string {
  if (sale.discountKind === "percent" && sale.discountPercent !== null) {
    const scope = sale.discountCumulative === false ? " (ohne rabattierte Artikel)" : "";
    return `Gesamtrabatt ${formatPercent(sale.discountPercent)}${scope}`;
  }
  return "Gesamtrabatt";
}
