import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Button } from "../../atoms/Button";
import { FilterableTable } from "../FilterableTable";
import { formatChf } from "../../../lib/money/change";
import { PAYMENT_METHOD_LABELS } from "../../../types/sale";
import type { Sale } from "../../../types/sale";

export interface SalesTableProps {
  sales: Sale[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<Sale>();

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return timestamp.slice(0, 10);
  return date.toLocaleDateString("de-CH", { dateStyle: "medium" });
}

export function SalesTable({ sales, selectedId, onSelect, toolbar }: SalesTableProps) {
  const columns = [
    columnHelper.accessor((sale) => formatTimestamp(sale.timestamp), {
      id: "timestamp",
      header: "Datum",
      // Filter by day; the time would make every sale its own value.
      getUniqueValues: (sale) => [formatDate(sale.timestamp)],
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((sale) => String(sale.id), {
      id: "id",
      header: "Beleg-Nr.",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((sale) => PAYMENT_METHOD_LABELS[sale.paymentMethod], {
      id: "paymentMethod",
      header: "Zahlart",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((sale) => formatChf(sale.totalCents), {
      id: "total",
      header: "Summe (CHF)",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((sale) => sale.pickupNumber ?? "", {
      id: "pickupNumber",
      header: "Abholnummer",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.display({
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant={selectedId === row.original.id ? "primary" : "secondary"}
          onClick={() => onSelect(row.original.id)}
        >
          Details
        </Button>
      ),
    }),
  ];

  return (
    <FilterableTable
      data={sales}
      columns={columns}
      searchPlaceholder="Verkäufe suchen (Datum, Beleg-Nr., Summe, Abholnummer...)"
      toolbar={toolbar}
    />
  );
}
