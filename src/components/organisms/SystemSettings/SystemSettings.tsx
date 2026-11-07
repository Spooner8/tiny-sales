import { Button } from "../../atoms/Button";
import { Select } from "../../atoms/Select";
import { FormField } from "../../molecules/FormField";
import { Checkbox } from "../../ui/checkbox";
import { useAppVersionQuery, useInstallUpdate, useUpdateCheckQuery } from "../../../hooks/useAppUpdate";
import { useSetTestMode, useTestModeQuery } from "../../../hooks/useSettings";
import { useTheme } from "../../../hooks/useTheme";
import { THEME_LABELS, THEME_PREFERENCES } from "../../../lib/theme";
import { confirmUpdate, installLabel } from "../../../lib/update";
import type { ThemePreference } from "../../../lib/theme";

export function SystemSettings() {
  const theme = useTheme();
  const { data: testMode } = useTestModeQuery();
  const setTestMode = useSetTestMode();

  const { data: appVersion } = useAppVersionQuery();
  const updateCheck = useUpdateCheckQuery();
  const update = updateCheck.data;
  const installUpdate = useInstallUpdate();

  async function handleInstallUpdate() {
    if (!update || !(await confirmUpdate(update.version))) return;
    installUpdate.mutate(update);
  }

  return (
    <>
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
        <h2>Updates</h2>
        <p>
          Installierte Version: <strong>{appVersion ?? "..."}</strong>
        </p>
        <p className="muted">
          Beim Start wird automatisch nach einer neuen Version gesucht. Vor dem ersten Start einer neuen Version, die die
          Datenbank umstellt, wird neben der Datenbank eine Sicherung angelegt (…-before-update-….db).
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

      <div className="settings-section">
        <h2>Test-Modus</h2>
        <p className="muted">
          Im Test-Modus wird eine separate Test-Datenbank (tiny-sales-dev.db) verwendet. Dort kann gefahrlos ausprobiert
          werden, die produktiven Daten bleiben unberührt.
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
    </>
  );
}
