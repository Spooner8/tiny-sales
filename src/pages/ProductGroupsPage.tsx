import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { Modal } from "../components/molecules/Modal";
import { PageHeader } from "../components/molecules/PageHeader";
import { ShowInactiveToggle } from "../components/molecules/ShowInactiveToggle";
import { ProductGroupForm } from "../components/organisms/ProductGroupForm";
import { ProductGroupTable } from "../components/organisms/ProductGroupTable";
import {
  useCreateProductGroup,
  useDeactivateProductGroup,
  useProductGroupsQuery,
  useUpdateProductGroup,
} from "../hooks/useProductGroups";
import { confirmAction } from "../lib/confirm";
import type { ProductGroup } from "../types/productGroup";

export function ProductGroupsPage() {
  const { data: productGroups, isLoading } = useProductGroupsQuery();
  const createMutation = useCreateProductGroup();
  const updateMutation = useUpdateProductGroup();
  const deactivateMutation = useDeactivateProductGroup();

  const [editing, setEditing] = useState<ProductGroup | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeMutation = editing === "new" ? createMutation : updateMutation;
  const visibleProductGroups = (productGroups ?? []).filter((g) => showInactive || g.active);

  function closeForm() {
    setEditing(null);
    createMutation.reset();
    updateMutation.reset();
  }

  async function handleDeactivate(id: number) {
    if (await confirmAction("Warengruppe wirklich deaktivieren?", "Deaktivieren")) {
      deactivateMutation.mutate(id);
    }
  }

  return (
    <section>
      <PageHeader
        title="Warengruppen"
        action={<Button onClick={() => setEditing("new")}>Neue Warengruppe</Button>}
      />

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Neue Warengruppe" : "Warengruppe bearbeiten"}
        onClose={closeForm}
      >
        {editing && (
          <ProductGroupForm
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
      </Modal>

      {isLoading && <p>Wird geladen...</p>}

      {productGroups && (
        <ProductGroupTable
          productGroups={visibleProductGroups}
          onEdit={setEditing}
          onDeactivate={handleDeactivate}
          toolbar={<ShowInactiveToggle checked={showInactive} onCheckedChange={setShowInactive} />}
        />
      )}

      {deactivateMutation.error && <p className="field-error">{deactivateMutation.error.message}</p>}
    </section>
  );
}
