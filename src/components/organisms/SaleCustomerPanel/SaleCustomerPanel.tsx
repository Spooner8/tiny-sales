import { useState } from "react";

import { Button } from "../../atoms/Button";
import { CustomerPicker } from "../CustomerPicker";
import { customerLabel } from "../../../types/customer";
import type { Customer } from "../../../types/customer";
import type { Sale } from "../../../types/sale";

export interface SaleCustomerPanelProps {
  /** A sale without a customer order; those keep the order's customer. */
  sale: Sale;
  /** Active customers to choose from. */
  customers: Customer[];
  busy?: boolean;
  errorMessage?: string | null;
  onAssign: (customerId: number | null) => void;
  onCreateNew: () => void;
}

/** Assigns a customer to a sale afterwards, or changes or removes that customer. */
export function SaleCustomerPanel({ sale, customers, busy, errorMessage, onAssign, onCreateNew }: SaleCustomerPanelProps) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="sale-customer-panel">
      {picking ? (
        <>
          <CustomerPicker
            customers={customers}
            selected={null}
            onSelect={(customer) => {
              if (customer) onAssign(customer.id);
            }}
            onCreateNew={onCreateNew}
          />
          <div className="form-actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPicking(false)}>
              Abbrechen
            </Button>
          </div>
        </>
      ) : (
        <div className="form-actions">
          {sale.customerName ? (
            <>
              <span>
                Kunde: <strong>{customerLabel(sale.customerName, sale.customerCompany)}</strong>
              </span>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setPicking(true)}>
                Ändern
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onAssign(null)}>
                Entfernen
              </Button>
            </>
          ) : (
            <>
              <span className="muted">Kein Kunde hinterlegt</span>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setPicking(true)}>
                Kunde zuweisen
              </Button>
            </>
          )}
        </div>
      )}
      {errorMessage && <p className="field-error">{errorMessage}</p>}
    </div>
  );
}
