import { Badge } from "../../atoms/Badge";
import { formatChf } from "../../../lib/money/change";
import { formatPercent } from "../../../lib/money/discount";

export interface PriceTagProps {
  /** Regular price before the promotion. */
  listPriceCents: number;
  /** Price actually charged. */
  salePriceCents: number;
  /** Shows a "−20 %" badge when the price is discounted. */
  discountPercent?: number;
  withCurrency?: boolean;
}

/** A price that shows the struck-through regular price next to it when discounted. */
export function PriceTag({ listPriceCents, salePriceCents, discountPercent, withCurrency = true }: PriceTagProps) {
  const discounted = salePriceCents !== listPriceCents;
  const suffix = withCurrency ? " CHF" : "";
  return (
    <span className="price-tag">
      {discounted && <s className="price-tag-list">{formatChf(listPriceCents)}</s>}
      <span className={discounted ? "price-tag-sale" : undefined}>
        {formatChf(salePriceCents)}
        {suffix}
      </span>
      {discounted && discountPercent ? <Badge tone="primary">−{formatPercent(discountPercent)}</Badge> : null}
    </span>
  );
}
