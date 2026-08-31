import { describe, expect, test } from 'vitest';
import { uiicPortalSummary } from '../uiic-portal-summary';
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

describe('uiicPortalSummary — parts buckets', () => {
  test('a metal part goes in at its FULL pre-depreciation price', () => {
    // R1. The portal depreciates; we must not do it for them.
    // 100 months old => 40% metal depreciation.
    const s = uiicPortalSummary([row({ assessed: 10000, partType: 'metal' })], 100, 'standard');
    expect(s.parts.ageBasedDep).toBe(10000);
    expect(s.parts.dep50).toBe(0);
    expect(s.parts.dep30).toBe(0);
    expect(s.parts.nilDep).toBe(0);
  });

  test('the GST slab for that same part is POST-depreciation', () => {
    // R3, and the asymmetry in spec §2.1. If someone "fixes" the pre/post
    // mismatch, this is the test that fails.
    const s = uiicPortalSummary([row({ assessed: 10000, partType: 'metal', gst: 18 })], 100, 'standard');
    expect(s.partsGst).toEqual([{ rate: 18, amount: 6000 }]); // 10000 x 60%
  });

  test('splits plastic, fibreglass and glass into their own buckets', () => {
    const s = uiicPortalSummary(
      [
        row({ assessed: 4000, partType: 'plastic' }),
        row({ assessed: 3000, partType: 'fiberglass' }),
        row({ assessed: 2000, partType: 'glass' }),
      ],
      100,
      'standard',
    );
    expect(s.parts.dep50).toBe(4000);
    expect(s.parts.dep30).toBe(3000);
    expect(s.parts.nilDep).toBe(2000);
    expect(s.parts.ageBasedDep).toBe(0);
  });

  test('ignores rows the surveyor disallowed', () => {
    const s = uiicPortalSummary(
      [row({ assessed: 10000, partType: 'metal', allowed: false })],
      100,
      'standard',
    );
    expect(s.parts.ageBasedDep).toBe(0);
  });
});

describe('uiicPortalSummary — disposal parts', () => {
  test('disposal parts land in nilDep at their allowed value, with zero GST', () => {
    // R2. Octavia-shaped: every part allowed on a disposal basis.
    const s = uiicPortalSummary(
      [
        row({ assessed: 8000, partType: 'glass', isDisposal: true, disposalPercent: 100 }),
        row({ assessed: 15000, partType: 'glass', isDisposal: true, disposalPercent: 100 }),
        row({ assessed: 4500, partType: 'glass', isDisposal: true, disposalPercent: 100 }),
      ],
      82,
      'standard',
    );
    expect(s.parts.nilDep).toBe(27500);
    expect(s.partsGst).toEqual([{ rate: 0, amount: 27500 }]);
  });

  test('a disposal metal part goes to nilDep, not ageBasedDep', () => {
    // 100 months => 40% dep, then 50% disposal => 10000 x 0.6 x 0.5 = 3000
    const s = uiicPortalSummary(
      [row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })],
      100,
      'standard',
    );
    expect(s.parts.nilDep).toBe(3000);
    expect(s.parts.ageBasedDep).toBe(0);
  });
});

describe('uiicPortalSummary — nil depreciation policy', () => {
  test('puts the whole parts amount into nilDep', () => {
    // R5
    const s = uiicPortalSummary(
      [
        row({ assessed: 10000, partType: 'metal' }),
        row({ assessed: 5000, partType: 'glass' }),
      ],
      100,
      'nil',
    );
    expect(s.parts.nilDep).toBe(15000);
    expect(s.parts.ageBasedDep).toBe(0);
  });

  test('a disposal part on a nil policy keeps its disposal reduction', () => {
    // Disposal is tested BEFORE the policy. Reversing that order enters
    // 10000 here and overstates the claim.
    const s = uiicPortalSummary(
      [row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })],
      100,
      'nil',
    );
    expect(s.parts.nilDep).toBe(5000);
  });
});

describe('uiicPortalSummary — labour and paint', () => {
  test('combines labour with paint after paint depreciation', () => {
    // R4/R7, the figures from the SWAR panel: 23200 + (24000 - 3000) = 44200
    const s = uiicPortalSummary(
      [
        row({ assessed: 23200, section: 'labour', partType: 'labour' }),
        row({ assessed: 24000, section: 'paint', partType: 'paint', depOverride: 12.5 }),
      ],
      100,
      'standard',
    );
    expect(s.labour.labour).toBe(23200);
    expect(s.labour.paint).toBe(24000);
    expect(s.labour.lessPaintDep).toBe(3000);
    expect(s.labour.totalLabour).toBe(44200);
  });

  test('labour and paint do not leak into the parts buckets', () => {
    const s = uiicPortalSummary(
      [
        row({ assessed: 23200, section: 'labour', partType: 'labour' }),
        row({ assessed: 24000, section: 'paint', partType: 'paint' }),
      ],
      100,
      'standard',
    );
    expect(s.parts.ageBasedDep).toBe(0);
    expect(s.parts.nilDep).toBe(0);
  });

  test('labour GST is banded separately from parts GST', () => {
    const s = uiicPortalSummary(
      [
        row({ assessed: 10000, partType: 'metal', gst: 28 }),
        row({ assessed: 20000, section: 'labour', partType: 'labour', gst: 18 }),
      ],
      100,
      'standard',
    );
    expect(s.partsGst).toEqual([{ rate: 28, amount: 6000 }]);
    expect(s.labourGst).toEqual([{ rate: 18, amount: 20000 }]);
  });
});

describe('uiicPortalSummary — tie-out', () => {
  test('reports the rupee lost to rounding the buckets', () => {
    // Both buckets round down: 1000.4 -> 1000 and 2000.4 -> 2000, so the
    // rounded total is 3000 against an exact 3000.8.
    const s = uiicPortalSummary(
      [
        row({ assessed: 1000.4, partType: 'metal' }),
        row({ assessed: 2000.4, partType: 'plastic' }),
      ],
      100,
      'standard',
    );
    expect(s.parts.ageBasedDep).toBe(1000);
    expect(s.parts.dep50).toBe(2000);
    expect(s.tieOut.exact).toBeCloseTo(3000.8, 2);
    expect(s.tieOut.rounded).toBe(3000);
    expect(s.tieOut.delta).toBeCloseTo(-0.8, 2);
  });
});
