import { save } from "@tauri-apps/plugin-dialog";
import { useMutation } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Badge } from "../components/atoms/Badge";
import { Button } from "../components/atoms/Button";
import { PageHeader } from "../components/molecules/PageHeader";
import { InvoiceDocument } from "../components/templates/InvoiceDocument";
import { useCompanyProfileQuery } from "../hooks/useCompanyProfile";
import { useInvoiceQuery, useSetInvoicePaidOn, useStoreInvoicePdf } from "../hooks/useInvoice";
import { invoiceApi } from "../lib/api/invoice";
import { formatDate } from "../lib/customerOrders";
import { customerLabel, customerName } from "../types/customer";
import { formatReceiptNumber } from "../types/sale";
import { applyPrintPageStyle } from "../lib/printPage";
import { withPrintTheme } from "../lib/theme";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function InvoicePage() {
  const { invoiceId } = useParams({ from: "/invoices/$invoiceId" });
  const id = Number(invoiceId);
  const { data: detail, error } = useInvoiceQuery(id);
  const { data: company } = useCompanyProfileQuery();
  const storePdf = useStoreInvoicePdf();
  const setPaidOn = useSetInvoicePaidOn();
  const openPdf = useMutation({ mutationFn: () => invoiceApi.openPdf(id) });
  const savePdf = useMutation({
    mutationFn: async () => {
      const path = await save({
        title: "Rechnung speichern",
        defaultPath: `Rechnung-${id}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (path) await invoiceApi.savePdf(id, path);
    },
  });
  // Fonts and logo loaded, pages laid out: what the PDF will show.
  const [documentReady, setDocumentReady] = useState(false);
  const storeStarted = useRef(false);

  const canStore = detail !== undefined && !detail.invoice.hasPdf && detail.payment !== null && company !== undefined;

  async function storeInvoicePdf() {
    applyPrintPageStyle("@page { size: A4; margin: 0; }");
    await nextFrame();
    await withPrintTheme(() => storePdf.mutateAsync(id)).catch(() => {});
  }

  // The PDF is created once, right after the invoice: it is what was issued
  // and is never changed afterwards.
  useEffect(() => {
    if (!canStore || !documentReady || storeStarted.current) return;
    storeStarted.current = true;
    void storeInvoicePdf();
  }, [canStore, documentReady]);

  if (error) {
    return (
      <section>
        <PageHeader title={`Rechnung ${invoiceId}`} />
        <p className="field-error">{error.message}</p>
      </section>
    );
  }
  if (!detail || !company) return <p>Wird geladen...</p>;

  const { invoice } = detail;
  const pdfBusy = storePdf.isPending || (canStore && !storePdf.isError);

  return (
    <section>
      <PageHeader title={`Rechnung ${invoice.id}`} />

      <div className="invoice-controls no-print">
        <div className="invoice-controls-row">
          {invoice.paidOn ? (
            <Badge tone="success">Bezahlt am {formatDate(invoice.paidOn)}</Badge>
          ) : (
            <Badge tone="warning">Offen · zahlbar bis {formatDate(invoice.dueDate)}</Badge>
          )}
          <span className="muted">
            {customerLabel(customerName(detail.customer), detail.customer.company)} ·{" "}
            <Link to="/orders/$orderId" params={{ orderId: String(detail.orderId) }}>
              Auftrag {detail.orderId}
            </Link>{" "}
            · Beleg-Nr. {formatReceiptNumber(invoice.saleId)}
          </span>
        </div>

        <div className="invoice-controls-row">
          <Button type="button" disabled={!invoice.hasPdf || openPdf.isPending} onClick={() => openPdf.mutate()}>
            PDF öffnen
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!invoice.hasPdf || savePdf.isPending}
            onClick={() => savePdf.mutate()}
          >
            PDF speichern unter...
          </Button>
          {invoice.paidOn ? (
            <Button
              type="button"
              variant="secondary"
              disabled={setPaidOn.isPending}
              onClick={() => setPaidOn.mutate({ id, paidOn: null })}
            >
              Wieder als offen markieren
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={setPaidOn.isPending}
              onClick={() => setPaidOn.mutate({ id, paidOn: todayIso() })}
            >
              Als bezahlt markieren (heute)
            </Button>
          )}
        </div>

        {pdfBusy && <p className="muted">PDF wird erstellt...</p>}
        {storePdf.error && (
          <p className="field-error">
            {storePdf.error.message}{" "}
            <Button type="button" size="sm" variant="secondary" onClick={() => void storeInvoicePdf()}>
              Erneut versuchen
            </Button>
          </p>
        )}
        {!invoice.hasPdf && detail.paymentError && <p className="field-error">{detail.paymentError}</p>}
        {invoice.hasPdf && (
          <p className="muted">
            Unten die Ansicht mit den aktuellen Firmendaten. Das PDF ist die Rechnung, wie sie ausgestellt wurde.
          </p>
        )}
        {[openPdf.error, savePdf.error, setPaidOn.error].map(
          (err) => err && <p key={err.message} className="field-error">{err.message}</p>,
        )}
      </div>

      <InvoiceDocument detail={detail} company={company} onReady={() => setDocumentReady(true)} />
    </section>
  );
}
