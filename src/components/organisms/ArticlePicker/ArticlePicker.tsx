import { useState } from "react";
import type { FormEvent } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { PriceTag } from "../../molecules/PriceTag";
import { findArticleByCode, formatArticleReference, matchesArticleSearch } from "../../../lib/articleCode";
import type { Article } from "../../../types/article";

export interface ArticlePickerProps {
  articles: Article[];
  onAdd: (article: Article) => void;
  /** Quantity per article id held by open sales; shows the stock when set. */
  reserved?: Map<number, number>;
}

function StockInfo({ stock, reserved }: { stock: number; reserved: number }) {
  return (
    <span className="article-picker-stock muted">
      Bestand {stock}
      {reserved > 0 && ` · ${reserved} in offenen Verkäufen reserviert · verfügbar ${Math.max(stock - reserved, 0)}`}
    </span>
  );
}

export function ArticlePicker({ articles, onAdd, reserved }: ArticlePickerProps) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    const match = findArticleByCode(articles, trimmed);
    if (!match) {
      setCodeError(`Art-Nr. "${trimmed}" nicht gefunden`);
      return;
    }
    onAdd(match);
    setCode("");
    setCodeError(null);
  }

  const matches =
    query.trim().length > 0
      ? articles
          .filter((a) => matchesArticleSearch(a, query))
          .slice(0, 8)
      : [];

  return (
    <div className="article-picker">
      <form className="article-picker-scan" onSubmit={handleCodeSubmit}>
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeError(null);
          }}
          placeholder="Art-Nr. scannen oder eingeben..."
          autoFocus
        />
        <Button type="submit">Hinzufügen</Button>
      </form>
      {codeError && <p className="field-error">{codeError}</p>}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Artikel suchen (Name, Art-Nr. oder Muster-Nr.)..."
      />

      {matches.length > 0 && (
        <ul className="article-picker-results">
          {matches.map((article) => (
            <li key={article.id} className="article-picker-result">
              <span>
                {article.name} <span className="muted">({formatArticleReference(article)})</span>
                {article.discontinued && (
                  <>
                    {" "}
                    <Badge tone="warning">Auslaufend</Badge>
                  </>
                )}
                {reserved && <StockInfo stock={article.stock} reserved={reserved.get(article.id) ?? 0} />}
              </span>
              <PriceTag
                listPriceCents={article.totalPriceCents}
                salePriceCents={article.salePriceCents}
                discountPercent={article.discountPercent}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onAdd(article);
                  setQuery("");
                }}
              >
                Hinzufügen
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
