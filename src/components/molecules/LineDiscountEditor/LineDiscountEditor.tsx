import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import type { LineDiscountDraft } from "../../../lib/money/discount";

export interface LineDiscountEditorProps {
  draft: LineDiscountDraft;
  error?: string | null;
  onChange: (draft: LineDiscountDraft) => void;
}

const KIND_OPTIONS: { value: LineDiscountDraft["kind"]; label: string }[] = [
  { value: "none", label: "–" },
  { value: "percent", label: "%" },
  { value: "amount", label: "CHF" },
];

/** Compact per-line discount input: percent off or an amount off per unit (CHF). */
export function LineDiscountEditor({ draft, error, onChange }: LineDiscountEditorProps) {
  return (
    <div className="line-discount-editor">
      <div className="line-discount-editor-row">
        <Select
          value={draft.kind}
          onValueChange={(value) => onChange({ kind: value as LineDiscountDraft["kind"], input: "" })}
          options={KIND_OPTIONS}
          className="line-discount-kind"
        />
        {draft.kind !== "none" && (
          <Input
            type="text"
            inputMode="decimal"
            value={draft.input}
            onChange={(e) => onChange({ ...draft, input: e.target.value })}
            placeholder={draft.kind === "percent" ? "z.B. 10" : "z.B. 5.00"}
            aria-label={draft.kind === "percent" ? "Rabatt in Prozent" : "Nachlass pro Stück in CHF"}
            className="line-discount-value"
          />
        )}
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
