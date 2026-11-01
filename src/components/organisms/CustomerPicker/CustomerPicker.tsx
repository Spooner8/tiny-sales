import { useState } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { customerAddressLine, customerLabel, customerName } from "../../../types/customer";
import type { Customer } from "../../../types/customer";

export interface CustomerPickerProps {
  /** Active customers to choose from. */
  customers: Customer[];
  /** The chosen customer, also if inactive by now. */
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onCreateNew: () => void;
  /** No change of customer, e.g. for completed orders. */
  readOnly?: boolean;
}

function matches(customer: Customer, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return [
    customerName(customer),
    `${customer.lastName} ${customer.firstName}`,
    customer.company,
    customer.city,
    customer.phone,
    customer.mobile,
    customer.email,
  ].some((value) => value?.toLowerCase().includes(needle));
}

export function CustomerPicker({ customers, selected, onSelect, onCreateNew, readOnly }: CustomerPickerProps) {
  const [query, setQuery] = useState("");

  if (selected) {
    const contact = [selected.phone, selected.mobile, selected.email].filter(Boolean).join(" · ");
    return (
      <div className="customer-card">
        <div className="customer-card-details">
          {selected.company && <strong>{selected.company}</strong>}
          {selected.company ? <span>{customerName(selected)}</span> : <strong>{customerName(selected)}</strong>}
          {customerAddressLine(selected) && <span>{customerAddressLine(selected)}</span>}
          {contact && <span className="muted">{contact}</span>}
          {selected.note && <span className="muted">Notiz: {selected.note}</span>}
          {selected.additionalInfo && <span className="muted">Zusatzinfo: {selected.additionalInfo}</span>}
        </div>
        {!readOnly && (
          <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(null)}>
            Anderer Kunde
          </Button>
        )}
      </div>
    );
  }

  const results = query.trim() ? customers.filter((c) => matches(c, query)).slice(0, 8) : [];

  return (
    <div className="article-picker">
      <div className="article-picker-scan">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kunde suchen (Name, Firma, Ort, Telefon, E-Mail)..."
          autoFocus
        />
        <Button type="button" variant="secondary" onClick={onCreateNew}>
          Neuer Kunde
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="article-picker-results">
          {results.map((customer) => (
            <li key={customer.id} className="article-picker-result">
              <span>
                {customerLabel(customerName(customer), customer.company)}
                {customerAddressLine(customer) && <span className="article-picker-stock muted">{customerAddressLine(customer)}</span>}
              </span>
              <Button type="button" variant="secondary" onClick={() => onSelect(customer)}>
                Wählen
              </Button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && <p className="muted">Kein passender Kunde gefunden.</p>}
    </div>
  );
}
