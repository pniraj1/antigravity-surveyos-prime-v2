import { describe, expect, test } from 'vitest';
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

const TL = { isTotalLoss: true, totalLossDetails: { salvageWithRC: 1, salvageWithoutRC: 2, towingExpenses: 0, workshopRent: 0 } } as Partial<ClaimData>;
const html = (c: ClaimData) => buildStandardFinalHTML(c, null);

describe('cash loss in the standard Final', () => {
  test('cash loss off or undefined -> identical to before', () => {
    const off = { ...sample(), cashLoss: { enabled: false, notionalPercent: 30 } } as ClaimData;
    const none = { ...sample() } as ClaimData; delete (none as { cashLoss?: unknown }).cashLoss;
    expect(html(off)).toBe(html(none));
    expect(html(none)).not.toContain('8A.');
  });

  test('8A sits between section 8 and section 9; NET 72,500.35', () => {
    const h = html(sample());
    const a = h.indexOf('8A. CASH LOSS BASIS (without production of repair bills; all figures before GST)');
    expect(a).toBeGreaterThan(h.indexOf('8. ASSESSMENT SUMMARY'));
    expect(a).toBeLessThan(h.indexOf('9. DETAILS'));
    expect(h.slice(a, h.indexOf('9. DETAILS'))).toContain('72,500.35');
    expect(h.slice(a, h.indexOf('9. DETAILS'))).toContain('105,000.50');
  });

  test('section 8 NET ASSESSED LOSS unchanged when cash loss on', () => {
    const sec8 = (h: string) => h.slice(h.indexOf('8. ASSESSMENT SUMMARY'), h.indexOf('RUPEES', h.indexOf('NET ASSESSED LOSS')));
    expect(sec8(html(sample()))).toBe(sec8(html(sample({ cashLoss: undefined }))));
  });

  test('auto preamble mentions cash loss; surveyor-typed preamble untouched', () => {
    expect(html(sample())).toMatch(/cash loss basis[^<]*30%/);
    const typed = html(sample({ reportPreamble: 'My own words.' }));
    expect(typed).toContain('My own words.');
    expect(typed).not.toMatch(/recommended for settlement on cash loss basis/);
  });

  test('TL + cash loss -> comparison has Cash Loss column with 8A net; TL off -> no comparison', () => {
    const h = html(sample(TL));
    const cmp = h.slice(h.indexOf("Comparison of Insurer's Liability"), h.indexOf('9. DETAILS'));
    expect(cmp).toContain('Cash Loss');
    expect(cmp).toContain('72,500.35');
    expect(html(sample())).not.toContain("Comparison of Insurer's Liability");
  });

  test('TL without cash loss -> no Cash Loss column', () => {
    const h = html(sample({ ...TL, cashLoss: undefined }));
    expect(h.slice(h.indexOf("Comparison of Insurer's Liability"))).not.toContain('>Cash Loss<');
  });

  test('percent null -> no NaN', () => {
    expect(html(sample({ cashLoss: { enabled: true, notionalPercent: null } }))).not.toContain('NaN');
    expect(html(sample({ ...TL, cashLoss: { enabled: true, notionalPercent: null } }))).not.toContain('NaN');
  });
});
