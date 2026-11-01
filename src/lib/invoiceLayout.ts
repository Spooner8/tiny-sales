// Splits an invoice into A4 pages. The blocks are measured on screen first
// (in mm), so the pages print exactly as they are shown.

/** Writable height of a page: 297 mm minus 15 mm margin at top and bottom. */
const PAGE_CONTENT_MM = 267;
/** On the page with the payment part, the content ends 5 mm above it. */
const PAGE_CONTENT_ABOVE_PAYMENT_MM = 297 - 105 - 5 - 15;
/** Leeway for rounding between measuring and printing. */
const SAFETY_MM = 3;

export interface InvoiceMeasurements {
  /** Everything on page 1 above the items: header, address, title, intro. */
  firstHeader: number;
  /** The short header of the following pages. */
  continuationHeader: number;
  /** Table without its rows: head and margins. */
  tableOverhead: number;
  rows: number[];
  /** Totals, payment note and closing. */
  tail: number;
}

export interface InvoicePageLayout {
  /** First page with the full header, otherwise the short one. */
  first: boolean;
  /** Indexes of the item rows on this page. */
  rows: number[];
  tail: boolean;
  payment: boolean;
}

export function paginateInvoice(m: InvoiceMeasurements, withPayment: boolean): InvoicePageLayout[] {
  const capacity = PAGE_CONTENT_MM - SAFETY_MM;
  const pages: InvoicePageLayout[] = [];
  let page: InvoicePageLayout = { first: true, rows: [], tail: false, payment: false };
  let used = m.firstHeader + m.tableOverhead;

  function nextPage(usedByHeader: number) {
    pages.push(page);
    page = { first: false, rows: [], tail: false, payment: false };
    used = m.continuationHeader + usedByHeader;
  }

  m.rows.forEach((height, index) => {
    // A row too high for any page still goes somewhere instead of looping.
    if (page.rows.length > 0 && used + height > capacity) nextPage(m.tableOverhead);
    page.rows.push(index);
    used += height;
  });

  if (used + m.tail > capacity) nextPage(0);
  page.tail = true;
  used += m.tail;

  if (withPayment) {
    if (used <= PAGE_CONTENT_ABOVE_PAYMENT_MM - SAFETY_MM) {
      page.payment = true;
    } else {
      nextPage(0);
      page.payment = true;
    }
  }
  pages.push(page);
  return pages;
}
