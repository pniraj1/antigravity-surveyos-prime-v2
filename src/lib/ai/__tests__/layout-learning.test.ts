import { describe, it, expect, vi, beforeEach } from 'vitest';
import { layoutPrompt, layoutFromAnswer, keptLayouts } from '../layout-learning';
import { parseFirst } from '../parser-first';
import { page } from './fixtures/vw-two-tables';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
beforeEach(() => store.clear());

// what the AI should say for the fixture: x of each column's value in the first row under each heading
const answer = {
  tables: [
    { page: 1, heading_y: [319, 315, 310], columns: [
      { x: 46, field: 'sr_no' }, { x: 60, field: 'description' }, { x: 293, field: 'hsn_sac' }, { x: 353, field: 'quantity' },
      { x: 433, field: 'taxable_amount' }, { x: 546, field: 'total_amount' }] },
    { page: 1, heading_y: [151, 147, 142], columns: [
      { x: 43, field: 'sr_no' }, { x: 58, field: 'description' }, { x: 157, field: 'part_number' }, { x: 252, field: 'hsn_sac' },
      { x: 313, field: 'quantity' }, { x: 337, field: 'unit_price' }, { x: 424, field: 'taxable_amount' }, { x: 546, field: 'total_amount' }] },
  ],
};
const ai = (reply: unknown) => vi.fn().mockResolvedValue(JSON.stringify(reply));

describe('layoutPrompt', () => {
  it('sends the heading lines with word positions and leaves most amount rows out', () => {
    const p = layoutPrompt([page]);
    expect(p).toContain('y=315: 105:Description 302:SAC 344:Qty.');
    expect(p).toContain('PAGE 1');
    expect(p).not.toContain('FENDER');   // three lines under the last heading-like line
  });
});

describe('layoutFromAnswer', () => {
  it('builds both tables from the answer, with column edges taken from the page', () => {
    const l = layoutFromAnswer(answer, [page])!;
    expect(l).toHaveLength(2);
    expect(l[1].cols.find(c => c.field === 'total_amount')).toEqual({ field: 'total_amount', x: 546, right: 571 });
    expect(l[0].words.map(w => w.s)).toContain('Description');
  });
  it.each([
    ['no tables', {}],
    ['heading lines that are not on the page', { tables: [{ ...answer.tables[0], heading_y: [500] }] }],
    ['an amount column with no value where the AI says', { tables: [{ ...answer.tables[0], columns: [...answer.tables[0].columns, { x: 999, field: 'unit_price' }] }] }],
    ['no description column', { tables: [{ ...answer.tables[0], columns: answer.tables[0].columns.filter(c => c.field !== 'description') }] }],
  ])('rejects %s', (_n, raw) => {
    expect(layoutFromAnswer(raw, [page])).toBeNull();
  });
});

describe('parseFirst', () => {
  it('a layout the built-in rules do not know: one small call, rows read in code, layout kept', async () => {
    const call = ai(answer);
    const r = await parseFirst([page], call);
    expect(r.ok && r.learned).toBe(true);
    if (r.ok) expect(r.data.gross_amount).toBe(472);
    expect(call).toHaveBeenCalledTimes(1);
    expect(keptLayouts()).toHaveLength(1);
  });
  it('the next bill like it is read from the kept layout, with no call', async () => {
    await parseFirst([page], ai(answer));
    const call = ai(answer);
    expect((await parseFirst([page], call)).ok).toBe(true);
    expect(call).not.toHaveBeenCalled();
  });
  it('swapped columns that still tie are caught (qty x rate, codes) and nothing is kept', async () => {
    const swapped = { tables: [answer.tables[0], { ...answer.tables[1], columns: answer.tables[1].columns.map(c =>
      c.field === 'part_number' ? { ...c, field: 'hsn_sac' } : c.field === 'hsn_sac' ? { ...c, field: 'part_number' } : c.field === 'quantity' ? { ...c, field: 'other' } : c) }] };
    const r = await parseFirst([page], ai(swapped));
    expect(r.ok).toBe(false);
    expect(keptLayouts()).toEqual([]);
  });
  it('a failed or unusable call leaves the built-in decline, so the bill goes to AI as before', async () => {
    expect((await parseFirst([page], vi.fn().mockRejectedValue(new Error('quota')))).ok).toBe(false);
    expect((await parseFirst([page], vi.fn().mockResolvedValue('not json'))).ok).toBe(false);
  });
  it('a cancel is passed on', async () => {
    const e = new Error('x'); e.name = 'AbortError';
    await expect(parseFirst([page], vi.fn().mockRejectedValue(e))).rejects.toThrow('x');
  });
});
