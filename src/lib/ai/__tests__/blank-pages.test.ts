import { describe, it, expect, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const { fakePdf, rendered } = vi.hoisted(() => {
  const rendered: number[] = [];
  // page 1 digital, page 2 blank (a border line only), page 3 scanned (no text, one image), page 4 outlined text (no text layer, many paths)
  const pages: Record<number, { text: string; ops: number[] }> = {
    1: { text: 'text1', ops: [] },
    2: { text: '', ops: [1, 2, 3] },
    3: { text: '', ops: [1, 85, 2] },
    4: { text: '', ops: Array(400).fill(7) },
  };
  const fakePdf = {
    numPages: 4,
    getPage: async (n: number) => ({
      getViewport: () => ({ width: 10, height: 10 }),
      render: () => { rendered.push(n); return { promise: Promise.resolve() }; },
      getTextContent: async () => ({ items: pages[n].text ? [{ str: pages[n].text, transform: [1, 0, 0, 1, 10, 20], width: 20 }] : [] }),
      getOperatorList: async () => ({ fnArray: pages[n].ops }),
    }),
  };
  return { fakePdf, rendered };
});

vi.mock('pdfjs-dist', () => ({
  version: 'x',
  GlobalWorkerOptions: {},
  OPS: { constructPath: 7, paintImageXObject: 85, paintInlineImageXObject: 86 },
  getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
}));
vi.stubGlobal('document', {
  createElement: () => ({ getContext: () => ({}), toDataURL: () => 'data:x', width: 0, height: 0 }),
} as unknown as Document);

import { fileToImages } from '../processor';

describe('blank pages', () => {
  it('a page with no text, no image and almost nothing drawn is never rendered or sent', async () => {
    const r = await fileToImages(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    expect(r.pageNumbers).toEqual([1, 3, 4]);
    expect(r.apiImages).toHaveLength(3);
    expect(r.textLayers).toEqual(['text1', '', '']);
    expect(r.pageTokens).toHaveLength(3);
    expect(rendered).not.toContain(2);
  });
});
