import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import { FormField } from "../FormField";
import { Checkbox } from "../../ui/checkbox";
import { formatChf } from "../../../lib/money/change";
import type { SaleDiscountDraft } from "../../../lib/money/discount";

export interface SaleDiscountFieldsProps {
  draft: SaleDiscountDraft;
  onChange: (draft: SaleDiscountDraft) => void;
  /** Sum of the lines, the placeholder for a new total. */
  subtotalCents: number;
  /** Offers the cumulative option for percentage discounts. */
  hasDiscountedLines: boolean;
  error?: string | null;
}

type DiscountKind = SaleDiscountDraft["kind"];

const DISCOUNT_KIND_OPTIONS: { value: DiscountKind; label: string }[] = [
  { value: "none", label: "Kein Rabatt" },
  { value: "percent", label: "Prozent (%)" },
  { value: "total", label: "Neuer Endbetrag (CHF)" },
];

/** Discount on a whole sale or order: a percentage or a new final total. */
export function SaleDiscountFields({
  draft,
  onChange,
  subtotalCents,
  hasDiscountedLines,
  error,
}: SaleDiscountFieldsProps) {
  const { kind, input, cumulative } = draft;
  return (
    <>
      <div className="discount-row">
        <FormField label="Rabatt" htmlFor="discount-kind">
          <Select
            id="discount-kind"
            value={kind}
            onValueChange={(value) => onChange({ kind: value as DiscountKind, input: "", cumulative: false })}
            options={DISCOUNT_KIND_OPTIONS}
          />
        </FormField>
        {kind !== "none" && (
          <FormField
            label={kind === "percent" ? "Rabatt in %" : "Neuer Endbetrag (CHF)"}
            htmlFor="discount-value"
            error={error}
          >
            <Input
              id="discount-value"
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => onChange({ ...draft, input: e.target.value })}
              placeholder={kind === "percent" ? "z.B. 10" : formatChf(subtotalCents)}
              autoFocus
            />
          </FormField>
        )}
      </div>

      {kind === "percent" && hasDiscountedLines && (
        <div className="form-field form-field-row">
          <Checkbox
            id="discount-cumulative"
            checked={cumulative}
            onCheckedChange={(checked) => onChange({ ...draft, cumulative: checked })}
          />
          <label htmlFor="discount-cumulative">
            Mit Aktionen und Positionsrabatten kumulieren
            <span className="muted">
              {" "}
              {cumulative
                ? "(gilt auch für bereits rabattierte Positionen)"
                : "(bereits rabattierte Positionen erhalten keinen Gesamtrabatt)"}
            </span>
          </label>
        </div>
      )}
    </>
  );
}
