import { describe, expect, test } from 'vitest';
import { sectionSubtotals, billedTotals, SECTION_ORDER } from '../section-subtotals';
import { calculateAssessmentSummary } from '../assessment';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('sectionSubtotals', () => {
  test('each section total equals the engine figure it came from', () => {
    const rows = [
      row({ partType: 'metal', assessed: 10000, section: 'parts' }),
      row({ partType: 'labour', assessed: 2000, section: 'labour' }),
      row({ partType: 'paint', assessed: 5000, section: 'paint' }),
    ];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    expect(s.parts.base).toBe(summary.partsBase);
    expect(s.parts.total).toBe(summary.partsTotal);
    expect(s.labour.base).toBe(summary.labourOnlyBase);
    expect(s.labour.total).toBe(summary.labourOnlyTotal);
    expect(s.paint.base).toBe(summary.paintOnlyBase);
    expect(s.paint.total).toBe(summary.paintOnlyTotal);
  });

  test('gst is the difference between total and base', () => {
    const rows = [row({ partType: 'metal', assessed: 10000, gst: 28 })];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    // 10000 at 25% dep = 7500 base; 28% GST = 2100
    expect(s.parts.base).toBeCloseTo(7500, 2);
    expect(s.parts.gst).toBeCloseTo(2100, 2);
    expect(s.parts.total).toBeCloseTo(9600, 2);
  });

  test('the three section totals sum to the grand total', () => {
    const rows = [
      row({ partType: 'metal', assessed: 10000, section: 'parts' }),
      row({ partType: 'plastic', assessed: 4000, section: 'parts' }),
      row({ partType: 'labour', assessed: 2000, section: 'labour' }),
      row({ partType: 'paint', assessed: 5000, section: 'paint' }),
    ];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    expect(s.parts.total + s.labour.total + s.paint.total).toBeCloseTo(summary.grandTotal, 2);
  });

  test('an empty claim gives three zeroed sections', () => {
    const summary = calculateAssessmentSummary([], 38, 'standard');
    const s = sectionSubtotals(summary);
    for (const key of ['parts', 'labour', 'paint'] as const) {
      expect(s[key]).toEqual({ base: 0, gst: 0, total: 0 });
    }
  });
});

/**
 * The Bill Check grid's billed-side footers. These are the figures the surveyor
 * checks against the workshop's invoice, so a per-section line that does not add
 * up to the grand total below it is worse than no line at all.
 */
describe('billedTotals', () => {
  test('an empty list gives five zeros', () => {
    expect(billedTotals([])).toEqual({
      estimated: 0, assessed: 0, billedTaxable: 0, billedAmount: 0, notInBill: 0,
    });
  });

  // The regression this guards: the inline reduces this helper replaces all used
  // `|| 0`, because these three fields are genuinely optional on a persisted row.
  // One bare `+` on an undefined turns the whole column into NaN.
  test('missing money fields count as zero, never NaN', () => {
    const t = billedTotals([
      row({ estimated: undefined as never, billedTaxable: undefined, billedAmount: undefined }),
      row({ estimated: 500, billedTaxable: 400, billedAmount: 472 }),
    ]);

    expect(t.estimated).toBe(500);
    expect(t.billedTaxable).toBe(400);
    expect(t.billedAmount).toBe(472);
    for (const v of Object.values(t)) expect(Number.isNaN(v)).toBe(false);
  });

  test('notInBill counts only rows the workshop did not claim', () => {
    const t = billedTotals([
      row({ assessed: 1000, billStatus: 'not-in-bill' }),
      row({ assessed: 2000, billStatus: 'in-bill' }),
      row({ assessed: 4000, billStatus: 'in-bill' }),
      row({ assessed: 8000, billStatus: 'pending' }),
      row({ assessed: 16000 }),
    ]);

    expect(t.notInBill).toBe(1000);
    expect(t.assessed).toBe(31000);
  });

  // The invariant behind the whole feature: three per-section lines must add up
  // to the one grand TOTAL still printed below them.
  test('the three section splits sum to the whole', () => {
    const rows = [
      row({ section: 'parts',  assessed: 10000, billedAmount: 11800, billStatus: 'in-bill' }),
      row({ section: 'parts',  assessed: 4000,  billStatus: 'not-in-bill' }),
      row({ section: 'labour', assessed: 2000,  billedAmount: 2360, billedTaxable: 2000 }),
      row({ section: 'paint',  assessed: 5000,  billedTaxable: 5000 }),
    ];
    const bySection = (s: AssessmentRow['section']) =>
      billedTotals(rows.filter(r => r.section === s));

    const split = [bySection('parts'), bySection('labour'), bySection('paint')];
    const whole = billedTotals(rows);

    for (const key of Object.keys(whole) as (keyof typeof whole)[]) {
      expect(split.reduce((sum, part) => sum + part[key], 0)).toBeCloseTo(whole[key], 6);
    }
  });
});

describe('SECTION_ORDER', () => {
  // Guards the grids against a section being added to the AssessmentSection union
  // and silently vanishing from both, since each renders only what this lists.
  test('covers every section sectionSubtotals returns, in report order', () => {
    expect(SECTION_ORDER.map(s => s.section)).toEqual(['parts', 'labour', 'paint']);

    const summary = calculateAssessmentSummary([], 38, 'standard');
    expect(SECTION_ORDER.map(s => s.section).sort())
      .toEqual(Object.keys(sectionSubtotals(summary)).sort());
  });

  test('every section carries a printable title', () => {
    for (const { title } of SECTION_ORDER) expect(title.trim().length).toBeGreaterThan(0);
  });
});
