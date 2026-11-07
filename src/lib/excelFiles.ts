import { open, save } from "@tauri-apps/plugin-dialog";

/** Picks where the export is saved, `null` if cancelled. */
export function pickExcelFileToSave(name: string): Promise<string | null> {
  return save({
    title: `${name} exportieren`,
    defaultPath: `${name}.xlsx`,
    filters: [{ name: "Excel-Datei", extensions: ["xlsx"] }],
  });
}

/** Picks the file to import, `null` if cancelled. */
export async function pickExcelFileToImport(name: string): Promise<string | null> {
  const path = await open({
    title: `${name} importieren`,
    filters: [{ name: "Excel- oder LibreOffice-Datei", extensions: ["xlsx", "ods"] }],
    multiple: false,
  });
  return path && typeof path === "string" ? path : null;
}
