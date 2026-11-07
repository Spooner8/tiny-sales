import { Image as TauriImage } from "@tauri-apps/api/image";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { appMarkUrl } from "./appMark";
import type { ColorSchemeId } from "./colorSchemes";

const WINDOW_ICON_SIZE = 64;

async function renderMark(id: ColorSchemeId): Promise<number[]> {
  const image = new Image();
  // Windows shows this icon at 16 to 32 pixels, where the details would blur.
  image.src = appMarkUrl(id, "small");
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = WINDOW_ICON_SIZE;
  canvas.height = WINDOW_ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas nicht verfügbar");
  context.drawImage(image, 0, 0, WINDOW_ICON_SIZE, WINDOW_ICON_SIZE);
  // A plain array: a typed array would reach the backend as an object and be refused.
  return Array.from(context.getImageData(0, 0, WINDOW_ICON_SIZE, WINDOW_ICON_SIZE).data);
}

let latestRequest = 0;

/**
 * Shows the colour in the title bar and the taskbar while the app runs. The
 * installed shortcuts can't follow: their icon is part of the program file.
 * A failure only leaves the blue icon there, so it is not worth an error.
 */
export async function updateWindowIcon(id: ColorSchemeId): Promise<void> {
  const request = ++latestRequest;
  try {
    const pixels = await renderMark(id);
    if (request !== latestRequest) return;
    const icon = await TauriImage.new(pixels, WINDOW_ICON_SIZE, WINDOW_ICON_SIZE);
    try {
      await getCurrentWindow().setIcon(icon);
    } finally {
      await icon.close();
    }
  } catch (err) {
    console.warn("Fenster-Icon konnte nicht gesetzt werden", err);
  }
}
