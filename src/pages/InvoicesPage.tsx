import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "../components/molecules/PageHeader";
import { InvoiceTable } from "../components/organisms/InvoiceTable";
import { Checkbox } from "../components/ui/checkbox";
import { useCreateInvoiceReminder, useInvoicesQuery, useSetInvoicePaidOn } from "../hooks/useInvoice";
import { confirmAction } from "../lib/confirm";
import { todayIso } from "../lib/customerOrders";
import { nextReminderQuestion } from "../types/invoice";
import type { InvoiceOverview } from "../types/invoice";

export function InvoicesPage() {
  const navigate = useNavigate();
  const { data: invoices, isLoading } = useInvoicesQuery();
  const setPaidOn = useSetInvoicePaidOn();
  const createReminder = useCreateInvoiceReminder();
  const [showSettled, setShowSettled] = useState(false);

  // What needs watching: the overdue ones first, then by deadline.
  const visibleInvoices = (invoices ?? [])
    .filter((i) => showSettled || i.status === "open" || i.status === "overdue")
    .sort((a, b) => Number(b.status === "overdue") - Number(a.status === "overdue") || a.dueDate.localeCompare(b.dueDate));

  async function remind(invoice: InvoiceOverview) {
    if (!(await confirmAction(nextReminderQuestion(invoice), "Erstellen"))) return;
    try {
      const reminder = await createReminder.mutateAsync(invoice.id);
      void navigate({
        to: "/invoices/$invoiceId/reminders/$reminderId",
        params: { invoiceId: String(invoice.id), reminderId: String(reminder.id) },
      });
    } catch {
      // Shown below via createReminder.error.
    }
  }

  const errorMessage = createReminder.error?.message ?? setPaidOn.error?.message;

  return (
    <section>
      <PageHeader title="Rechnungen" />

      {isLoading && <p>Wird geladen...</p>}

      {invoices && (
        <InvoiceTable
          invoices={visibleInvoices}
          busy={createReminder.isPending || setPaidOn.isPending}
          onOpen={(invoice) =>
            void navigate({ to: "/invoices/$invoiceId", params: { invoiceId: String(invoice.id) } })
          }
          onRemind={(invoice) => void remind(invoice)}
          onMarkPaid={(invoice) => setPaidOn.mutate({ id: invoice.id, paidOn: todayIso() })}
          toolbar={
            <div className="show-inactive-toggle">
              <Checkbox id="show-settled" checked={showSettled} onCheckedChange={setShowSettled} />
              <label htmlFor="show-settled">Auch bezahlte anzeigen</label>
            </div>
          }
        />
      )}

      {errorMessage && <p className="field-error">{errorMessage}</p>}
    </section>
  );
}
