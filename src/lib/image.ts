/**
 * Reads an image file into a PNG data URL, scaled down so its longer side is
 * at most `maxSize` pixels. Keeps logos stored in the database small; PNG
 * keeps transparency.
 */
export async function readImageAsDataUrl(file: File, maxSize = 800): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Bitte eine Bilddatei wählen (PNG, JPG, SVG ...)");

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Das Bild konnte nicht gelesen werden"));
      img.src = url;
    });
    // SVGs without intrinsic size report 0; fall back to the target size.
    const width = image.naturalWidth || maxSize;
    const height = image.naturalHeight || maxSize;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Das Bild konnte nicht verarbeitet werden");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
