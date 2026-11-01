import { describe, it, expect, vi } from 'vitest';
import { parserEligible, readHeader, safeParse } from '../parser-first';

vi.mock('../row-parser', () => ({ parseEstimate: (t: unknown[]) => { if (!t.length) throw new Error('odd layout'); return { ok: false, reason: 'x' }; } }));

describe('safeParse', () => {
  it('turns a parser throw into a decline', () => {
    expect(safeParse([])).toEqual({ ok: false, reason: 'parser error: odd layout' });
  });
  it('passes through a normal outcome', () => {
    expect(safeParse([[]])).toEqual({ ok: false, reason: 'x' });
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
