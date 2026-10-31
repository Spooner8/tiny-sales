import { useState } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { formatArticleReference, matchesArticleSearch } from "../../../lib/articleCode";
import { parseNumericInput } from "../../../lib/utils";
import type { LabelEntry } from "../../../lib/labels/buildPages";
import type { Article } from "../../../types/article";

export interface LabelQueueEditorProps {
  articles: Article[];
  entries: LabelEntry[];
  onChange: (entries: LabelEntry[]) => void;
}

export function LabelQueueEditor({ articles, entries, onChange }: LabelQueueEditorProps) {
  const [query, setQuery] = useState("");

  const matches =
    query.trim().length > 0
      ? articles
          .filter((a) => matchesArticleSearch(a, query))
          .slice(0, 8)
      : [];

  function addArticle(article: Article) {
    if (entries.some((e) => e.article.id === article.id)) return;
    onChange([...entries, { article, quantity: 10 }]);
    setQuery("");
  }

  function setQuantity(articleId: number, quantity: number) {
    onChange(entries.map((e) => (e.article.id === articleId ? { ...e, quantity: Math.max(0, quantity) } : e)));
  }

  function removeEntry(articleId: number) {
    onChange(entries.filter((e) => e.article.id !== articleId));
  }

  return (
    <div className="article-picker">
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
              </span>
              <Button type="button" variant="secondary" onClick={() => addArticle(article)}>
                Hinzufügen
              </Button>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-name">Artikel</th>
                <th>Anzahl Etiketten</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.article.id}>
                  <td>
                    {entry.article.name} <span className="muted">({formatArticleReference(entry.article)})</span>
                  </td>
                  <td>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={entry.quantity}
                      onChange={(e) => setQuantity(entry.article.id, parseNumericInput(e.target.value, entry.quantity))}
                      className="finishing-picker-price"
                    />
                  </td>
                  <td>
                    <Button type="button" variant="danger" size="sm" onClick={() => removeEntry(entry.article.id)}>
                      Entfernen
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
