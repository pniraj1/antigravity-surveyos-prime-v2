import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

// vi.mock factories are hoisted above imports, so the fake pdf and the
// request-tracking array must be created via vi.hoisted to be in scope.
const { fakePdf, requestedPages } = vi.hoisted(() => {
  const requestedPages: number[] = [];
  const fakePdf = {
    numPages: 4,
    getPage: async (n: number) => {
      requestedPages.push(n);
      return {
        getViewport: () => ({ width: 10, height: 10 }),
        render: () => ({ promise: Promise.resolve() }),
        getTextContent: async () => ({ items: [{ str: `text${n}` }] }),
      };
    },
  };
  return { fakePdf, requestedPages };
});

vi.mock('pdfjs-dist', () => ({
  version: 'x',
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
}));

// Stub the only DOM API the PDF branch of fileToImages touches: canvas creation.
vi.stubGlobal('document', {
  createElement: () => ({ getContext: () => ({}), toDataURL: () => 'data:x', width: 0, height: 0 }),
} as unknown as Document);

import { setAIPages } from '../ai-pages';
import { fileToImages } from '../processor';

function pdfFile(): File {
  return new File(['x'], 'a.pdf', { type: 'application/pdf' });
}

beforeEach(() => {
  requestedPages.length = 0;
});

describe('fileToImages — PDF page filter', () => {
  it('tagged [1,3]: only those two pages are rendered, in order', async () => {
    const file = pdfFile();
    setAIPages(file, [1, 3]);
    const progress: Array<[number, number]> = [];

    const { apiImages, viewImages, textLayers } = await fileToImages(file, (p, t) => progress.push([p, t]));

    expect(apiImages).toHaveLength(2);
    expect(viewImages).toHaveLength(2);
    expect(textLayers).toEqual(['text1', 'text3']);
    expect(progress[progress.length - 1]).toEqual([2, 2]);
    expect(requestedPages).toEqual([1, 3]); // unticked pages 2 and 4 are never fetched
  });

  it('untagged: every page is rendered', async () => {
    const file = pdfFile();
    const progress: Array<[number, number]> = [];

    const { apiImages, textLayers } = await fileToImages(file, (p, t) => progress.push([p, t]));

    expect(apiImages).toHaveLength(4);
    expect(textLayers).toEqual(['text1', 'text2', 'text3', 'text4']);
    expect(progress[progress.length - 1]).toEqual([4, 4]);
  });

  it('tagged [0, 9]: both out of range → no pages rendered', async () => {
    const file = pdfFile();
    setAIPages(file, [0, 9]);

    const { apiImages, viewImages } = await fileToImages(file);

    expect(apiImages).toHaveLength(0);
    expect(viewImages).toHaveLength(0);
    expect(requestedPages).toEqual([]);
  });
});
