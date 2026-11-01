import { open, save } from "@tauri-apps/plugin-dialog";

const DATABASE_FILTERS = [{ name: "SQLite-Datenbank", extensions: ["db"] }];

/**
 * Picks an existing database file, `null` if cancelled. An open dialog:
 * picking an existing file never asks to overwrite it.
 */
export async function pickExistingDatabase(defaultPath?: string): Promise<string | null> {
  const path = await open({
    title: "Bestehende Datenbank öffnen",
    defaultPath,
    filters: DATABASE_FILTERS,
    multiple: false,
  });
  return path && typeof path === "string" ? path : null;
}

/** Picks where a new, empty database is created, `null` if cancelled. */
export async function pickNewDatabasePath(): Promise<string | null> {
  return save({
    title: "Neue Datenbank anlegen",
    defaultPath: "kasse-neu.db",
    filters: DATABASE_FILTERS,
  });
}
