import { PageHeader } from "../components/molecules/PageHeader";
import { CompanySettings } from "../components/organisms/CompanySettings";
import { DataSettings } from "../components/organisms/DataSettings";
import { DocumentSettings } from "../components/organisms/DocumentSettings";
import { SystemSettings } from "../components/organisms/SystemSettings";
import { Tabs } from "../components/ui/tabs";

const TABS = [
  { value: "company", label: "Firma", content: <CompanySettings /> },
  { value: "documents", label: "Belege & Rechnungen", content: <DocumentSettings /> },
  { value: "data", label: "Daten", content: <DataSettings /> },
  { value: "system", label: "System", content: <SystemSettings /> },
];

export function SettingsPage() {
  return (
    <section>
      <PageHeader title="Einstellungen" />
      <Tabs label="Bereiche der Einstellungen" items={TABS} />
    </section>
  );
}
