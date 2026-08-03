import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Rasterize PDF pages to images so they can flow through the exact same
 * PhotoItem pipeline as a photographed document — @react-pdf/renderer's
 * <Image> only embeds PNG/JPEG, it cannot embed a PDF page directly.
 *
 * pdfjs-dist is dynamically imported inside loadPdf() so it never bundles
 * into a page that doesn't touch a PDF — mirrors fileToImages() in
 * src/lib/ai/processor.ts. The `import type` above is erased at compile
 * time and does not bundle the library; only a runtime `import(...)` would.
 */

/** One page, rendered to a JPEG data URL at some target resolution. */
export interface RenderedPage {
  dataUrl: string;
  w: number;
  h: number;
}

/** A PDF, parsed once, ready to render any of its pages at any resolution. */
export interface LoadedPdf {
  numPages: number;
  /** Render one page (1-indexed) to a JPEG capped at `maxWidth` px wide. */
  renderPage(pageNumber: number, maxWidth: number, quality: number): Promise<RenderedPage>;
  /**
   * Release pdfjs's internal resources for this document. Always call this
   * once every page you need has been rendered — whether the surveyor
   * confirmed a page selection or cancelled it.
   */
  destroy(): Promise<void>;
}

/**
 * Thrown when a PDF requires a password to open. Rejected outright rather
 * than prompting for one — an unusual enough case for a surveyor's
 * documents that building unlock UI for it isn't worth it. Callers should
 * catch this specifically and direct the surveyor to screenshot the
 * document instead.
 */
export class PdfPasswordProtectedError extends Error {
  constructor(fileName: string) {
    super(`${fileName} is password-protected.`);
    this.name = 'PdfPasswordProtectedError';
  }
}

/**
 * Thumbnail target for the page picker: small and fast, since every page of
 * a multi-page PDF is thumbnailed before the surveyor has decided which (if
 * any) they want to reject. The full DOC_MAX_WIDTH render only happens for
 * pages actually kept.
 */
export const PDF_THUMB_WIDTH = 220;
export const PDF_THUMB_QUALITY = 0.6;

/**
 * Parse a PDF file. Returns a handle bound to the parsed document, so
 * rendering a thumbnail now and the full-resolution image later for only
 * the kept pages never re-parses the file — parsing is the expensive step.
 */
export async function loadPdf(file: File): Promise<LoadedPdf> {
  const pdfjsLib = await import('pdfjs-dist');
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();

  let pdf: PDFDocumentProxy;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new PdfPasswordProtectedError(file.name);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to open ${file.name}: ${String(error)}`);
  }

  return {
    numPages: pdf.numPages,
    renderPage: (pageNumber, maxWidth, quality) => renderPdfPage(pdf, pageNumber, maxWidth, quality),
    destroy: () => pdf.destroy(),
  };
}

async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  maxWidth: number,
  quality: number,
): Promise<RenderedPage> {
  try {
    const page = await pdf.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = maxWidth / unscaled.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get a 2D canvas context');
    }

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;

    return {
      dataUrl: canvas.toDataURL('image/jpeg', quality),
      w: viewport.width,
      h: viewport.height,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to render page ${pageNumber}: ${String(error)}`);
  }
}
