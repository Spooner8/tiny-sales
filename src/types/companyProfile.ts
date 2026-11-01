/** The shop's own details, printed on receipts and invoices and shown in the menu. */
export interface CompanyProfile {
  name: string;
  street: string;
  /** Postal code and city in one line, e.g. "8000 Zürich". */
  postalCity: string;
  phone: string;
  website: string;
  vatNumber: string;
  /** First footer line on the receipt, e.g. a thank-you. */
  receiptThanks: string;
  /** Second, highlighted footer line. */
  receiptSignature: string;
  /** Logo for receipt and menu as a data URL. */
  logo: string | null;
  /** Optional square mark for the collapsed menu as a data URL. */
  logoMark: string | null;
  /** Account for the QR payment part of invoices (IBAN or QR-IBAN). */
  iban: string;
  /** Payment term of invoices in days. */
  invoicePaymentDays: number;
  /** VAT rate for new sales in percent; 0 shows no VAT. */
  vatRatePercent: number;
}
