import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { FilterableTable } from "../FilterableTable";
import type { ProductGroup } from "../../../types/productGroup";
import type { ProductSubgroup } from "../../../types/productSubgroup";

export interface ProductSubgroupTableProps {
  productSubgroups: ProductSubgroup[];
  productGroups: ProductGroup[];
  onEdit: (productSubgroup: ProductSubgroup) => void;
  onDeactivate: (id: number) => void;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<ProductSubgroup>();

export function ProductSubgroupTable({
  productSubgroups,
  productGroups,
  onEdit,
  onDeactivate,
  toolbar,
}: ProductSubgroupTableProps) {
  const productGroupNameById = new Map(productGroups.map((g) => [g.id, g.name]));
  const groupName = (subgroup: ProductSubgroup) => productGroupNameById.get(subgroup.productGroupId) ?? "";

  const columns = [
    columnHelper.accessor(groupName, {
      id: "productGroup",
      header: "Warengruppe",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor("name", {
      header: "Name",
      meta: { searchable: true, filterable: true, className: "col-name" },
    }),
    columnHelper.accessor((s) => (s.active ? "Aktiv" : "Inaktiv"), {
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
    <FilterableTable
      data={productSubgroups}
      columns={columns}
      searchPlaceholder="Warenuntergruppe suchen (Name oder Warengruppe)..."
      toolbar={toolbar}
    />
  );
}
