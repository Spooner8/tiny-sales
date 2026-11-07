import { CompanyProfileForm } from "../CompanyProfileForm";
import { useCompanyProfileQuery, useSaveCompanyProfile } from "../../../hooks/useCompanyProfile";
import { useDbPathQuery } from "../../../hooks/useSettings";

export function CompanySettings() {
  const { data: dbPath } = useDbPathQuery();
  const { data: profile, error } = useCompanyProfileQuery();
  const save = useSaveCompanyProfile();

  return (
    <div className="settings-section">
      <h2>Firma</h2>
      <p className="muted">
        Erscheint im Kopf und Fuss der Quittung und im Menü. Leere Felder werden auf der Quittung weggelassen. Die
        Angaben sind in der Datenbank gespeichert und daher auch im Backup enthalten.
      </p>
      {error && <p className="field-error">{error.message}</p>}
      {profile && (
        <CompanyProfileForm
          // Another database (test mode, restore) brings its own profile.
          key={dbPath}
          initial={profile}
          submitting={save.isPending}
          errorMessage={save.error?.message}
          saved={save.isSuccess}
          // Merged into the latest profile: the other tab saves its part on its own.
          onSubmit={(values) => save.mutate({ ...profile, ...values })}
          onChange={() => save.reset()}
        />
      )}
    </div>
  );
}
