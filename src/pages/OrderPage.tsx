import { Link, useBlocker, useNavigate, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button } from "../components/atoms/Button";
import { Select } from "../components/atoms/Select";
import { FormField } from "../components/molecules/FormField";
import { Modal } from "../components/molecules/Modal";
import { PageHeader } from "../components/molecules/PageHeader";
import { SaleDiscountFields } from "../components/molecules/SaleDiscountFields";
import { ArticlePicker } from "../components/organisms/ArticlePicker";
import { CustomerForm } from "../components/organisms/CustomerForm";
import { CustomerPicker } from "../components/organisms/CustomerPicker";
import { OrderItemsTable } from "../components/organisms/OrderItemsTable";
import type { OrderLine } from "../components/organisms/OrderItemsTable";
import { useArticlesQuery } from "../hooks/useArticles";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import {
  useCompleteCustomerOrder,
  useCustomerOrderQuery,
  useDeleteCustomerOrder,
  useSaveCustomerOrder,
  useSetCustomerOrderStatus,
} from "../hooks/useCustomerOrders";
import { useCreateCustomer, useCustomersQuery } from "../hooks/useCustomers";
import { findArticleByCode } from "../lib/articleCode";
import { confirmAction } from "../lib/confirm";
import {
  formatDate,
  lineFromArticle,
  lineFromOrderItem,
  orderTotals,
  saleDiscountDraft,
  withLineDiscount,
} from "../lib/customerOrders";
import { formatChf } from "../lib/money/change";
import { EMPTY_SALE_DISCOUNT, formatPercent } from "../lib/money/discount";
import type { LineDiscountDraft, SaleDiscountDraft } from "../lib/money/discount";
import type { Article } from "../types/article";
import { customerLabel } from "../types/customer";
import type { Customer } from "../types/customer";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "../types/customerOrder";
import type { CustomerOrder, OrderStatus, SaveCustomerOrder } from "../types/customerOrder";
import { formatReceiptNumber, ORDER_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, paidAtCheckout } from "../types/sale";
import type { PaymentMethod } from "../types/sale";

const STATUS_OPTIONS = ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }));
const PAYMENT_METHOD_OPTIONS = ORDER_PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));

/** "/orders/new" creates an order, "/orders/42" edits order 42. */
export function OrderPage() {
  const { orderId } = useParams({ from: "/orders/$orderId" });
  const id = orderId === "new" ? null : Number(orderId);
  const { data: order, error } = useCustomerOrderQuery(id);
  const { data: customers } = useCustomersQuery();
  const { data: articles } = useArticlesQuery();

  if (error) {
    return (
      <section>
        <PageHeader title="Auftrag" />
        <p className="field-error">{error.message}</p>
      </section>
    );
  }
  if ((id !== null && !order) || !customers || !articles) {
    return <p>Wird geladen...</p>;
  }
  // A new editor per order, so its state starts from the stored order.
  return <OrderEditor key={order?.id ?? "new"} order={order ?? null} customers={customers} articles={articles} />;
}

interface OrderEditorProps {
  order: CustomerOrder | null;
  customers: Customer[];
  articles: Article[];
}

/** Compares what would be saved, to notice unsaved changes. */
function snapshot(
  customerId: number | null,
  status: OrderStatus,
  paymentMethod: PaymentMethod,
  discountDraft: SaleDiscountDraft,
  lines: OrderLine[],
): string {
  return JSON.stringify({
    customerId,
    status,
    paymentMethod,
    discountDraft,
    lines: lines.map((l) => [l.id, l.articleId, l.quantity, l.discountDraft, l.note.trim()]),
  });
}

