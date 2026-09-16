import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../service', () => {
  class AllProvidersBusyError extends Error {}
  class OfflineError extends Error {}
  return { callAIGateway: vi.fn(), AllProvidersBusyError, OfflineError, newSession: () => ({}) };
});
import { callAIGateway, AllProvidersBusyError } from '../service';
import { fillGaps, gapPrompt, MAX_GAP_PAGES } from '../gap-fill';

const gw = callAIGateway as unknown as ReturnType<typeof vi.fn>;
const row = (sr_no: number, total_amount = 10, _page = 0) => ({ sr_no, total_amount, _page });
const base = { spare_parts: [row(1), row(3, 10, 1)], labour_items: [], painting_items: [], gross_amount: 30 };
const images = ['p0', 'p1', 'p2'];

beforeEach(() => gw.mockReset());

describe('fillGaps', () => {
  it('no pages → no calls, same data', async () => {
    const out = await fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [], pages: [] });
    expect(gw).not.toHaveBeenCalled();
    expect(out).toBe(base);
  });
  it('one call per page with only that page image; inserts the missing serial tagged with its page', async () => {
    gw.mockResolvedValueOnce(JSON.stringify({ spare_parts: [row(2, 10), row(1, 99)] }));
    const out: any = await fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [2], pages: [1] });
    expect(gw).toHaveBeenCalledTimes(1);
    expect(gw.mock.calls[0][1]).toEqual(['p1']);
    expect(gw.mock.calls[0][3]).toBe('heavy');
    expect(out.spare_parts.map((r: any) => r.sr_no)).toEqual([1, 3, 2]);
    expect(out.spare_parts[2]._page).toBe(1);
    expect(out.spare_parts[0].total_amount).toBe(10);        // existing row 1 not replaced
  });
  it('an unparseable page is skipped, the others still merge', async () => {
    gw.mockResolvedValueOnce('not json').mockResolvedValueOnce(JSON.stringify({ spare_parts: [row(2)] }));
    const out: any = await fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [2], pages: [0, 1] });
    expect(out.spare_parts).toHaveLength(3);
  });
  it('busy/offline/abort propagate', async () => {
    gw.mockRejectedValueOnce(new AllProvidersBusyError('heavy', []));
    await expect(fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [2], pages: [1] })).rejects.toBeInstanceOf(AllProvidersBusyError);
  });
  it('more than MAX_GAP_PAGES pages → no calls', async () => {
    const pages = Array.from({ length: MAX_GAP_PAGES + 1 }, (_, i) => i);
    const out = await fillGaps({ basePrompt: 'P', apiImages: Array(10).fill('x'), data: base, srNos: [2], pages });
    expect(gw).not.toHaveBeenCalled();
    expect(out).toBe(base);
  });
});

describe('gapPrompt', () => {
  it('names the serials when known', () => {
    expect(gapPrompt('P', 3, [38, 52], [1, 2])).toContain('serial numbers 38, 52');
    expect(gapPrompt('P', 3, [38, 52], [1, 2])).toContain('page 3');
  });
  it('asks for rows not yet listed when serials are unknown', () => {
    const p = gapPrompt('P', 5, [], [1, 2, 3]);
    expect(p).toContain('already captured: 1, 2, 3');
    expect(p).toContain('NOT in that list');
  });
});
