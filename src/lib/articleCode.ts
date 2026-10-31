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
 * old "ART-" prefix) and pattern number - not case sensitive.
 */
export function matchesArticleSearch(
  article: { name: string; code: string; patternNumber: string | null },
  query: string,
): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return false;
  const code = normalizeArticleCode(query).toLowerCase();
  return (
    article.name.toLowerCase().includes(text) ||
    (code !== "" && article.code.toLowerCase().includes(code)) ||
    (article.patternNumber?.toLowerCase().includes(text) ?? false)
  );
}

/** e.g. "Art-Nr. K7Q2XM · Muster-Nr. STR-001" */
export function formatArticleReference(article: { code: string; patternNumber: string | null }): string {
  const pattern = article.patternNumber ? ` · Muster-Nr. ${article.patternNumber}` : "";
  return `${formatArticleCode(article.code)}${pattern}`;
}
