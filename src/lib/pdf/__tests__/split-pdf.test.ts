import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { splitPdfBySize } from '../split-pdf';

async function createTestPdfBlob(pageCount: number): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`Page content for page ${i + 1}`, { x: 50, y: 350 });
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

describe('splitPdfBySize', () => {
  it('returns isSplit: false with 1 part when PDF size is <= maxSizeBytes', async () => {
    const pdfBlob = await createTestPdfBlob(3);
    const result = await splitPdfBySize(pdfBlob, 10 * 1024 * 1024); // 10 MB limit

    expect(result.isSplit).toBe(false);
    expect(result.totalPages).toBe(3);
    expect(result.originalSizeBytes).toBe(pdfBlob.size);
    expect(result.parts).toHaveLength(1);

    const part = result.parts[0];
    expect(part.partNumber).toBe(1);
    expect(part.totalParts).toBe(1);
    expect(part.pageStart).toBe(1);
    expect(part.pageEnd).toBe(3);
    expect(part.sizeBytes).toBe(pdfBlob.size);
    expect(part.blob).toBe(pdfBlob);
  });

  it('splits a multi-page PDF exceeding maxSizeBytes into multiple parts with correct page ranges', async () => {
    const totalPages = 6;
    const pdfBlob = await createTestPdfBlob(totalPages);
    const fullSize = pdfBlob.size;

    // Set threshold so roughly 2 pages fit per part
    const threshold = Math.floor(fullSize * 0.45);
    const result = await splitPdfBySize(pdfBlob, threshold);

    expect(result.isSplit).toBe(true);
    expect(result.totalPages).toBe(totalPages);
    expect(result.parts.length).toBeGreaterThanOrEqual(2);

    let expectedStart = 1;
    for (let i = 0; i < result.parts.length; i++) {
      const part = result.parts[i];
      expect(part.partNumber).toBe(i + 1);
      expect(part.totalParts).toBe(result.parts.length);
      expect(part.pageStart).toBe(expectedStart);
      expect(part.pageEnd).toBeGreaterThanOrEqual(part.pageStart);

      // Verify each part is a valid PDF with matching page count
      const partDoc = await PDFDocument.load(await part.blob.arrayBuffer());
      const partPageCount = partDoc.getPageCount();
      expect(partPageCount).toBe(part.pageEnd - part.pageStart + 1);

      // Verify part size limit (unless a single page is forced)
      if (partPageCount > 1) {
        expect(part.sizeBytes).toBeLessThanOrEqual(threshold);
      }

      expectedStart = part.pageEnd + 1;
    }

    // All pages must be covered through totalPages
    expect(expectedStart - 1).toBe(totalPages);
  });

  it('returns isSplit: false with 1 part when a 1-page PDF exceeds maxSizeBytes', async () => {
    const pdfBlob = await createTestPdfBlob(1);
    // Threshold smaller than even a 1-page PDF
    const result = await splitPdfBySize(pdfBlob, 50);

    expect(result.isSplit).toBe(false);
    expect(result.totalPages).toBe(1);
    expect(result.parts).toHaveLength(1);

    const part = result.parts[0];
    expect(part.partNumber).toBe(1);
    expect(part.totalParts).toBe(1);
    expect(part.pageStart).toBe(1);
    expect(part.pageEnd).toBe(1);
    expect(part.sizeBytes).toBe(pdfBlob.size);
    expect(part.blob).toBe(pdfBlob);
  });

  it('splits into single-page parts when each individual page exceeds maxSizeBytes', async () => {
    const totalPages = 3;
    const pdfBlob = await createTestPdfBlob(totalPages);
    // Tiny threshold that each page will exceed
    const result = await splitPdfBySize(pdfBlob, 10);

    expect(result.isSplit).toBe(true);
    expect(result.totalPages).toBe(totalPages);
    expect(result.parts).toHaveLength(3);

    for (let i = 0; i < result.parts.length; i++) {
      const part = result.parts[i];
      expect(part.partNumber).toBe(i + 1);
      expect(part.totalParts).toBe(3);
      expect(part.pageStart).toBe(i + 1);
      expect(part.pageEnd).toBe(i + 1);
    }
  });
});
