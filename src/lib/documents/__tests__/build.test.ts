import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { planBox, buildBoxFile, sha256Hex } from '../kit/build';
import type { BoxState } from '../kit/checklist';
import { merge, single } from '../kit/recipes/types';

async function pdfBlob(pages: number): Promise<Blob> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([300 + i, 400]);
  return new Blob([(await d.save()) as BlobPart], { type: 'application/pdf' });
}
const PNG_1X1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const pngBlob = () => new Blob([PNG_1X1], { type: 'image/png' });
const pageCount = async (b: Blob) => (await PDFDocument.load(await b.arrayBuffer())).getPageCount();

type Src = { blob: Blob; mime: string; name: string };
const reader = (files: Record<string, Src>) => async (id: string) => files[id];

describe('planBox', () => {
  it('non-adjacent pages collected in order', async () => {
    const state = { parts: [{ docId: 'combined', pages: [7, 3] }] } as unknown as BoxState;
    const plan = planBox(state);
    expect(plan).toEqual([{ docId: 'combined', pages: [3, 7] }]);
    const box = single('rc', 'RC Book', true);
    const out = await buildBoxFile(box, plan, reader({ combined: { blob: await pdfBlob(9), mime: 'application/pdf', name: 'scan.pdf' } }));
    expect(out.pages).toBe(2);
    expect(await pageCount(out.blob)).toBe(2);
    expect(out.name).toBe('RC Book.pdf');
  });
});

describe('build', () => {
  it('whole single file is passed through unchanged', async () => {
    const blob = await pdfBlob(3);
    const box = single('rc', 'RC Book', true);
    const out = await buildBoxFile(box, [{ docId: 'a', pages: [1, 2, 3] }], reader({ a: { blob, mime: 'application/pdf', name: 'my rc.pdf' } }));
    expect(await sha256Hex(out.blob)).toBe(await sha256Hex(blob));
    expect(out.name).toBe('RC Book.pdf');
  });

  it('merge of two PDFs and one PNG gives page count sum', async () => {
    const box = merge('kyc', 'KYC', true, ['aadhaar', 'pan']);
    const out = await buildBoxFile(box, [{ docId: 'a', pages: [] }, { docId: 'b', pages: [2] }, { docId: 'c', pages: [] }], reader({
      a: { blob: await pdfBlob(2), mime: 'application/pdf', name: 'a.pdf' },
      b: { blob: await pdfBlob(4), mime: 'application/pdf', name: 'b.pdf' },
      c: { blob: pngBlob(), mime: 'image/png', name: 'c.png' },
    }));
    expect(out.pages).toBe(4);
    expect(await pageCount(out.blob)).toBe(4);
    expect(out.name).toBe('KYC.pdf');
  });
});
