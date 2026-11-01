import { QRCodeSVG } from "qrcode.react";

import type { InvoiceAddress, InvoicePayment } from "../../../types/invoice";

export interface QrBillPaymentPartProps {
  payment: InvoicePayment;
}

// The Swiss cross in the middle of the QR code: 7 mm of the 46 mm code.
const QR_SIZE = 460;
const CROSS_SIZE = 70;
const SWISS_CROSS = `data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>" +
    "<rect width='20' height='20' fill='white'/>" +
    "<rect x='1' y='1' width='18' height='18' fill='black'/>" +
    "<rect x='8.4' y='4.3' width='3.2' height='11.4' fill='white'/>" +
    "<rect x='4.3' y='8.4' width='11.4' height='3.2' fill='white'/>" +
    "</svg>",
)}`;

/** e.g. "1 949.75": the QR-bill wants a space as thousands separator. */
function formatAmount(cents: number): string {
  const [francs, rappen] = (cents / 100).toFixed(2).split(".");
  return `${francs.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${rappen}`;
}

function Address({ address }: { address: InvoiceAddress }) {
  return (
    <>
      <span>{address.name}</span>
      <span>{address.street}</span>
      <span>{address.postalCity}</span>
    </>
  );
}

/** Empty field with corner marks, for the payer to fill in by hand. */
function BlankField({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 12V0H12 M88 0H100V12 M100 88V100H88 M12 100H0V88"
        fill="none"
        stroke="black"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The Swiss QR-bill payment part (A6 landscape, 210 × 105 mm) with receipt,
 * laid out after the SIX style guide.
 */
export function QrBillPaymentPart({ payment }: QrBillPaymentPartProps) {
  const amount = payment.amountCents > 0 ? formatAmount(payment.amountCents) : null;
  return (
    <div className="qr-bill">
      <section className="qr-bill-receipt">
        <h2 className="qr-bill-title">Empfangsschein</h2>
        <div className="qr-bill-receipt-info">
          <h3>Konto / Zahlbar an</h3>
          <span>{payment.iban}</span>
          <Address address={payment.creditor} />
          <h3>Referenz</h3>
          <span>{payment.reference}</span>
          <h3>Zahlbar durch</h3>
          {payment.debtor ? <Address address={payment.debtor} /> : <BlankField className="qr-bill-blank-receipt-debtor" />}
        </div>
        <div className="qr-bill-amount">
          <div>
            <h3>Währung</h3>
            <span>CHF</span>
          </div>
          <div>
            <h3>Betrag</h3>
            {amount ? <span>{amount}</span> : <BlankField className="qr-bill-blank-receipt-amount" />}
          </div>
        </div>
        <div className="qr-bill-acceptance">Annahmestelle</div>
      </section>

      <section className="qr-bill-payment">
        <div className="qr-bill-payment-left">
          <h2 className="qr-bill-title">Zahlteil</h2>
          <QRCodeSVG
            value={payment.qrPayload}
            size={QR_SIZE}
            level="M"
            marginSize={0}
            className="qr-bill-code"
            imageSettings={{ src: SWISS_CROSS, width: CROSS_SIZE, height: CROSS_SIZE, excavate: true }}
          />
          <div className="qr-bill-amount">
            <div>
              <h3>Währung</h3>
              <span>CHF</span>
            </div>
            <div>
              <h3>Betrag</h3>
              {amount ? <span>{amount}</span> : <BlankField className="qr-bill-blank-payment-amount" />}
            </div>
          </div>
        </div>
        <div className="qr-bill-payment-info">
          <h3>Konto / Zahlbar an</h3>
          <span>{payment.iban}</span>
          <Address address={payment.creditor} />
          <h3>Referenz</h3>
          <span>{payment.reference}</span>
          <h3>Zusätzliche Informationen</h3>
          <span>{payment.message}</span>
          <h3>{payment.debtor ? "Zahlbar durch" : "Zahlbar durch (Name/Adresse)"}</h3>
          {payment.debtor ? <Address address={payment.debtor} /> : <BlankField className="qr-bill-blank-payment-debtor" />}
        </div>
      </section>
    </div>
  );
}
