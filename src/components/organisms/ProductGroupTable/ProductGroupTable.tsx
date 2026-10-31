import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { FilterableTable } from "../FilterableTable";
import type { ProductGroup } from "../../../types/productGroup";

export interface ProductGroupTableProps {
  productGroups: ProductGroup[];
  onEdit: (productGroup: ProductGroup) => void;
  onDeactivate: (id: number) => void;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<ProductGroup>();

export function ProductGroupTable({ productGroups, onEdit, onDeactivate, toolbar }: ProductGroupTableProps) {
  const columns = [
    columnHelper.accessor("name", {
      header: "Name",
      meta: { searchable: true, filterable: true, className: "col-name" },
    }),
    columnHelper.accessor((g) => (g.active ? "Aktiv" : "Inaktiv"), {
      id: "status",
      header: "Status",
      cell: ({ row, getValue }) => <Badge tone={row.original.active ? "success" : "neutral"}>{getValue()}</Badge>,
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
    <FilterableTable data={productGroups} columns={columns} searchPlaceholder="Warengruppe suchen..." toolbar={toolbar} />
  );
}
