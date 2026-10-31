import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";

import { cn } from "../../lib/utils";

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ id, checked, onCheckedChange, disabled, className }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value)}
      disabled={disabled}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-input bg-card transition-colors data-[checked]:bg-primary data-[checked]:border-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <BaseCheckbox.Indicator className="text-primary-foreground">
        <Check size={14} strokeWidth={3} />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
