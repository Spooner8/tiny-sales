import { open, save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

import { Button } from "../../atoms/Button";
import { ExcelExchange } from "../ExcelExchange";
import {
  useBackupDatabase,
  useCreateDatabase,
  useDbPathQuery,
  useOpenDatabase,
  useRestoreDatabase,
  useTestModeQuery,
} from "../../../hooks/useSettings";
import { confirmAction } from "../../../lib/confirm";
import { pickExistingDatabase, pickNewDatabasePath } from "../../../lib/databaseFiles";

export function DataSettings() {
  const { data: dbPath, isLoading, error } = useDbPathQuery();
  const { data: testMode } = useTestModeQuery();
  const openDatabase = useOpenDatabase();
  const createDatabase = useCreateDatabase();
  const switchError = openDatabase.error ?? createDatabase.error;
  const switching = openDatabase.isPending || createDatabase.isPending;
  const backupDatabase = useBackupDatabase();
  const restoreDatabase = useRestoreDatabase();
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  async function handleOpenDatabase() {
    createDatabase.reset();
    const path = await pickExistingDatabase(dbPath);
    if (path) openDatabase.mutate(path);
  }

  async function handleCreateDatabase() {
    openDatabase.reset();
    const path = await pickNewDatabasePath();
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
    <>
      <div className="settings-section">
        <h2>Excel-Import und -Export</h2>
        <p className="muted">
          Der Export enthält alle bestehenden Einträge und dient auch als Vorlage. Die Datei kann in Excel oder LibreOffice
          bearbeitet und wieder importiert werden. Vor dem Import werden alle Änderungen angezeigt, gelöscht wird nie etwas.
        </p>
        <ExcelExchange kind="articles" />
        <ExcelExchange kind="customers" />
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
          „Datenbank öffnen“ verwendet eine bestehende Datei (z.B. eine ältere Kopie) unverändert weiter. „Neue Datenbank
          anlegen“ erstellt eine leere Datenbank und überschreibt nie eine bestehende Datei.
        </p>
        {testMode && <p className="muted">Die produktive Datenbank kann nur ausserhalb des Test-Modus gewechselt werden.</p>}
        {switchError && <p className="field-error">{switchError.message}</p>}
      </div>
    </>
  );
}
