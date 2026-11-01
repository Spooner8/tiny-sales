import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { QrBillPaymentPart } from "../../organisms/QrBillPaymentPart";
import { formatArticleCode } from "../../../lib/articleCode";
import { formatDate } from "../../../lib/customerOrders";
import { paginateInvoice } from "../../../lib/invoiceLayout";
import type { InvoiceMeasurements, InvoicePageLayout } from "../../../lib/invoiceLayout";
import { formatChf } from "../../../lib/money/change";
import { lineDiscountNote, saleDiscountLabel, vatLabel } from "../../../lib/saleText";
import type { CompanyProfile } from "../../../types/companyProfile";
import { countryName } from "../../../types/customer";
import type { Customer } from "../../../types/customer";
import type { InvoiceDetail } from "../../../types/invoice";

export interface InvoiceDocumentProps {
  detail: InvoiceDetail;
  company: CompanyProfile;
  /** Called once fonts and images are loaded and the pages are final. */
  onReady?: () => void;
}

const MM_PER_PX = 25.4 / 96;

function salutation(customer: Customer): string {
  if (customer.gender === "male") return `Sehr geehrter Herr ${customer.lastName}`;
  if (customer.gender === "female") return `Sehr geehrte Frau ${customer.lastName}`;
  return `Guten Tag ${customer.firstName} ${customer.lastName}`;
}

function recipientName(customer: Customer): string {
  const title = customer.gender === "male" ? "Herr " : customer.gender === "female" ? "Frau " : "";
  return `${title}${customer.firstName} ${customer.lastName}`;
}

async function imagesLoaded(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => (img.onload = img.onerror = resolve)),
    ),
  );
}

function heightMm(element: Element | null): number {
  return element ? element.getBoundingClientRect().height * MM_PER_PX : 0;
}

function measure(root: HTMLElement): InvoiceMeasurements {
  const block = (name: string) => root.querySelector(`[data-measure="${name}"]`);
  const rows = Array.from(root.querySelectorAll('[data-measure="row"]')).map(heightMm);
  return {
    firstHeader: heightMm(block("first")),
    continuationHeader: heightMm(block("continuation")),
    tableOverhead: heightMm(block("table")) - rows.reduce((sum, h) => sum + h, 0),
    rows,
    tail: heightMm(block("tail")),
  };
}

/**
 * The invoice on A4 pages, with the QR payment part at the bottom of the
 * last page - or on a page of its own if there is no room left. The blocks
 * are measured in a hidden copy first and then split into pages, so the
 * printed pages match the ones shown; the stored PDF is printed from this.
 */
