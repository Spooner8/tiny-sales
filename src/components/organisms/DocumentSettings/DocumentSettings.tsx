import { Select } from "../../atoms/Select";
import { FormField } from "../../molecules/FormField";
import { DocumentSettingsForm } from "./DocumentSettingsForm";
import { useCompanyProfileQuery, useSaveCompanyProfile } from "../../../hooks/useCompanyProfile";
import { useDbPathQuery, useReceiptPaperSizeQuery, useSetReceiptPaperSize } from "../../../hooks/useSettings";
import { RECEIPT_PAPER_SIZES } from "../../../types/settings";
import type { ReceiptPaperSize } from "../../../types/settings";

export function DocumentSettings() {
  const { data: dbPath } = useDbPathQuery();
  const { data: paperSize } = useReceiptPaperSizeQuery();
  const setPaperSize = useSetReceiptPaperSize();
  const { data: profile, error } = useCompanyProfileQuery();
  const save = useSaveCompanyProfile();

  return (
    <>
      <div className="settings-section">
        <h2>Druck</h2>
        <FormField label="Papiergrösse der Quittung" htmlFor="receipt-paper-size">
          <Select
            id="receipt-paper-size"
            value={paperSize ?? "A4"}
            onValueChange={(value) => setPaperSize.mutate(value as ReceiptPaperSize)}
            options={RECEIPT_PAPER_SIZES.map((size) => ({ value: size, label: size }))}
          />
        </FormField>
      </div>

      <div className="settings-section">
        <h2>Texte, MWST und Zahlungen</h2>
        <p className="muted">
          Ein geänderter MWST-Satz gilt für Verkäufe und Aufträge, die ab jetzt abgeschlossen werden. Bestehende Belege
          behalten ihren Satz.
        </p>
        {error && <p className="field-error">{error.message}</p>}
        {profile && (
          <DocumentSettingsForm
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
    </>
  );
}
