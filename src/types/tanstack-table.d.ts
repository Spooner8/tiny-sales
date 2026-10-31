import "@tanstack/react-table";
import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // Read by FilterableTable to build its search and per-column filters.
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Included in the free-text search above the table. */
    searchable?: boolean;
    /**
     * Shows a funnel in the header with a multi-select of the column's
     * distinct values. The column must produce strings; set the column's
     * `getUniqueValues` when a row has several (or other) values to filter by.
     */
    filterable?: boolean;
    /** CSS class for the column's header and body cells, e.g. "col-name". */
    className?: string;
  }
}
