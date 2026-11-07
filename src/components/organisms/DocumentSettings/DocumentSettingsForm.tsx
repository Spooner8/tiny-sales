import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { FormField } from "../../molecules/FormField";
import type { CompanyProfile } from "../../../types/companyProfile";

/** The part of the profile this form edits. */
export type DocumentDetails = Pick<
  CompanyProfile,
  | "receiptThanks"
  | "receiptSignature"
  | "vatRatePercent"
  | "iban"
  | "invoicePaymentDays"
  | "reminderPaymentDays"
  | "reminderFeeCents"
>;

export interface DocumentSettingsFormProps {
  initial: CompanyProfile;
  submitting?: boolean;
  errorMessage?: string | null;
  /** Shown after a successful save until the next change. */
  saved?: boolean;
  onSubmit: (values: DocumentDetails) => void;
  onChange?: () => void;
}

export function DocumentSettingsForm({
  initial,
  submitting,
  errorMessage,
  saved,
  onSubmit,
  onChange,
}: DocumentSettingsFormProps) {
  const [receiptThanks, setReceiptThanks] = useState(initial.receiptThanks);
  const [receiptSignature, setReceiptSignature] = useState(initial.receiptSignature);
  const [iban, setIban] = useState(initial.iban);

  const [paymentDays, setPaymentDays] = useState(String(initial.invoicePaymentDays));
  const paymentDaysValid = /^\d{1,3}$/.test(paymentDays.trim());
  const [vatRate, setVatRate] = useState(String(initial.vatRatePercent));
  // Empty means no VAT; up to two decimals, e.g. 8.1 or 2,6.
  const vatRateValid = vatRate.trim() === "" || /^\d{1,2}([.,]\d{1,2})?$/.test(vatRate.trim());

  const [reminderDays, setReminderDays] = useState(String(initial.reminderPaymentDays));
  const reminderDaysValid = /^\d{1,3}$/.test(reminderDays.trim());
  const [reminderFee, setReminderFee] = useState((initial.reminderFeeCents / 100).toFixed(2));
  // Empty means no fee.
  const reminderFeeValid = reminderFee.trim() === "" || /^\d+([.,]\d{1,2})?$/.test(reminderFee.trim());

  function change(set: (value: string) => void) {
    return (event: { target: { value: string } }) => {
      set(event.target.value);
      onChange?.();
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!paymentDaysValid || !vatRateValid || !reminderDaysValid || !reminderFeeValid) return;
    onSubmit({
      receiptThanks,
      receiptSignature,
      iban,
      invoicePaymentDays: Number(paymentDays.trim()),
      vatRatePercent: vatRate.trim() ? Number.parseFloat(vatRate.trim().replace(",", ".")) : 0,
      reminderPaymentDays: Number(reminderDays.trim()),
      reminderFeeCents: reminderFee.trim() ? Math.round(Number.parseFloat(reminderFee.trim().replace(",", ".")) * 100) : 0,
    });
  }

  return (
    <form className="company-profile-form" onSubmit={handleSubmit}>
      <h3 className="settings-subheading">Quittung</h3>
      <div className="company-profile-fields">
        <FormField label="Dankeszeile" htmlFor="document-receipt-thanks">
          <Input
            id="document-receipt-thanks"
            value={receiptThanks}
            onChange={change(setReceiptThanks)}
            placeholder="z.B. Vielen Dank für Ihren Einkauf!"
          />
        </FormField>
        <FormField label="Grusszeile" htmlFor="document-receipt-signature">
          <Input
            id="document-receipt-signature"
            value={receiptSignature}
            onChange={change(setReceiptSignature)}
            placeholder="z.B. Ihr Muster-Team"
          />
        </FormField>
      </div>

      <h3 className="settings-subheading">MWST</h3>
      <div className="company-profile-fields">
        <FormField
          label="MWST-Satz in % (0 = keine MWST ausweisen)"
          htmlFor="document-vat-rate"
          error={vatRateValid ? null : "Bitte einen Satz wie 8.1 eingeben"}
        >
          <Input
            id="document-vat-rate"
            inputMode="decimal"
            value={vatRate}
            onChange={change(setVatRate)}
            placeholder="z.B. 8.1"
          />
        </FormField>
      </div>

      <h3 className="settings-subheading">Rechnungen</h3>
      <div className="company-profile-fields">
        <FormField label="IBAN (QR-Zahlteil)" htmlFor="document-iban">
          <Input
            id="document-iban"
            value={iban}
            onChange={change(setIban)}
            placeholder="z.B. CH44 3199 9123 0008 8901 2"
          />
        </FormField>
        <FormField
          label="Zahlungsfrist (Tage)"
          htmlFor="document-invoice-payment-days"
          error={paymentDaysValid ? null : "Bitte eine Anzahl Tage eingeben, z.B. 30"}
        >
          <Input
            id="document-invoice-payment-days"
            inputMode="numeric"
            value={paymentDays}
            onChange={change(setPaymentDays)}
          />
        </FormField>
      </div>

      <h3 className="settings-subheading">Mahnungen</h3>
      <div className="company-profile-fields">
        <FormField
          label="Zahlungsfrist (Tage)"
          htmlFor="document-reminder-days"
          error={reminderDaysValid ? null : "Bitte eine Anzahl Tage eingeben, z.B. 10"}
        >
          <Input
            id="document-reminder-days"
            inputMode="numeric"
            value={reminderDays}
            onChange={change(setReminderDays)}
          />
        </FormField>
        <FormField
          label="Gebühr pro Mahnung (CHF, Zahlungserinnerung gratis)"
          htmlFor="document-reminder-fee"
          error={reminderFeeValid ? null : "Bitte einen Betrag wie 20.00 eingeben"}
        >
          <Input
            id="document-reminder-fee"
            inputMode="decimal"
            value={reminderFee}
            onChange={change(setReminderFee)}
          />
        </FormField>
      </div>

      {errorMessage && <p className="field-error">{errorMessage}</p>}

      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          Speichern
        </Button>
        {saved && <span className="muted">Gespeichert.</span>}
      </div>
    </form>
  );
}
