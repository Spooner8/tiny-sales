import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri rejects command errors with the raw AppError string (no `Error` object).
 * This wrapper normalizes that into real `Error` instances so React Query &
 * friends can work with `error.message` everywhere.
 */
export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw new Error(typeof err === "string" ? err : String(err));
  }
}
