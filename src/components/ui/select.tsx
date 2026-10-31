import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
  /** An empty string means "nothing selected" and shows the placeholder. */
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({ id, value, onValueChange, options, placeholder, disabled, className }: SelectProps) {
  return (
    <BaseSelect.Root
      value={value === "" ? null : value}
      onValueChange={(v) => onValueChange(v ?? "")}
      disabled={disabled}
      items={options.map((o) => ({ value: o.value, label: o.label }))}
    >
      <BaseSelect.Trigger
        id={id}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3.5 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <BaseSelect.Value placeholder={placeholder} className="data-[placeholder]:text-muted-foreground" />
        <BaseSelect.Icon>
          <ChevronDown size={16} className="opacity-60" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        {/* The app scrolls inside .app-content, not the document, so the
            default item-aligned mode (which relies on document scroll lock)
            would leave the popup floating while the page scrolls behind it. */}
        <BaseSelect.Positioner alignItemWithTrigger={false} sideOffset={6} className="z-50">
          <BaseSelect.Popup className="max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-soft-lg">
            {options.map((option) => (
              <BaseSelect.Item
                key={option.value}
                value={option.value}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator>
                  <Check size={14} />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
