import { DOC_JPEG_QUALITY } from './document-annexure';

/**
 * Rotate an image 90 degrees clockwise, returning a new data URL and the
 * swapped dimensions.
 *
 * Rotation is baked into the pixels rather than stored as metadata, so the
 * result is correct in every consumer at once — the gallery, the PDF, and any
 * future one — with no dependence on @react-pdf/renderer's transform support.
 *
 * Cost: one JPEG re-encode per call, so quality degrades slightly with repeated
 * rotation. Negligible for the two or three presses a correction needs, and the
 * alternative (retaining an untouched original per document) would roughly
 * double the IndexedDB budget.
 */
export function rotateImage90(
  dataUrl: string,
): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;
        // A 90 degree turn swaps the axes.
        const w = srcH;
        const h = srcW;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get a 2D canvas context'));
          return;
        }

        // Move the origin to the destination centre, turn, then draw the source
        // centred on that origin.
        ctx.translate(w / 2, h / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -srcW / 2, -srcH / 2);

        resolve({ dataUrl: canvas.toDataURL('image/jpeg', DOC_JPEG_QUALITY), w, h });
      } catch (error: unknown) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(`Failed to rotate image: ${String(error)}`));
        }
      }
    };

    img.onerror = () => reject(new Error('Could not decode image for rotation'));
    img.src = dataUrl;
  });
}
