import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { FormField } from "../../molecules/FormField";
import { ImageField } from "../../molecules/ImageField";
import type { CompanyProfile } from "../../../types/companyProfile";

export interface CompanyProfileFormProps {
  initial: CompanyProfile;
  submitting?: boolean;
  errorMessage?: string | null;
  /** Shown after a successful save until the next change. */
  saved?: boolean;
  onSubmit: (values: CompanyProfile) => void;
  onChange?: () => void;
}

type TextField = Exclude<keyof CompanyProfile, "logo" | "logoMark" | "invoicePaymentDays" | "vatRatePercent">;

const TEXT_FIELDS: { key: TextField; label: string; placeholder: string }[] = [
  { key: "name", label: "Firmenname", placeholder: "z.B. Muster GmbH" },
  { key: "street", label: "Strasse", placeholder: "z.B. Bahnhofstrasse 1" },
  { key: "postalCity", label: "PLZ und Ort", placeholder: "z.B. 8000 Zürich" },
  { key: "phone", label: "Telefon", placeholder: "z.B. +41 44 123 45 67" },
  { key: "website", label: "Website", placeholder: "z.B. www.example.ch" },
  { key: "vatNumber", label: "MWST-Nummer", placeholder: "z.B. CHE-123.456.789 MWST" },
  { key: "receiptThanks", label: "Quittung: Dankeszeile", placeholder: "z.B. Vielen Dank für Ihren Einkauf!" },
  { key: "receiptSignature", label: "Quittung: Grusszeile", placeholder: "z.B. Ihr Muster-Team" },
  { key: "iban", label: "IBAN für Rechnungen (QR-Zahlteil)", placeholder: "z.B. CH44 3199 9123 0008 8901 2" },
];

export function CompanyProfileForm({
  initial,
  submitting,
  errorMessage,
  saved,
  onSubmit,
  onChange,
}: CompanyProfileFormProps) {
  const [values, setValues] = useState<CompanyProfile>(initial);
  const [paymentDays, setPaymentDays] = useState(String(initial.invoicePaymentDays));
  const paymentDaysValid = /^\d{1,3}$/.test(paymentDays.trim());
  const [vatRate, setVatRate] = useState(String(initial.vatRatePercent));
  // Empty means no VAT; up to two decimals, e.g. 8.1 or 2,6.
  const vatRateValid = vatRate.trim() === "" || /^\d{1,2}([.,]\d{1,2})?$/.test(vatRate.trim());

  function update(change: Partial<CompanyProfile>) {
    setValues((prev) => ({ ...prev, ...change }));
    onChange?.();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!paymentDaysValid || !vatRateValid) return;
    onSubmit({
      ...values,
      invoicePaymentDays: Number(paymentDays.trim()),
      vatRatePercent: vatRate.trim() ? Number.parseFloat(vatRate.trim().replace(",", ".")) : 0,
    });
  }

  return (
    <form className="company-profile-form" onSubmit={handleSubmit}>
      <div className="company-profile-fields">
        {TEXT_FIELDS.map((field) => (
          <FormField key={field.key} label={field.label} htmlFor={`company-${field.key}`}>
            <Input
              id={`company-${field.key}`}
              value={values[field.key]}
              onChange={(e) => update({ [field.key]: e.target.value })}
              placeholder={field.placeholder}
            />
          </FormField>
        ))}
        <FormField
          label="MWST-Satz in % (0 = keine MWST ausweisen)"
          htmlFor="company-vat-rate"
          error={vatRateValid ? null : "Bitte einen Satz wie 8.1 eingeben"}
        >
          <Input
            id="company-vat-rate"
            inputMode="decimal"
            value={vatRate}
            onChange={(e) => {
              setVatRate(e.target.value);
              onChange?.();
            }}
            placeholder="z.B. 8.1"
          />
        </FormField>
        <FormField
          label="Zahlungsfrist für Rechnungen (Tage)"
          htmlFor="company-invoice-payment-days"
          error={paymentDaysValid ? null : "Bitte eine Anzahl Tage eingeben, z.B. 30"}
        >
          <Input
            id="company-invoice-payment-days"
            inputMode="numeric"
            value={paymentDays}
            onChange={(e) => {
              setPaymentDays(e.target.value);
              onChange?.();
            }}
          />
        </FormField>
      </div>

      <div className="company-profile-images">
        <ImageField
          id="company-logo"
          label="Logo"
          hint="Erscheint auf der Quittung und im Menü."
          value={values.logo}
          onChange={(logo) => update({ logo })}
        />
        <ImageField
          id="company-logo-mark"
          label="Logo-Symbol (optional)"
          hint="Quadratisches Symbol für das eingeklappte Menü. Ohne Symbol wird dort das Logo verkleinert gezeigt."
          value={values.logoMark}
          onChange={(logoMark) => update({ logoMark })}
          maxSize={256}
        />
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
