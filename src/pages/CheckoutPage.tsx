import { useEffect, useState } from "react";

import { Input } from "../components/atoms/Input";
import { OpenSaleTabs } from "../components/molecules/OpenSaleTabs";
import type { OpenSaleTab } from "../components/molecules/OpenSaleTabs";
import { PageHeader } from "../components/molecules/PageHeader";
import { ArticlePicker } from "../components/organisms/ArticlePicker";
import { Cart } from "../components/organisms/Cart";
import type { CartLine } from "../components/organisms/Cart";
import { PaymentPanel } from "../components/organisms/PaymentPanel";
import type { PaymentConfirmDetails } from "../components/organisms/PaymentPanel";
import { Receipt } from "../components/templates/Receipt";
import { useArticlesQuery } from "../hooks/useArticles";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useCompanyProfileQuery } from "../hooks/useCompanyProfile";
import {
  getRememberedOpenSaleId,
  useActiveOpenSaleId,
  useOpenSaleActions,
  useOpenSaleSyncError,
  useOpenSalesQuery,
} from "../hooks/useOpenSales";
import { useReceiptPaperSizeQuery, useSetReceiptPaperSize } from "../hooks/useSettings";
import { useCreateSale } from "../hooks/useSale";
import { findArticleByCode } from "../lib/articleCode";
import { confirmAction } from "../lib/confirm";
import {
  EMPTY_LINE_DISCOUNT,
  lineUnitPriceCents,
  parseLineDiscount,
  parseSaleDiscount,
  saleDiscountCents,
} from "../lib/money/discount";
import type { DiscountableLine, LineDiscountDraft } from "../lib/money/discount";
import { isBlankOpenSale, openSaleTitle, reservedQuantities } from "../lib/openSales";
import type { Article } from "../types/article";
import type { OpenSale } from "../types/openSale";
import type { SaleWithItems } from "../types/sale";
import type { ReceiptPaperSize } from "../types/settings";

const NO_RESERVATIONS = new Map<number, number>();

function toDiscountableLines(lines: CartLine[]): DiscountableLine[] {
  return lines.map((line) => ({
    lineTotalCents: line.unitPriceCents * line.quantity,
    discounted: line.unitPriceCents < line.article.totalPriceCents,
  }));
}

