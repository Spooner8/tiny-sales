import { createColumnHelper } from "@tanstack/react-table";
import type { FilterFn } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { FilterableTable } from "../FilterableTable";
import { formatDate } from "../../../lib/customerOrders";
import { formatChf } from "../../../lib/money/change";
import { customerLabel } from "../../../types/customer";
import { ORDER_STATUS_LABELS } from "../../../types/customerOrder";
import type { OrderStatus } from "../../../types/customerOrder";
import {
  formatInvoiceNumber,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  REMINDER_LEVEL_LABELS,
} from "../../../types/invoice";
import type { InvoiceOverview } from "../../../types/invoice";

export interface InvoiceTableProps {
  invoices: InvoiceOverview[];
  onOpen: (invoice: InvoiceOverview) => void;
  onRemind: (invoice: InvoiceOverview) => void;
  onMarkPaid: (invoice: InvoiceOverview) => void;
  /** Disables the actions while one is running. */
  busy?: boolean;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<InvoiceOverview>();

/**
 * Finds the text in the columns, and the reference however a bank statement
 * writes it: with or without spaces, in any case, also an older short form.
 */
const searchInvoices: FilterFn<InvoiceOverview> = (row, columnId, query: string) => {
  const needle = query.trim().toLowerCase();
  return (
    String(row.getValue(columnId)).toLowerCase().includes(needle) ||
    row.original.referenceSearch.toLowerCase().includes(needle.replace(/\s/g, ""))
  );
};

export function InvoiceTable({ invoices, onOpen, onRemind, onMarkPaid, busy, toolbar }: InvoiceTableProps) {
  const columns = [
    columnHelper.accessor((i) => formatInvoiceNumber(i.id), {
      id: "number",
      header: "Nr.",
      meta: { searchable: true },
    }),
    columnHelper.accessor("reference", {
      header: "Referenz",
      meta: { searchable: true, className: "invoice-table-reference" },
    }),
    columnHelper.accessor((i) => formatDate(i.createdAt), {
      id: "createdAt",
      header: "Datum",
      meta: { searchable: true },
    }),
    columnHelper.accessor((i) => customerLabel(i.customerName, i.customerCompany), {
      id: "customer",
      header: "Kunde",
      meta: { searchable: true, filterable: true, className: "col-name" },
    }),
    columnHelper.accessor((i) => ORDER_STATUS_LABELS[i.orderStatus as OrderStatus] ?? i.orderStatus, {
      id: "orderStatus",
      header: "Auftrag",
      cell: ({ row, getValue }) => `${row.original.orderId} · ${getValue()}`,
      meta: { filterable: true },
    }),
    columnHelper.accessor((i) => formatChf(i.outstandingCents), {
      id: "outstanding",
      header: "Betrag (CHF)",
      meta: { searchable: true },
    }),
    columnHelper.accessor((i) => formatDate(i.dueDate), {
      id: "dueDate",
      header: "Zahlbar bis",
    }),
    columnHelper.accessor((i) => INVOICE_STATUS_LABELS[i.status], {
      id: "status",
      header: "Status",
      cell: ({ row, getValue }) => (
        <Badge tone={INVOICE_STATUS_TONES[row.original.status]}>
          {getValue()}
          {row.original.paidOn && ` am ${formatDate(row.original.paidOn)}`}
        </Badge>
      ),
      meta: { filterable: true },
    }),
    columnHelper.accessor((i) => REMINDER_LEVEL_LABELS[i.reminderLevel] ?? "Keine", {
      id: "reminder",
      header: "Gemahnt",
      meta: { filterable: true },
    }),
    columnHelper.display({
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => (
        <div className="row-actions">
          <Button variant="secondary" size="sm" onClick={() => onOpen(row.original)}>
            Öffnen
          </Button>
          {row.original.canRemind && (
            <Button size="sm" disabled={busy} onClick={() => onRemind(row.original)}>
              Mahnen
            </Button>
          )}
          {(row.original.status === "open" || row.original.status === "overdue") && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => onMarkPaid(row.original)}>
              Bezahlt
            </Button>
          )}
        </div>
      ),
    }),
  ];

  return (
    <FilterableTable
      data={invoices}
      columns={columns}
      searchPlaceholder="Rechnungen suchen (Nr., Referenz aus dem E-Banking, Kunde, Betrag...)"
      toolbar={toolbar}
      searchFn={searchInvoices}
    />
  );
}
