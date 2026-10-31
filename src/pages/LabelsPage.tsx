import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { Select } from "../components/atoms/Select";
import { FormField } from "../components/molecules/FormField";
import { PageHeader } from "../components/molecules/PageHeader";
import { LabelPagePreview } from "../components/organisms/LabelPagePreview";
import { LabelQueueEditor } from "../components/organisms/LabelQueueEditor";
import { useArticlesQuery } from "../hooks/useArticles";
import { useCreateLabelTemplate, useLabelTemplatesQuery, useUpdateLabelTemplate } from "../hooks/useLabelTemplates";
import { buildLabelPages } from "../lib/labels/buildPages";
import type { LabelEntry, LabelGridConfig } from "../lib/labels/buildPages";
import { parseNumericInput } from "../lib/utils";
import { PAPER_ORIENTATION_LABELS, PAPER_ORIENTATIONS } from "../types/labelTemplate";
import type { PaperOrientation } from "../types/labelTemplate";
import { RECEIPT_PAPER_SIZES } from "../types/settings";
import type { ReceiptPaperSize } from "../types/settings";

const DEFAULT_CONFIG: LabelGridConfig = {
  paperSize: "A4",
  orientation: "portrait",
  columns: 2,
  rows: 5,
  labelWidthMm: 90,
  labelHeightMm: 50,
  gapXMm: 3,
  gapYMm: 3,
  marginXMm: 10,
  marginYMm: 10,
};