export function CheckoutPage() {
  const { data: articles, isLoading } = useArticlesQuery();
  const { data: openSales } = useOpenSalesQuery();
  const openSaleActions = useOpenSaleActions();
  const syncError = useOpenSaleSyncError();
  const [activeId, setActiveId] = useActiveOpenSaleId();
  const createSale = useCreateSale();
  const { data: company } = useCompanyProfileQuery();
  const { data: defaultPaperSize } = useReceiptPaperSizeQuery();
  const setReceiptPaperSize = useSetReceiptPaperSize();

  const [completedSale, setCompletedSale] = useState<SaleWithItems | null>(null);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("A4");
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultPaperSize) setPaperSize(defaultPaperSize);
  }, [defaultPaperSize]);

  // Always work in an open sale: the remembered one, a blank one, or a new one.
  useEffect(() => {
    if (!openSales || completedSale) return;
    if (openSales.some((sale) => sale.id === activeId)) return;
    // Read the cache rather than this render's data: StrictMode runs the
    // effect twice and the first run may just have created a sale.
    const sales = openSaleActions.getAll();
    const remembered = getRememberedOpenSaleId();
    const next =
      sales.find((sale) => sale.id === remembered) ?? sales.find(isBlankOpenSale) ?? openSaleActions.create();
    setActiveId(next.id);
  }, [openSales, activeId, completedSale, openSaleActions]);

  const activeArticles = (articles ?? []).filter((a) => a.active);
  const articlesById = new Map(activeArticles.map((a) => [a.id, a]));
  const activeSale = openSales?.find((sale) => sale.id === activeId) ?? null;
  // Completing deletes the open sale: no changes while that is in flight.
  const locked = createSale.isPending;
  // Stock held by the other open sales is not available to this one.
  const reservedElsewhere = reservedQuantities(openSales ?? [], activeSale?.id);

  function buildLines(sale: OpenSale, reserved: Map<number, number>): CartLine[] {
    return sale.items
      .map((item) => {
        const article = articlesById.get(item.articleId);
        if (!article) return null;
        const { discount, error } = parseLineDiscount(item.discount, article.salePriceCents);
        return {
          article,
          quantity: item.quantity,
          discountDraft: item.discount,
          discount,
          discountError: error,
          unitPriceCents: lineUnitPriceCents(article.salePriceCents, discount),
          reservedElsewhere: reserved.get(article.id) ?? 0,
        };
      })
      .filter((line): line is CartLine => line !== null);
  }

  const lines = activeSale ? buildLines(activeSale, reservedElsewhere) : [];
  const hasLineErrors = lines.some((line) => line.discountError !== null);

  const tabs: OpenSaleTab[] = (openSales ?? []).map((sale) => {
    const saleLines = toDiscountableLines(buildLines(sale, NO_RESERVATIONS));
    const subtotalCents = saleLines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const { discount } = parseSaleDiscount(sale.discount, subtotalCents);
    return {
      id: sale.id,
      title: openSaleTitle(sale),
      itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      totalCents: subtotalCents - saleDiscountCents(saleLines, discount),
    };
  });

  function changeActiveSale(change: (sale: OpenSale) => OpenSale) {
    if (!activeSale || locked) return;
    openSaleActions.update(activeSale.id, change);
  }

  function setItemQuantity(articleId: number, quantity: number) {
    changeActiveSale((sale) => {
      const exists = sale.items.some((item) => item.articleId === articleId);
      return {
        ...sale,
        items: exists
          ? sale.items.map((item) => (item.articleId === articleId ? { ...item, quantity } : item))
          : [...sale.items, { articleId, quantity, discount: EMPTY_LINE_DISCOUNT }],
      };
    });
  }

  function quantityInCart(articleId: number): number {
    return activeSale?.items.find((item) => item.articleId === articleId)?.quantity ?? 0;
  }

  // Quantities are not capped at the recorded stock: an article physically
  // at the counter exists, and the sale corrects a too-low stock (see the
  // hint in the cart and SaleRepository::create). Only pieces held by other
  // open sales are asked about, once the cart reaches what is left.
  async function confirmReservedStock(article: Article, currentQuantity: number): Promise<boolean> {
    const reserved = reservedElsewhere.get(article.id) ?? 0;
    const available = Math.max(article.stock - reserved, 0);
    const exceedsNow = currentQuantity + 1 > available && currentQuantity <= available;
    if (reserved === 0 || !exceedsNow) return true;
    return confirmAction(
      `"${article.name}": ${reserved} von ${article.stock} Stück sind in anderen offenen Verkäufen reserviert, ` +
        `verfügbar: ${available}.\n\nTrotzdem hinzufügen?`,
      "Trotzdem hinzufügen",
    );
  }

  async function addArticle(article: Article) {
    if (!activeSale || locked) return;
    const current = quantityInCart(article.id);
    if (!(await confirmReservedStock(article, current))) return;
    setItemQuantity(article.id, current + 1);
  }

  async function changeQuantity(articleId: number, quantity: number) {
    const article = articlesById.get(articleId);
    if (!article) return;
    if (quantity <= 0) {
      removeArticle(articleId);
      return;
    }
    const current = quantityInCart(articleId);
    if (quantity > current && !(await confirmReservedStock(article, current))) return;
    setItemQuantity(articleId, quantity);
  }

  function changeDiscount(articleId: number, draft: LineDiscountDraft) {
    changeActiveSale((sale) => ({
      ...sale,
      items: sale.items.map((item) => (item.articleId === articleId ? { ...item, discount: draft } : item)),
    }));
  }

  function removeArticle(articleId: number) {
    changeActiveSale((sale) => ({ ...sale, items: sale.items.filter((item) => item.articleId !== articleId) }));
  }

  useBarcodeScanner(
    (code) => {
      const match = findArticleByCode(activeArticles, code);
      if (match) {
        void addArticle(match);
        setScanError(null);
      } else {
        setScanError(`Art-Nr. "${code}" nicht gefunden`);
      }
    },
    !completedSale && articles !== undefined && activeSale !== null,
  );

  /** A sale left without items or name isn't worth keeping as a tab. */
  function dropActiveIfBlank() {
    if (activeSale && isBlankOpenSale(activeSale)) openSaleActions.remove(activeSale.id);
  }

  function selectSale(id: string) {
    if (locked || (id === activeId && !completedSale)) return;
    dropActiveIfBlank();
    setCompletedSale(null);
    setScanError(null);
    createSale.reset();
    setActiveId(id);
  }

  function startAnotherSale() {
    if (locked) return;
    if (!completedSale && activeSale && isBlankOpenSale(activeSale)) return;
    dropActiveIfBlank();
    const blank = openSaleActions.getAll().find(isBlankOpenSale);
    setCompletedSale(null);
    setScanError(null);
    createSale.reset();
    setActiveId((blank ?? openSaleActions.create()).id);
  }

  function handleConfirm(details: PaymentConfirmDetails) {
    if (!activeSale) return;
    createSale.mutate(
      {
        items: lines.map((line) => ({
          articleId: line.article.id,
          quantity: line.quantity,
          discount: line.discount,
        })),
        paymentMethod: details.paymentMethod,
        cashGivenCents: details.cashGivenCents,
        pickupNumber: details.pickupNumber,
        discount: details.discount,
        openSaleId: activeSale.id,
      },
      {
        onSuccess: (sale) => {
          setCompletedSale(sale);
          setActiveId(null);
        },
      },
    );
  }

  function startNewSale() {
    setCompletedSale(null);
    createSale.reset();
  }

  async function cancelSale() {
    if (!activeSale || locked) return;
    if (activeSale.items.length > 0 && !(await confirmAction("Verkauf abbrechen und Warenkorb leeren?", "Verkauf abbrechen"))) {
      return;
    }
    openSaleActions.remove(activeSale.id);
    setActiveId(null);
    createSale.reset();
  }

  const tabBar = openSales && (
    <OpenSaleTabs
      tabs={tabs}
      activeId={completedSale ? null : activeId}
      onSelect={selectSale}
      onCreate={startAnotherSale}
      disabled={locked}
    />
  );

  if (completedSale) {
    return (
      <section>
        <PageHeader title="Kasse" />
        {tabBar}
        <Receipt
          sale={completedSale}
          company={company}
          paperSize={paperSize}
          onPaperSizeChange={(size) => {
            setPaperSize(size);
            setReceiptPaperSize.mutate(size);
          }}
          onNewSale={startNewSale}
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Kasse" />

      {(isLoading || !openSales) && <p>Wird geladen...</p>}

      {tabBar}
      {syncError && <p className="field-error">Offener Verkauf konnte nicht gespeichert werden: {syncError}</p>}

      {articles && activeSale && (
        <>
          <div className="open-sale-meta">
            <Input
              value={activeSale.label ?? ""}
              onChange={(e) => changeActiveSale((sale) => ({ ...sale, label: e.target.value }))}
              placeholder="Bezeichnung, z.B. Kundenname (optional)"
              aria-label="Bezeichnung des Verkaufs"
            />
          </div>
          <ArticlePicker
            articles={activeArticles}
            onAdd={(article) => void addArticle(article)}
            reserved={reservedQuantities(openSales ?? [])}
          />
          {scanError && <p className="field-error">{scanError}</p>}
          <Cart
            lines={lines}
            onChangeQuantity={(articleId, quantity) => void changeQuantity(articleId, quantity)}
            onChangeDiscount={changeDiscount}
            onRemove={removeArticle}
          />

          {lines.length > 0 && (
            <PaymentPanel
              key={activeSale.id}
              lines={toDiscountableLines(lines)}
              discountDraft={activeSale.discount}
              onDiscountDraftChange={(discount) => changeActiveSale((sale) => ({ ...sale, discount }))}
              pickupNumber={activeSale.pickupNumber}
              onPickupNumberChange={(pickupNumber) => changeActiveSale((sale) => ({ ...sale, pickupNumber }))}
              blocked={hasLineErrors}
              submitting={createSale.isPending}
              errorMessage={createSale.error?.message}
              onConfirm={handleConfirm}
              onCancel={() => void cancelSale()}
            />
          )}
        </>
      )}
    </section>
  );
}
