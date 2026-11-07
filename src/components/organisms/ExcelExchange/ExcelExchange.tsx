import { useState } from "react";

import { Button } from "../../atoms/Button";
import { Modal } from "../../molecules/Modal";
import { useExcelExchange } from "../../../hooks/useExcel";
import { pickExcelFileToImport, pickExcelFileToSave } from "../../../lib/excelFiles";
import { EXCEL_KIND_LABELS } from "../../../types/excel";
import type { ExcelKind, ImportChange, ImportPreview } from "../../../types/excel";

export interface ExcelExchangeProps {
  kind: ExcelKind;
}

function ChangeList({ title, changes }: { title: string; changes: ImportChange[] }) {
  if (changes.length === 0) return null;
  return (
    <>
      <h3 className="excel-preview-title">
        {title} ({changes.length})
      </h3>
      <ul className="excel-preview-list">
        {changes.map((change) => (
          <li key={change.row}>
            <span className="muted">Zeile {change.row}:</span> {change.label}
            {change.changes.length > 0 && <span className="muted"> · {change.changes.join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Exports the data as an Excel file, which also serves as the template, and
 * imports such a file after showing what it would change.
 */
export function ExcelExchange({ kind }: ExcelExchangeProps) {
  const { exportFile, previewFile, applyFile } = useExcelExchange(kind);
  const label = EXCEL_KIND_LABELS[kind];
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState<{ path: string; preview: ImportPreview } | null>(null);

  async function handleExport() {
    setMessage(null);
    const path = await pickExcelFileToSave(label);
    if (!path) return;
    exportFile.mutate(path, { onSuccess: () => setMessage(`${label} exportiert.`) });
  }

  async function handleImport() {
    setMessage(null);
    const path = await pickExcelFileToImport(label);
    if (!path) return;
    previewFile.mutate(path, { onSuccess: (preview) => setImporting({ path, preview }) });
  }

  function closePreview() {
    setImporting(null);
    applyFile.reset();
  }

  function handleApply() {
    if (!importing) return;
    applyFile.mutate(importing.path, {
      onSuccess: (result) => {
        closePreview();
        setMessage(`Import abgeschlossen: ${result.created} neu, ${result.updated} geändert.`);
      },
    });
  }

  const preview = importing?.preview;
  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const hasChanges = (preview?.created.length ?? 0) + (preview?.updated.length ?? 0) > 0;
  const error = exportFile.error?.message ?? previewFile.error?.message;

  return (
    <div className="excel-exchange">
      <div className="excel-exchange-row">
        <strong className="excel-exchange-label">{label}</strong>
        <Button type="button" variant="secondary" disabled={exportFile.isPending} onClick={() => void handleExport()}>
          Exportieren
        </Button>
        <Button type="button" variant="secondary" disabled={previewFile.isPending} onClick={() => void handleImport()}>
          Importieren
        </Button>
      </div>
      {message && <p className="muted">{message}</p>}
      {error && <p className="field-error">{error}</p>}

      <Modal open={importing !== null} title={`${label} importieren`} onClose={closePreview} size="lg">
        {preview && (
          <div className="excel-preview">
            <p>
              <strong>{preview.created.length}</strong> neu · <strong>{preview.updated.length}</strong> geändert ·{" "}
              <strong>{preview.unchanged}</strong> unverändert
              {hasErrors && (
                <>
                  {" "}
                  · <strong className="field-error">{preview.errors.length} Fehler</strong>
                </>
              )}
            </p>

            {hasErrors && (
              <>
                <p className="field-error">
                  Die Datei enthält Fehler. Es wird nichts übernommen, bis sie korrigiert und erneut gewählt wird.
                </p>
                <ul className="excel-preview-list">
                  {preview.errors.map((rowError, index) => (
                    <li key={index}>
                      <span className="muted">Zeile {rowError.row}:</span> {rowError.message}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <ChangeList title="Neu" changes={preview.created} />
            <ChangeList title="Geändert" changes={preview.updated} />
            {!hasErrors && !hasChanges && <p className="muted">Die Datei enthält keine Änderungen.</p>}
            {applyFile.error && <p className="field-error">{applyFile.error.message}</p>}

            <div className="form-actions">
              <Button type="button" disabled={hasErrors || !hasChanges || applyFile.isPending} onClick={handleApply}>
                Übernehmen
              </Button>
              <Button type="button" variant="secondary" disabled={applyFile.isPending} onClick={closePreview}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
