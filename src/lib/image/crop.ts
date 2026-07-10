// ═══════════════════════════════════════════════════════════
// IMAGE CROP HELPER
// Turns a react-easy-crop pixel area into a new cropped File.
// Used by DocumentReviewSheet so the surveyor can tighten framing
// (e.g. a far-away RC photo) before it goes to the AI vision model.
// ═══════════════════════════════════════════════════════════

/** Pixel crop rectangle as reported by react-easy-crop's `croppedAreaPixels`. */
export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result?.toString();
      if (url) resolve(url);
      else reject(new Error('Failed to read image'));
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = src;
  });
}

/**
 * Crops `file` to the given pixel rectangle and returns a new JPEG File.
 * Output is always JPEG (photos), q0.92 — the AI pipeline re-encodes/downscales
 * anyway, so this only needs to be visually faithful.
 */
export async function cropFileToFile(file: File, area: PixelCrop): Promise<File> {
  const img = await loadImage(await readAsDataUrl(file));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, canvas.width, canvas.height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  );
  if (!blob) throw new Error('Crop failed');

  const base = file.name.replace(/\.[^.]+$/, '') || 'document';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
