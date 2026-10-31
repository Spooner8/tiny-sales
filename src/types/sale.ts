export const PAYMENT_METHODS = ["Cash", "Twint", "Card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: "Bar",
  Twint: "Twint",
  Card: "Karte (SumUp)",
};

export interface SaleItemDetail {
  articleId: number;
  articleCode: string;
  articleName: string;
  quantity: number;
  /** Regular unit price before the article promotion. */
  listPriceCents: number;
  /** Unit price charged (after the article promotion and line discount). */
  unitPriceCents: number;
  /** Article promotion in percent at the time of sale (0 = none). */
  articleDiscountPercent: number;
  /** Set when a line discount was given at checkout. */
  lineDiscountKind: LineDiscount["kind"] | null;
  /** The percentage, or the overridden unit price in Rappen. */
  lineDiscountValue: number | null;
  /** quantity * unitPriceCents, before the sale discount. */
  lineTotalCents: number;
  /** This line's share of the sale discount. */
  discountCents: number;
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

/** Discount on one line: percent off the current price, or a new unit price in Rappen. */
export type LineDiscount = { kind: "percent"; value: number } | { kind: "price"; value: number };

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
