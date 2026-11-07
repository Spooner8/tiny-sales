import { useEffect, useRef } from "react";

import { DocumentLetterhead } from "../../organisms/DocumentLetterhead";
import { QrBillPaymentPart } from "../../organisms/QrBillPaymentPart";
import { formatDate } from "../../../lib/customerOrders";
import { formatChf } from "../../../lib/money/change";
import { documentAssetsLoaded } from "../../../lib/printPage";
import { customerSalutation } from "../../../lib/saleText";
import type { CompanyProfile } from "../../../types/companyProfile";
import { REMINDER_LEVEL_LABELS } from "../../../types/invoice";
import type { InvoiceReminderDetail } from "../../../types/invoice";

export interface ReminderDocumentProps {
  detail: InvoiceReminderDetail;
  company: CompanyProfile;
  /** Called once fonts and images are loaded. */
  onReady?: () => void;
}

function letterText(detail: InvoiceReminderDetail): string {
  const { invoice, reminder, previousReminderAt } = detail;
  const invoiceRef = `Rechnung Nr. ${invoice.id} vom ${formatDate(invoice.createdAt)}`;
  const previous = previousReminderAt ? `vom ${formatDate(previousReminderAt)} ` : "";
  const deadline = formatDate(reminder.dueDate);
  if (reminder.level === 1) {
    return (
      `Sicher ist es Ihrer Aufmerksamkeit entgangen: Unsere ${invoiceRef} ist noch offen. ` +
      `Wir bitten Sie, den Betrag bis am ${deadline} zu überweisen. ` +
      "Falls Sie in der Zwischenzeit bezahlt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos."
    );
  }
  if (reminder.level === 2) {
    return (
      `Trotz unserer Zahlungserinnerung ${previous}konnten wir für die ${invoiceRef} noch keinen Zahlungseingang feststellen. ` +
      `Wir bitten Sie, den Betrag bis am ${deadline} zu überweisen. ` +
      "Falls Sie in der Zwischenzeit bezahlt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos."
    );
  }
  return (
    `Trotz unserer 1. Mahnung ${previous}ist die ${invoiceRef} weiterhin offen. ` +
    `Wir fordern Sie auf, den Betrag bis spätestens am ${deadline} zu überweisen. ` +
    "Andernfalls behalten wir uns weitere Schritte vor."
  );
}

/**
 * A reminder on one A4 page with the QR payment part at the bottom. Printed
 * as it is shown; the stored PDF is printed from this.
 */
export function ReminderDocument({ detail, company, onReady }: ReminderDocumentProps) {
  const { reminder, invoice, customer, payment } = detail;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const root = rootRef.current;
    if (!root) return;
    void documentAssetsLoaded(root).then(() => {
      if (!cancelled) onReady?.();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="invoice-document" ref={rootRef}>
      <section className="invoice-page">
        <div className="invoice-block">
          <DocumentLetterhead company={company} customer={customer} />

          <h1 className="invoice-title">{REMINDER_LEVEL_LABELS[reminder.level]}</h1>
          <dl className="invoice-meta">
            <dt>Datum</dt>
            <dd>{formatDate(reminder.createdAt)}</dd>
            <dt>Rechnungs-Nr.</dt>
            <dd>{invoice.id}</dd>
            <dt>Rechnungsdatum</dt>
            <dd>{formatDate(invoice.createdAt)}</dd>
            <dt>Kunden-Nr.</dt>
            <dd>{customer.id}</dd>
            <dt>Zahlbar bis</dt>
            <dd>{formatDate(reminder.dueDate)}</dd>
          </dl>

          <p>{customerSalutation(customer)}</p>
          <p>{letterText(detail)}</p>

          <dl className="invoice-totals">
            <dt>Rechnungsbetrag</dt>
            <dd>{formatChf(detail.totalCents)}</dd>
            {detail.refundedCents > 0 && (
              <>
                <dt>Retouren</dt>
                <dd>−{formatChf(detail.refundedCents)}</dd>
              </>
            )}
            {detail.feesCents > 0 && (
              <>
                <dt>Mahngebühren</dt>
                <dd>{formatChf(detail.feesCents)}</dd>
              </>
            )}
            <dt className="invoice-grand-total">Zu bezahlen CHF</dt>
            <dd className="invoice-grand-total">{formatChf(reminder.amountCents)}</dd>
          </dl>

          {company.receiptSignature && (
            <p className="invoice-closing">
              <span>Freundliche Grüsse</span>
              <strong>{company.receiptSignature}</strong>
            </p>
          )}
        </div>
        {payment && <QrBillPaymentPart payment={payment} />}
      </section>
    </div>
  );
}
