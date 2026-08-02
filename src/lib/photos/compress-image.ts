/**
 * Compress an image to a data URL and return its post-compress dimensions.
 *
 * `mime` defaults to PNG to keep the damage-photo path byte-identical to what
 * it produced before the annexure existed. PNG ignores `quality` in every
 * browser; only the JPEG path uses it.
 */
export function compressImage(
  file: File,
  maxWidth: number,
  quality: number,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          let { width, height } = img;
          // Preserve original aspect ratio; cap width
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width  = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width  = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No canvas context')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve({ dataUrl: canvas.toDataURL(mime, quality), w: width, h: height });
        } catch (error: unknown) {
          if (error instanceof Error) {
            reject(error);
          } else {
            reject(new Error(`Failed to compress image: ${String(error)}`));
          }
        }
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
