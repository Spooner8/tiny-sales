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

/** Overdue counts from the latest deadline: that of the last reminder, if any. */
export type InvoiceStatus = "open" | "overdue" | "paid" | "refunded";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: "Offen",
  overdue: "Überfällig",
  paid: "Bezahlt",
  refunded: "Retourniert",
};

export const INVOICE_STATUS_TONES: Record<InvoiceStatus, "warning" | "destructive" | "success" | "neutral"> = {
  open: "warning",
  overdue: "destructive",
  paid: "success",
  refunded: "neutral",
};

export const REMINDER_LEVEL_LABELS: Record<number, string> = {
  1: "Zahlungserinnerung",
  2: "1. Mahnung",
  3: "2. Mahnung",
};

/** One row of the invoice overview. */
export interface InvoiceOverview {
  id: number;
  saleId: number;
  orderId: number;
  customerName: string;
  customerCompany: string | null;
  /** Production status of the order. */
  orderStatus: string;
  createdAt: string;
  /** The latest deadline: that of the last reminder, or of the invoice. */
  dueDate: string;
  paidOn: string | null;
  totalCents: number;
  /** Refunds booked as returns of this sale. */
  refundedCents: number;
  /** Sum of the reminder fees so far. */
  feesCents: number;
  /** What is still owed: total - refunds + fees. */
  outstandingCents: number;
  /** Highest reminder level so far, 0 if none. */
  reminderLevel: number;
  status: InvoiceStatus;
  /** Overdue, and not all reminder levels are used yet. */
  canRemind: boolean;
}

/** A reminder as issued. */
export interface InvoiceReminder {
  id: number;
  invoiceId: number;
  /** 1 = payment reminder, 2 and 3 = first and second dunning letter. */
  level: number;
  createdAt: string;
  /** The new payment deadline ("YYYY-MM-DD"). */
  dueDate: string;
  /** The fee added by this reminder. */
  feeCents: number;
  /** What the customer is asked to pay, including all fees so far. */
  amountCents: number;
  /** Whether the issued PDF is stored yet. */
  hasPdf: boolean;
}

/** The question before issuing the next reminder of an invoice. */
export function nextReminderQuestion(invoice: InvoiceOverview): string {
  const label = REMINDER_LEVEL_LABELS[invoice.reminderLevel + 1];
  return `${label} für Rechnung ${invoice.id} erstellen?\n\nSie erhält eine neue Zahlungsfrist und kann danach nicht mehr geändert werden.`;
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
  overview: InvoiceOverview;
  reminders: InvoiceReminder[];
  orderId: number;
  customer: Customer;
  sale: SaleWithItems;
  /** null if the company profile no longer allows a payment part. */
  payment: InvoicePayment | null;
  paymentError: string | null;
}

/** Everything needed to render a reminder, with the sums as they were when it was issued. */
export interface InvoiceReminderDetail {
  reminder: InvoiceReminder;
  invoice: Invoice;
  /** When the previous reminder went out. */
  previousReminderAt: string | null;
  customer: Customer;
  totalCents: number;
  /** Refunds deducted when the reminder was issued. */
  refundedCents: number;
  /** All fees up to and including this reminder. */
  feesCents: number;
  /** null if the company profile no longer allows a payment part. */
  payment: InvoicePayment | null;
  paymentError: string | null;
}
