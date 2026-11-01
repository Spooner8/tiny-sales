import { open, save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { Select } from "../components/atoms/Select";
import { FormField } from "../components/molecules/FormField";
import { PageHeader } from "../components/molecules/PageHeader";
import { CompanyProfileForm } from "../components/organisms/CompanyProfileForm";
import { Checkbox } from "../components/ui/checkbox";
import {
  useBackupDatabase,
  useDbPathQuery,
  useReceiptPaperSizeQuery,
  useRestoreDatabase,
  useCreateDatabase,
  useOpenDatabase,
  useSetReceiptPaperSize,
  useSetTestMode,
  useTestModeQuery,
} from "../hooks/useSettings";
import { useAppVersionQuery, useInstallUpdate, useUpdateCheckQuery } from "../hooks/useAppUpdate";
import { useCompanyProfileQuery, useSaveCompanyProfile } from "../hooks/useCompanyProfile";
import { useTheme } from "../hooks/useTheme";
import { confirmAction } from "../lib/confirm";
import { THEME_LABELS, THEME_PREFERENCES } from "../lib/theme";
import { confirmUpdate, installLabel } from "../lib/update";
import type { ThemePreference } from "../lib/theme";
import { RECEIPT_PAPER_SIZES } from "../types/settings";
import type { ReceiptPaperSize } from "../types/settings";

export function SettingsPage() {
  const { data: dbPath, isLoading, error } = useDbPathQuery();
  const openDatabase = useOpenDatabase();
  const createDatabase = useCreateDatabase();
  const switchError = openDatabase.error ?? createDatabase.error;
  const switching = openDatabase.isPending || createDatabase.isPending;
  const backupDatabase = useBackupDatabase();
  const restoreDatabase = useRestoreDatabase();
  const { data: paperSize } = useReceiptPaperSizeQuery();
  const setPaperSize = useSetReceiptPaperSize();
  const theme = useTheme();
  const { data: testMode } = useTestModeQuery();
  const setTestMode = useSetTestMode();

  const { data: companyProfile, error: companyProfileError } = useCompanyProfileQuery();
  const saveCompanyProfile = useSaveCompanyProfile();
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const { data: appVersion } = useAppVersionQuery();
  const updateCheck = useUpdateCheckQuery();
  const update = updateCheck.data;
  const installUpdate = useInstallUpdate();

  async function handleInstallUpdate() {
    if (!update || !(await confirmUpdate(update.version))) return;
    installUpdate.mutate(update);
  }

  // An open dialog: picking an existing file never asks to overwrite it.
  async function handleOpenDatabase() {
    createDatabase.reset();
    const path = await open({
      title: "Bestehende Datenbank öffnen",
      defaultPath: dbPath,
      filters: [{ name: "SQLite-Datenbank", extensions: ["db"] }],
      multiple: false,
    });
    if (path && typeof path === "string") openDatabase.mutate(path);
  }

  async function handleCreateDatabase() {
    openDatabase.reset();
    const path = await save({
      title: "Neue Datenbank anlegen",
      defaultPath: "kasse-neu.db",
      filters: [{ name: "SQLite-Datenbank", extensions: ["db"] }],
    });
    if (path) createDatabase.mutate(path);
  }

  async function handleBackup() {
    setBackupMessage(null);
    const destination = await save({
      title: "Backup speichern",
      defaultPath: `backup${testMode ? "-test" : ""}-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: "SQLite-Datenbank", extensions: ["db"] }],
    });
    if (!destination) return;
    backupDatabase.mutate(destination, {
      onSuccess: () => setBackupMessage(`Backup gespeichert: ${destination}`),
    });
  }

  async function handleRestore() {
    setRestoreMessage(null);
    const source = await open({
      title: "Backup auswählen",
      filters: [{ name: "SQLite-Datenbank", extensions: ["db"] }],
      multiple: false,
    });
    if (!source || typeof source !== "string") return;
    const confirmed = await confirmAction(
      `Alle Daten in der aktuellen Datenbank
${dbPath}
werden durch den Inhalt des Backups ersetzt.

` +
        "Vorher wird automatisch eine Sicherheitskopie der aktuellen Daten angelegt. Fortfahren?",
      "Wiederherstellen",
    );
    if (!confirmed) return;
    restoreDatabase.mutate(source, {
      onSuccess: (safetyCopy) =>
        setRestoreMessage(`Backup wiederhergestellt. Die vorherigen Daten wurden gesichert unter: ${safetyCopy}`),
    });
  }

  return (
    <section>
      <PageHeader title="Einstellungen" />

      {/* Left: the small cards in pairs, then the others; right: the company
          details. Both columns have a minimum width, the page scrolls below it. */}
      <div className="settings-layout">
        <div className="settings-layout-column">
          <div className="settings-layout-pair">
            <div className="settings-section">
              <h2>Darstellung</h2>
              <FormField label="Farbschema" htmlFor="theme-preference">
                <Select
                  id="theme-preference"
                  value={theme.preference}
                  onValueChange={(value) => theme.setPreference(value as ThemePreference)}
                  options={THEME_PREFERENCES.map((p) => ({ value: p, label: THEME_LABELS[p] }))}
                />
              </FormField>
            </div>

            <div className="settings-section">
              <h2>Quittung</h2>
              <FormField label="Papiergrösse" htmlFor="receipt-paper-size">
                <Select
                  id="receipt-paper-size"
                  value={paperSize ?? "A4"}
                  onValueChange={(value) => setPaperSize.mutate(value as ReceiptPaperSize)}
                  options={RECEIPT_PAPER_SIZES.map((size) => ({ value: size, label: size }))}
                />
              </FormField>
            </div>
          </div>

          <div className="settings-section">
            <h2>Test-Modus</h2>
            <p className="muted">
              Im Test-Modus wird eine separate Test-Datenbank (tiny-sales-dev.db) verwendet. Dort kann gefahrlos
              ausprobiert werden, die produktiven Daten bleiben unberührt.
            </p>
            <div className="form-field form-field-row">
              <Checkbox
                id="test-mode"
                checked={testMode ?? false}
                disabled={testMode === undefined || setTestMode.isPending}
                onCheckedChange={(checked) => setTestMode.mutate(checked)}
              />
              <label htmlFor="test-mode">Test-Modus aktiv</label>
            </div>
            {setTestMode.error && <p className="field-error">{setTestMode.error.message}</p>}
          </div>

          <div className="settings-section">
            <h2>Datenbank</h2>
            <p>
              {testMode ? "Aktive Test-Datenbank:" : "Aktueller Pfad:"}{" "}
              <code className="settings-path">
                {isLoading ? "wird geladen..." : error ? `Fehler: ${error.message}` : dbPath}
              </code>
            </p>
            <div className="form-actions">
              <Button type="button" onClick={handleOpenDatabase} disabled={switching || testMode}>
                Datenbank öffnen
              </Button>
              <Button type="button" variant="secondary" onClick={handleCreateDatabase} disabled={switching || testMode}>
                Neue Datenbank anlegen
              </Button>
            </div>
            <p className="muted">
              „Datenbank öffnen“ verwendet eine bestehende Datei (z.B. eine ältere Kopie) unverändert weiter. „Neue
              Datenbank anlegen“ erstellt eine leere Datenbank und überschreibt nie eine bestehende Datei.
            </p>
            {testMode && <p className="muted">Die produktive Datenbank kann nur ausserhalb des Test-Modus gewechselt werden.</p>}
            {switchError && <p className="field-error">{switchError.message}</p>}
          </div>

          <div className="settings-section">
            <h2>Backup &amp; Wiederherstellung</h2>
            <p className="muted">
              Beim Wiederherstellen wird der Inhalt der aktuell verwendeten Datenbank durch das Backup ersetzt (nicht
              zusammengeführt). Der Pfad bleibt gleich, die Datei enthält danach die Daten des Backups.
            </p>
            <div className="form-actions">
              <Button type="button" onClick={handleBackup} disabled={backupDatabase.isPending}>
                Backup erstellen
              </Button>
              <Button type="button" variant="secondary" onClick={handleRestore} disabled={restoreDatabase.isPending}>
                Backup wiederherstellen
              </Button>
            </div>
            {backupMessage && <p>{backupMessage}</p>}
            {restoreMessage && <p>{restoreMessage}</p>}
            {backupDatabase.error && <p className="field-error">{backupDatabase.error.message}</p>}
            {restoreDatabase.error && <p className="field-error">{restoreDatabase.error.message}</p>}
          </div>

          <div className="settings-section">
            <h2>Updates</h2>
            <p>
              Installierte Version: <strong>{appVersion ?? "..."}</strong>
            </p>
            <p className="muted">
              Beim Start wird automatisch nach einer neuen Version gesucht. Vor dem ersten Start einer neuen Version, die
              die Datenbank umstellt, wird neben der Datenbank eine Sicherung angelegt (…-before-update-….db).
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => updateCheck.refetch()}
                disabled={updateCheck.isFetching || installUpdate.isPending}
              >
                {updateCheck.isFetching ? "Suche läuft..." : "Nach Updates suchen"}
              </Button>
              {update && (
                <Button type="button" onClick={handleInstallUpdate} disabled={installUpdate.isPending}>
                  {installLabel(installUpdate.isPending, installUpdate.progress)}
                </Button>
              )}
            </div>
            {!updateCheck.isFetching && updateCheck.error && (
              <p className="field-error">Suche fehlgeschlagen: {updateCheck.error.message}</p>
            )}
            {!updateCheck.isFetching && updateCheck.isSuccess && !update && <p>Tiny Sales ist auf dem neuesten Stand.</p>}
            {update && <p>Version {update.version} ist verfügbar.</p>}
            {installUpdate.error && <p className="field-error">Update fehlgeschlagen: {installUpdate.error.message}</p>}
          </div>
        </div>

        <div className="settings-layout-column">
          <div className="settings-section">
            <h2>Firma</h2>
            <p className="muted">
              Erscheint im Kopf und Fuss der Quittung und im Menü. Leere Felder werden auf der Quittung weggelassen.
              Die Angaben sind in der Datenbank gespeichert und daher auch im Backup enthalten.
            </p>
            {companyProfileError && <p className="field-error">{companyProfileError.message}</p>}
            {companyProfile && (
              <CompanyProfileForm
                // Another database (test mode, restore) brings its own profile.
                key={dbPath}
                initial={companyProfile}
                submitting={saveCompanyProfile.isPending}
                errorMessage={saveCompanyProfile.error?.message}
                saved={saveCompanyProfile.isSuccess}
                onSubmit={(values) => saveCompanyProfile.mutate(values)}
                onChange={() => saveCompanyProfile.reset()}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
