import type { ReceiptPaperSize } from "./settings";

export const PAPER_ORIENTATIONS = ["portrait", "landscape"] as const;
export type PaperOrientation = (typeof PAPER_ORIENTATIONS)[number];

export const PAPER_ORIENTATION_LABELS: Record<PaperOrientation, string> = {
  portrait: "Hochformat",
  landscape: "Querformat",
};

export interface LabelTemplate {
  id: number;
  name: string;
  paperSize: ReceiptPaperSize;
  orientation: PaperOrientation;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  marginXMm: number;
  marginYMm: number;
  active: boolean;
}

export interface NewLabelTemplate {
  name: string;
  paperSize: ReceiptPaperSize;
  orientation: PaperOrientation;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  marginXMm: number;
  marginYMm: number;
}

export interface UpdateLabelTemplate {
  id: number;
  name: string;
  paperSize: ReceiptPaperSize;
  orientation: PaperOrientation;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  marginXMm: number;
  marginYMm: number;
  active: boolean;
}
