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
const sizes = async (b: Blob) => (await PDFDocument.load(await b.arrayBuffer())).getPages().map((p) => [p.getWidth(), p.getHeight()]);
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
    expect((await sizes(out.blob)).map(([w]) => w)).toEqual([302, 306]); // source pages 3 and 7, in that order
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
    const out = await buildBoxFile(box, [{ docId: 'a', pages: [] }, { docId: 'b', pages: [3] }, { docId: 'c', pages: [] }], reader({
      a: { blob: await pdfBlob(2), mime: 'application/pdf', name: 'a.pdf' },
      b: { blob: await pdfBlob(4), mime: 'application/pdf', name: 'b.pdf' },
      c: { blob: pngBlob(), mime: 'image/png', name: 'c.png' },
    }));
    expect(out.pages).toBe(4);
    expect(await pageCount(out.blob)).toBe(4);
    // a's two pages, then b's page 3, then the PNG on an A4 page
    expect(await sizes(out.blob)).toEqual([[300, 400], [301, 400], [302, 400], [595, 842]]);
    expect(out.name).toBe('KYC.pdf');
  });

  describe('encrypted PDFs', () => {
    // pdf-lib can't encrypt, but a trailer /Encrypt entry is all its isEncrypted looks at.
    async function encryptedPdf(pages: number): Promise<Blob> {
      const d = await PDFDocument.create();
      for (let i = 0; i < pages; i++) d.addPage([300 + i, 400]);
      d.context.trailerInfo.Encrypt = d.context.register(d.context.obj({ Filter: 'Standard', V: 1, R: 2 }));
      return new Blob([(await d.save({ useObjectStreams: false })) as BlobPart], { type: 'application/pdf' });
    }
    const CANT_OPEN = "This PDF can't be opened here (it may be password-protected). Open it yourself and save an unlocked copy into the claim folder.";

    it('the fixture really is encrypted', async () => {
      expect((await PDFDocument.load(await (await encryptedPdf(1)).arrayBuffer(), { ignoreEncryption: true })).isEncrypted).toBe(true);
    });

    it('cutting pages out of an encrypted PDF is refused with the unlock copy', async () => {
      const src = { blob: await encryptedPdf(3), mime: 'application/pdf', name: 'policy.pdf' };
      await expect(buildBoxFile(single('rc', 'RC Book', true), [{ docId: 'a', pages: [2] }], reader({ a: src }))).rejects.toThrow(CANT_OPEN);
      await expect(buildBoxFile(merge('kyc', 'KYC', true, ['policy']), [{ docId: 'a', pages: [] }], reader({ a: src }))).rejects.toThrow(CANT_OPEN);
    });

    it('a whole encrypted file still passes through untouched', async () => {
      const blob = await encryptedPdf(2);
      const out = await buildBoxFile(single('policy', 'Policy', true), [{ docId: 'a', pages: [1, 2] }], reader({ a: { blob, mime: 'application/pdf', name: 'p.pdf' } }));
      expect(out.blob).toBe(blob);
    });
  });

  it('a box label with "/" gives a file name without one', async () => {
    const box = merge('photos', 'Front/Rear/Side Photograph', false, ['photoFront']);
    const out = await buildBoxFile(box, [{ docId: 'a', pages: [] }], reader({ a: { blob: pngBlob(), mime: 'image/png', name: 'f.png' } }));
    expect(out.name).toBe('Front-Rear-Side Photograph.pdf');
  });
});
