import { describe, it, expect, vi } from 'vitest';

const { fakePdf } = vi.hoisted(() => ({
  fakePdf: {
    numPages: 2,
    getPage: async (n: number) => ({ getTextContent: async () => ({ items: [{ str: 'page' }, { str: String(n) }] }) }),
    destroy: async () => undefined,
  },
}));

vi.mock('pdfjs-dist', () => ({
  version: 'x',
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
}));

import { pageTexts, pageCountOf } from '../kit/page-text';

const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
const png = new File(['x'], 'a.png', { type: 'image/png' });

describe('page-text', () => {
  it('reads each PDF page text layer', async () => {
    expect(await pageTexts(pdf)).toEqual(['page 1', 'page 2']);
    expect(await pageCountOf(pdf)).toBe(2);
  });
  it('images and other files are one page with no text', async () => {
    expect(await pageTexts(png)).toBeNull();
    expect(await pageCountOf(png)).toBe(1);
  });
});
