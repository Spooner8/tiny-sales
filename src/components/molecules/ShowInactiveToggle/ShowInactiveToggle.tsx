import { Checkbox } from "../../ui/checkbox";

export interface ShowInactiveToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ShowInactiveToggle({ checked, onCheckedChange }: ShowInactiveToggleProps) {
  return (
    <div className="show-inactive-toggle">
      <Checkbox id="show-inactive" checked={checked} onCheckedChange={onCheckedChange} />
      <label htmlFor="show-inactive">Auch deaktivierte anzeigen</label>
    </div>
  );
}