export function InvoiceDocument({ detail, company, onReady }: InvoiceDocumentProps) {
  const { invoice, customer, sale, payment } = detail;
  const { sale: header, items } = sale;
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<InvoicePageLayout[] | null>(null);
  const [ready, setReady] = useState(false);

  // Before the first paint, and again once fonts and the logo have loaded
  // and may have changed the heights.
  useLayoutEffect(() => {
    if (measureRef.current) setPages(paginateInvoice(measure(measureRef.current), payment !== null));
  }, [detail, company]);

  useEffect(() => {
    let cancelled = false;
    const root = measureRef.current;
    if (!root) return;
    void Promise.all([document.fonts.ready, imagesLoaded(root)]).then(() => {
      if (cancelled) return;
      setPages(paginateInvoice(measure(root), payment !== null));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [detail, company]);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready]);

  const pageCount = pages?.length ?? 1;
  const senderLine = [company.name, company.street, company.postalCity].filter(Boolean).join(" · ");

  const firstHeader = (
    <>
      <header className="invoice-header">
        {company.logo ? <img className="invoice-logo" src={company.logo} alt={company.name} /> : <span />}
        <address className="invoice-company">
          <strong>{company.name}</strong>
          {company.street && <span>{company.street}</span>}
          {company.postalCity && <span>{company.postalCity}</span>}
          {company.phone && <span>{company.phone}</span>}
          {company.website && <span>{company.website}</span>}
        </address>
      </header>

      <address className="invoice-recipient">
        <span className="invoice-sender-line">{senderLine}</span>
        {customer.company && <span>{customer.company}</span>}
        <span>{recipientName(customer)}</span>
        {customer.street && <span>{customer.street}</span>}
        {(customer.postalCode || customer.city) && (
          <span>{[customer.postalCode, customer.city].filter(Boolean).join(" ")}</span>
        )}
        {/* Abroad, the country goes on the last line in capitals, as the post wants it. */}
        {customer.country !== "CH" && <span>{countryName(customer.country).toUpperCase()}</span>}
      </address>

      <h1 className="invoice-title">Rechnung</h1>
      <dl className="invoice-meta">
        <dt>Rechnungs-Nr.</dt>
        <dd>{invoice.id}</dd>
        <dt>Rechnungsdatum</dt>
        <dd>{formatDate(invoice.createdAt)}</dd>
        <dt>Auftrag</dt>
        <dd>{detail.orderId}</dd>
        <dt>Kunden-Nr.</dt>
        <dd>{customer.id}</dd>
        <dt>Zahlbar bis</dt>
        <dd>{formatDate(invoice.dueDate)}</dd>
        {company.vatNumber && (
          <>
            <dt>MWST-Nr.</dt>
            <dd>{company.vatNumber}</dd>
          </>
        )}
        {/* Always shown, so page 1 is as high when measured as when shown. */}
        <dt>Seite</dt>
        <dd>1 von {pageCount}</dd>
      </dl>

      <p>{salutation(customer)}</p>
      <p>Vielen Dank für Ihren Auftrag. Wir stellen Ihnen folgende Positionen in Rechnung:</p>
    </>
  );

  const continuationHeader = (pageNumber: number) => (
    <div className="invoice-continuation">
      <span>
        {company.name} · Rechnung {invoice.id}
      </span>
      <span>
        Seite {pageNumber} von {pageCount}
      </span>
    </div>
  );

  const itemsTable = (rowIndexes: number[], measuring: boolean) => (
    <table className="invoice-items">
      {/* Fixed widths, so rows wrap the same in the measured copy and on every page. */}
      <colgroup>
        <col className="invoice-col-position" />
        <col />
        <col className="invoice-col-quantity" />
        <col className="invoice-col-price" />
        <col className="invoice-col-amount" />
      </colgroup>
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Artikel</th>
          <th className="invoice-num">Menge</th>
          <th className="invoice-num">Preis</th>
          <th className="invoice-num">Betrag CHF</th>
        </tr>
      </thead>
      <tbody>
        {rowIndexes.map((index) => {
          const item = items[index];
          return (
            <tr key={index} data-measure={measuring ? "row" : undefined}>
              <td>{index + 1}</td>
              <td>
                <span className="invoice-item-name">{item.articleName}</span>
                <span className="invoice-item-detail">
                  Art-Nr. {formatArticleCode(item.articleCode)}
                  {item.articleInternalNumber && ` / ${item.articleInternalNumber}`}
                </span>
                {item.note && <span className="invoice-item-detail">{item.note}</span>}
                {lineDiscountNote(item) && <span className="invoice-item-detail">{lineDiscountNote(item)}</span>}
              </td>
              <td className="invoice-num">{item.quantity}</td>
              <td className="invoice-num">{formatChf(item.unitPriceCents)}</td>
              <td className="invoice-num">{formatChf(item.lineTotalCents)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const tail = (
    <>
      <dl className="invoice-totals">
        {header.discountCents > 0 && (
          <>
            <dt>Zwischensumme</dt>
            <dd>{formatChf(header.subtotalCents)}</dd>
            <dt>{saleDiscountLabel(header)}</dt>
            <dd>−{formatChf(header.discountCents)}</dd>
          </>
        )}
        <dt className="invoice-grand-total">Total CHF</dt>
        <dd className="invoice-grand-total">{formatChf(header.totalCents)}</dd>
        {vatLabel(header) && (
          <>
            <dt className="invoice-vat">{vatLabel(header)}</dt>
            <dd className="invoice-vat">{formatChf(header.vatCents ?? 0)}</dd>
          </>
        )}
      </dl>

      <p>Bitte überweisen Sie den Betrag bis am {formatDate(invoice.dueDate)} mit dem QR-Zahlteil.</p>
      {(company.receiptThanks || company.receiptSignature) && (
        <p className="invoice-closing">
          {company.receiptThanks && <span>{company.receiptThanks}</span>}
          {company.receiptSignature && <strong>{company.receiptSignature}</strong>}
        </p>
      )}
    </>
  );

  const allRows = items.map((_, index) => index);

  return (
    <div className="invoice-document">
      <div className="invoice-measure no-print" ref={measureRef} aria-hidden="true">
        <div className="invoice-block" data-measure="first">
          {firstHeader}
        </div>
        <div className="invoice-block" data-measure="continuation">
          {continuationHeader(1)}
        </div>
        <div className="invoice-block" data-measure="table">
          {itemsTable(allRows, true)}
        </div>
        <div className="invoice-block" data-measure="tail">
          {tail}
        </div>
      </div>

      {pages?.map((page, pageIndex) => (
        <section key={pageIndex} className="invoice-page">
          <div className="invoice-block">{page.first ? firstHeader : continuationHeader(pageIndex + 1)}</div>
          {page.rows.length > 0 && <div className="invoice-block">{itemsTable(page.rows, false)}</div>}
          {page.tail && <div className="invoice-block">{tail}</div>}
          {page.payment && payment && <QrBillPaymentPart payment={payment} />}
        </section>
      ))}
    </div>
  );
}
