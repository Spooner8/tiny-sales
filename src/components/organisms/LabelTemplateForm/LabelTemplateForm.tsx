import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import { FormField } from "../../molecules/FormField";
import { Checkbox } from "../../ui/checkbox";
import { LabelPagePreview } from "../LabelPagePreview";
import { parseNumericInput } from "../../../lib/utils";
import { RECEIPT_PAPER_SIZES } from "../../../types/settings";
import type { ReceiptPaperSize } from "../../../types/settings";
import { PAPER_ORIENTATION_LABELS, PAPER_ORIENTATIONS } from "../../../types/labelTemplate";
import type { LabelTemplate, PaperOrientation } from "../../../types/labelTemplate";

export interface LabelTemplateFormValues {
  name: string;
  paperSize: ReceiptPaperSize;
  orientation: PaperOrientation;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  marginXMm: number;
  marginYMm: number;
  active: boolean;
}

export interface LabelTemplateFormProps {
  initial?: LabelTemplate;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: LabelTemplateFormValues) => void;
  onCancel: () => void;
}

const PAPER_SIZE_OPTIONS = RECEIPT_PAPER_SIZES.map((size) => ({ value: size, label: size }));
const ORIENTATION_OPTIONS = PAPER_ORIENTATIONS.map((o) => ({ value: o, label: PAPER_ORIENTATION_LABELS[o] }));

export function LabelTemplateForm({ initial, submitting, errorMessage, onSubmit, onCancel }: LabelTemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>(initial?.paperSize ?? "A4");
  const [orientation, setOrientation] = useState<PaperOrientation>(initial?.orientation ?? "portrait");
  const [columns, setColumns] = useState(initial?.columns ?? 2);
  const [rows, setRows] = useState(initial?.rows ?? 5);
  const [labelWidthMm, setLabelWidthMm] = useState(initial?.labelWidthMm ?? 90);
  const [labelHeightMm, setLabelHeightMm] = useState(initial?.labelHeightMm ?? 50);
  const [gapXMm, setGapXMm] = useState(initial?.gapXMm ?? 3);
  const [gapYMm, setGapYMm] = useState(initial?.gapYMm ?? 3);
  const [marginXMm, setMarginXMm] = useState(initial?.marginXMm ?? 10);
  const [marginYMm, setMarginYMm] = useState(initial?.marginYMm ?? 10);
  const [active, setActive] = useState(initial?.active ?? true);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name, paperSize, orientation, columns, rows, labelWidthMm, labelHeightMm, gapXMm, gapYMm, marginXMm, marginYMm, active });
  }

  return (
    <>
      <form className="form" onSubmit={handleSubmit}>
      <FormField label="Name" htmlFor="label-template-name">
        <Input id="label-template-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </FormField>

      <FormField label="Papierformat" htmlFor="label-template-paper-size">
        <Select
          id="label-template-paper-size"
          value={paperSize}
          onValueChange={(value) => setPaperSize(value as ReceiptPaperSize)}
          options={PAPER_SIZE_OPTIONS}
        />
      </FormField>

      <FormField label="Ausrichtung" htmlFor="label-template-orientation">
        <Select
          id="label-template-orientation"
          value={orientation}
          onValueChange={(value) => setOrientation(value as PaperOrientation)}
          options={ORIENTATION_OPTIONS}
        />
      </FormField>

      <div className="label-config-grid">
        <FormField label="Spalten" htmlFor="label-template-columns">
          <Input
            id="label-template-columns"
            type="text"
            inputMode="numeric"
            value={columns}
            onChange={(e) => setColumns(parseNumericInput(e.target.value, columns))}
          />
        </FormField>
        <FormField label="Zeilen" htmlFor="label-template-rows">
          <Input
            id="label-template-rows"
            type="text"
            inputMode="numeric"
            value={rows}
            onChange={(e) => setRows(parseNumericInput(e.target.value, rows))}
          />
        </FormField>
        <FormField label="Etikettenbreite (mm)" htmlFor="label-template-width">
          <Input
            id="label-template-width"
            type="text"
            inputMode="decimal"
            value={labelWidthMm}
            onChange={(e) => setLabelWidthMm(parseNumericInput(e.target.value, labelWidthMm))}
          />
        </FormField>
        <FormField label="Etikettenhöhe (mm)" htmlFor="label-template-height">
          <Input
            id="label-template-height"
            type="text"
            inputMode="decimal"
            value={labelHeightMm}
            onChange={(e) => setLabelHeightMm(parseNumericInput(e.target.value, labelHeightMm))}
          />
        </FormField>
        <FormField label="Abstand horizontal (mm)" htmlFor="label-template-gap-x">
          <Input
            id="label-template-gap-x"
            type="text"
            inputMode="decimal"
            value={gapXMm}
            onChange={(e) => setGapXMm(parseNumericInput(e.target.value, gapXMm))}
          />
        </FormField>
        <FormField label="Abstand vertikal (mm)" htmlFor="label-template-gap-y">
          <Input
            id="label-template-gap-y"
            type="text"
            inputMode="decimal"
            value={gapYMm}
            onChange={(e) => setGapYMm(parseNumericInput(e.target.value, gapYMm))}
          />
        </FormField>
        <FormField label="Seitenrand links/rechts (mm)" htmlFor="label-template-margin-x">
          <Input
            id="label-template-margin-x"
            type="text"
            inputMode="decimal"
            value={marginXMm}
            onChange={(e) => setMarginXMm(parseNumericInput(e.target.value, marginXMm))}
          />
        </FormField>
        <FormField label="Seitenrand oben/unten (mm)" htmlFor="label-template-margin-y">
          <Input
            id="label-template-margin-y"
            type="text"
            inputMode="decimal"
            value={marginYMm}
            onChange={(e) => setMarginYMm(parseNumericInput(e.target.value, marginYMm))}
          />
        </FormField>
      </div>

      {initial && (
        <div className="form-field form-field-row">
          <Checkbox id="label-template-active" checked={active} onCheckedChange={setActive} />
          <label htmlFor="label-template-active">Aktiv</label>
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

      <LabelPagePreview
        config={{ paperSize, orientation, columns, rows, labelWidthMm, labelHeightMm, gapXMm, gapYMm, marginXMm, marginYMm }}
      />
    </>
  );
}
