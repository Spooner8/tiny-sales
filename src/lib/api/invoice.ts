import { invokeCommand } from "./client";
import type { InvoiceDetail } from "../../types/invoice";

export const invoiceApi = {
  get: (id: number) => invokeCommand<InvoiceDetail>("get_invoice", { id }),
  /** Prints the invoice shown in the window to PDF and stores it, once. */
  storePdf: (id: number) => invokeCommand<void>("store_invoice_pdf", { id }),
  openPdf: (id: number) => invokeCommand<void>("open_invoice_pdf", { id }),
  savePdf: (id: number, path: string) => invokeCommand<void>("save_invoice_pdf", { id, path }),
  setPaidOn: (id: number, paidOn: string | null) => invokeCommand<void>("set_invoice_paid_on", { id, paidOn }),
};
