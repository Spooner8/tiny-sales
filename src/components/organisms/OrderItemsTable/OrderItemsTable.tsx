import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { LineDiscountEditor } from "../../molecules/LineDiscountEditor";
import { PriceTag } from "../../molecules/PriceTag";
import { formatChf } from "../../../lib/money/change";
import type { LineDiscountDraft } from "../../../lib/money/discount";
import type { LineDiscount } from "../../../types/sale";

/** An order line as edited in the order. */
export interface OrderLine {
  /** Identifies the line while editing; an article can be on several lines. */
  key: string;
  /** Set for lines saved before; they keep their prices. */
  id: number | null;
  articleId: number;
  articleCode: string;
  articleName: string;
  articleInternalNumber: string | null;
  quantity: number;
  /** Regular unit price when the line was added. */
  listPriceCents: number;
  /** Unit price after the article promotion when the line was added. */
  salePriceCents: number;
  articleDiscountPercent: number;
  discountDraft: LineDiscountDraft;
  /** The validated line discount (null if none or invalid). */
  discount: LineDiscount | null;
  discountError: string | null;
  /** salePriceCents after the line discount. */
  unitPriceCents: number;
  note: string;
}

export interface OrderItemsTableProps {
  lines: OrderLine[];
  /** Without handlers the lines are shown read-only, e.g. for completed orders. */
  onChangeQuantity?: (key: string, quantity: number) => void;
  onChangeDiscount?: (key: string, draft: LineDiscountDraft) => void;
  onChangeNote?: (key: string, note: string) => void;
  onRemove?: (key: string) => void;
}

export function OrderItemsTable({
  lines,
  onChangeQuantity,
  onChangeDiscount,
  onChangeNote,
  onRemove,
}: OrderItemsTableProps) {
  const editable = onChangeQuantity !== undefined;
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

  if (lines.length === 0) {
    return <p className="muted">Noch keine Artikel im Auftrag.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table cart-table order-items-table">
        <thead>
          <tr>
            <th>Art-Nr.</th>
            <th className="col-name">Artikel</th>
            <th className="order-items-note">Zusatzinfo</th>
            <th>Einzelpreis</th>
            {(editable || lines.some((line) => line.discount)) && <th>Rabatt</th>}
            <th>Menge</th>
            <th>Summe</th>
            {editable && <th></th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key}>
              <td>{line.articleCode}</td>
              <td className="col-name">
                {line.articleName}
                {line.articleInternalNumber && <span className="muted"> ({line.articleInternalNumber})</span>}
              </td>
              <td className="order-items-note">
                {onChangeNote ? (
                  <Input
                    value={line.note}
                    onChange={(e) => onChangeNote(line.key, e.target.value)}
                    placeholder="z.B. Name zum Bedrucken"
                    aria-label={`Zusatzinfo zu ${line.articleName}`}
                  />
                ) : (
                  line.note || "–"
                )}
              </td>
              <td>
                <PriceTag
                  listPriceCents={line.listPriceCents}
                  salePriceCents={line.unitPriceCents}
                  discountPercent={line.discount ? undefined : line.articleDiscountPercent}
                />
              </td>
              {editable ? (
                <td>
                  <LineDiscountEditor
                    draft={line.discountDraft}
                    error={line.discountError}
                    onChange={(draft) => onChangeDiscount?.(line.key, draft)}
                  />
                </td>
              ) : (
                lines.some((l) => l.discount) && <td>{line.discountDraft.kind === "none" ? "–" : discountLabel(line)}</td>
              )}
              <td className="cart-quantity">
                {editable && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onChangeQuantity(line.key, line.quantity - 1)}
                  >
                    −
                  </Button>
                )}
                <span>{line.quantity}</span>
                {editable && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onChangeQuantity(line.key, line.quantity + 1)}
                  >
                    +
                  </Button>
                )}
              </td>
              <td>{formatChf(line.unitPriceCents * line.quantity)} CHF</td>
              {editable && (
                <td>
                  <Button type="button" variant="danger" size="sm" onClick={() => onRemove?.(line.key)}>
                    Entfernen
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={editable || lines.some((line) => line.discount) ? 6 : 5} className="cart-total-label">
              Zwischensumme
            </td>
            <td className="cart-total-value">{formatChf(subtotalCents)} CHF</td>
            {editable && <td></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function discountLabel(line: OrderLine): string {
  return line.discountDraft.kind === "percent" ? `−${line.discountDraft.input} %` : `−${line.discountDraft.input} CHF`;
}
