import { loadPdf } from '@/lib/photos/pdf-to-images';

/** Page count of a PDF, releasing pdfjs resources immediately. */
async function defaultCountPdfPages(file: File): Promise<number> {
  const loaded = await loadPdf(file);
  try {
    return loaded.numPages;
  } finally {
    await loaded.destroy();
  }
}

/**
 * True when the surveyor has a decision to make before the AI reads these
 * files: more than one file, or any multi-page PDF. A single image or
 * single-page PDF returns false so the upload starts exactly as before.
 *
 * `countPdfPages` is injectable so the gate is unit-testable in node
 * (pdfjs needs a DOM/canvas).
 */
export async function needsReview(
  files: File[],
  countPdfPages: (file: File) => Promise<number> = defaultCountPdfPages,
): Promise<boolean> {
  if (files.length === 0) return false;
  if (files.length > 1) return true;
  const [file] = files;
  if (file.type !== 'application/pdf') return false;
  try {
    return (await countPdfPages(file)) > 1;
  } catch {
    // Unreadable / password-protected: nothing to pick from, send whole.
    return false;
  }
}
