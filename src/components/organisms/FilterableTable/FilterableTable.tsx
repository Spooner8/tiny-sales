import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, ColumnFiltersState, FilterFn } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { ColumnFilterPopover } from "./ColumnFilterPopover";

export interface FilterableTableProps<TData> {
  data: TData[];
  // TanStack's own column helpers produce mixed value types per column.
  columns: ColumnDef<TData, any>[];
  searchPlaceholder?: string;
  /** Extra controls shown next to the search, e.g. a date range or a toggle. */
  toolbar?: ReactNode;
  /** Replaces the plain text match of the search; called per searchable column. */
  searchFn?: FilterFn<TData>;
}

/**
 * Multi-select column filter: a row matches if any of its values for the
 * column (see `getUniqueValues`, e.g. several finishings) is selected.
 */
const anyOfSelected: FilterFn<unknown> = (row, columnId, selected: string[]) =>
  row.getUniqueValues<unknown>(columnId).some((value) => selected.includes(String(value ?? "")));
anyOfSelected.autoRemove = (value: string[] | undefined) => !value || value.length === 0;

/**
 * Table with a free-text search over the columns marked `meta.searchable`
 * and a funnel filter in the header of columns marked `meta.filterable`.
 * TanStack combines all column filters and the search with AND; within one
 * column the selected values are combined with OR.
 */
export function FilterableTable<TData>({
  data,
  columns,
  searchPlaceholder = "Suchen...",
  toolbar,
  searchFn,
}: FilterableTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    defaultColumn: { filterFn: anyOfSelected as FilterFn<TData> },
    state: { globalFilter, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: searchFn ?? "includesString",
    getColumnCanGlobalFilter: (column) => column.columnDef.meta?.searchable === true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const rows = table.getRowModel().rows;
  const isFiltered = globalFilter !== "" || columnFilters.length > 0;

  function resetFilters() {
    setGlobalFilter("");
    setColumnFilters([]);
  }

  return (
    <div className="filterable-table">
      <div className="filterable-table-toolbar">
        <div className="filterable-table-search">
          <Search size={16} className="filterable-table-search-icon" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Tabelle durchsuchen"
          />
        </div>
        {toolbar}
        {isFiltered && (
          <>
            <span className="muted">
              {rows.length} von {data.length}
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={resetFilters}>
              Filter zurücksetzen
            </Button>
          </>
        )}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const title = flexRender(header.column.columnDef.header, header.getContext());
                  const label = typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.id;
                  return (
                    <th key={header.id} className={header.column.columnDef.meta?.className}>
                      {header.column.columnDef.meta?.filterable ? (
                        <span className="data-table-header">
                          {title}
                          <ColumnFilterPopover column={header.column} label={label} />
                        </span>
                      ) : (
                        title
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cell.column.columnDef.meta?.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={table.getAllLeafColumns().length} className="data-table-empty">
                  {isFiltered ? "Keine Treffer für die gewählten Filter." : "Keine Einträge vorhanden."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
