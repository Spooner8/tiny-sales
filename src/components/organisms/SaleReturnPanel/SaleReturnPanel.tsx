import { useMemo, useState } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import { FormField } from "../../molecules/FormField";
import { formatArticleCode } from "../../../lib/articleCode";
import { formatChf } from "../../../lib/money/change";
import { refundCents } from "../../../lib/money/discount";
import { parseNumericInput } from "../../../lib/utils";
import { PAYMENT_METHOD_LABELS, paidAtCheckout, REFUND_METHODS } from "../../../types/sale";
import type {
  NewSaleReturnItem,
  PaymentMethod,
  SaleItemDetail,
  SaleReturnWithItems,
  SaleWithItems,
} from "../../../types/sale";

export interface SaleReturnPanelProps {
  sale: SaleWithItems;
  existingReturns: SaleReturnWithItems[];
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (input: { items: NewSaleReturnItem[]; refundMethod: PaymentMethod }) => void;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Lines of a customer order can repeat an article, e.g. with different
 * notes. Returns are booked per article, so its lines are combined (as in
 * SaleReturnService).
 */
function linesPerArticle(items: SaleItemDetail[]): SaleItemDetail[] {
  const lines = new Map<number, SaleItemDetail>();
  for (const item of items) {
    const line = lines.get(item.articleId);
    lines.set(
      item.articleId,
      line
        ? {
            ...line,
            quantity: line.quantity + item.quantity,
            lineTotalCents: line.lineTotalCents + item.lineTotalCents,
            discountCents: line.discountCents + item.discountCents,
          }
        : item,
    );
  }
  return [...lines.values()];
}

const PAYMENT_METHOD_OPTIONS = REFUND_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));

export function SaleReturnPanel({ sale, existingReturns, submitting, errorMessage, onSubmit }: SaleReturnPanelProps) {
  const alreadyReturned = useMemo(() => {
    const map = new Map<number, number>();
    for (const ret of existingReturns) {
      for (const item of ret.items) {
        map.set(item.articleId, (map.get(item.articleId) ?? 0) + item.quantity);
      }
    }
    return map;
  }, [existingReturns]);

  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  // Refunded the way it was paid; an invoice by default back to the account.
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>(
    paidAtCheckout(sale.sale.paymentMethod) ? sale.sale.paymentMethod : "BankTransfer",
  );

  const rows = linesPerArticle(sale.items).map((item) => {
    const already = alreadyReturned.get(item.articleId) ?? 0;
    const remaining = item.quantity - already;
    return { item, already, remaining };
  });

  function setQuantity(articleId: number, value: number, max: number) {
    const clamped = Math.max(0, Math.min(value, max));
    setReturnQuantities((prev) => ({ ...prev, [articleId]: clamped }));
  }

  function takeAllBack() {
    const next: Record<number, number> = {};
    for (const row of rows) {
      if (row.remaining > 0) next[row.item.articleId] = row.remaining;
    }
    setReturnQuantities(next);
  }

  function handleSubmit() {
    const items: NewSaleReturnItem[] = Object.entries(returnQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([articleId, quantity]) => ({ articleId: Number(articleId), quantity }));
    onSubmit({ items, refundMethod });
  }

  const hasSelection = Object.values(returnQuantities).some((qty) => qty > 0);
  // Refunds what was actually paid for the returned units (after promotions
  // and the sale discount) - the backend computes the binding amount.
  const refundPreviewCents = rows.reduce(
    (sum, { item, already }) =>
      sum +
      refundCents(
        item.lineTotalCents - item.discountCents,
        item.quantity,
        already,
        returnQuantities[item.articleId] ?? 0,
      ),
    0,
  );
  const fullyReturned = rows.every((row) => row.remaining === 0);

  return (
    <div className="sale-return-panel">
      <p className="muted">
        {formatTimestamp(sale.sale.timestamp)} · bezahlt mit {PAYMENT_METHOD_LABELS[sale.sale.paymentMethod]}
      </p>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-name">Artikel</th>
              <th>Verkauft</th>
              <th>Bezahlt</th>
              <th>Bereits retourniert</th>
              <th>Retoure-Menge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, already, remaining }) => (
              <tr key={item.articleId}>
                <td>
                  {item.articleName} <span className="muted">({formatArticleCode(item.articleCode)})</span>
                </td>
                <td>{item.quantity}</td>
                <td>{formatChf(item.lineTotalCents - item.discountCents)} CHF</td>
                <td>{already}</td>
                <td>
                  <Input
                    type="text"
                    inputMode="numeric"
                    disabled={remaining <= 0}
                    value={returnQuantities[item.articleId] ?? 0}
                    onChange={(e) =>
                      setQuantity(item.articleId, parseNumericInput(e.target.value, returnQuantities[item.articleId] ?? 0), remaining)
                    }
                    className="finishing-picker-price"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fullyReturned ? (
        <p className="muted">Dieser Verkauf wurde bereits vollständig retourniert.</p>
      ) : (
        <>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={takeAllBack}>
              Alles zurücknehmen
            </Button>
          </div>

          <FormField label="Rückerstattungsart" htmlFor="refund-method">
            <Select
              id="refund-method"
              value={refundMethod}
              onValueChange={(value) => setRefundMethod(value as PaymentMethod)}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </FormField>

          {hasSelection && (
            <p>
              Rückerstattung: <strong>{formatChf(refundPreviewCents)} CHF</strong>
            </p>
          )}

          {errorMessage && <p className="field-error">{errorMessage}</p>}

          <div className="form-actions">
            <Button type="button" disabled={!hasSelection || submitting} onClick={handleSubmit}>
              Retoure buchen
            </Button>
          </div>
        </>
      )}

      {existingReturns.length > 0 && (
        <div className="sale-return-history">
          <h2>Bisherige Retouren</h2>
          {existingReturns.map((ret) => (
            <div key={ret.return.id} className="sale-return-history-entry">
              <p>
                {formatTimestamp(ret.return.timestamp)} · Rückerstattung via{" "}
                {PAYMENT_METHOD_LABELS[ret.return.refundMethod]} · {formatChf(ret.return.totalRefundCents)} CHF
              </p>
              <ul>
                {ret.items.map((item) => (
                  <li key={item.articleId}>
                    {item.quantity}× {item.articleName}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
