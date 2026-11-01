import { useState } from "react";

import { DatePicker } from "../components/molecules/DatePicker";
import { PageHeader } from "../components/molecules/PageHeader";
import { SaleReturnPanel } from "../components/organisms/SaleReturnPanel";
import { SalesTable } from "../components/organisms/SalesTable";
import { useCreateSaleReturn, useSaleQuery, useSaleReturnsQuery, useSalesQuery } from "../hooks/useSale";

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

  return (
    <section>
      <PageHeader title="Verkäufe" />

      {isLoading && <p>Wird geladen...</p>}

      {/* Always rendered: the date range lives in its toolbar and must stay
          usable while a new range is loading. */}
      <SalesTable
        entries={entries ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
        toolbar={
          <div className="toolbar-date-range">
            <label htmlFor="sales-from">Von</label>
            <DatePicker id="sales-from" value={from} onValueChange={setFrom} />
            <label htmlFor="sales-to">Bis</label>
            <DatePicker id="sales-to" value={to} onValueChange={setTo} />
          </div>
        }
      />

      {saleDetail && returns && (
        <div style={{ marginTop: 24 }}>
          <SaleReturnPanel
            sale={saleDetail}
            existingReturns={returns}
            submitting={createReturn.isPending}
            errorMessage={createReturn.error?.message}
            onSubmit={({ items, refundMethod }) => {
              createReturn.mutate({ saleId: saleDetail.sale.id, refundMethod, items });
            }}
          />
        </div>
      )}
    </section>
  );
}
