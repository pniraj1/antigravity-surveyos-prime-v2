import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const { scales, lim, TEXT } = vi.hoisted(() => ({ scales: [] as number[], lim: { table: [] as any[], first: undefined as string | undefined }, TEXT: 'Rs 1,200 spare part amount '.repeat(20) }));

vi.mock('pdfjs-dist', () => ({
  version: 'x',
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({
      getViewport: ({ scale }: { scale: number }) => { scales.push(scale); return { width: 10, height: 10 }; },
      render: () => ({ promise: Promise.resolve() }),
      getTextContent: async () => ({ items: [{ str: TEXT }] }),
    }),
  }) }),
}));
vi.stubGlobal('document', {
  createElement: () => ({ getContext: () => ({}), toDataURL: () => 'data:x', width: 0, height: 0 }),
} as unknown as Document);

vi.mock('../service', async (orig) => ({
  ...(await orig<typeof import('../service')>()),
  callAIGateway: vi.fn(async () => JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }], gross_amount: 10 })),
  getActiveImageCap: () => null,
  firstModel: () => lim.first,
}));
vi.mock('../page-limits', () => ({
  get PAGE_LIMITS() { return lim.table; },
  limitsFor: (model: string, method: string, table: any[] = lim.table) => table.find(l => l.model === model && l.method === method),
}));

import { setAITestOverride, callAIGateway } from '../service';
import { fileToImages, extractDocument } from '../processor';

const pdf = () => new File(['x'], 'a.pdf', { type: 'application/pdf' });
const ov = (o: object) => setAITestOverride({ provider: 'groq', model: 'm', key: 'k', ...o });
beforeEach(() => { scales.length = 0; lim.table = []; lim.first = undefined; setAITestOverride(null); vi.mocked(callAIGateway).mockClear(); });

describe('bench override on PDFs', () => {
  it('no override: view 3, API 1.5', async () => {
    await fileToImages(pdf());
    expect(scales).toEqual([3, 1.5]);
  });
  it('imageScale 1.25 reaches the API render only', async () => {
    ov({ imageScale: 1.25 });
    await fileToImages(pdf());
    expect(scales).toEqual([3, 1.25]);
  });
  it('table imageScale 1.25 for the preferred model → API scale 1.25; empty table → 1.5', async () => {
    await extractDocument('estimate', pdf());
    expect(scales).toEqual([3, 1.5]);
    scales.length = 0; lim.first = 'pref';
    lim.table = [{ model: 'pref', method: 'vision', maxRowsPerCall: 60, maxPagesPerCall: 2, imageScale: 1.25, measuredAt: '', modelVersion: '' }];
    await extractDocument('estimate', pdf());
    expect(scales).toEqual([3, 1.25]);
  });
  it("method 'vision' forces images on a text-rich PDF", async () => {
    ov({ method: 'vision' });
    await extractDocument('estimate', pdf());
    const images = vi.mocked(callAIGateway).mock.calls[0][1] as string[];
    expect(images.length).toBeGreaterThan(0);
  });
  it('no override: text-rich PDF sends no images', async () => {
    await extractDocument('estimate', pdf());
    expect((vi.mocked(callAIGateway).mock.calls[0][1] as string[]).length).toBe(0);
  });
});
