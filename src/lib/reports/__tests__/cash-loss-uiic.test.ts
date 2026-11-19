import { describe, expect, test } from 'vitest';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import { buildStandardFinalHTML } from '../standard-report-builder';
import { nonKoClaim } from './non-ko-claim';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const r = (o: Partial<AssessmentRow>) => ({
  id: `r${Math.random()}`, particulars: 'Item', estimated: 100000, assessed: 10000, partType: 'metal', gst: 18,
  section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, depOverride: 0, ...o,
}) as AssessmentRow;

function sample(extra: Partial<ClaimData> = {}): ClaimData {
  return {
    ...nonKoClaim(),
    assessmentRows: [
      r({ section: 'labour', partType: 'labour', assessed: 36750 }),
      r({ assessed: 68960.5 }), r({ assessed: 4775, partType: 'plastic' }), r({ assessed: 1600, partType: 'glass' }),
    ],
    feeBill: { salvageValue: 7085, billSalvage: 7085, compulsoryExcess: 1000, voluntaryExcess: 0, travelExpenses: 0 },
    cashLoss: { enabled: true, notionalPercent: 30 },
    ...extra,
  } as unknown as ClaimData;
}

const html = (c: ClaimData) => buildUIICFinalHTML(c, null);
const TL = { isTotalLoss: true, totalLossDetails: { salvageWithRC: 1, salvageWithoutRC: 2, towingExpenses: 0, workshopRent: 0 } } as Partial<ClaimData>;

describe('cash loss in UIIC Final', () => {
  test('cash off -> identical to no cashLoss', () => {
    const off = { ...sample(), cashLoss: { enabled: false, notionalPercent: 30 } } as ClaimData;
    const none = { ...sample() } as ClaimData; delete (none as { cashLoss?: unknown }).cashLoss;
    expect(html(off)).toBe(html(none));
    expect(html(none)).not.toContain('8A.');
  });

  test('cash on -> 8A between DETAILS OF ASSESSMENT and GST SUMMARY; payable by insurer = cash net', () => {
    const h = html(sample());
    const a = h.indexOf('8A. CASH LOSS BASIS');
    expect(a).toBeGreaterThan(h.indexOf('DETAILS OF ASSESSMENT'));
    expect(a).toBeLessThan(h.indexOf('GST SUMMARY'));
    expect(h).toMatch(/Amount Payable by Insurer<\/td><td[^>]*>[^<]*72500\.35/);
  });

  test('authorize repairs absent; recommended for Rs. cash net present', () => {
    const h = html(sample());
    expect(h).not.toContain('authorize repairs');
    expect(h).toMatch(/recommended for Rs. 72500.35/);
    expect(html({ ...sample(), cashLoss: undefined } as ClaimData)).toContain('authorize repairs');
  });

  test('UIIC 8A gross equals standard 8A gross', () => {
    const c = sample();
    const grab = (h: string) => /GROSS ASSESSED LOSS<\/td><td[^>]*>([^<]*)</.exec(h)?.[1];
    expect(grab(html(c))).toContain("105,000.50");
    expect(grab(html(c))).toBe(grab(buildStandardFinalHTML(c, null)));
  });

  test('TL + cash -> comparison has Cash Loss column', () => {
    const h = html(sample(TL));
    expect(h.slice(h.indexOf("COMPARISON OF INSURER'S LIABILITY"))).toContain('Cash Loss');
  });
});
