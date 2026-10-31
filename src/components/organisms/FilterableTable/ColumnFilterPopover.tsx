import { Popover } from "@base-ui/react/popover";
import type { Column } from "@tanstack/react-table";
import { Filter } from "lucide-react";
import { useState } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Checkbox } from "../../ui/checkbox";
import { cn } from "../../../lib/utils";

/** Show a search box in the option list from this many options on. */
const SEARCH_THRESHOLD = 8;
const EMPTY_LABEL = "(leer)";

export interface ColumnFilterPopoverProps<TData> {
  column: Column<TData, unknown>;
  label: string;
}

/**
 * Funnel button next to a column title, opening a multi-select of the
 * column's distinct values (with how many rows have each, given the other
 * active filters). Options come from TanStack's faceted unique values.
 */
export function ColumnFilterPopover<TData>({ column, label }: ColumnFilterPopoverProps<TData>) {
  const [query, setQuery] = useState("");
  const selected = (column.getFilterValue() as string[] | undefined) ?? [];
  const facets = column.getFacetedUniqueValues();

  // Keep selected values listed even if other filters now hide all their rows.
  const options = [...new Set([...[...facets.keys()].map((v) => String(v ?? "")), ...selected])].sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "de-CH", { numeric: true }),
  );
  const visibleOptions = query.trim()
    ? options.filter((o) => (o || EMPTY_LABEL).toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function toggle(value: string, checked: boolean) {
    const next = checked ? [...selected, value] : selected.filter((v) => v !== value);
    column.setFilterValue(next.length > 0 ? next : undefined);
  }

  return (
    <Popover.Root onOpenChange={(open) => !open && setQuery("")}>
      <Popover.Trigger
        className={cn("column-filter-trigger", selected.length > 0 && "column-filter-trigger-active")}
        aria-label={`${label} filtern`}
        title={`${label} filtern`}
      >
        <Filter size={13} />
        {selected.length > 0 && <span className="column-filter-count">{selected.length}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="column-filter-popup">
            {options.length > SEARCH_THRESHOLD && (
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`${label} suchen...`}
                className="column-filter-search"
                autoFocus
              />
            )}
            <ul className="column-filter-options">
              {visibleOptions.map((value, index) => {
                const id = `filter-${column.id}-${index}`;
                return (
                  <li key={value} className="column-filter-option">
                    <Checkbox
                      id={id}
                      checked={selected.includes(value)}
                      onCheckedChange={(checked) => toggle(value, checked)}
                    />
                    <label htmlFor={id}>{value || EMPTY_LABEL}</label>
                    <span className="column-filter-option-count">{facets.get(value) ?? 0}</span>
                  </li>
                );
              })}
              {visibleOptions.length === 0 && <li className="column-filter-empty">Keine Werte</li>}
            </ul>
            {selected.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="column-filter-clear"
                onClick={() => column.setFilterValue(undefined)}
              >
                Filter löschen
              </Button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
