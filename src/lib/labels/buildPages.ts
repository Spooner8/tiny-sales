import type { Article } from "../../types/article";
import type { PaperOrientation } from "../../types/labelTemplate";
import type { ReceiptPaperSize } from "../../types/settings";

export interface LabelEntry {
  article: Article;
  quantity: number;
}

export interface LabelGridConfig {
  paperSize: ReceiptPaperSize;
  orientation: PaperOrientation;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  /** Left and right page margin. */
  marginXMm: number;
  /** Top and bottom page margin. */
  marginYMm: number;
}

/** A label position on a sheet: an article to print, a position already
 * used on a partially printed sheet, or a free position. */
export type LabelCell = Article | "skipped" | null;

/** Portrait dimensions; see pageSizeMm() for the oriented size. */
const PAGE_SIZE_MM: Record<ReceiptPaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

export function pageSizeMm(config: Pick<LabelGridConfig, "paperSize" | "orientation">): {
  width: number;
  height: number;
} {
  const portrait = PAGE_SIZE_MM[config.paperSize];
  return config.orientation === "landscape" ? { width: portrait.height, height: portrait.width } : portrait;
}

/** Space the label grid needs including the page margin on both sides. */
export function gridSizeMm(config: LabelGridConfig): { width: number; height: number } {
  const columns = Math.max(0, config.columns);
  const rows = Math.max(0, config.rows);
  return {
    width: config.marginXMm * 2 + columns * config.labelWidthMm + Math.max(0, columns - 1) * config.gapXMm,
    height: config.marginYMm * 2 + rows * config.labelHeightMm + Math.max(0, rows - 1) * config.gapYMm,
  };
}

export interface LabelContentMetrics {
  paddingMm: number;
  gapMm: number;
  qrSizeMm: number;
  /** Base font size (article name); code and price are derived from it. */
  fontSizeMm: number;
}

/** Sizes the label content proportionally to the label: the QR code takes
 * at most a third of the width (and never more than the height), the rest
 * goes to the text. The name wraps word-wise over up to three lines, so the
 * font is sized for a few words per line rather than the whole name on one.
 * Examples: 45×30 mm → ~8pt name, 90×50 mm → capped at ~14pt. */
export function labelContentMetrics(config: LabelGridConfig): LabelContentMetrics {
  const width = Math.max(1, config.labelWidthMm);
  const height = Math.max(1, config.labelHeightMm);
  const paddingMm = Math.min(4, Math.max(1, height * 0.06));
  const gapMm = paddingMm * 0.7;
  const innerWidth = Math.max(0, width - 2 * paddingMm);
  const innerHeight = Math.max(0, height - 2 * paddingMm);
  const qrSizeMm = Math.min(innerHeight, innerWidth / 3);
  const textWidth = Math.max(0, innerWidth - qrSizeMm - gapMm);
  const fontSizeMm = Math.min(5, Math.max(2.2, Math.min(innerHeight * 0.16, textWidth * 0.11)));
  return { paddingMm, gapMm, qrSizeMm, fontSizeMm };
}

/** Lays out articles into fixed-size grid pages, skipping `offset` cells on
 * the very first page so a partially used label sheet can be reused. Always
 * returns at least one page so the sheet layout can be previewed while empty. */
export function buildLabelPages(
  entries: LabelEntry[],
  columns: number,
  rows: number,
  offset: number,
): LabelCell[][] {
  const perPage = columns * rows;
  if (perPage <= 0) return [];

  const flat: LabelCell[] = [];
  for (let i = 0; i < offset; i++) flat.push("skipped");
  for (const entry of entries) {
    for (let i = 0; i < entry.quantity; i++) flat.push(entry.article);
  }

  if (flat.length === 0) flat.push(null);
  while (flat.length % perPage !== 0) flat.push(null);

  const pages: LabelCell[][] = [];
  for (let i = 0; i < flat.length; i += perPage) {
    pages.push(flat.slice(i, i + perPage));
  }
  return pages;
}
