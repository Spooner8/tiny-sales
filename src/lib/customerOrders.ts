import type { OrderLine } from "../components/organisms/OrderItemsTable";
import {
  EMPTY_LINE_DISCOUNT,
  EMPTY_SALE_DISCOUNT,
  lineUnitPriceCents,
  parseLineDiscount,
  parseSaleDiscount,
  saleDiscountCents,
} from "./money/discount";
import type { DiscountableLine, LineDiscountDraft, SaleDiscountDraft } from "./money/discount";
import type { Article } from "../types/article";
import type { CustomerOrderItem } from "../types/customerOrder";
import type { LineDiscount, SaleDiscount } from "../types/sale";

function newLineKey(): string {
  return crypto.randomUUID();
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** A stored discount as it would have been typed. */
export function lineDiscountDraft(discount: LineDiscount | null): LineDiscountDraft {
  if (!discount) return EMPTY_LINE_DISCOUNT;
  return discount.kind === "percent"
    ? { kind: "percent", input: String(discount.value) }
    : { kind: "amount", input: centsToInput(discount.value) };
}

export function saleDiscountDraft(discount: SaleDiscount | null): SaleDiscountDraft {
  if (!discount) return EMPTY_SALE_DISCOUNT;
  return discount.kind === "percent"
    ? { kind: "percent", input: String(discount.value), cumulative: discount.cumulative }
    : { kind: "total", input: centsToInput(discount.value), cumulative: false };
}

/** The line with a new discount draft, validated against its agreed price. */
export function withLineDiscount(line: OrderLine, draft: LineDiscountDraft): OrderLine {
  const { discount, error } = parseLineDiscount(draft, line.salePriceCents);
  return {
    ...line,
    discountDraft: draft,
    discount,
    discountError: error,
    unitPriceCents: lineUnitPriceCents(line.salePriceCents, discount),
  };
}

export function lineFromOrderItem(item: CustomerOrderItem): OrderLine {
  return withLineDiscount(
    {
      key: newLineKey(),
      id: item.id,
      articleId: item.articleId,
      articleCode: item.articleCode,
      articleName: item.articleName,
      articleInternalNumber: item.articleInternalNumber,
      quantity: item.quantity,
      listPriceCents: item.listPriceCents,
      salePriceCents: item.salePriceCents,
      articleDiscountPercent: item.articleDiscountPercent,
      discountDraft: EMPTY_LINE_DISCOUNT,
      discount: null,
      discountError: null,
      unitPriceCents: item.unitPriceCents,
      note: item.note ?? "",
    },
    lineDiscountDraft(item.discount),
  );
}

/** A new line at the article's current price; saving fixes it. */
export function lineFromArticle(article: Article): OrderLine {
  return {
    key: newLineKey(),
    id: null,
    articleId: article.id,
    articleCode: article.code,
    articleName: article.name,
    articleInternalNumber: article.internalNumber,
    quantity: 1,
    listPriceCents: article.totalPriceCents,
    salePriceCents: article.salePriceCents,
    articleDiscountPercent: article.discountPercent,
    discountDraft: EMPTY_LINE_DISCOUNT,
    discount: null,
    discountError: null,
    unitPriceCents: article.salePriceCents,
    note: "",
  };
}

export function toDiscountableLines(lines: OrderLine[]): DiscountableLine[] {
  return lines.map((line) => ({
    lineTotalCents: line.unitPriceCents * line.quantity,
    discounted: line.unitPriceCents < line.listPriceCents,
  }));
}

export interface OrderTotals {
  subtotalCents: number;
  discount: SaleDiscount | null;
  discountError: string | null;
  discountCents: number;
  totalCents: number;
}

export function orderTotals(lines: OrderLine[], draft: SaleDiscountDraft): OrderTotals {
  const discountable = toDiscountableLines(lines);
  const subtotalCents = discountable.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const { discount, error } = parseSaleDiscount(draft, subtotalCents);
  const discountCents = saleDiscountCents(discountable, discount);
  return { subtotalCents, discount, discountError: error, discountCents, totalCents: subtotalCents - discountCents };
}

/** e.g. "12.03.2026" for a timestamp or date from the database (UTC). */
export function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}
