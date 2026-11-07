import { invokeCommand } from "./client";
import type { InvoiceDetail, InvoiceOverview, InvoiceReminder, InvoiceReminderDetail } from "../../types/invoice";

export const invoiceApi = {
  list: () => invokeCommand<InvoiceOverview[]>("list_invoices"),
  get: (id: number) => invokeCommand<InvoiceDetail>("get_invoice", { id }),
  /** Prints the invoice shown in the window to PDF and stores it, once. */
  storePdf: (id: number) => invokeCommand<void>("store_invoice_pdf", { id }),
  openPdf: (id: number) => invokeCommand<void>("open_invoice_pdf", { id }),
  savePdf: (id: number, path: string) => invokeCommand<void>("save_invoice_pdf", { id, path }),
  setPaidOn: (id: number, paidOn: string | null) => invokeCommand<void>("set_invoice_paid_on", { id, paidOn }),
  createReminder: (invoiceId: number) => invokeCommand<InvoiceReminder>("create_invoice_reminder", { invoiceId }),
  getReminder: (id: number) => invokeCommand<InvoiceReminderDetail>("get_invoice_reminder", { id }),
  /** Prints the reminder shown in the window to PDF and stores it, once. */
  storeReminderPdf: (id: number) => invokeCommand<void>("store_invoice_reminder_pdf", { id }),
  openReminderPdf: (id: number) => invokeCommand<void>("open_invoice_reminder_pdf", { id }),
  saveReminderPdf: (id: number, path: string) => invokeCommand<void>("save_invoice_reminder_pdf", { id, path }),
};
