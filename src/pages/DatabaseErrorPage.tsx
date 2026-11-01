import { Button } from "../components/atoms/Button";
import { useAppVersionQuery, useInstallUpdate, useUpdateCheckQuery } from "../hooks/useAppUpdate";
import {
  useCreateDatabase,
  useDbPathQuery,
  useOpenDatabase,
  useRetryDatabase,
  useSetTestMode,
  useTestModeQuery,
} from "../hooks/useSettings";
import { pickExistingDatabase, pickNewDatabasePath } from "../lib/databaseFiles";
import { confirmUpdate, installLabel } from "../lib/update";

export interface DatabaseErrorPageProps {
  /** Why the database couldn't be opened at startup. */
  error: string;
}

/**
 * Shown instead of the app when the database couldn't be opened at startup,
 * e.g. because it was migrated by a newer version on another computer or
 * the NAS it lives on isn't reachable. Offers what can fix it: an update,
 * trying again, or another database.
 */
export function DatabaseErrorPage({ error }: DatabaseErrorPageProps) {
  const { data: dbPath } = useDbPathQuery();
  const { data: testMode } = useTestModeQuery();
  const { data: appVersion } = useAppVersionQuery();
  const updateCheck = useUpdateCheckQuery();
  const update = updateCheck.data;
  const installUpdate = useInstallUpdate();

  const retryDatabase = useRetryDatabase();
  const openDatabase = useOpenDatabase();
  const createDatabase = useCreateDatabase();
  const setTestMode = useSetTestMode();
  const databaseActions = [retryDatabase, openDatabase, createDatabase, setTestMode];
  const busy = databaseActions.some((action) => action.isPending) || installUpdate.isPending;
  const actionError = databaseActions.find((action) => action.error)?.error;

  function resetActions() {
    for (const action of databaseActions) action.reset();
  }

  async function handleInstallUpdate() {
    if (!update || !(await confirmUpdate(update.version))) return;
    installUpdate.mutate(update);
  }

  async function handleOpenDatabase() {
    resetActions();
    const path = await pickExistingDatabase(dbPath);
    if (path) openDatabase.mutate(path);
  }

  async function handleCreateDatabase() {
    resetActions();
    const path = await pickNewDatabasePath();
    if (path) createDatabase.mutate(path);
  }

  return (
    <main className="app-content">
      <div className="database-error-page">
        <div className="settings-section">
          <h1 className="database-error-title">Datenbank kann nicht geöffnet werden</h1>
          <p className="field-error">{error}</p>
          <p>
            {testMode ? "Test-Datenbank:" : "Datenbank:"} <code className="settings-path">{dbPath ?? "..."}</code>
          </p>
          <p className="muted">
            Wurde die Datenbank bei einem Update umgestellt, liegt der Stand davor als Sicherung im selben Ordner
            (…-before-update-….db).
          </p>
        </div>

        <div className="settings-section">
          <h2>Update</h2>
          <p>
            Installierte Version: <strong>{appVersion ?? "..."}</strong>
          </p>
          {updateCheck.isFetching && <p>Suche nach Updates...</p>}
          {!updateCheck.isFetching && update && <p>Version {update.version} ist verfügbar.</p>}
          {!updateCheck.isFetching && updateCheck.isSuccess && !update && <p>Es ist keine neuere Version verfügbar.</p>}
          {!updateCheck.isFetching && updateCheck.error && (
            <p className="field-error">Suche fehlgeschlagen: {updateCheck.error.message}</p>
          )}
          <div className="form-actions">
            {update && (
              <Button type="button" onClick={handleInstallUpdate} disabled={busy}>
                {installLabel(installUpdate.isPending, installUpdate.progress)}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => updateCheck.refetch()}
              disabled={updateCheck.isFetching || busy}
            >
              Erneut suchen
            </Button>
          </div>
          {installUpdate.error && <p className="field-error">Update fehlgeschlagen: {installUpdate.error.message}</p>}
        </div>

        <div className="settings-section">
          <h2>Datenbank</h2>
          <p className="muted">
            Ist die Datenbank gerade nicht erreichbar (z.B. auf einem NAS), später erneut versuchen. Sonst kann eine
            andere Datenbank geöffnet oder eine neue angelegt werden.
          </p>
          <div className="form-actions">
            <Button
              type="button"
              onClick={() => {
                resetActions();
                retryDatabase.mutate();
              }}
              disabled={busy}
            >
              Erneut versuchen
            </Button>
            {testMode ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  resetActions();
                  setTestMode.mutate(false);
                }}
                disabled={busy}
              >
                Test-Modus beenden
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={handleOpenDatabase} disabled={busy}>
                  Andere Datenbank öffnen
                </Button>
                <Button type="button" variant="secondary" onClick={handleCreateDatabase} disabled={busy}>
                  Neue Datenbank anlegen
                </Button>
              </>
            )}
          </div>
          {actionError && <p className="field-error">{actionError.message}</p>}
        </div>
      </div>
    </main>
  );
}
