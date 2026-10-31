export const RECEIPT_PAPER_SIZES = ["A4", "A5"] as const;
export type ReceiptPaperSize = (typeof RECEIPT_PAPER_SIZES)[number];
