import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { FilterableTable } from "../FilterableTable";
import { PAPER_ORIENTATION_LABELS } from "../../../types/labelTemplate";
import type { LabelTemplate } from "../../../types/labelTemplate";

export interface LabelTemplateTableProps {
  templates: LabelTemplate[];
  onEdit: (template: LabelTemplate) => void;
  onDeactivate: (id: number) => void;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<LabelTemplate>();

const formatMm = (value: number) => value.toLocaleString("de-CH", { maximumFractionDigits: 1 });

export function LabelTemplateTable({ templates, onEdit, onDeactivate, toolbar }: LabelTemplateTableProps) {
  const columns = [
    columnHelper.accessor("name", {
      header: "Name",
      meta: { searchable: true, filterable: true, className: "col-name" },
    }),
    columnHelper.accessor((t) => `${t.paperSize} ${PAPER_ORIENTATION_LABELS[t.orientation]}`, {
      id: "paper",
      header: "Papierformat",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((t) => `${t.columns} × ${t.rows}`, {
      id: "grid",
      header: "Raster",
      cell: ({ row, getValue }) => `${getValue()} (${row.original.columns * row.original.rows} Etiketten)`,
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((t) => `${formatMm(t.labelWidthMm)} × ${formatMm(t.labelHeightMm)} mm`, {
      id: "size",
      header: "Etikettengrösse",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((t) => (t.active ? "Aktiv" : "Inaktiv"), {
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
      data={templates}
      columns={columns}
      searchPlaceholder="Vorlage suchen (Name, Format, Raster, Grösse)..."
      toolbar={toolbar}
    />
  );
}
