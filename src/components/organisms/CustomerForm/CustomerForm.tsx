import { Fragment, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import { Textarea } from "../../atoms/Textarea";
import { FormField } from "../../molecules/FormField";
import { Checkbox } from "../../ui/checkbox";
import {
  duplicateCustomerMessage,
  findDuplicateCustomer,
  isValidEmail,
  isValidPhone,
  postalCodeError,
} from "../../../lib/customerChecks";
import { COUNTRIES, GENDER_LABELS, GENDERS } from "../../../types/customer";
import type { Customer, Gender, NewCustomer } from "../../../types/customer";

export interface CustomerFormValues extends NewCustomer {
  active: boolean;
}

export interface CustomerFormProps {
  initial?: Customer;
  /** All customers, to warn about a duplicate while typing. */
  customers: Customer[];
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
}

type TextKey = Exclude<keyof NewCustomer, "gender" | "country">;

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

const NO_GENDER = "none";

const GENDER_OPTIONS = [
  { value: NO_GENDER, label: "Keine Angabe" },
  ...GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] })),
];

const FIELDS: {
  key: TextKey;
  label: string;
  placeholder?: string;
  full?: boolean;
  multiline?: boolean;
  type?: "email" | "tel";
}[] = [
  { key: "company", label: "Firma", full: true },
  { key: "firstName", label: "Vorname *" },
  { key: "lastName", label: "Nachname *" },
  { key: "street", label: "Strasse und Hausnummer", placeholder: "z.B. Bahnhofstrasse 1" },
  { key: "postalCode", label: "PLZ", placeholder: "z.B. 8000" },
  { key: "city", label: "Ort", placeholder: "z.B. Zürich" },
  { key: "phone", label: "Telefon", placeholder: "z.B. 044 123 45 67", type: "tel" },
  { key: "mobile", label: "Mobil", placeholder: "z.B. 079 123 45 67", type: "tel" },
  { key: "email", label: "E-Mail", placeholder: "z.B. name@beispiel.ch", type: "email" },
  { key: "note", label: "Notiz", full: true, multiline: true },
  {
    key: "additionalInfo",
    label: "Zusatzinfo (unterscheidet Kunden mit gleichem Namen)",
    full: true,
    multiline: true,
  },
];

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

const PHONE_ERROR = "Ungültige Nummer, z.B. 079 123 45 67 oder +41 79 123 45 67";

export function CustomerForm({ initial, customers, submitting, errorMessage, onSubmit, onCancel }: CustomerFormProps) {
  const [values, setValues] = useState<Record<TextKey, string>>(() => {
    const record = {} as Record<TextKey, string>;
    for (const field of FIELDS) record[field.key] = initial?.[field.key] ?? "";
    return record;
  });
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [country, setCountry] = useState(initial?.country ?? "CH");
  const [active, setActive] = useState(initial?.active ?? true);
  const [errors, setErrors] = useState<Partial<Record<TextKey, string>>>({});

  function update(key: TextKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Shown as soon as the names match, so the additional info can be
  // filled in before saving.
  const duplicate =
    values.firstName.trim() && values.lastName.trim()
      ? findDuplicateCustomer(
          customers,
          { firstName: values.firstName, lastName: values.lastName, additionalInfo: values.additionalInfo },
          initial?.id ?? null,
        )
      : null;
  const fieldErrors: Partial<Record<TextKey, string>> = {
    ...errors,
    additionalInfo: duplicate ? duplicateCustomerMessage(duplicate) : errors.additionalInfo,
  };

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<TextKey, string>> = {};
    if (!values.firstName.trim()) nextErrors.firstName = "Vorname ist ein Pflichtfeld";
    if (!values.lastName.trim()) nextErrors.lastName = "Nachname ist ein Pflichtfeld";
    if (values.email.trim() && !isValidEmail(values.email.trim())) {
      nextErrors.email = "Ungültige E-Mail-Adresse, z.B. name@beispiel.ch";
    }
    const postalError = values.postalCode.trim() ? postalCodeError(country, values.postalCode.trim()) : null;
    if (postalError) nextErrors.postalCode = postalError;
    if (values.phone.trim() && !isValidPhone(values.phone.trim())) nextErrors.phone = PHONE_ERROR;
    if (values.mobile.trim() && !isValidPhone(values.mobile.trim())) nextErrors.mobile = PHONE_ERROR;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || duplicate) return;

    onSubmit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      street: emptyToNull(values.street),
      postalCode: emptyToNull(values.postalCode),
      city: emptyToNull(values.city),
      country,
      phone: emptyToNull(values.phone),
      mobile: emptyToNull(values.mobile),
      email: emptyToNull(values.email),
      gender,
      company: emptyToNull(values.company),
      note: emptyToNull(values.note),
      additionalInfo: emptyToNull(values.additionalInfo),
      active,
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        {FIELDS.map((field) => (
          <Fragment key={field.key}>
            {/* Before the postal code, whose format depends on it. */}
            {field.key === "postalCode" && (
              <FormField label="Land" htmlFor="customer-country">
                <Select
                  id="customer-country"
                  value={country}
                  onValueChange={(value) => {
                    setCountry(value);
                    setErrors((prev) => ({ ...prev, postalCode: undefined }));
                  }}
                  options={COUNTRY_OPTIONS}
                />
              </FormField>
            )}
            <div className={field.full ? "form-grid-full" : undefined}>
              <FormField label={field.label} htmlFor={`customer-${field.key}`} error={fieldErrors[field.key]}>
                {field.multiline ? (
                  <Textarea
                    id={`customer-${field.key}`}
                    value={values[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    rows={2}
                  />
                ) : (
                  <Input
                    id={`customer-${field.key}`}
                    type={field.type ?? "text"}
                    value={values[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    // Most customers are private persons: start with the first name.
                    autoFocus={field.key === "firstName"}
                  />
                )}
              </FormField>
            </div>
            {field.key === "email" && (
              <FormField label="Geschlecht (für die Anrede)" htmlFor="customer-gender">
                <Select
                  id="customer-gender"
                  value={gender ?? NO_GENDER}
                  onValueChange={(value) => setGender(value === NO_GENDER ? null : (value as Gender))}
                  options={GENDER_OPTIONS}
                />
              </FormField>
            )}
          </Fragment>
        ))}

        {initial && (
          <div className="form-grid-checkboxes">
            <div className="form-field-row">
              <Checkbox id="customer-active" checked={active} onCheckedChange={setActive} />
              <label htmlFor="customer-active">Aktiv</label>
            </div>
          </div>
        )}
      </div>

      {errorMessage && <p className="field-error">{errorMessage}</p>}

      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          {initial ? "Speichern" : "Anlegen"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
