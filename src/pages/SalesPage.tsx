import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { DatePicker } from "../components/molecules/DatePicker";
import { Modal } from "../components/molecules/Modal";
import { PageHeader } from "../components/molecules/PageHeader";
import { SaleReturnPanel } from "../components/organisms/SaleReturnPanel";
import { SalesTable } from "../components/organisms/SalesTable";
import { useCreateSaleReturn, useSaleQuery, useSaleReturnsQuery, useSalesQuery } from "../hooks/useSale";
import { customerLabel } from "../types/customer";
import { formatReceiptNumber } from "../types/sale";

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SalesPage() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: entries, isLoading } = useSalesQuery(from, to);
  const { data: saleDetail } = useSaleQuery(selectedId);
  const { data: returns } = useSaleReturnsQuery(selectedId);
  const createReturn = useCreateSaleReturn();

  function showDetails(saleId: number | null) {
    setSelectedId(saleId);
    createReturn.reset();
  }

  return (
    <section>
      <PageHeader title="Verkäufe" />

      {isLoading && <p>Wird geladen...</p>}

      {/* Always rendered: the date range lives in its toolbar and must stay
          usable while a new range is loading. */}
      <SalesTable
        entries={entries ?? []}
        selectedId={selectedId}
        onSelect={showDetails}
        toolbar={
          <div className="toolbar-date-range">
            <label htmlFor="sales-from">Von</label>
            <DatePicker id="sales-from" value={from} onValueChange={setFrom} />
            <label htmlFor="sales-to">Bis</label>
            <DatePicker id="sales-to" value={to} onValueChange={setTo} />
          </div>
        }
      />

      {/* Over the list, so it shows wherever the row is and closes with X or Escape. */}
      <Modal
        open={selectedId !== null}
        title={selectedId !== null ? `Beleg-Nr. ${formatReceiptNumber(selectedId)}` : ""}
        onClose={() => showDetails(null)}
        size="lg"
      >
        {!saleDetail || !returns ? (
          <p>Wird geladen...</p>
        ) : (
          <>
            {saleDetail.sale.customerOrderId !== null && (
              <p className="sale-order-links">
                {customerLabel(saleDetail.sale.customerName ?? "", saleDetail.sale.customerCompany)} ·{" "}
                <Link to="/orders/$orderId" params={{ orderId: String(saleDetail.sale.customerOrderId) }}>
                  Auftrag {saleDetail.sale.customerOrderId}
                </Link>
                {saleDetail.sale.invoiceId !== null && (
                  <>
                    {" · "}
                    <Link to="/invoices/$invoiceId" params={{ invoiceId: String(saleDetail.sale.invoiceId) }}>
                      Rechnung {saleDetail.sale.invoiceId} ({saleDetail.sale.invoicePaidOn ? "bezahlt" : "offen"})
                    </Link>
                  </>
                )}
              </p>
            )}
            <SaleReturnPanel
              // A new panel per sale, so no input of the previous one is kept.
              key={saleDetail.sale.id}
              sale={saleDetail}
              existingReturns={returns}
              submitting={createReturn.isPending}
              errorMessage={createReturn.error?.message}
              onSubmit={({ items, refundMethod }) => {
                createReturn.mutate({ saleId: saleDetail.sale.id, refundMethod, items });
              }}
            />
          </>
        )}
      </Modal>
    </section>
  );
}
