import type { LineDiscount, PaymentMethod, SaleDiscount, SaleWithItems } from "./sale";

/** Production states of an order, in their usual order. */
export const ORDER_STATUSES = [
  "open",
  "material_required",
  "material_ordered",
  "ready_for_production",
  "produced",
  "delivered",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open: "Offen",
  material_required: "Material muss bestellt werden",
  material_ordered: "Material bestellt",
  ready_for_production: "Bereit für Produktion",
  produced: "Produziert",
  delivered: "Ausgeliefert",
};

export interface CustomerOrderItem {
  id: number;
  articleId: number;
  articleCode: string;
  articleName: string;
  articleInternalNumber: string | null;
  quantity: number;
  /** Regular unit price when the line was added. */
  listPriceCents: number;
  /** Unit price after the article promotion when the line was added. */
  salePriceCents: number;
  articleDiscountPercent: number;
  discount: LineDiscount | null;
  /** salePriceCents after the line discount. */
  unitPriceCents: number;
  /** Extra information for this line only. */
  note: string | null;
}

export interface CustomerOrder {
  id: number;
  customerId: number;
  customerName: string;
  customerCompany: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  discount: SaleDiscount | null;
  /** Set once the order is completed. */
  saleId: number | null;
  invoiceId: number | null;
  createdAt: string;
  updatedAt: string;
  items: CustomerOrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

export interface SaveCustomerOrderItem {
  /** Set for lines saved before; they keep their prices. */
  id: number | null;
  articleId: number;
  quantity: number;
  discount: LineDiscount | null;
  note: string | null;
}

export interface SaveCustomerOrder {
  /** null creates a new order. */
  id: number | null;
  customerId: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  discount: SaleDiscount | null;
  items: SaveCustomerOrderItem[];
}

export interface CompleteCustomerOrder {
  orderId: number;
  paymentMethod: PaymentMethod;
  cashGivenCents: number | null;
  discount: SaleDiscount | null;
}

export interface CompletedCustomerOrder {
  sale: SaleWithItems;
  /** Set when the order was paid by invoice. */
  invoiceId: number | null;
}
