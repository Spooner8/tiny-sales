import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { Modal } from "../components/molecules/Modal";
import { PageHeader } from "../components/molecules/PageHeader";
import { ShowInactiveToggle } from "../components/molecules/ShowInactiveToggle";
import { CustomerForm } from "../components/organisms/CustomerForm";
import { CustomerTable } from "../components/organisms/CustomerTable";
import {
  useCreateCustomer,
  useCustomersQuery,
  useDeactivateCustomer,
  useUpdateCustomer,
} from "../hooks/useCustomers";
import { confirmAction } from "../lib/confirm";
import type { Customer } from "../types/customer";

export function CustomersPage() {
  const { data: customers, isLoading } = useCustomersQuery();
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deactivateMutation = useDeactivateCustomer();

  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeMutation = editing === "new" ? createMutation : updateMutation;
  const visibleCustomers = (customers ?? []).filter((c) => showInactive || c.active);

  function closeForm() {
    setEditing(null);
    createMutation.reset();
    updateMutation.reset();
  }

  async function handleDeactivate(id: number) {
    if (await confirmAction("Kunde wirklich deaktivieren?", "Deaktivieren")) {
      deactivateMutation.mutate(id);
    }
  }

  return (
    <section>
      <PageHeader title="Kunden" action={<Button onClick={() => setEditing("new")}>Neuer Kunde</Button>} />

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Neuer Kunde" : "Kunde bearbeiten"}
        onClose={closeForm}
        size="lg"
      >
        {editing && (
          <CustomerForm
            initial={editing === "new" ? undefined : editing}
            customers={customers ?? []}
            submitting={activeMutation.isPending}
            errorMessage={activeMutation.error?.message}
            onCancel={closeForm}
            onSubmit={({ active, ...fields }) => {
              const action =
                editing === "new"
                  ? createMutation.mutateAsync(fields)
                  : updateMutation.mutateAsync({ id: editing.id, active, ...fields });
              action.then(closeForm).catch(() => {});
            }}
          />
        )}
      </Modal>

      {isLoading && <p>Wird geladen...</p>}

      {customers && (
        <CustomerTable
          customers={visibleCustomers}
          onEdit={setEditing}
          onDeactivate={handleDeactivate}
          toolbar={<ShowInactiveToggle checked={showInactive} onCheckedChange={setShowInactive} />}
        />
      )}

      {deactivateMutation.error && <p className="field-error">{deactivateMutation.error.message}</p>}
    </section>
  );
}
