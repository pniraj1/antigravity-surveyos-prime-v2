import { describe, it, expect, vi } from 'vitest';
import { parserEligible, readHeader, safeParse, checkFields } from '../parser-first';

vi.mock('../row-parser', () => ({ parseEstimate: (t: unknown[]) => { if (!t.length) throw new Error('odd layout'); return { ok: false, reason: 'x' }; } }));

describe('safeParse', () => {
  it('turns a parser throw into a decline', () => {
    expect(safeParse([])).toEqual({ ok: false, reason: 'parser error: odd layout' });
  });
  it('passes through a normal outcome', () => {
    expect(safeParse([[]])).toEqual({ ok: false, reason: 'x' });
  });
});

describe('checkFields', () => {
  const row = (sr_no: number, part_number: string, hsn_sac: string) => ({ sr_no, part_number, hsn_sac, total_amount: 10 });
  it('blanks a part no. printed like an amount and an HSN/SAC that is not 4, 6 or 8 digits, and says which rows', () => {
    const data = { spare_parts: [row(1, '1,990.00', '73181500'), row(2, '5442551063 04', '8708.99.0'), row(3, '1018805163', '8708.29.00Y')], labour_items: [row(1, '', 'assembly')], painting_items: [], gross_amount: 40 };
    const { data: out, issues } = checkFields(data);
    expect(out.spare_parts.map(r => [r.part_number, r.hsn_sac])).toEqual([['', '73181500'], ['5442551063 04', ''], ['1018805163', '']]);
    expect(out.labour_items[0].hsn_sac).toBe('');
    expect(issues).toEqual(['Part no. or HSN/SAC was unclear and left blank on 4 rows (parts 1, 2, 3; labour 1). Please check them against the PDF.']);
    expect(data.spare_parts[0].part_number).toBe('1,990.00');   // input untouched
  });
  it('keeps good values and raises nothing', () => {
    const data = { spare_parts: [row(1, 'A401990215 0', '7318'), row(2, '', ''), row(3, 'X', '8708.99.00')], labour_items: [row(1, '', '998714')], painting_items: [], gross_amount: 40 };
    expect(checkFields(data)).toEqual({ data, issues: [] });
  });
});

const ok = { key: 'estimate', allText: true, fileCount: 1, override: undefined };

describe('parserEligible', () => {
  it('true for estimate and final-bill, all-text, one file, no extras', () => {
    expect(parserEligible(ok)).toBe(true);
    expect(parserEligible({ ...ok, key: 'final-bill' })).toBe(true);
  });
  it.each([
    ['other doc type', { key: 'rc' }],
    ['mixed pages', { allText: false }],
    ['several files', { fileCount: 2 }],
    ['feedback', { feedback: 'x' }],
    ['previousData', { previousData: {} }],
    ['forceDocMode', { forceDocMode: 'vision' }],
    ['bench override', { override: { method: 'text' } }],
  ])('false for %s', (_n, patch) => {
    expect(parserEligible({ ...ok, ...patch })).toBe(false);
  });
});

describe('readHeader', () => {
  it('sends page 1 + last page only and keeps only listed fields', async () => {
    const call = vi.fn().mockResolvedValue(JSON.stringify({
      workshop_name: 'ACME', vehicle_number: 'MH01', gross_amount: 99, junk: 'x',
    }));
    const h = await readHeader('estimate', ['P1TEXT', 'P2TEXT', 'P3TEXT'], call);
    const prompt = call.mock.calls[0][0] as string;
    expect(prompt).toContain('P1TEXT');
    expect(prompt).toContain('P3TEXT');
    expect(prompt).not.toContain('P2TEXT');
    expect(h.workshop_name).toBe('ACME');
    expect(h.vehicle_number).toBe('MH01');
    expect(h.bill_number).toBe('');
    expect(h).not.toHaveProperty('gross_amount');
    expect(h).not.toHaveProperty('junk');
  });
  it('final-bill fields', async () => {
    const h = await readHeader('final-bill', ['a'], async () => '{}');
    expect(Object.keys(h).sort()).toEqual(['bill_date', 'bill_number', 'workshop_name']);
  });
  it('returns empty strings when the call throws', async () => {
    const h = await readHeader('estimate', ['a'], async () => { throw new Error('boom'); });
    expect(Object.values(h).every(v => v === '')).toBe(true);
    expect(Object.keys(h)).toHaveLength(7);
  });
  it('rethrows AbortError', async () => {
    const e = new Error('x'); e.name = 'AbortError';
    await expect(readHeader('estimate', ['a'], async () => { throw e; })).rejects.toThrow('x');
  });
});
