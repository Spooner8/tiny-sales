import { useState } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import { FormField } from "../../molecules/FormField";
import { Checkbox } from "../../ui/checkbox";
import { breakDownChange, DENOMINATIONS, formatChf } from "../../../lib/money/change";
import { formatPercent, parseSaleDiscount, saleDiscountCents } from "../../../lib/money/discount";
import type { DiscountableLine, SaleDiscountDraft } from "../../../lib/money/discount";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../../../types/sale";
import type { PaymentMethod, SaleDiscount } from "../../../types/sale";

export interface PaymentConfirmDetails {
  paymentMethod: PaymentMethod;
  cashGivenCents: number | null;
  pickupNumber: string | null;
  discount: SaleDiscount | null;
}

export interface PaymentPanelProps {
  /** Cart lines after promotions and line discounts, before the sale discount. */
  lines: DiscountableLine[];
  /** Sale discount and pickup number are kept with the open sale. */
  discountDraft: SaleDiscountDraft;
  onDiscountDraftChange: (draft: SaleDiscountDraft) => void;
  pickupNumber: string;
  onPickupNumberChange: (pickupNumber: string) => void;
  /** Prevents completing the sale, e.g. while a line discount is invalid. */
  blocked?: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
  onConfirm: (details: PaymentConfirmDetails) => void;
  onCancel: () => void;
}

const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));

type DiscountKind = SaleDiscountDraft["kind"];

const DISCOUNT_KIND_OPTIONS: { value: DiscountKind; label: string }[] = [
  { value: "none", label: "Kein Rabatt" },
  { value: "percent", label: "Prozent (%)" },
  { value: "total", label: "Neuer Endbetrag (CHF)" },
];

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Empty counts as nothing given yet; null means the input isn't a valid amount. */
function parseCashInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number.parseFloat(trimmed.replace(",", ".")) * 100);
}

