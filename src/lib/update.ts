import { confirmAction } from "./confirm";

/** Asks before the app is closed for installing version `version`. */
export function confirmUpdate(version: string): Promise<boolean> {
  return confirmAction(
    `Version ${version} wird heruntergeladen und installiert. Tiny Sales wird dafür geschlossen und danach neu gestartet.

` + "Offene Verkäufe bleiben gespeichert. Jetzt aktualisieren?",
    "Aktualisieren",
  );
}

export function installLabel(installing: boolean, progress: number | null): string {
  if (!installing) return "Jetzt aktualisieren";
  return progress === null ? "Wird installiert..." : `Wird heruntergeladen... ${progress} %`;
}
