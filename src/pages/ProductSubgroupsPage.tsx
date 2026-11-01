import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { Modal } from "../components/molecules/Modal";
import { PageHeader } from "../components/molecules/PageHeader";
import { ShowInactiveToggle } from "../components/molecules/ShowInactiveToggle";
import { ProductSubgroupForm } from "../components/organisms/ProductSubgroupForm";
import { ProductSubgroupTable } from "../components/organisms/ProductSubgroupTable";
import { useProductGroupsQuery } from "../hooks/useProductGroups";
import {
  useCreateProductSubgroup,
  useDeactivateProductSubgroup,
  useProductSubgroupsQuery,
  useUpdateProductSubgroup,
} from "../hooks/useProductSubgroups";
import { confirmAction } from "../lib/confirm";
import type { ProductSubgroup } from "../types/productSubgroup";

export function ProductSubgroupsPage() {
  const { data: productSubgroups, isLoading } = useProductSubgroupsQuery();
  const { data: productGroups } = useProductGroupsQuery();
  const createMutation = useCreateProductSubgroup();
  const updateMutation = useUpdateProductSubgroup();
  const deactivateMutation = useDeactivateProductSubgroup();

  const [editing, setEditing] = useState<ProductSubgroup | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeMutation = editing === "new" ? createMutation : updateMutation;
  const activeProductGroups = (productGroups ?? []).filter((g) => g.active);
  const productGroupNameById = new Map((productGroups ?? []).map((g) => [g.id, g.name]));
  // Keep subgroups of the same product group together in the table.
  const visibleProductSubgroups = (productSubgroups ?? [])
    .filter((s) => showInactive || s.active)
    .sort(
      (a, b) =>
        (productGroupNameById.get(a.productGroupId) ?? "").localeCompare(
          productGroupNameById.get(b.productGroupId) ?? "",
          "de-CH",
        ) || a.name.localeCompare(b.name, "de-CH"),
    );

  function closeForm() {
    setEditing(null);
    createMutation.reset();
    updateMutation.reset();
  }

  async function handleDeactivate(id: number) {
    if (await confirmAction("Warenuntergruppe wirklich deaktivieren?", "Deaktivieren")) {
      deactivateMutation.mutate(id);
    }
  }

  return (
    <section>
      <PageHeader
        title="Warenuntergruppen"
        action={<Button onClick={() => setEditing("new")}>Neue Warenuntergruppe</Button>}
      />

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Neue Warenuntergruppe" : "Warenuntergruppe bearbeiten"}
        onClose={closeForm}
      >
        {editing && productGroups && (
          <ProductSubgroupForm
            initial={editing === "new" ? undefined : editing}
            productGroups={activeProductGroups}
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

      {productSubgroups && productGroups && (
        <ProductSubgroupTable
          productSubgroups={visibleProductSubgroups}
          productGroups={productGroups}
          onEdit={setEditing}
          onDeactivate={handleDeactivate}
          toolbar={<ShowInactiveToggle checked={showInactive} onCheckedChange={setShowInactive} />}
        />
      )}

      {deactivateMutation.error && <p className="field-error">{deactivateMutation.error.message}</p>}
    </section>
  );
}