export function PaymentPanel({
  lines,
  discountDraft,
  onDiscountDraftChange,
  pickupNumber,
  onPickupNumberChange,
  blocked,
  submitting,
  errorMessage,
  onConfirm,
  onCancel,
}: PaymentPanelProps) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const hasDiscountedLines = lines.some((line) => line.discounted);
  const { kind: discountKind, input: discountInput, cumulative } = discountDraft;
  const { discount, error: discountError } = parseSaleDiscount(discountDraft, subtotalCents);
  const discountCents = saleDiscountCents(lines, discount);
  const totalCents = subtotalCents - discountCents;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  // The amount field is the single source of truth for the cash given;
  // denomination buttons add to it, the counts only label the buttons.
  const [cashInput, setCashInput] = useState("");
  const [tenderedCounts, setTenderedCounts] = useState<Record<number, number>>({});

  const parsedCents = parseCashInput(cashInput);
  const cashInvalid = parsedCents === null;
  const tenderedCents = parsedCents ?? 0;
  const changeCents = tenderedCents - totalCents;
  const changeBreakdown = changeCents > 0 ? breakDownChange(changeCents) : [];
  const cashInsufficient = paymentMethod === "Cash" && (cashInvalid || tenderedCents < totalCents);

  function addDenomination(cents: number) {
    setTenderedCounts((prev) => ({ ...prev, [cents]: (prev[cents] ?? 0) + 1 }));
    setCashInput(centsToInput(tenderedCents + cents));
  }

  function setManualCash(value: string) {
    setCashInput(value);
    // Typed amounts no longer correspond to the clicked notes/coins.
    setTenderedCounts({});
  }

  function resetDenominations() {
    setCashInput("");
    setTenderedCounts({});
  }

  function handleConfirm() {
    onConfirm({
      paymentMethod,
      cashGivenCents: paymentMethod === "Cash" ? tenderedCents : null,
      pickupNumber: pickupNumber.trim() ? pickupNumber.trim() : null,
      discount,
    });
  }

  return (
    <div className="payment-panel">
      <div className="discount-row">
        <FormField label="Rabatt" htmlFor="discount-kind">
          <Select
            id="discount-kind"
            value={discountKind}
            onValueChange={(value) =>
              onDiscountDraftChange({ kind: value as DiscountKind, input: "", cumulative: false })
            }
            options={DISCOUNT_KIND_OPTIONS}
          />
        </FormField>
        {discountKind !== "none" && (
          <FormField
            label={discountKind === "percent" ? "Rabatt in %" : "Neuer Endbetrag (CHF)"}
            htmlFor="discount-value"
            error={discountError}
          >
            <Input
              id="discount-value"
              type="text"
              inputMode="decimal"
              value={discountInput}
              onChange={(e) => onDiscountDraftChange({ ...discountDraft, input: e.target.value })}
              placeholder={discountKind === "percent" ? "z.B. 10" : formatChf(subtotalCents)}
              autoFocus
            />
          </FormField>
        )}
      </div>

      {discountKind === "percent" && hasDiscountedLines && (
        <div className="form-field form-field-row">
          <Checkbox id="discount-cumulative" checked={cumulative} onCheckedChange={(checked) => onDiscountDraftChange({ ...discountDraft, cumulative: checked })} />
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

      <dl className="payment-summary">
        {discountCents > 0 && (
          <>
            <dt>Zwischensumme</dt>
            <dd>{formatChf(subtotalCents)} CHF</dd>
            <dt>Gesamtrabatt{discount?.kind === "percent" ? ` ${formatPercent(discount.value)}` : ""}</dt>
            <dd>−{formatChf(discountCents)} CHF</dd>
          </>
        )}
        <dt className="payment-summary-total">Total</dt>
        <dd className="payment-summary-total">{formatChf(totalCents)} CHF</dd>
      </dl>

      <div className="payment-method-field">
        <FormField label="Zahlart" htmlFor="payment-method">
          <Select
            id="payment-method"
            value={paymentMethod}
            onValueChange={(value) => {
              setPaymentMethod(value as PaymentMethod);
              resetDenominations();
            }}
            options={PAYMENT_METHOD_OPTIONS}
          />
        </FormField>
      </div>

      {paymentMethod === "Cash" && (
        <div className="cash-panel">
          <div className="denomination-grid">
            {DENOMINATIONS.map((d) => (
              <Button
                key={d.cents}
                type="button"
                variant="secondary"
                onClick={() => addDenomination(d.cents)}
              >
                {d.label}
                {tenderedCounts[d.cents] ? ` ×${tenderedCounts[d.cents]}` : ""}
              </Button>
            ))}
          </div>
          <div className="cash-manual-row">
            <FormField label="Gegeben (CHF)" htmlFor="cash-given">
              <Input
                id="cash-given"
                type="text"
                inputMode="decimal"
                value={cashInput}
                onChange={(e) => setManualCash(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
            <Button type="button" variant="secondary" onClick={() => setManualCash(centsToInput(totalCents))}>
              Passend
            </Button>
            <Button type="button" variant="secondary" onClick={resetDenominations}>
              Zurücksetzen
            </Button>
          </div>

          {cashInvalid ? (
            <p className="field-error">Ungültiger Betrag, z.B. 50 oder 42.50</p>
          ) : cashInsufficient ? (
            <p className="field-error">
              Fehlbetrag: {formatChf(totalCents - tenderedCents)} CHF
            </p>
          ) : (
            <div className="change-breakdown">
              <p>Wechselgeld: {formatChf(changeCents)} CHF</p>
              {changeBreakdown.length > 0 && (
                <ul>
                  {changeBreakdown.map((entry) => (
                    <li key={entry.denomination.cents}>
                      {entry.count}× {entry.denomination.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <FormField label="Abholnummer (optional)" htmlFor="pickup-number">
        <Input
          id="pickup-number"
          value={pickupNumber}
          onChange={(e) => onPickupNumberChange(e.target.value)}
          placeholder="z.B. 42"
        />
      </FormField>

      {errorMessage && <p className="field-error">{errorMessage}</p>}

      <div className="form-actions">
        <Button type="button" disabled={submitting || blocked || cashInsufficient || discountError !== null} onClick={handleConfirm}>
          Verkauf abschliessen
        </Button>
        <Button type="button" variant="secondary" disabled={submitting} onClick={onCancel}>
          Verkauf abbrechen
        </Button>
      </div>
    </div>
  );
}
