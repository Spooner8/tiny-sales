export type ExcelKind = "articles" | "customers";

export const EXCEL_KIND_LABELS: Record<ExcelKind, string> = {
  articles: "Artikel",
  customers: "Kunden",
};

/** A problem in one row of an imported file. */
export interface ImportRowError {
  /** Row number as Excel shows it. */
  row: number;
  message: string;
}

/** What importing one row will do. */
export interface ImportChange {
  row: number;
  /** What the row is about, e.g. the article's number and name. */
  label: string;
  /** The changed values, e.g. "Preis: 25.00 → 27.00"; empty for new rows. */
  changes: string[];
}

/** What an import would do, shown before anything is written. */
export interface ImportPreview {
  created: ImportChange[];
  updated: ImportChange[];
  unchanged: number;
  /** Any error keeps the whole file from being imported. */
  errors: ImportRowError[];
}

export interface ImportResult {
  created: number;
  updated: number;
}
