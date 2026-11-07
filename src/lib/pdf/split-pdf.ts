import { PDFDocument } from 'pdf-lib';

export interface SplitPart {
  partNumber: number; // 1-indexed
  totalParts: number;
  blob: Blob;
  pageStart: number; // 1-indexed (inclusive)
  pageEnd: number;   // 1-indexed (inclusive)
  sizeBytes: number;
}

export interface SplitPdfResult {
  isSplit: boolean;
  parts: SplitPart[];
  originalSizeBytes: number;
  totalPages: number;
}

export const DEFAULT_MAX_PDF_SIZE_BYTES = 1.95 * 1024 * 1024; // 1.95 MB

function bytesToPdfBlob(bytes: Uint8Array): Blob {
  // BlobPart cast ensures compatibility with TypeScript 5.5+ Uint8Array<ArrayBufferLike>
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

/**
 * Splits a PDF Blob into parts if its size exceeds `maxSizeBytes`.
 * Preserves 1-indexed page numbering and guarantees parts do not exceed `maxSizeBytes`
 * unless an individual page by itself exceeds the limit.
 */
export async function splitPdfBySize(
  pdfBlob: Blob,
  maxSizeBytes: number = DEFAULT_MAX_PDF_SIZE_BYTES
): Promise<SplitPdfResult> {
  const originalSizeBytes = pdfBlob.size;
  const pdfBytes = await pdfBlob.arrayBuffer();
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  if (totalPages === 0) {
    return {
      isSplit: false,
      parts: [],
      originalSizeBytes,
      totalPages: 0,
    };
  }

  // If document is already within size limit or only has 1 page, no splitting can/should be done
  if (originalSizeBytes <= maxSizeBytes || totalPages <= 1) {
    return {
      isSplit: false,
      parts: [
        {
          partNumber: 1,
          totalParts: 1,
          blob: pdfBlob,
          pageStart: 1,
          pageEnd: totalPages,
          sizeBytes: originalSizeBytes,
        },
      ],
      originalSizeBytes,
      totalPages,
    };
  }

  // Helper to extract and save a range of pages [rangeStart..rangeEnd] (0-indexed)
  const buildSubDoc = async (rangeStart: number, rangeEnd: number): Promise<Uint8Array> => {
    const subDoc = await PDFDocument.create();
    const count = rangeEnd - rangeStart + 1;
    const pageIndices = Array.from({ length: count }, (_, i) => rangeStart + i);
    const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => subDoc.addPage(page));
    return subDoc.save();
  };

  const rawParts: Array<{
    blob: Blob;
    pageStart: number;
    pageEnd: number;
    sizeBytes: number;
  }> = [];

  let start = 0; // 0-indexed

  while (start < totalPages) {
    // If only one page left
    if (start === totalPages - 1) {
      const bytes = await buildSubDoc(start, start);
      rawParts.push({
        blob: bytesToPdfBlob(bytes),
        pageStart: start + 1,
        pageEnd: totalPages,
        sizeBytes: bytes.byteLength,
      });
      break;
    }

    // Check if all remaining pages [start..totalPages - 1] fit within limit
    const remainingBytes = await buildSubDoc(start, totalPages - 1);
    if (remainingBytes.byteLength <= maxSizeBytes) {
      rawParts.push({
        blob: bytesToPdfBlob(remainingBytes),
        pageStart: start + 1,
        pageEnd: totalPages,
        sizeBytes: remainingBytes.byteLength,
      });
      break;
    }

    // Binary search for maximum `end` in [start, totalPages - 2] that fits <= maxSizeBytes
    let low = start;
    let high = totalPages - 2;
    let bestEnd = start;
    let bestBytes: Uint8Array | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midBytes = await buildSubDoc(start, mid);
      if (midBytes.byteLength <= maxSizeBytes) {
        bestEnd = mid;
        bestBytes = midBytes;
        low = mid + 1; // Try to fit more pages
      } else {
        high = mid - 1; // Too large, try fewer pages
      }
    }

    // If even a single page [start..start] exceeded maxSizeBytes, we must still take that 1 page
    if (!bestBytes) {
      bestBytes = await buildSubDoc(start, start);
      bestEnd = start;
    }

    rawParts.push({
      blob: bytesToPdfBlob(bestBytes),
      pageStart: start + 1,
      pageEnd: bestEnd + 1,
      sizeBytes: bestBytes.byteLength,
    });

    start = bestEnd + 1;
  }

  const isSplit = rawParts.length > 1;

  const parts: SplitPart[] = rawParts.map((part, index) => ({
    partNumber: index + 1,
    totalParts: rawParts.length,
    blob: part.blob,
    pageStart: part.pageStart,
    pageEnd: part.pageEnd,
    sizeBytes: part.sizeBytes,
  }));

  return {
    isSplit,
    parts,
    originalSizeBytes,
    totalPages,
  };
}
