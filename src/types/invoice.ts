import type { Customer } from "./customer";
import type { SaleWithItems } from "./sale";

export interface Invoice {
  /** The invoice number. */
  id: number;
  saleId: number;
  createdAt: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  /** Day the payment arrived ("YYYY-MM-DD"); null while it is open. */
  paidOn: string | null;
  /** Whether the issued PDF is stored yet. */
  hasPdf: boolean;
}

/** An address as printed on the payment part. */
export interface InvoiceAddress {
  name: string;
  street: string;
  postalCity: string;
}

/** The QR payment part of an invoice. */
export interface InvoicePayment {
  /** In blocks of four, as printed. */
  iban: string;
  /** Formatted as printed. */
  reference: string;
  /** The text to encode in the Swiss QR code. */
  qrPayload: string;
  creditor: InvoiceAddress;
  /** null if the customer's address is incomplete. */
  debtor: InvoiceAddress | null;
  amountCents: number;
  message: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  orderId: number;
  customer: Customer;
  sale: SaleWithItems;
  /** null if the company profile no longer allows a payment part. */
  payment: InvoicePayment | null;
  paymentError: string | null;
}
