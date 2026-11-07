import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { Select } from "../../atoms/Select";
import { FilterableTable } from "../FilterableTable";
import { formatDate } from "../../../lib/customerOrders";
import { formatChf } from "../../../lib/money/change";
import { customerLabel } from "../../../types/customer";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "../../../types/customerOrder";
import type { CustomerOrder, OrderStatus } from "../../../types/customerOrder";
import { formatReceiptNumber, PAYMENT_METHOD_LABELS } from "../../../types/sale";

export interface CustomerOrderTableProps {
  orders: CustomerOrder[];
  onOpen: (order: CustomerOrder) => void;
  onChangeStatus: (order: CustomerOrder, status: OrderStatus) => void;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<CustomerOrder>();

/** How far the billing is, e.g. "Rechnung 3 · offen" or "Beleg 00012 · bezahlt". */
function billingLabel(order: CustomerOrder): string {
  if (order.saleId === null) return "Nicht abgerechnet";
  if (order.invoiceId === null) return `Beleg ${formatReceiptNumber(order.saleId)} · bezahlt`;
  return `Rechnung ${order.invoiceId} · ${order.invoicePaidOn ? "bezahlt" : "offen"}`;
}

function billingTone(order: CustomerOrder): "warning" | "success" {
  return order.saleId === null || (order.invoiceId !== null && !order.invoicePaidOn) ? "warning" : "success";
}

const STATUS_OPTIONS = ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }));

export function CustomerOrderTable({ orders, onOpen, onChangeStatus, toolbar }: CustomerOrderTableProps) {
  const columns = [
    columnHelper.accessor((o) => String(o.id), {
      id: "number",
      header: "Nr.",
      meta: { searchable: true },
    }),
    columnHelper.accessor((o) => formatDate(o.createdAt), {
      id: "createdAt",
      header: "Erfasst",
      meta: { searchable: true },
    }),
    columnHelper.accessor((o) => customerLabel(o.customerName, o.customerCompany), {
      id: "customer",
      header: "Kunde",
      meta: { searchable: true, filterable: true, className: "col-name" },
    }),
    columnHelper.accessor((o) => o.items.map((i) => i.articleName).join(", "), {
      id: "articles",
      header: "Artikel",
      cell: ({ row }) => `${row.original.items.reduce((sum, i) => sum + i.quantity, 0)} Stk.`,
      meta: { searchable: true },
    }),
    columnHelper.accessor((o) => ORDER_STATUS_LABELS[o.status], {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Select
          value={row.original.status}
          onValueChange={(value) => onChangeStatus(row.original, value as OrderStatus)}
          options={STATUS_OPTIONS}
          className="order-status-select"
        />
      ),
      meta: { filterable: true },
    }),
    columnHelper.accessor((o) => PAYMENT_METHOD_LABELS[o.paymentMethod], {
      id: "paymentMethod",
      header: "Zahlart",
      meta: { filterable: true },
    }),
    columnHelper.accessor((o) => formatChf(o.totalCents), {
      id: "total",
      header: "Total (CHF)",
      meta: { searchable: true },
    }),
    columnHelper.accessor(billingLabel, {
      id: "billing",
      header: "Abrechnung",
      cell: ({ row, getValue }) => (
        <div className="row-actions">
          <Badge tone={billingTone(row.original)}>{getValue()}</Badge>
          {row.original.done && <Badge tone="neutral">Erledigt</Badge>}
        </div>
      ),
      meta: { searchable: true },
    }),
    columnHelper.display({
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" onClick={() => onOpen(row.original)}>
          Öffnen
        </Button>
      ),
    }),
  ];

  return (
    <FilterableTable
      data={orders}
      columns={columns}
      searchPlaceholder="Aufträge suchen (Nr., Kunde, Artikel, Total...)"
      toolbar={toolbar}
    />
  );
}
