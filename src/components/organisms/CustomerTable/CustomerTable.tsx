import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { FilterableTable } from "../FilterableTable";
import { countryName } from "../../../types/customer";
import type { Customer } from "../../../types/customer";

export interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDeactivate: (id: number) => void;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<Customer>();

const STATUS_ACTIVE = "Aktiv";
const STATUS_INACTIVE = "Inaktiv";

export function CustomerTable({ customers, onEdit, onDeactivate, toolbar }: CustomerTableProps) {
  const columns = [
    columnHelper.accessor((c) => c.company ?? "", {
      id: "company",
      header: "Firma",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor("lastName", {
      header: "Nachname",
      meta: { searchable: true, className: "col-name" },
    }),
    columnHelper.accessor("firstName", {
      header: "Vorname",
      meta: { searchable: true },
    }),
    columnHelper.accessor((c) => c.street ?? "", {
      id: "address",
      header: "Adresse",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true },
    }),
    columnHelper.accessor((c) => c.postalCode ?? "", {
      id: "postalCode",
      header: "PLZ",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true },
    }),
    columnHelper.accessor((c) => c.city ?? "", {
      id: "city",
      header: "Ort",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((c) => countryName(c.country), {
      id: "country",
      header: "Land",
      meta: { filterable: true },
    }),
    columnHelper.accessor((c) => [c.phone, c.mobile].filter(Boolean).join(" / "), {
      id: "phone",
      header: "Telefon / Mobil",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true },
    }),
    columnHelper.accessor((c) => c.email ?? "", {
      id: "email",
      header: "E-Mail",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true },
    }),
    columnHelper.accessor((c) => (c.active ? STATUS_ACTIVE : STATUS_INACTIVE), {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={row.original.active ? "success" : "neutral"}>
          {row.original.active ? STATUS_ACTIVE : STATUS_INACTIVE}
        </Badge>
      ),
      meta: { filterable: true },
    }),
    columnHelper.display({
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => (
        <div className="row-actions">
          <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>
            Bearbeiten
          </Button>
          {row.original.active && (
            <Button variant="danger" size="sm" onClick={() => onDeactivate(row.original.id)}>
              Deaktivieren
            </Button>
          )}
        </div>
      ),
    }),
  ];

  return (
    <FilterableTable
      data={customers}
      columns={columns}
      searchPlaceholder="Kunden suchen (Name, Firma, Adresse, PLZ, Ort, Telefon, E-Mail...)"
      toolbar={toolbar}
    />
  );
}
