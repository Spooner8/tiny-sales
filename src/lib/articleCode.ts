/**
 * Turns typed or scanned input into a stored article number: not case
 * sensitive, ignores spaces and the "ART-" prefix that labels printed before
 * the prefix was dropped still carry in their QR code.
 */
export function normalizeArticleCode(input: string): string {
  return input.trim().toUpperCase().replace(/^ART-/, "").replace(/\s+/g, "");
}

export function findArticleByCode<T extends { code: string }>(articles: T[], input: string): T | undefined {
  const code = normalizeArticleCode(input);
  if (!code) return undefined;
  return articles.find((article) => article.code.toUpperCase() === code);
}

/** e.g. "Art-Nr. K7Q2XM" */
export function formatArticleCode(code: string): string {
  return `Art-Nr. ${code}`;
}

/**
 * Free-text article search over name, article number (also typed with the
 * old "ART-" prefix) and internal number - not case sensitive.
 */
export function matchesArticleSearch(
  article: { name: string; code: string; internalNumber: string | null },
  query: string,
): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return false;
  const code = normalizeArticleCode(query).toLowerCase();
  return (
    article.name.toLowerCase().includes(text) ||
    (code !== "" && article.code.toLowerCase().includes(code)) ||
    (article.internalNumber?.toLowerCase().includes(text) ?? false)
  );
}

/** e.g. "Art-Nr. K7Q2XM · Interne Nr. STR-001" */
export function formatArticleReference(article: { code: string; internalNumber: string | null }): string {
  const internal = article.internalNumber ? ` · Interne Nr. ${article.internalNumber}` : "";
  return `${formatArticleCode(article.code)}${internal}`;
}
