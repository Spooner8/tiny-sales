import type { LineDiscountDraft, SaleDiscountDraft } from "../lib/money/discount";

export interface OpenSaleItem {
  articleId: number;
  quantity: number;
  /** As typed at the checkout; validated when the sale is completed. */
  discount: LineDiscountDraft;
}

/**
 * A sale started at the checkout but not completed yet. Its items reserve
 * stock; nothing is booked until it is completed.
 */
export interface OpenSale {
  id: string;
  /** Tab number at the checkout, reused once the sale is closed. */
  number: number;
  /** Optional name, e.g. the customer's. */
  label: string | null;
  discount: SaleDiscountDraft;
  pickupNumber: string;
  createdAt: string;
  updatedAt: string;
  items: OpenSaleItem[];
}

export type SaveOpenSale = Omit<OpenSale, "createdAt" | "updatedAt">;
