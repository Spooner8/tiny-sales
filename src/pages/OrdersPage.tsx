import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { PageHeader } from "../components/molecules/PageHeader";
import { CustomerOrderTable } from "../components/organisms/CustomerOrderTable";
import { Checkbox } from "../components/ui/checkbox";
import { useCustomerOrdersQuery, useSetCustomerOrderStatus } from "../hooks/useCustomerOrders";

export function OrdersPage() {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useCustomerOrdersQuery();
  const setStatus = useSetCustomerOrderStatus();
  const [showDone, setShowDone] = useState(false);

  // A billed order stays here until it is delivered and paid.
  const visibleOrders = (orders ?? []).filter((o) => showDone || !o.done);

  function openOrder(id: number | "new") {
    void navigate({ to: "/orders/$orderId", params: { orderId: String(id) } });
  }

  return (
    <section>
      <PageHeader title="Aufträge" action={<Button onClick={() => openOrder("new")}>Neuer Auftrag</Button>} />

      {isLoading && <p>Wird geladen...</p>}

      {orders && (
        <CustomerOrderTable
          orders={visibleOrders}
          onOpen={(order) => openOrder(order.id)}
          onChangeStatus={(order, status) => setStatus.mutate({ id: order.id, status })}
          toolbar={
            <div className="show-inactive-toggle">
              <Checkbox id="show-done" checked={showDone} onCheckedChange={setShowDone} />
              <label htmlFor="show-done">Auch erledigte anzeigen</label>
            </div>
          }
        />
      )}

      {setStatus.error && <p className="field-error">{setStatus.error.message}</p>}
    </section>
  );
}
