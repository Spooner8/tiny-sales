import { Plus } from "lucide-react";

import { Button } from "../../atoms/Button";
import { formatChf } from "../../../lib/money/change";

export interface OpenSaleTab {
  id: string;
  title: string;
  /** Number of pieces in the cart. */
  itemCount: number;
  totalCents: number;
}

export interface OpenSaleTabsProps {
  tabs: OpenSaleTab[];
  /** null while no open sale is selected, e.g. on the receipt. */
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  disabled?: boolean;
}

export function OpenSaleTabs({ tabs, activeId, onSelect, onCreate, disabled }: OpenSaleTabsProps) {
  return (
    <div className="open-sale-tabs no-print">
      <div className="open-sale-tab-list" role="tablist" aria-label="Offene Verkäufe">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            className="open-sale-tab"
            data-active={tab.id === activeId ? "" : undefined}
            disabled={disabled}
            onClick={() => onSelect(tab.id)}
          >
            <span className="open-sale-tab-title">{tab.title}</span>
            <span className="open-sale-tab-meta">
              {tab.itemCount === 0
                ? "leer"
                : `${tab.itemCount} Artikel · ${formatChf(tab.totalCents)} CHF`}
            </span>
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={onCreate}
        title="Den aktuellen Verkauf offen lassen und einen weiteren beginnen"
      >
        <Plus size={16} />
        Neuer Verkauf
      </Button>
    </div>
  );
}
