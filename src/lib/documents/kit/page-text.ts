// src/lib/documents/kit/page-text.ts
/** A file's page count and, for PDFs, each page's text layer. Browser-only; never throws. */

const isPdf = (b: Blob) => b.type === 'application/pdf' || (b instanceof File && /\.pdf$/i.test(b.name));

// Same loading as src/lib/ai/processor.ts: pdfjs is imported lazily, never statically.
async function openPdf(blob: Blob) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  return pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
}

/** Text of every page (empty string for a scanned page), or null when the file has no text layer to read. */
export async function pageTexts(blob: Blob): Promise<string[] | null> {
  if (!isPdf(blob)) return null;
  try {
    const pdf = await openPdf(blob);
    try {
      const out: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        try {
          const content = await (await pdf.getPage(n)).getTextContent();
          out.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' ').trim());
        } catch { out.push(''); }
      }
      return out;
    } finally { void pdf.destroy(); }
  } catch { return null; }
}

/** 1 for anything that is not a PDF; 0 (unknown) for a PDF that cannot be read. */
export async function pageCountOf(blob: Blob): Promise<number> {
  if (!isPdf(blob)) return 1;
  try {
    const pdf = await openPdf(blob);
    const n = pdf.numPages;
    void pdf.destroy();
    return n;
  } catch { return 0; }
}