function OrderEditor({ order, customers, articles }: OrderEditorProps) {
  const navigate = useNavigate();
  const saveMutation = useSaveCustomerOrder();
  const completeMutation = useCompleteCustomerOrder();
  const deleteMutation = useDeleteCustomerOrder();
  const statusMutation = useSetCustomerOrderStatus();
  const createCustomer = useCreateCustomer();

  const [customerId, setCustomerId] = useState<number | null>(order?.customerId ?? null);
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? "open");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order?.paymentMethod ?? "Cash");
  const [discountDraft, setDiscountDraft] = useState<SaleDiscountDraft>(
    order ? saleDiscountDraft(order.discount) : EMPTY_SALE_DISCOUNT,
  );
  const [lines, setLines] = useState<OrderLine[]>(() => order?.items.map(lineFromOrderItem) ?? []);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshot(customerId, status, paymentMethod, discountDraft, lines),
  );
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  // A customer created here, until the customer list is reloaded.
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const completed = order?.saleId != null;
  const busy = saveMutation.isPending || completeMutation.isPending || deleteMutation.isPending;
  const activeArticles = articles.filter((a) => a.active);
  const activeCustomers = customers.filter((c) => c.active);
  const selectedCustomer =
    customers.find((c) => c.id === customerId) ?? (createdCustomer?.id === customerId ? createdCustomer : null);
  const totals = orderTotals(lines, discountDraft);
  const hasInvalidDiscount = totals.discountError !== null || lines.some((l) => l.discountError !== null);
  const dirty = !completed && snapshot(customerId, status, paymentMethod, discountDraft, lines) !== savedSnapshot;

  // Navigating away loses unsaved changes; ask first. Leaving on purpose
  // (after saving, completing or deleting) skips the question.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leavingRef = useRef(false);
  useBlocker({
    shouldBlockFn: async () => {
      if (leavingRef.current || !dirtyRef.current) return false;
      return !(await confirmAction("Der Auftrag hat ungespeicherte Änderungen. Trotzdem verlassen?", "Verlassen"));
    },
  });

  function changeLines(change: (lines: OrderLine[]) => OrderLine[]) {
    if (completed) return;
    setLines(change);
    setFormError(null);
  }

  function addArticle(article: Article) {
    changeLines((prev) => {
      // Another piece of the same article without note or discount goes on
      // the same line; otherwise it gets its own, e.g. for another note.
      const index = prev.findIndex(
        (l) => l.articleId === article.id && !l.note.trim() && l.discountDraft.kind === "none",
      );
      if (index < 0) return [...prev, lineFromArticle(article)];
      return prev.map((l, i) => (i === index ? { ...l, quantity: l.quantity + 1 } : l));
    });
  }

  function updateLine(key: string, change: (line: OrderLine) => OrderLine) {
    changeLines((prev) => prev.map((l) => (l.key === key ? change(l) : l)));
  }

  function changeQuantity(key: string, quantity: number) {
    if (quantity <= 0) changeLines((prev) => prev.filter((l) => l.key !== key));
    else updateLine(key, (l) => ({ ...l, quantity }));
  }

  useBarcodeScanner(
    (code) => {
      const match = findArticleByCode(activeArticles, code);
      if (match) {
        addArticle(match);
        setScanError(null);
      } else {
        setScanError(`Art-Nr. "${code}" nicht gefunden`);
      }
    },
    !completed && !creatingCustomer,
  );

  function buildInput(): SaveCustomerOrder | null {
    if (customerId === null) {
      setFormError("Bitte einen Kunden wählen");
      return null;
    }
    if (hasInvalidDiscount) {
      setFormError("Bitte die ungültigen Rabatte korrigieren");
      return null;
    }
    return {
      id: order?.id ?? null,
      customerId,
      status,
      paymentMethod,
      discount: totals.discount,
      items: lines.map((l) => ({
        id: l.id,
        articleId: l.articleId,
        quantity: l.quantity,
        discount: l.discount,
        note: l.note.trim() ? l.note.trim() : null,
      })),
    };
  }

  /** Saves and takes over the stored lines; null if nothing could be saved. */
  async function save(): Promise<CustomerOrder | null> {
    const input = buildInput();
    if (!input) return null;
    try {
      const saved = await saveMutation.mutateAsync(input);
      const savedLines = saved.items.map(lineFromOrderItem);
      const savedDiscount = saleDiscountDraft(saved.discount);
      setLines(savedLines);
      setDiscountDraft(savedDiscount);
      setSavedSnapshot(snapshot(saved.customerId, saved.status, saved.paymentMethod, savedDiscount, savedLines));
      return saved;
    } catch {
      return null;
    }
  }

  async function handleSave() {
    const saved = await save();
    if (saved && !order) {
      leavingRef.current = true;
      void navigate({ to: "/orders/$orderId", params: { orderId: String(saved.id) }, replace: true });
    }
  }

  async function handleComplete() {
    const current = dirty || !order ? await save() : order;
    if (!current) return;
    if (current.items.length === 0) {
      setFormError("Der Auftrag enthält keine Artikel");
      return;
    }
    if (paidAtCheckout(current.paymentMethod)) {
      leavingRef.current = true;
      void navigate({ to: "/orders/$orderId/checkout", params: { orderId: String(current.id) } });
      return;
    }
    const confirmed = await confirmAction(
      `Rechnung über ${formatChf(current.totalCents)} CHF an ${customerLabel(current.customerName, current.customerCompany)} erstellen?\n\n` +
        "Der Auftrag wird damit abgeschlossen und kann nicht mehr geändert werden.",
      "Rechnung erstellen",
    );
    if (!confirmed) return;
    try {
      const result = await completeMutation.mutateAsync({
        orderId: current.id,
        paymentMethod: "Invoice",
        cashGivenCents: null,
        discount: current.discount,
      });
      leavingRef.current = true;
      void navigate({ to: "/invoices/$invoiceId", params: { invoiceId: String(result.invoiceId) } });
    } catch {
      // Shown below via completeMutation.error.
    }
  }

  async function handleDelete() {
    if (!order) return;
    if (!(await confirmAction(`Auftrag ${order.id} wirklich löschen?`, "Löschen"))) return;
    try {
      await deleteMutation.mutateAsync(order.id);
      leavingRef.current = true;
      void navigate({ to: "/orders" });
    } catch {
      // Shown below via deleteMutation.error.
    }
  }

  function changeStatus(next: OrderStatus) {
    setStatus(next);
    // A completed order can't be saved anymore, only its status changes.
    if (completed && order) statusMutation.mutate({ id: order.id, status: next });
  }

  const errorMessage =
    formError ??
    saveMutation.error?.message ??
    completeMutation.error?.message ??
    deleteMutation.error?.message ??
    statusMutation.error?.message;

  return (
    <section>
      <PageHeader
        title={order ? `Auftrag ${order.id}` : "Neuer Auftrag"}
        action={
          <Button variant="secondary" onClick={() => void navigate({ to: "/orders" })}>
            Zur Übersicht
          </Button>
        }
      />

      {order && (
        <p className="muted order-meta">
          Erfasst am {formatDate(order.createdAt)} · zuletzt geändert am {formatDate(order.updatedAt)}
        </p>
      )}

      {order?.saleId != null && (
        <div className="order-completed">
          Abgeschlossen mit Beleg-Nr. {formatReceiptNumber(order.saleId)} ({PAYMENT_METHOD_LABELS[order.paymentMethod]}).
          {order.invoiceId !== null && (
            <Link to="/invoices/$invoiceId" params={{ invoiceId: String(order.invoiceId) }}>
              Rechnung {order.invoiceId} anzeigen
            </Link>
          )}
        </div>
      )}

      <h2 className="order-section-title">Kunde</h2>
      <CustomerPicker
        customers={activeCustomers}
        selected={selectedCustomer}
        onSelect={(customer) => {
          setCustomerId(customer?.id ?? null);
          setFormError(null);
        }}
        onCreateNew={() => setCreatingCustomer(true)}
        readOnly={completed}
      />

      <div className="order-settings">
        <FormField label="Status" htmlFor="order-status">
          <Select
            id="order-status"
            value={status}
            onValueChange={(value) => changeStatus(value as OrderStatus)}
            options={STATUS_OPTIONS}
          />
        </FormField>
        <FormField label="Zahlart" htmlFor="order-payment-method">
          <Select
            id="order-payment-method"
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            options={PAYMENT_METHOD_OPTIONS}
            disabled={completed}
          />
        </FormField>
      </div>

      <h2 className="order-section-title">Artikel</h2>
      {!completed && <ArticlePicker articles={activeArticles} onAdd={addArticle} />}
      {scanError && <p className="field-error">{scanError}</p>}
      <OrderItemsTable
        lines={lines}
        onChangeQuantity={completed ? undefined : changeQuantity}
        onChangeDiscount={
          completed
            ? undefined
            : (key, draft: LineDiscountDraft) => updateLine(key, (l) => withLineDiscount(l, draft))
        }
        onChangeNote={completed ? undefined : (key, note) => updateLine(key, (l) => ({ ...l, note }))}
        onRemove={completed ? undefined : (key) => changeLines((prev) => prev.filter((l) => l.key !== key))}
      />

      <div className="payment-panel order-summary">
        {!completed && lines.length > 0 && (
          <SaleDiscountFields
            draft={discountDraft}
            onChange={setDiscountDraft}
            subtotalCents={totals.subtotalCents}
            hasDiscountedLines={lines.some((l) => l.unitPriceCents < l.listPriceCents)}
            error={totals.discountError}
          />
        )}
        <dl className="payment-summary">
          {totals.discountCents > 0 && (
            <>
              <dt>Zwischensumme</dt>
              <dd>{formatChf(totals.subtotalCents)} CHF</dd>
              <dt>
                Gesamtrabatt{totals.discount?.kind === "percent" ? ` ${formatPercent(totals.discount.value)}` : ""}
              </dt>
              <dd>−{formatChf(totals.discountCents)} CHF</dd>
            </>
          )}
          <dt className="payment-summary-total">Total</dt>
          <dd className="payment-summary-total">{formatChf(totals.totalCents)} CHF</dd>
        </dl>

        {errorMessage && <p className="field-error">{errorMessage}</p>}

        {!completed && (
          <div className="form-actions">
            <Button type="button" disabled={busy || !dirty} onClick={() => void handleSave()}>
              Speichern
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || lines.length === 0}
              onClick={() => void handleComplete()}
            >
              {paidAtCheckout(paymentMethod) ? "Abschliessen an der Kasse" : "Abschliessen mit Rechnung"}
            </Button>
            {order && (
              <Button type="button" variant="danger" disabled={busy} onClick={() => void handleDelete()}>
                Auftrag löschen
              </Button>
            )}
            {dirty && <span className="muted">Ungespeicherte Änderungen</span>}
          </div>
        )}
      </div>

      <Modal open={creatingCustomer} title="Neuer Kunde" onClose={() => setCreatingCustomer(false)} size="lg">
        {creatingCustomer && (
          <CustomerForm
            customers={customers}
            submitting={createCustomer.isPending}
            errorMessage={createCustomer.error?.message}
            onCancel={() => setCreatingCustomer(false)}
            onSubmit={({ active: _active, ...fields }) => {
              createCustomer
                .mutateAsync(fields)
                .then((customer) => {
                  setCreatedCustomer(customer);
                  setCustomerId(customer.id);
                  setCreatingCustomer(false);
                  setFormError(null);
                })
                .catch(() => {});
            }}
          />
        )}
      </Modal>
    </section>
  );
}
