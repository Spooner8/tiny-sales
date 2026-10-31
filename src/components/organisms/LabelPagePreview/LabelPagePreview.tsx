import { QRCodeSVG } from "qrcode.react";
import type { CSSProperties } from "react";

import { formatArticleCode } from "../../../lib/articleCode";
import { formatChf } from "../../../lib/money/change";
import { buildLabelPages, gridSizeMm, labelContentMetrics, pageSizeMm } from "../../../lib/labels/buildPages";
import type { LabelCell, LabelGridConfig } from "../../../lib/labels/buildPages";
import { PAPER_ORIENTATION_LABELS } from "../../../types/labelTemplate";

export interface LabelPagePreviewProps {
  config: LabelGridConfig;
  /** Pages to render; defaults to a single empty sheet showing the layout. */
  pages?: LabelCell[][];
}

/**
 * Renders label sheets at real paper size. The same markup is the on-screen
 * page view and the print output: free and already-used positions are only
 * marked on screen, the page frame and status are hidden when printing.
 */
export function LabelPagePreview({ config, pages }: LabelPagePreviewProps) {
  const page = pageSizeMm(config);
  const needed = gridSizeMm(config);
  const fits = needed.width <= page.width && needed.height <= page.height;
  const sheets = pages ?? buildLabelPages([], config.columns, config.rows, 0);
  const metrics = labelContentMetrics(config);
  const contentVars = {
    "--label-padding": `${metrics.paddingMm}mm`,
    "--label-gap": `${metrics.gapMm}mm`,
    "--label-qr-size": `${metrics.qrSizeMm}mm`,
    "--label-font-size": `${metrics.fontSizeMm}mm`,
  } as CSSProperties;

  return (
    <div className="label-page-preview">
      <p className={`no-print ${fits ? "label-page-preview-status-ok" : "label-page-preview-status-warn"}`}>
        Benötigt {Math.round(needed.width)}×{Math.round(needed.height)} mm auf {config.paperSize} {PAPER_ORIENTATION_LABELS[config.orientation]} (
        {page.width}×{page.height} mm){" "}
        {fits ? "— passt auf die Seite." : "— passt NICHT auf die Seite!"}
      </p>

      {sheets.map((cells, pageIndex) => (
        <div key={pageIndex} className="label-page-preview-page">
          {sheets.length > 1 && (
            <span className="label-page-preview-page-number no-print">
              Seite {pageIndex + 1} von {sheets.length}
            </span>
          )}
          <div
            className="label-sheet"
            style={{
              ...contentVars,
              width: `${page.width}mm`,
              height: `${page.height}mm`,
              gridTemplateColumns: `repeat(${Math.max(0, config.columns)}, ${config.labelWidthMm}mm)`,
              gridTemplateRows: `repeat(${Math.max(0, config.rows)}, ${config.labelHeightMm}mm)`,
              gap: `${config.gapYMm}mm ${config.gapXMm}mm`,
              padding: `${config.marginYMm}mm ${config.marginXMm}mm`,
              breakAfter: pageIndex < sheets.length - 1 ? "page" : "auto",
            }}
          >
            {cells.map((cell, cellIndex) =>
              cell === null ? (
                <div key={cellIndex} className="label-cell label-cell-empty" />
              ) : cell === "skipped" ? (
                <div key={cellIndex} className="label-cell label-cell-skipped" title="Bereits benutzt" />
              ) : (
                <div key={cellIndex} className="label-cell">
                  <QRCodeSVG value={cell.code} size={256} marginSize={1} className="label-cell-qr" />
                  <div className="label-cell-text">
                    <div className="label-cell-name">{cell.name}</div>
                    <div className="label-cell-code">{formatArticleCode(cell.code)}</div>
                    <div className="label-cell-price">{formatChf(cell.totalPriceCents)} CHF</div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
