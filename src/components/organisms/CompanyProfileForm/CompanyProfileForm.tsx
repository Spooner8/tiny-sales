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

type TextField = Exclude<keyof CompanyProfile, "logo" | "logoMark">;

const TEXT_FIELDS: { key: TextField; label: string; placeholder: string }[] = [
  { key: "name", label: "Firmenname", placeholder: "z.B. Muster GmbH" },
  { key: "street", label: "Strasse", placeholder: "z.B. Bahnhofstrasse 1" },
  { key: "postalCity", label: "PLZ und Ort", placeholder: "z.B. 8000 Zürich" },
  { key: "phone", label: "Telefon", placeholder: "z.B. +41 44 123 45 67" },
  { key: "website", label: "Website", placeholder: "z.B. www.example.ch" },
  { key: "vatNumber", label: "MWST-Nummer", placeholder: "z.B. CHE-123.456.789 MWST" },
  { key: "receiptThanks", label: "Quittung: Dankeszeile", placeholder: "z.B. Vielen Dank für Ihren Einkauf!" },
  { key: "receiptSignature", label: "Quittung: Grusszeile", placeholder: "z.B. Ihr Muster-Team" },
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

  function update(change: Partial<CompanyProfile>) {
    setValues((prev) => ({ ...prev, ...change }));
    onChange?.();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
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
