import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { FormField } from "../../molecules/FormField";
import { Checkbox } from "../../ui/checkbox";
import type { ProductGroup } from "../../../types/productGroup";

export interface ProductGroupFormValues {
  name: string;
  active: boolean;
}

export interface ProductGroupFormProps {
  initial?: ProductGroup;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: ProductGroupFormValues) => void;
  onCancel: () => void;
}

export function ProductGroupForm({
  initial,
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: ProductGroupFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name, active });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <FormField label="Name" htmlFor="product-group-name">
        <Input
          id="product-group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </FormField>

      {initial && (
        <div className="form-field form-field-row">
          <Checkbox id="product-group-active" checked={active} onCheckedChange={setActive} />
          <label htmlFor="product-group-active">Aktiv</label>
        </div>
      )}

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
