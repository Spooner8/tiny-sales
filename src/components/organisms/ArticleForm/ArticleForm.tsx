import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Checkbox } from "../../ui/checkbox";
import { Input } from "../../atoms/Input";
import { Select } from "../../atoms/Select";
import { Textarea } from "../../atoms/Textarea";
import { FormField } from "../../molecules/FormField";
import { formatArticleReference, matchesArticleSearch } from "../../../lib/articleCode";
import { formatChf } from "../../../lib/money/change";
import { formatPercent, roundTo5Rappen } from "../../../lib/money/discount";
import { parseNumericInput } from "../../../lib/utils";
import type { Article, NewArticleComponentLink } from "../../../types/article";
import type { ProductGroup } from "../../../types/productGroup";
import type { ProductSubgroup } from "../../../types/productSubgroup";

export interface ArticleFormValues {
  name: string;
  productGroupId: number;
  productSubgroupId: number;
  internalNumber: string | null;
  description: string | null;
  isFinishing: boolean;
  priceCents: number;
  stock: number;
  active: boolean;
  discontinued: boolean;
  discountPercent: number;
  componentLinks: NewArticleComponentLink[];
}

export interface ArticleFormProps {
  initial?: Article;
  productGroups: ProductGroup[];
  productSubgroups: ProductSubgroup[];
  articles: Article[];
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: ArticleFormValues) => void;
  onCancel: () => void;
}

function centsToChfString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function chfStringToCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Strict variant for the required base price: null if empty or not a valid non-negative amount. */
function parseRequiredChf(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  return chfStringToCents(trimmed);
}

/** Optional promotion: empty means none; null if not a number from 0 to 100. */
function parseDiscountPercent(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  const percent = Number.parseFloat(trimmed.replace(",", "."));
  return percent <= 100 ? percent : null;
}

type RequiredField = "name" | "productGroup" | "productSubgroup" | "price" | "discount";

