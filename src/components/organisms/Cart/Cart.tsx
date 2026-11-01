import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { LineDiscountEditor } from "../../molecules/LineDiscountEditor";
import { PriceTag } from "../../molecules/PriceTag";
import { formatChf } from "../../../lib/money/change";
import type { LineDiscountDraft } from "../../../lib/money/discount";
import type { Article } from "../../../types/article";
import type { LineDiscount } from "../../../types/sale";

export interface CartLine {
  article: Article;
  quantity: number;
  discountDraft: LineDiscountDraft;
  /** The validated line discount (null if none or invalid). */
  discount: LineDiscount | null;
  discountError: string | null;
  /** Unit price after the article promotion and the line discount. */
  unitPriceCents: number;
  /** Quantity of this article held by other open sales. */
  reservedElsewhere: number;
}

function StockHint({ line }: { line: CartLine }) {
  const { stock } = line.article;
  const available = Math.max(stock - line.reservedElsewhere, 0);
  if (line.reservedElsewhere > 0 && line.quantity > available) {
    return (
      <span className="cart-stock-hint cart-stock-hint-warning">
        Nur {available} verfügbar – {line.reservedElsewhere} von {stock} sind in anderen offenen Verkäufen reserviert
      </span>
    );
  }
  if (line.quantity > stock) {
    return (
      <span className="cart-stock-hint">
        Systembestand: {stock} – wird beim Abschluss auf die verkaufte Menge korrigiert
      </span>
    );
  }
  return null;
}

export interface CartProps {
  lines: CartLine[];
  onChangeQuantity: (articleId: number, quantity: number) => void;
  onChangeDiscount: (articleId: number, draft: LineDiscountDraft) => void;
  onRemove: (articleId: number) => void;
}

export function Cart({ lines, onChangeQuantity, onChangeDiscount, onRemove }: CartProps) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

  if (lines.length === 0) {
    return <p className="muted">Warenkorb ist leer.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table cart-table">
        <thead>
          <tr>
            <th>Art-Nr.</th>
            <th>Interne Nr.</th>
            <th className="col-name">Name</th>
            <th>Einzelpreis</th>
            <th>Rabatt</th>
            <th>Menge</th>
            <th>Summe</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.article.id}>
              <td>{line.article.code}</td>
              <td>{line.article.internalNumber ?? "–"}</td>
              <td className="col-name">
                {line.article.name}
                {line.article.discontinued && (
                  <>
                    {" "}
                    <Badge tone="warning">Auslaufend</Badge>
                  </>
                )}
                <StockHint line={line} />
              </td>
              <td>
                <PriceTag
                  listPriceCents={line.article.totalPriceCents}
                  salePriceCents={line.unitPriceCents}
                  discountPercent={line.discount ? undefined : line.article.discountPercent}
                />
              </td>
              <td>
                <LineDiscountEditor
                  draft={line.discountDraft}
                  error={line.discountError}
                  onChange={(draft) => onChangeDiscount(line.article.id, draft)}
                />
              </td>
              <td className="cart-quantity">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onChangeQuantity(line.article.id, line.quantity - 1)}
                >
                  −
                </Button>
                <span>{line.quantity}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onChangeQuantity(line.article.id, line.quantity + 1)}
                >
                  +
                </Button>
              </td>
              <td>{formatChf(line.unitPriceCents * line.quantity)} CHF</td>
              <td>
                <Button type="button" variant="danger" size="sm" onClick={() => onRemove(line.article.id)}>
                  Entfernen
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="cart-total-label">
              Zwischensumme
            </td>
            <td className="cart-total-value">{formatChf(subtotalCents)} CHF</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
