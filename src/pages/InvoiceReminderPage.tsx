import { save } from "@tauri-apps/plugin-dialog";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "../components/atoms/Button";
import { PageHeader } from "../components/molecules/PageHeader";
import { ReminderDocument } from "../components/templates/ReminderDocument";
import { useCompanyProfileQuery } from "../hooks/useCompanyProfile";
import { useInvoiceReminderQuery, useStoreInvoiceReminderPdf } from "../hooks/useInvoice";
import { invoiceApi } from "../lib/api/invoice";
import { printDocumentToPdf } from "../lib/printPage";
import { REMINDER_LEVEL_LABELS } from "../types/invoice";

export function InvoiceReminderPage() {
  const navigate = useNavigate();
  const { invoiceId, reminderId } = useParams({ from: "/invoices/$invoiceId/reminders/$reminderId" });
  const id = Number(reminderId);
  const { data: detail, error } = useInvoiceReminderQuery(id);
  const { data: company } = useCompanyProfileQuery();
  const storePdf = useStoreInvoiceReminderPdf();
  const openPdf = useMutation({ mutationFn: () => invoiceApi.openReminderPdf(id) });
  const savePdf = useMutation({
    mutationFn: async () => {
      if (!detail) return;
      const path = await save({
        title: "Mahnung speichern",
        defaultPath: `Mahnung-${detail.invoice.id}-${detail.reminder.level}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (path) await invoiceApi.saveReminderPdf(id, path);
    },
  });
  // Fonts and logo loaded: what the PDF will show.
  const [documentReady, setDocumentReady] = useState(false);
  const storeStarted = useRef(false);

  const canStore = detail !== undefined && !detail.reminder.hasPdf && detail.payment !== null && company !== undefined;

  function storeReminderPdf() {
    return printDocumentToPdf(() => storePdf.mutateAsync(id)).catch(() => {});
  }

  // Like the invoice's: created once and never changed afterwards.
  useEffect(() => {
    if (!canStore || !documentReady || storeStarted.current) return;
    storeStarted.current = true;
    void storeReminderPdf();
  }, [canStore, documentReady]);

  const backToInvoice = (
    <Button
      variant="secondary"
      onClick={() => void navigate({ to: "/invoices/$invoiceId", params: { invoiceId } })}
    >
      Zur Rechnung
    </Button>
  );

  if (error) {
    return (
      <section>
        <PageHeader title="Mahnung" action={backToInvoice} />
        <p className="field-error">{error.message}</p>
      </section>
    );
  }
  if (!detail || !company) return <p>Wird geladen...</p>;

  const { reminder } = detail;
  const pdfBusy = storePdf.isPending || (canStore && !storePdf.isError);

  return (
    <section>
      <PageHeader
        title={`${REMINDER_LEVEL_LABELS[reminder.level]} zu Rechnung ${detail.invoice.id}`}
        action={backToInvoice}
      />

      <div className="invoice-controls no-print">
        <div className="invoice-controls-row">
          <Button type="button" disabled={!reminder.hasPdf || openPdf.isPending} onClick={() => openPdf.mutate()}>
            PDF öffnen
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!reminder.hasPdf || savePdf.isPending}
            onClick={() => savePdf.mutate()}
          >
            PDF speichern unter...
          </Button>
        </div>

        {pdfBusy && <p className="muted">PDF wird erstellt...</p>}
        {storePdf.error && (
          <p className="field-error">
            {storePdf.error.message}{" "}
            <Button type="button" size="sm" variant="secondary" onClick={() => void storeReminderPdf()}>
              Erneut versuchen
            </Button>
          </p>
        )}
        {!reminder.hasPdf && detail.paymentError && <p className="field-error">{detail.paymentError}</p>}
        {reminder.hasPdf && (
          <p className="muted">
            Unten die Ansicht mit den aktuellen Firmendaten. Das PDF ist die Mahnung, wie sie ausgestellt wurde.
          </p>
        )}
        {[openPdf.error, savePdf.error].map((err) => err && <p key={err.message} className="field-error">{err.message}</p>)}
      </div>

      <ReminderDocument detail={detail} company={company} onReady={() => setDocumentReady(true)} />
    </section>
  );
}
