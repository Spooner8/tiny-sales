import { confirm } from "@tauri-apps/plugin-dialog";

/**
 * Native yes/no dialog. Always use this instead of `window.confirm`: the
 * Tauri dialog plugin replaces `window.confirm` with an async function, so
 * its return value is a Promise - always truthy - and
 * `if (!window.confirm(...)) return` never stops anything.
 */
export function confirmAction(message: string, okLabel = "Ja"): Promise<boolean> {
  return confirm(message, {
    title: "Bitte bestätigen",
    kind: "warning",
    okLabel,
    cancelLabel: "Abbrechen",
  });
}
