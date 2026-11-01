import { describe, it, expect, vi, beforeEach } from 'vitest';

const tokens = vi.fn();
vi.mock('../processor', () => ({ fileToTokens: (f: File) => tokens(f), extractDocument: vi.fn() }));
vi.mock('../parser-first', () => ({ safeParse: (t: unknown) => (t === 'ties' ? { ok: true, data: { spare_parts: [], labour_items: [], painting_items: [], gross_amount: 5 } } : { ok: false, reason: 'no header' }) }));

import { runModelTest, getAITestOverride } from '../service';

const o = { provider: 'ollama' as const, model: 'row-parser', key: '', method: 'parser' as const };
describe('runModelTest with the parser method', () => {
  beforeEach(() => tokens.mockReset());
  it('returns the parsed data and sets no AI override', async () => {
    tokens.mockResolvedValue('ties');
    const r = await runModelTest(o, 'estimate', new File(['x'], 'a.pdf'), () => {});
    expect(r).toMatchObject({ ok: true, data: { gross_amount: 5 } });
    expect(getAITestOverride()).toBeNull();
  });
  it('reports a decline with its reason', async () => {
    tokens.mockResolvedValue('odd');
    const r = await runModelTest(o, 'estimate', new File(['x'], 'a.pdf'), () => {});
    expect(r).toMatchObject({ ok: false, data: null, error: 'parser declined: no header' });
  });
});
