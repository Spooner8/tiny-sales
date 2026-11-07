import { invokeCommand } from "./client";
import type { ExcelKind, ImportPreview, ImportResult } from "../../types/excel";

const COMMANDS: Record<ExcelKind, { export: string; preview: string; apply: string }> = {
  articles: {
    export: "export_articles",
    preview: "preview_article_import",
    apply: "apply_article_import",
  },
  customers: {
    export: "export_customers",
    preview: "preview_customer_import",
    apply: "apply_customer_import",
  },
};

export const excelApi = {
  exportFile: (kind: ExcelKind, path: string) => invokeCommand<void>(COMMANDS[kind].export, { path }),
  previewImport: (kind: ExcelKind, path: string) => invokeCommand<ImportPreview>(COMMANDS[kind].preview, { path }),
  applyImport: (kind: ExcelKind, path: string) => invokeCommand<ImportResult>(COMMANDS[kind].apply, { path }),
};
