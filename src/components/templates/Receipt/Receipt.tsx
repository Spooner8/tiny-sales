import { Button } from "../../atoms/Button";
import { Select } from "../../atoms/Select";
import { formatArticleCode } from "../../../lib/articleCode";
import { formatChf } from "../../../lib/money/change";
import { applyPrintPageStyle } from "../../../lib/printPage";
import { lineDiscountNote, saleDiscountLabel, vatLabel } from "../../../lib/saleText";
import { formatReceiptNumber, PAYMENT_METHOD_LABELS } from "../../../types/sale";
import { RECEIPT_PAPER_SIZES } from "../../../types/settings";
import type { CompanyProfile } from "../../../types/companyProfile";
import type { SaleWithItems } from "../../../types/sale";
import type { ReceiptPaperSize } from "../../../types/settings";

export interface ReceiptProps {
  sale: SaleWithItems;
  /** Shop details for the header and footer (Einstellungen → Firma). */
  company: CompanyProfile | undefined;
  paperSize: ReceiptPaperSize;
  onPaperSizeChange: (size: ReceiptPaperSize) => void;
  onNewSale: () => void;
}

function applyPrintPageSize(size: ReceiptPaperSize) {
  const margin = size === "A4" ? "15mm" : "10mm";
  applyPrintPageStyle(`@page { size: ${size}; margin: ${margin}; }`);
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

export function Receipt({ sale, company, paperSize, onPaperSizeChange, onNewSale }: ReceiptProps) {
  const { sale: header, items } = sale;
  const hasDiscount = header.discountCents > 0;

  function handlePrint() {
    applyPrintPageSize(paperSize);
    window.print();
  }

  return (
    <div>
      <div className="receipt-controls no-print">
        <label className="receipt-paper-size-label">
          Papiergrösse:
          <Select
            value={paperSize}
            onValueChange={(value) => onPaperSizeChange(value as ReceiptPaperSize)}
            options={RECEIPT_PAPER_SIZES.map((size) => ({ value: size, label: size }))}
            className="receipt-paper-size-select"
          />
        </label>
        <Button type="button" onClick={handlePrint}>
          Quittung drucken
        </Button>
        <Button type="button" variant="secondary" onClick={onNewSale}>
          Neuer Verkauf
        </Button>
      </div>

      <article className={`receipt receipt-${paperSize.toLowerCase()}`}>
        {company && (company.logo || company.name) && (
          <header className="receipt-header">
            {company.logo && <img className="receipt-logo" src={company.logo} alt={company.name} />}
            <address className="receipt-company">
              {company.name && <strong>{company.name}</strong>}
              {company.street && <span>{company.street}</span>}
              {company.postalCity && <span>{company.postalCity}</span>}
              {company.phone && <span>{company.phone}</span>}
              {company.website && <span>{company.website}</span>}
              {company.vatNumber && <span>MWST-Nr. {company.vatNumber}</span>}
            </address>
          </header>
        )}

        <div className="receipt-meta">
          <h1>Quittung</h1>
          <dl>
            <dt>Datum</dt>
            <dd>{formatTimestamp(header.timestamp)}</dd>
            <dt>Beleg-Nr.</dt>
            <dd>{formatReceiptNumber(header.id)}</dd>
            {header.customerOrderId !== null && (
              <>
                <dt>Auftrag</dt>
                <dd>{header.customerOrderId}</dd>
              </>
            )}
            {header.customerName && (
              <>
                <dt>Kunde</dt>
                <dd>
                  {header.customerCompany && (
                    <>
                      {header.customerCompany}
                      <br />
                    </>
                  )}
                  {header.customerName}
                </dd>
              </>
            )}
          </dl>
        </div>

        <table className="receipt-items">
          <thead>
            <tr>
              <th>Artikel</th>
              <th className="receipt-num">Menge</th>
              <th className="receipt-num">Preis</th>
              <th className="receipt-num">Summe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              // Order lines can repeat an article, e.g. with different notes.
              <tr key={index}>
                <td>
                  <span className="receipt-item-name">{item.articleName}</span>
                  <span className="receipt-item-code">
                    {formatArticleCode(item.articleCode)}
                    {item.articleInternalNumber && ` / ${item.articleInternalNumber}`}
                  </span>
                  {lineDiscountNote(item) && <span className="receipt-item-promo">{lineDiscountNote(item)}</span>}
                  {item.note && <span className="receipt-item-note">{item.note}</span>}
                </td>
                <td className="receipt-num">{item.quantity}</td>
                <td className="receipt-num">{formatChf(item.unitPriceCents)}</td>
                <td className="receipt-num">{formatChf(item.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="receipt-totals">
          {hasDiscount && (
            <>
              <dt>Zwischensumme</dt>
              <dd>{formatChf(header.subtotalCents)}</dd>
              <dt>{saleDiscountLabel(header)}</dt>
              <dd>−{formatChf(header.discountCents)}</dd>
            </>
          )}
          <dt className="receipt-grand-total">Total CHF</dt>
          <dd className="receipt-grand-total">{formatChf(header.totalCents)}</dd>
          {vatLabel(header) && (
            <>
              <dt className="receipt-vat">{vatLabel(header)}</dt>
              <dd className="receipt-vat">{formatChf(header.vatCents ?? 0)}</dd>
            </>
          )}
        </dl>

        <dl className="receipt-payment">
          <dt>Bezahlt mit</dt>
          <dd>{PAYMENT_METHOD_LABELS[header.paymentMethod]}</dd>
          {header.paymentMethod === "Cash" && (
            <>
              <dt>Gegeben</dt>
              <dd>{formatChf(header.cashGivenCents ?? 0)}</dd>
              <dt>Rückgeld</dt>
              <dd>{formatChf(header.changeCents ?? 0)}</dd>
            </>
          )}
        </dl>

        {header.pickupNumber && (
          <div className="receipt-pickup">
            <span>Abholnummer</span>
            <span className="receipt-pickup-number">{header.pickupNumber}</span>
          </div>
        )}

        {(company?.receiptThanks || company?.receiptSignature) && (
          <footer className="receipt-footer">
            {company.receiptThanks && <p>{company.receiptThanks}</p>}
            {company.receiptSignature && <p className="receipt-footer-signature">{company.receiptSignature}</p>}
          </footer>
        )}
      </article>
    </div>
  );
}
