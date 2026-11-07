export const PAYMENT_METHODS = ["Cash", "Twint", "Card", "Invoice", "BankTransfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: "Bar",
  Twint: "Twint",
  Card: "Karte (SumUp)",
  Invoice: "Rechnung",
  BankTransfer: "Überweisung",
};

/**
 * Whether the money is taken at the checkout. An invoice is paid later, so
 * an order paid by invoice is completed without the checkout (mirrors
 * `PaymentMethod::paid_at_checkout`).
 */
export function paidAtCheckout(method: PaymentMethod): boolean {
  return method === "Cash" || method === "Twint" || method === "Card";
}

/** What the checkout offers. */
export const CHECKOUT_PAYMENT_METHODS = PAYMENT_METHODS.filter(paidAtCheckout);

/** An order is paid at the checkout or by invoice. */
export const ORDER_PAYMENT_METHODS: readonly PaymentMethod[] = [...CHECKOUT_PAYMENT_METHODS, "Invoice"];

/** A return is refunded at the checkout or by bank transfer. */
export const REFUND_METHODS: readonly PaymentMethod[] = [...CHECKOUT_PAYMENT_METHODS, "BankTransfer"];

/** Receipt numbers have five digits: sale 1 is "00001". */
export function formatReceiptNumber(saleId: number): string {
  return String(saleId).padStart(5, "0");
}

export interface SaleItemDetail {
  articleId: number;
  articleCode: string;
  articleName: string;
  /** The article's current internal number ("Interne Nr."). */
  articleInternalNumber: string | null;
  quantity: number;
  /** Regular unit price before the article promotion. */
  listPriceCents: number;
  /** Unit price charged (after the article promotion and line discount). */
  unitPriceCents: number;
  /** Article promotion in percent at the time of sale (0 = none). */
  articleDiscountPercent: number;
  /**
   * Set when a line discount was given. "price" (a new unit price) only
   * occurs on sales from before line discounts became amounts off.
   */
  lineDiscountKind: LineDiscount["kind"] | "price" | null;
  /** The percentage, the amount off per unit or the new unit price in Rappen. */
  lineDiscountValue: number | null;
  /** quantity * unitPriceCents, before the sale discount. */
  lineTotalCents: number;
  /** This line's share of the sale discount. */
  discountCents: number;
  /** Extra information from the customer order line. */
  note: string | null;
}

export interface Sale {
  id: number;
  timestamp: string;
  paymentMethod: PaymentMethod;
  status: string;
  subtotalCents: number;
  discountCents: number;
  /** Set when the sale discount was entered as a percentage. */
  discountPercent: number | null;
  /** "amount" only occurs on sales from before line discounts existed. */
  discountKind: "percent" | "total" | "amount" | null;
  /** For percentage discounts: whether already discounted lines got it too. */
  discountCumulative: boolean | null;
  totalCents: number;
  pickupNumber: string | null;
  cashGivenCents: number | null;
  changeCents: number | null;
  /** VAT rate when the sale was booked; null for sales from before VAT was recorded. */
  vatRatePercent: number | null;
  /** VAT contained in totalCents. */
  vatCents: number | null;
  /** Set for sales that completed a customer order. */
  customerOrderId: number | null;
  /** The order's customer, or the one assigned to the sale afterwards. */
  customerName: string | null;
  customerCompany: string | null;
  /** Set for sales paid by invoice. */
  invoiceId: number | null;
  /** Day the invoice was paid ("YYYY-MM-DD"); null while it is open. */
  invoicePaidOn: string | null;
}

/**
 * One row of the sales list: a sale, or a return booked against one. A
 * return has a negative total, so the list adds up to the net revenue.
 */
export interface SaleListEntry {
  saleId: number;
  /** Set for returns. */
  returnId: number | null;
  timestamp: string;
  /** For returns: how the money was refunded. */
  paymentMethod: PaymentMethod;
  totalCents: number;
  pickupNumber: string | null;
  /** The order's customer, or the one assigned to the sale afterwards. */
  customerName: string | null;
  customerCompany: string | null;
  /** For sales paid by invoice (not set on their returns). */
  invoiceId: number | null;
  invoicePaidOn: string | null;
}

/** Receipt number shown for a list entry: "00042", or "R-00042" for a return of sale 42. */
export function receiptNumber(entry: SaleListEntry): string {
  const number = formatReceiptNumber(entry.saleId);
  return entry.returnId === null ? number : `R-${number}`;
}

export interface SaleWithItems {
  sale: Sale;
  items: SaleItemDetail[];
}

export interface NewSaleItem {
  articleId: number;
  quantity: number;
  discount: LineDiscount | null;
}

/** Discount on one line: percent off the current price, or an amount off per unit in Rappen. */
export type LineDiscount = { kind: "percent"; value: number } | { kind: "amount"; value: number };

export interface NewSale {
  items: NewSaleItem[];
  paymentMethod: PaymentMethod;
  cashGivenCents: number | null;
  pickupNumber: string | null;
  discount: SaleDiscount | null;
  /** The open sale this sale was rung up in; deleted on completion. */
  openSaleId: string | null;
}

/**
 * Discount on the whole sale: a percentage (`cumulative: false` leaves lines
 * that already have a promotion or line discount out), or a new final total
 * in Rappen whose difference to the subtotal is the discount.
 */
export type SaleDiscount =
  | { kind: "percent"; value: number; cumulative: boolean }
  | { kind: "total"; value: number };

export interface DailyRevenue {
  day: string;
  totalCents: number;
}

export interface ProductGroupRevenue {
  productGroupId: number;
  productGroupName: string;
  totalCents: number;
}

export interface ArticleRevenue {
  articleId: number;
  articleName: string;
  totalCents: number;
}

export interface SaleReturn {
  id: number;
  saleId: number;
  timestamp: string;
  refundMethod: PaymentMethod;
  totalRefundCents: number;
}

export interface SaleReturnItemDetail {
  articleId: number;
  articleCode: string;
  articleName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface SaleReturnWithItems {
  return: SaleReturn;
  items: SaleReturnItemDetail[];
}

export interface NewSaleReturnItem {
  articleId: number;
  quantity: number;
}

export interface NewSaleReturn {
  saleId: number;
  refundMethod: PaymentMethod;
  items: NewSaleReturnItem[];
}
