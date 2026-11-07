import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "../components/atoms/Button";
import { PageHeader } from "../components/molecules/PageHeader";
import { OrderItemsTable } from "../components/organisms/OrderItemsTable";
import { PaymentPanel } from "../components/organisms/PaymentPanel";
import type { PaymentConfirmDetails } from "../components/organisms/PaymentPanel";
import { Receipt } from "../components/templates/Receipt";
import { useCompanyProfileQuery } from "../hooks/useCompanyProfile";
import { useCompleteCustomerOrder, useCustomerOrderQuery } from "../hooks/useCustomerOrders";
import { useReceiptPaperSizeQuery, useSetReceiptPaperSize } from "../hooks/useSettings";
import { lineFromOrderItem, saleDiscountDraft, toDiscountableLines } from "../lib/customerOrders";
import type { SaleDiscountDraft } from "../lib/money/discount";
import { customerLabel } from "../types/customer";
import { CHECKOUT_PAYMENT_METHODS, formatReceiptNumber, paidAtCheckout } from "../types/sale";
import type { SaleWithItems } from "../types/sale";
import type { ReceiptPaperSize } from "../types/settings";

/**
 * Completes an order at the checkout: payment as for a sale, then the
 * receipt. Nothing to cancel here: changing or deleting an order happens in
 * the order itself.
 */
export function OrderCheckoutPage() {
  const navigate = useNavigate();
  const { orderId } = useParams({ from: "/orders/$orderId/checkout" });
  const { data: order, error } = useCustomerOrderQuery(Number(orderId));
  const { data: company } = useCompanyProfileQuery();
  const { data: defaultPaperSize } = useReceiptPaperSizeQuery();
  const setReceiptPaperSize = useSetReceiptPaperSize();
  const completeOrder = useCompleteCustomerOrder();

  const [completedSale, setCompletedSale] = useState<SaleWithItems | null>(null);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("A4");
  // The discount can still be adjusted here; the order itself keeps its own.
  const [discountDraft, setDiscountDraft] = useState<SaleDiscountDraft | null>(null);

  useEffect(() => {
    if (defaultPaperSize) setPaperSize(defaultPaperSize);
  }, [defaultPaperSize]);

  const title = `Kasse – Auftrag ${orderId}`;

  if (completedSale) {
    return (
      <section>
        <PageHeader title={title} />
        <Receipt
          sale={completedSale}
          company={company}
          paperSize={paperSize}
          onPaperSizeChange={(size) => {
            setPaperSize(size);
            setReceiptPaperSize.mutate(size);
          }}
          onNewSale={() => void navigate({ to: "/" })}
        />
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <PageHeader title={title} />
        <p className="field-error">{error.message}</p>
      </section>
    );
  }
  if (!order) return <p>Wird geladen...</p>;

  if (order.saleId !== null) {
    return (
      <section>
        <PageHeader title={title} />
        <p>Dieser Auftrag ist bereits abgerechnet (Beleg-Nr. {formatReceiptNumber(order.saleId)}).</p>
      </section>
    );
  }

  const lines = order.items.map(lineFromOrderItem);
  const draft = discountDraft ?? saleDiscountDraft(order.discount);

  function handleConfirm(details: PaymentConfirmDetails) {
    if (!order) return;
    completeOrder.mutate(
      {
        orderId: order.id,
        paymentMethod: details.paymentMethod,
        cashGivenCents: details.cashGivenCents,
        discount: details.discount,
      },
      { onSuccess: (result) => setCompletedSale(result.sale) },
    );
  }

  return (
    <section>
      <PageHeader
        title={title}
        action={
          <Button
            variant="secondary"
            disabled={completeOrder.isPending}
            onClick={() => void navigate({ to: "/orders/$orderId", params: { orderId } })}
          >
            Zurück zum Auftrag
          </Button>
        }
      />
      <p className="order-meta">
        Kunde: <strong>{customerLabel(order.customerName, order.customerCompany)}</strong>
      </p>
      <OrderItemsTable lines={lines} />
      <div style={{ marginTop: 24 }}>
        <PaymentPanel
          lines={toDiscountableLines(lines)}
          discountDraft={draft}
          onDiscountDraftChange={setDiscountDraft}
          paymentMethods={CHECKOUT_PAYMENT_METHODS}
          initialPaymentMethod={paidAtCheckout(order.paymentMethod) ? order.paymentMethod : "Cash"}
          confirmLabel="Auftrag abrechnen"
          submitting={completeOrder.isPending}
          errorMessage={completeOrder.error?.message}
          onConfirm={handleConfirm}
        />
      </div>
    </section>
  );
}
