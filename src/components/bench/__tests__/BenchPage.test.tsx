import { describe, test, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PdfProfile, BenchRow } from '@/lib/bench/types';
import type { CellResult } from '@/lib/bench/store';

vi.mock('@/lib/sandbox', () => ({ isSandbox: () => false, initSandboxSession: vi.fn() }));
vi.mock('@/lib/ai/service', () => ({ runModelTest: vi.fn(), ProviderError: class extends Error {} }));
vi.mock('@/lib/bench/store', async (orig) => ({ ...(await orig<typeof import('@/lib/bench/store')>()), bench: {} }));

import { BenchView } from '../BenchPage';
import { RunPanel } from '../RunPanel';
import { ResultsTable } from '../ResultsTable';
import { checkerVsGold, proposeTotal, canStart } from '../bench-logic';
import { planEstimate } from '@/lib/bench/plan';

const profile: PdfProfile = {
  id: 'p1', fileName: 'a.pdf', kind: 'digital', pageCount: 3, confirmed: true, unreadablePages: [],
  estimates: [{ label: 'E', firstPage: 1, lastPage: 1, grandTotal: 100 }],
};
const row = (amount: number, description = 'x'): BenchRow =>
  ({ section: 'spare_parts', srNo: null, description, qty: 1, rate: amount, amount, taxable: null, page: 1 });
const cell = (model: string, rows: BenchRow[], at = Date.now()): CellResult => ({
  id: model, profileId: 'p1', provider: 'groq', model, method: 'vision', pagesPerCall: 1, imageScale: 1.5, runNo: 1,
  status: 'done', rows, errors: [], calls: [], tokensIn: 10, tokensOut: 5, ms: 1, modelVersion: model, at,
});

describe('bench page', () => {
  test('is not rendered off the sandbox', () => {
    const html = renderToStaticMarkup(<BenchView mode="blocked" />);
    expect(html).toContain('The bench runs only on the sandbox site.');
    expect(html).not.toContain('Start');
  });

  test('Gemini unchecked by default; others checked', () => {
    const html = renderToStaticMarkup(<RunPanel profiles={[profile]} hardIds={[]} onHardIds={() => {}} onFinished={() => {}} />);
    expect(html).toMatch(/<input[^>]*data-pick="gemini[^"]*"(?![^>]*checked)[^>]*>/);
    expect(html).toMatch(/<input[^>]*data-pick="groq[^"]*"[^>]*checked/);
    expect(html).toContain("uses 9 of today");
  });

  test('planned calls match planEstimate', () => {
    const html = renderToStaticMarkup(<RunPanel profiles={[profile]} hardIds={[]} onHardIds={() => {}} onFinished={() => {}} />);
    const want = planEstimate([profile], [{ provider: 'groq', model: 'x', key: '', methods: ['vision'] }], []).groq;
    expect(html).toContain(`groq: ${want} calls`);
  });

  test('Start disabled until a profile is confirmed', () => {
    const off = renderToStaticMarkup(<RunPanel profiles={[{ ...profile, confirmed: false }]} hardIds={[]} onHardIds={() => {}} onFinished={() => {}} />);
    expect(off).toMatch(/disabled=""[^>]*>Start/);
    expect(off).toContain('Missing API key for: groq, nvidia, ollama');
    const pick = (provider: 'groq' | 'nvidia', key: string) => ({ provider, model: 'm', key, methods: ['vision' as const] });
    expect(canStart([profile], [pick('groq', 'k')])).toBe(true);
    expect(canStart([profile], [pick('groq', 'k'), pick('nvidia', '')])).toBe(false);
    expect(canStart([{ ...profile, confirmed: false }], [pick('groq', 'k')])).toBe(false);
  });
});

describe('checker vs gold', () => {
  const gold = [row(100)];
  test('agreeing readings give N/N and results stay visible', () => {
    const cells = [cell('m1', [row(100)])];
    expect(checkerVsGold([profile], cells, { p1: gold })).toEqual({ agree: 1, total: 1 });
    const html = renderToStaticMarkup(<ResultsTable profiles={[profile]} cells={cells} gold={{ p1: gold }} hardIds={[]} />);
    expect(html).toContain('1/1');
    expect(html).not.toContain('data-greyed="true"');
  });

  test('no gold at all greys the results with a lock message', () => {
    const html = renderToStaticMarkup(<ResultsTable profiles={[profile]} cells={[cell('m1', [row(100)])]} gold={{}} hardIds={[]} />);
    expect(html).toContain('0/0');
    expect(html).toContain('data-greyed="true"');
    expect(html).toContain('Lock at least one gold PDF');
    expect(html).toMatch(/disabled=""[^>]*>\s*Export limits table/);
  });

  test('one disagreeing reading greys the results', () => {
    // sums to 100 so the checker passes it, but it is not the gold rows
    const cells = [cell('m1', [row(100)]), cell('m2', [row(60, 'y'), row(40, 'z')])];
    const r = checkerVsGold([profile], cells, { p1: gold });
    expect(r.agree).toBeLessThan(r.total);
    const html = renderToStaticMarkup(<ResultsTable profiles={[profile]} cells={cells} gold={{ p1: gold }} hardIds={[]} />);
    expect(html).toContain('data-greyed="true"');
  });
});

describe('helpers', () => {
  test('proposeTotal takes the largest amount after "total"', () => {
    expect(proposeTotal(['Parts Total 1,200.00 Sub total 300 Grand Total 15,400.50'], 1, 1)).toBe(15400.5);
    expect(proposeTotal(['no amounts here'], 1, 1)).toBeNull();
  });
});
