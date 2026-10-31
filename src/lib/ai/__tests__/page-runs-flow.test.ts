import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

// A 3-page PDF; `texts[i]` is page i's text layer ('' = scanned page).
const { texts } = vi.hoisted(() => ({ texts: [] as string[] }));
vi.mock('pdfjs-dist', () => ({
  version: 'x',
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve({
    numPages: texts.length,
    getPage: async (n: number) => ({
      getViewport: () => ({ width: 10, height: 10 }),
      render: () => ({ promise: Promise.resolve() }),
      getTextContent: async () => ({ items: texts[n - 1] ? [{ str: texts[n - 1] }] : [] }),
    }),
  }) }),
}));
vi.stubGlobal('document', {
  createElement: () => ({ getContext: () => ({}), toDataURL: () => 'data:x', width: 0, height: 0 }),
} as unknown as Document);

const rows = (...sr: number[]) => JSON.stringify({ spare_parts: sr.map(s => ({ sr_no: s, total_amount: 10 })) });
vi.mock('../service', async (orig) => ({
  ...(await orig<typeof import('../service')>()),
  callAIGateway: vi.fn(),
  getActiveImageCap: () => null,
}));

import { setAITestOverride, callAIGateway } from '../service';
import { extractDocument } from '../processor';

const gw = vi.mocked(callAIGateway);
const pdf = () => new File(['x'], 'a.pdf', { type: 'application/pdf' });
const page = (n: number) => `Page${n} Rs 1,200 spare part amount `.repeat(10);
beforeEach(() => { setAITestOverride(null); gw.mockReset(); });

describe('extractDocument — text or image per page', () => {
  it('mixed 3-page doc: pages 1–2 as text, page 3 as an image, rows in page order', async () => {
    texts.splice(0, texts.length, page(1), page(2), '');
    // Replies out of serial order on purpose: page order, not serial order, is kept.
    gw.mockResolvedValueOnce(rows(3)).mockResolvedValueOnce(rows(1)).mockResolvedValueOnce(rows(2));
    const { data } = await extractDocument('estimate', pdf());
    expect(gw).toHaveBeenCalledTimes(3);
    const [c1, c2, c3] = gw.mock.calls;
    expect(c1[1]).toEqual([]); expect(c1[0]).toContain('--- PAGE 1 ---');
    expect(c2[1]).toEqual([]); expect(c2[0]).toContain('--- PAGE 2 ---');
    expect(c3[1]).toHaveLength(1); expect(c3[0]).not.toContain('--- PAGE');
    expect(data.spare_parts.map((r: any) => [r.sr_no, r._page])).toEqual([[3, 0], [1, 1], [2, 2]]);
  });

  it('pagesPerCall 2 groups text pages: 2 calls, page markers joined', async () => {
    texts.splice(0, texts.length, page(1), page(2), page(3));
    setAITestOverride({ provider: 'groq', model: 'm', key: 'k', pagesPerCall: 2 });
    gw.mockResolvedValueOnce(rows(1, 2)).mockResolvedValueOnce(rows(3));
    await extractDocument('estimate', pdf());
    expect(gw).toHaveBeenCalledTimes(2);
    expect(gw.mock.calls[0][1]).toEqual([]);
    expect(gw.mock.calls[0][0]).toContain('--- PAGE 1 ---');
    expect(gw.mock.calls[0][0]).toContain('--- PAGE 2 ---');
    expect(gw.mock.calls[1][0]).toContain('--- PAGE 3 ---');
  });

  it('text-layer hint: none on a mixed doc, kept on an all-text doc', async () => {
    const HINT = 'digitally-created document';
    const money = (n: number) => `${page(n)} ₹1,200 ₹300 ₹400 ₹500`;   // hasFinancialData needs >3 amounts
    texts.splice(0, texts.length, money(1), money(2), '');
    gw.mockResolvedValue(rows(1));
    await extractDocument('estimate', pdf());
    expect(gw.mock.calls.slice(0, 3).every(c => !String(c[0]).includes(HINT))).toBe(true);
    gw.mockClear();
    texts.splice(0, texts.length, money(1), money(2), money(3));
    await extractDocument('estimate', pdf());
    expect(gw.mock.calls.slice(0, 3).every(c => String(c[0]).includes(HINT))).toBe(true);
  });

  it('no override: all-text doc stays 1 page per call', async () => {
    texts.splice(0, texts.length, page(1), page(2), page(3));
    gw.mockResolvedValueOnce(rows(1)).mockResolvedValueOnce(rows(2)).mockResolvedValueOnce(rows(3));
    await extractDocument('estimate', pdf());
    expect(gw).toHaveBeenCalledTimes(3);
  });
});