function applyPrintStyle(paperSize: ReceiptPaperSize, orientation: PaperOrientation) {
  const styleId = "label-print-page-size";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${paperSize} ${orientation}; margin: 0; }`;
}

export function LabelsPage() {
  const { data: articles, isLoading } = useArticlesQuery();
  const { data: templates } = useLabelTemplatesQuery();
  const createTemplate = useCreateLabelTemplate();
  const updateTemplate = useUpdateLabelTemplate();

  const [entries, setEntries] = useState<LabelEntry[]>([]);
  const [config, setConfig] = useState<LabelGridConfig>(DEFAULT_CONFIG);
  const [startOffset, setStartOffset] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const activeArticles = (articles ?? []).filter((a) => a.active);
  const activeTemplates = (templates ?? []).filter((t) => t.active);
  const selectedTemplate = activeTemplates.find((t) => String(t.id) === selectedTemplateId);
  const pages = buildLabelPages(entries, config.columns, config.rows, Math.max(0, startOffset - 1));
  const labelCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);

  function updateConfig<K extends keyof LabelGridConfig>(key: K, value: LabelGridConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = activeTemplates.find((t) => String(t.id) === templateId);
    if (!template) return;
    setConfig({
      paperSize: template.paperSize,
      orientation: template.orientation,
      columns: template.columns,
      rows: template.rows,
      labelWidthMm: template.labelWidthMm,
      labelHeightMm: template.labelHeightMm,
      gapXMm: template.gapXMm,
      gapYMm: template.gapYMm,
      marginXMm: template.marginXMm,
      marginYMm: template.marginYMm,
    });
  }

  function saveAsTemplate() {
    const name = window.prompt("Name der Vorlage:");
    if (!name || !name.trim()) return;
    createTemplate.mutate({
      name: name.trim(),
      paperSize: config.paperSize,
      orientation: config.orientation,
      columns: config.columns,
      rows: config.rows,
      labelWidthMm: config.labelWidthMm,
      labelHeightMm: config.labelHeightMm,
      gapXMm: config.gapXMm,
      gapYMm: config.gapYMm,
      marginXMm: config.marginXMm,
      marginYMm: config.marginYMm,
    });
  }

  function updateSelectedTemplate() {
    if (!selectedTemplate) return;
    updateTemplate.mutate({
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      active: selectedTemplate.active,
      paperSize: config.paperSize,
      orientation: config.orientation,
      columns: config.columns,
      rows: config.rows,
      labelWidthMm: config.labelWidthMm,
      labelHeightMm: config.labelHeightMm,
      gapXMm: config.gapXMm,
      gapYMm: config.gapYMm,
      marginXMm: config.marginXMm,
      marginYMm: config.marginYMm,
    });
  }

  function handlePrint() {
    applyPrintStyle(config.paperSize, config.orientation);
    window.print();
  }

  return (
    <section>
      <PageHeader title="Etiketten" />

      {isLoading && <p>Wird geladen...</p>}

      {articles && (
        <>
          <div className="labels-layout no-print">
            <div className="labels-layout-column">
              <LabelQueueEditor articles={activeArticles} entries={entries} onChange={setEntries} />

              <div className="settings-section">
                <h2>Vorlage</h2>
                <div className="label-config-grid">
                  <FormField label="Gespeicherte Vorlage" htmlFor="label-template">
                    <Select
                      id="label-template"
                      value={selectedTemplateId}
                      onValueChange={applyTemplate}
                      placeholder="Keine Vorlage"
                      options={activeTemplates.map((t) => ({ value: String(t.id), label: t.name }))}
                    />
                  </FormField>
                  <FormField label="Papierformat" htmlFor="label-paper-size">
                    <Select
                      id="label-paper-size"
                      value={config.paperSize}
                      onValueChange={(value) => updateConfig("paperSize", value as ReceiptPaperSize)}
                      options={RECEIPT_PAPER_SIZES.map((size) => ({ value: size, label: size }))}
                    />
                  </FormField>
                  <FormField label="Ausrichtung" htmlFor="label-orientation">
                    <Select
                      id="label-orientation"
                      value={config.orientation}
                      onValueChange={(value) => updateConfig("orientation", value as PaperOrientation)}
                      options={PAPER_ORIENTATIONS.map((o) => ({ value: o, label: PAPER_ORIENTATION_LABELS[o] }))}
                    />
                  </FormField>
                </div>
                <div className="form-actions">
                  {selectedTemplate && (
                    <Button type="button" onClick={updateSelectedTemplate} disabled={updateTemplate.isPending}>
                      Vorlage "{selectedTemplate.name}" aktualisieren
                    </Button>
                  )}
                  <Button type="button" variant="secondary" onClick={saveAsTemplate} disabled={createTemplate.isPending}>
                    Als neue Vorlage speichern
                  </Button>
                </div>
                {createTemplate.error && <p className="field-error">{createTemplate.error.message}</p>}
                {updateTemplate.error && <p className="field-error">{updateTemplate.error.message}</p>}
                {updateTemplate.isSuccess && <p className="muted">Vorlage aktualisiert.</p>}
              </div>
            </div>

            <div className="labels-layout-column">
              <div className="settings-section">
                <h2>Rasterangabe</h2>
                <div className="label-config-grid">
                  <FormField label="Spalten" htmlFor="label-columns">
                    <Input
                      id="label-columns"
                      type="text"
                      inputMode="numeric"
                      value={config.columns}
                      onChange={(e) => updateConfig("columns", parseNumericInput(e.target.value, config.columns))}
                    />
                  </FormField>
                  <FormField label="Zeilen" htmlFor="label-rows">
                    <Input
                      id="label-rows"
                      type="text"
                      inputMode="numeric"
                      value={config.rows}
                      onChange={(e) => updateConfig("rows", parseNumericInput(e.target.value, config.rows))}
                    />
                  </FormField>
                  <FormField label="Etikettenbreite (mm)" htmlFor="label-width">
                    <Input
                      id="label-width"
                      type="text"
                      inputMode="decimal"
                      value={config.labelWidthMm}
                      onChange={(e) => updateConfig("labelWidthMm", parseNumericInput(e.target.value, config.labelWidthMm))}
                    />
                  </FormField>
                  <FormField label="Etikettenhöhe (mm)" htmlFor="label-height">
                    <Input
                      id="label-height"
                      type="text"
                      inputMode="decimal"
                      value={config.labelHeightMm}
                      onChange={(e) => updateConfig("labelHeightMm", parseNumericInput(e.target.value, config.labelHeightMm))}
                    />
                  </FormField>
                  <FormField label="Abstand horizontal (mm)" htmlFor="label-gap-x">
                    <Input
                      id="label-gap-x"
                      type="text"
                      inputMode="decimal"
                      value={config.gapXMm}
                      onChange={(e) => updateConfig("gapXMm", parseNumericInput(e.target.value, config.gapXMm))}
                    />
                  </FormField>
                  <FormField label="Abstand vertikal (mm)" htmlFor="label-gap-y">
                    <Input
                      id="label-gap-y"
                      type="text"
                      inputMode="decimal"
                      value={config.gapYMm}
                      onChange={(e) => updateConfig("gapYMm", parseNumericInput(e.target.value, config.gapYMm))}
                    />
                  </FormField>
                  <FormField label="Seitenrand links/rechts (mm)" htmlFor="label-margin-x">
                    <Input
                      id="label-margin-x"
                      type="text"
                      inputMode="decimal"
                      value={config.marginXMm}
                      onChange={(e) => updateConfig("marginXMm", parseNumericInput(e.target.value, config.marginXMm))}
                    />
                  </FormField>
                  <FormField label="Seitenrand oben/unten (mm)" htmlFor="label-margin-y">
                    <Input
                      id="label-margin-y"
                      type="text"
                      inputMode="decimal"
                      value={config.marginYMm}
                      onChange={(e) => updateConfig("marginYMm", parseNumericInput(e.target.value, config.marginYMm))}
                    />
                  </FormField>
                  <FormField label="Start bei Etikette Nr." htmlFor="label-offset">
                    <Input
                      id="label-offset"
                      type="text"
                      inputMode="numeric"
                      value={startOffset}
                      onChange={(e) => setStartOffset(parseNumericInput(e.target.value, startOffset))}
                    />
                  </FormField>
                </div>
                <p className="muted">
                  {config.columns * config.rows} Etiketten pro Bogen. Bereits benutzte Etiketten eines
                  teilweise bedruckten Bogens lassen sich über die Start-Position überspringen.
                </p>
              </div>
            </div>
          </div>

          <div className="label-page-preview-section">
            <div className="label-page-preview-header no-print">
              <h2>Seitenansicht</h2>
              <Button type="button" onClick={handlePrint} disabled={labelCount === 0}>
                Etiketten drucken
              </Button>
            </div>
            {labelCount === 0 && (
              <p className="muted no-print">Artikel auswählen, um sie auf dem Bogen zu sehen.</p>
            )}
            <LabelPagePreview config={config} pages={pages} />
          </div>
        </>
      )}
    </section>
  );
}
