import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Check } from "lucide-react";

import { COLOR_SCHEME_IDS, COLOR_SCHEMES, foregroundColor } from "../../../lib/colorSchemes";
import type { ColorSchemeId } from "../../../lib/colorSchemes";

export interface ColorSchemePickerProps {
  value: ColorSchemeId;
  onChange: (value: ColorSchemeId) => void;
  labelledBy: string;
}

export function ColorSchemePicker({ value, onChange, labelledBy }: ColorSchemePickerProps) {
  return (
    <RadioGroup
      className="color-scheme-picker"
      value={value}
      onValueChange={(next) => onChange(next as ColorSchemeId)}
      aria-labelledby={labelledBy}
    >
      {COLOR_SCHEME_IDS.map((id) => {
        const scheme = COLOR_SCHEMES[id];
        return (
          <label key={id} className="color-scheme-option">
            <Radio.Root
              value={id}
              className="color-scheme-swatch"
              style={{ background: scheme.light.primary, color: foregroundColor(scheme, "light") }}
            >
              <Radio.Indicator className="color-scheme-check">
                <Check size={18} strokeWidth={3} />
              </Radio.Indicator>
            </Radio.Root>
            <span>{scheme.label}</span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
