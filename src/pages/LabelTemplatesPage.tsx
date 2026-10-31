import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { PageHeader } from "../components/molecules/PageHeader";
import { ShowInactiveToggle } from "../components/molecules/ShowInactiveToggle";
import { LabelTemplateForm } from "../components/organisms/LabelTemplateForm";
import { LabelTemplateTable } from "../components/organisms/LabelTemplateTable";
import {
  useCreateLabelTemplate,
  useDeactivateLabelTemplate,
  useLabelTemplatesQuery,
  useUpdateLabelTemplate,
} from "../hooks/useLabelTemplates";
import { confirmAction } from "../lib/confirm";
import type { LabelTemplate } from "../types/labelTemplate";

export function LabelTemplatesPage() {
  const { data: templates, isLoading } = useLabelTemplatesQuery();
  const createMutation = useCreateLabelTemplate();
  const updateMutation = useUpdateLabelTemplate();
  const deactivateMutation = useDeactivateLabelTemplate();

  const [editing, setEditing] = useState<LabelTemplate | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeMutation = editing === "new" ? createMutation : updateMutation;
  const visibleTemplates = (templates ?? []).filter((t) => showInactive || t.active);

  function closeForm() {
    setEditing(null);
    createMutation.reset();
    updateMutation.reset();
  }

  async function handleDeactivate(id: number) {
    if (await confirmAction("Etiketten-Vorlage wirklich deaktivieren?", "Deaktivieren")) {
      deactivateMutation.mutate(id);
    }
  }

  return (
    <section>
      <PageHeader
        title="Etiketten-Vorlagen"
        action={<Button onClick={() => setEditing("new")}>Neue Vorlage</Button>}
      />

      {editing && (
        <LabelTemplateForm
          initial={editing === "new" ? undefined : editing}
          submitting={activeMutation.isPending}
          errorMessage={activeMutation.error?.message}
          onCancel={closeForm}
          onSubmit={(values) => {
            const action =
              editing === "new"
                ? createMutation.mutateAsync(values)
                : updateMutation.mutateAsync({ id: editing.id, ...values });
            action.then(closeForm).catch(() => {});
          }}
        />
      )}

      {isLoading && <p>Wird geladen...</p>}

      {templates && (
        <LabelTemplateTable
          templates={visibleTemplates}
          onEdit={setEditing}
          onDeactivate={handleDeactivate}
          toolbar={<ShowInactiveToggle checked={showInactive} onCheckedChange={setShowInactive} />}
        />
      )}

      {deactivateMutation.error && <p className="field-error">{deactivateMutation.error.message}</p>}
    </section>
  );
}
