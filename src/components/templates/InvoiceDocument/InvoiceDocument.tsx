import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { DocumentLetterhead } from "../../organisms/DocumentLetterhead";
import { QrBillPaymentPart } from "../../organisms/QrBillPaymentPart";
import { formatArticleCode } from "../../../lib/articleCode";
import { formatDate } from "../../../lib/customerOrders";
import { paginateInvoice } from "../../../lib/invoiceLayout";
import type { InvoiceMeasurements, InvoicePageLayout } from "../../../lib/invoiceLayout";
import { formatChf } from "../../../lib/money/change";
import { documentAssetsLoaded } from "../../../lib/printPage";
import { customerSalutation, lineDiscountNote, saleDiscountLabel, vatLabel } from "../../../lib/saleText";
import type { CompanyProfile } from "../../../types/companyProfile";
import { formatInvoiceNumber } from "../../../types/invoice";
import type { InvoiceDetail } from "../../../types/invoice";

export interface InvoiceDocumentProps {
  detail: InvoiceDetail;
  company: CompanyProfile;
  /** Called once fonts and images are loaded and the pages are final. */
  onReady?: () => void;
}

const MM_PER_PX = 25.4 / 96;

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
    void documentAssetsLoaded(root).then(() => {
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

  const firstHeader = (
    <>
      <DocumentLetterhead company={company} customer={customer} />

      <h1 className="invoice-title">Rechnung</h1>
      <dl className="invoice-meta">
        <dt>Rechnungs-Nr.</dt>
        <dd>{formatInvoiceNumber(invoice.id)}</dd>
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

      <p>{customerSalutation(customer)}</p>
      <p>Vielen Dank für Ihren Auftrag. Wir stellen Ihnen folgende Positionen in Rechnung:</p>
    </>
  );

  const continuationHeader = (pageNumber: number) => (
    <div className="invoice-continuation">
      <span>
        {company.name} · Rechnung {formatInvoiceNumber(invoice.id)}
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
