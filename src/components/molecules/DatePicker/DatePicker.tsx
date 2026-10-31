import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Calendar } from "../../ui/calendar";

export interface DatePickerProps {
  id?: string;
  /** ISO date (YYYY-MM-DD), interpreted as a local calendar day. */
  value: string;
  onValueChange: (value: string) => void;
}

function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function DatePicker({ id, value, onValueChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        className="flex h-10 w-44 cursor-pointer items-center justify-between gap-2 rounded-xl border border-input bg-card px-3.5 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={selected ? undefined : "text-muted-foreground"}>
          {selected ? selected.toLocaleDateString("de-CH") : "Datum wählen"}
        </span>
        <CalendarDays size={16} className="opacity-60" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-soft-lg">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => {
                if (date) onValueChange(toIsoDate(date));
                setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
