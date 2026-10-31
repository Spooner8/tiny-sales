import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import { FormField } from "../../molecules/FormField";
import { Checkbox } from "../../ui/checkbox";
import type { ProductGroup } from "../../../types/productGroup";
import type { ProductSubgroup } from "../../../types/productSubgroup";

export interface ProductSubgroupFormValues {
  productGroupId: number;
  name: string;
  active: boolean;
}

export interface ProductSubgroupFormProps {
  initial?: ProductSubgroup;
  productGroups: ProductGroup[];
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: ProductSubgroupFormValues) => void;
  onCancel: () => void;
}

export function ProductSubgroupForm({
  initial,
  productGroups,
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: ProductSubgroupFormProps) {
  const [productGroupId, setProductGroupId] = useState<number | null>(initial?.productGroupId ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [errors, setErrors] = useState<{ productGroup?: string; name?: string }>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = {
      productGroup: productGroupId === null ? "Warengruppe ist ein Pflichtfeld" : undefined,
      name: name.trim() ? undefined : "Name ist ein Pflichtfeld",
    };
    setErrors(nextErrors);
    if (productGroupId === null || nextErrors.name) return;
    onSubmit({ productGroupId, name, active });
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <FormField label="Warengruppe *" htmlFor="product-subgroup-product-group" error={errors.productGroup}>
        <Select
          id="product-subgroup-product-group"
          value={productGroupId === null ? "" : String(productGroupId)}
          onValueChange={(value) => {
            setProductGroupId(Number(value));
            setErrors((prev) => ({ ...prev, productGroup: undefined }));
          }}
          options={productGroups.map((g) => ({ value: String(g.id), label: g.name }))}
          placeholder="Warengruppe wählen"
        />
      </FormField>

      <FormField label="Name *" htmlFor="product-subgroup-name" error={errors.name}>
        <Input
          id="product-subgroup-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          autoFocus
        />
      </FormField>

      {initial && (
        <div className="form-field form-field-row">
          <Checkbox id="product-subgroup-active" checked={active} onCheckedChange={setActive} />
          <label htmlFor="product-subgroup-active">Aktiv</label>
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