export function ArticleForm({
  initial,
  productGroups,
  productSubgroups,
  articles,
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: ArticleFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [productGroupId, setProductGroupId] = useState<number | null>(initial?.productGroupId ?? null);
  const [productSubgroupId, setProductSubgroupId] = useState<number | null>(
    initial?.productSubgroupId ?? null,
  );
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});

  const subgroupsOfGroup = productSubgroups.filter((s) => s.productGroupId === productGroupId);

  function clearError(field: RequiredField) {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function changeProductGroup(id: number) {
    setProductGroupId(id);
    setProductSubgroupId(null);
    clearError("productGroup");
  }
  const [internalNumber, setInternalNumber] = useState(initial?.internalNumber ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isFinishing, setIsFinishing] = useState(initial?.isFinishing ?? false);
  const [price, setPrice] = useState(initial ? centsToChfString(initial.priceCents) : "");
  const [stock, setStock] = useState(initial?.stock ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  const [discontinued, setDiscontinued] = useState(initial?.discontinued ?? false);
  const [discount, setDiscount] = useState(initial?.discountPercent ? String(initial.discountPercent) : "");

  const [componentPrices, setComponentPrices] = useState<Record<number, string>>(() => {
    const initialMap: Record<number, string> = {};
    for (const c of initial?.components ?? []) {
      initialMap[c.componentArticleId] = centsToChfString(c.priceCents);
    }
    return initialMap;
  });
  const [componentQuery, setComponentQuery] = useState("");

  const otherArticles = articles.filter((a) => a.id !== initial?.id);
  // Only articles marked as a finishing can be attached.
  const selectableArticles = otherArticles.filter((a) => a.isFinishing);

  function addComponent(article: Article) {
    setComponentPrices((prev) => ({ ...prev, [article.id]: centsToChfString(article.totalPriceCents) }));
    setComponentQuery("");
  }

  function removeComponent(articleId: number) {
    setComponentPrices((prev) => {
      const next = { ...prev };
      delete next[articleId];
      return next;
    });
  }

  function setComponentPrice(articleId: number, value: string) {
    setComponentPrices((prev) => ({ ...prev, [articleId]: value }));
  }

  const selectedComponents = Object.keys(componentPrices)
    .map((id) => otherArticles.find((a) => a.id === Number(id)))
    .filter((a): a is Article => a !== undefined);

  const componentMatches =
    componentQuery.trim().length > 0
      ? selectableArticles
          .filter((a) => !(a.id in componentPrices) && matchesArticleSearch(a, componentQuery))
          .slice(0, 6)
      : [];

  const basePriceCents = chfStringToCents(price);
  const componentsTotalCents = Object.values(componentPrices).reduce(
    (sum, v) => sum + chfStringToCents(v),
    0,
  );
  const totalPriceCents = basePriceCents + componentsTotalCents;
  const discountPercent = parseDiscountPercent(discount);
  const salePriceCents =
    discountPercent && discountPercent > 0
      ? roundTo5Rappen((totalPriceCents * (100 - discountPercent)) / 100)
      : totalPriceCents;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const priceCents = parseRequiredChf(price);
    const nextErrors: Partial<Record<RequiredField, string>> = {};
    if (!name.trim()) nextErrors.name = "Name ist ein Pflichtfeld";
    if (productGroupId === null) nextErrors.productGroup = "Warengruppe ist ein Pflichtfeld";
    if (productSubgroupId === null) nextErrors.productSubgroup = "Warenuntergruppe ist ein Pflichtfeld";
    if (!price.trim()) nextErrors.price = "Preis ist ein Pflichtfeld";
    else if (priceCents === null) nextErrors.price = "Ungültiger Preis, z.B. 12.50";
    if (discountPercent === null) nextErrors.discount = "Rabatt muss eine Zahl zwischen 0 und 100 sein";
    setErrors(nextErrors);
    if (
      productGroupId === null ||
      productSubgroupId === null ||
      priceCents === null ||
      discountPercent === null ||
      nextErrors.name
    ) {
      return;
    }

    const componentLinks: NewArticleComponentLink[] = Object.entries(componentPrices).map(
      ([componentArticleId, priceStr]) => ({
        componentArticleId: Number(componentArticleId),
        priceOverrideCents: chfStringToCents(priceStr),
      }),
    );
    onSubmit({
      name,
      productGroupId,
      productSubgroupId,
      internalNumber: internalNumber.trim() ? internalNumber.trim() : null,
      description: description.trim() ? description.trim() : null,
      isFinishing,
      priceCents,
      stock,
      active,
      discontinued,
      discountPercent,
      componentLinks,
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <FormField label="Name *" htmlFor="article-name" error={errors.name}>
          <Input
            id="article-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            autoFocus
          />
        </FormField>

        <FormField label="Interne Nr. (optional)" htmlFor="article-internal-number">
          <Input
            id="article-internal-number"
            value={internalNumber}
            onChange={(e) => setInternalNumber(e.target.value)}
            placeholder="z.B. STR-001"
          />
        </FormField>

        <FormField label="Warengruppe *" htmlFor="article-product-group" error={errors.productGroup}>
          <Select
            id="article-product-group"
            value={productGroupId === null ? "" : String(productGroupId)}
            onValueChange={(value) => changeProductGroup(Number(value))}
            options={productGroups.map((g) => ({ value: String(g.id), label: g.name }))}
            placeholder="Warengruppe wählen"
          />
        </FormField>

        <FormField label="Warenuntergruppe *" htmlFor="article-product-subgroup" error={errors.productSubgroup}>
          <Select
            id="article-product-subgroup"
            value={productSubgroupId === null ? "" : String(productSubgroupId)}
            onValueChange={(value) => {
              setProductSubgroupId(Number(value));
              clearError("productSubgroup");
            }}
            options={subgroupsOfGroup.map((s) => ({ value: String(s.id), label: s.name }))}
            placeholder={
              productGroupId === null
                ? "Zuerst Warengruppe wählen"
                : subgroupsOfGroup.length === 0
                  ? "Keine Warenuntergruppen vorhanden"
                  : "Warenuntergruppe wählen"
            }
            disabled={subgroupsOfGroup.length === 0}
          />
        </FormField>

        <div className="form-grid-full">
          <FormField label="Beschrieb (optional)" htmlFor="article-description">
            <Textarea
              id="article-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </FormField>
        </div>

        <FormField label="Preis (CHF) *" htmlFor="article-price" error={errors.price}>
          <Input
            id="article-price"
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              clearError("price");
            }}
            placeholder="0.00"
          />
        </FormField>

        <FormField label="Aktions-Rabatt in % (optional)" htmlFor="article-discount" error={errors.discount}>
          <Input
            id="article-discount"
            type="text"
            inputMode="decimal"
            value={discount}
            onChange={(e) => {
              setDiscount(e.target.value);
              clearError("discount");
            }}
            placeholder="z.B. 20"
          />
        </FormField>

        <FormField label="Bestand" htmlFor="article-stock">
          <Input
            id="article-stock"
            type="text"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(parseNumericInput(e.target.value, stock))}
          />
        </FormField>

        {/* Flags next to the stock, lined up with its input below the label. */}
        <div className="form-grid-checkboxes">
          <div className="form-field form-field-row">
            <Checkbox id="article-discontinued" checked={discontinued} onCheckedChange={setDiscontinued} />
            <label htmlFor="article-discontinued">Auslaufend</label>
          </div>
          <div className="form-field form-field-row">
            <Checkbox id="article-is-finishing" checked={isFinishing} onCheckedChange={setIsFinishing} />
            <label htmlFor="article-is-finishing">Veredelung</label>
          </div>
          {initial && (
            <div className="form-field form-field-row">
              <Checkbox id="article-active" checked={active} onCheckedChange={setActive} />
              <label htmlFor="article-active">Aktiv</label>
            </div>
          )}
        </div>
      </div>

      <div className="form-field">
        <span className="field-label">Veredelungen</span>
        <p className="muted">Als Veredelung markierte Artikel, die diesem Artikel zugeordnet werden.</p>

        {selectedComponents.length > 0 && (
          <div className="finishing-picker">
            {selectedComponents.map((component) => (
              <div key={component.id} className="finishing-picker-row">
                <span className="finishing-picker-label">
                  {component.name}
                  {component.internalNumber ? ` (${component.internalNumber})` : ""}
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={componentPrices[component.id]}
                  onChange={(e) => setComponentPrice(component.id, e.target.value)}
                  className="finishing-picker-price"
                />
                <Button type="button" variant="danger" size="sm" onClick={() => removeComponent(component.id)}>
                  Entfernen
                </Button>
              </div>
            ))}
          </div>
        )}

        <Input
          value={componentQuery}
          onChange={(e) => setComponentQuery(e.target.value)}
          placeholder="Veredelung suchen und hinzufügen..."
        />
        {componentMatches.length > 0 && (
          <ul className="article-picker-results">
            {componentMatches.map((article) => (
              <li key={article.id} className="article-picker-result">
                <span>
                  {article.name} <span className="muted">({formatArticleReference(article)})</span>
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => addComponent(article)}>
                  Hinzufügen
                </Button>
              </li>
            ))}
          </ul>
        )}
        {componentQuery.trim() && componentMatches.length === 0 && (
          <p className="muted">Keine passende Veredelung. Nur Artikel mit „Veredelung“ können zugeordnet werden.</p>
        )}
      </div>

      <p className="finishing-total-preview">
        Gesamtpreis: <strong>{formatChf(totalPriceCents)} CHF</strong>
        {componentsTotalCents > 0 && (
          <span className="muted">
            {" "}
            ({formatChf(basePriceCents)} + {formatChf(componentsTotalCents)} Veredelung)
          </span>
        )}
      </p>
      {discountPercent !== null && discountPercent > 0 && (
        <p className="finishing-total-preview">
          Aktionspreis: <strong>{formatChf(salePriceCents)} CHF</strong>{" "}
          <span className="muted">
            (statt {formatChf(totalPriceCents)} CHF, −{formatPercent(discountPercent)})
          </span>
        </p>
      )}

      {errorMessage && <p className="field-error">{errorMessage}</p>}

      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          {initial ? "Speichern" : "Anlegen"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
