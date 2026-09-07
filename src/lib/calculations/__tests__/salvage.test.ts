import { describe, expect, test } from 'vitest';
import { salvageBasis } from '../salvage';
import { billCheckAssessed } from '@/lib/reports/bill-check-projection';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Bonnet Assy.',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

describe('salvageBasis', () => {
  test('no rows is zero', () => {
    expect(salvageBasis([])).toBe(0);
  });

  test('an allowed metal part counts at its assessed amount plus its own GST', () => {
    expect(salvageBasis([row({ assessed: 10000, gst: 18 })])).toBe(11800);
  });

  test('each row is taxed at its own rate', () => {
    // 10,000 at 18% = 11,800 and 5,000 at 28% = 6,400 → 18,200
    expect(salvageBasis([
      row({ assessed: 10000, gst: 18 }),
      row({ assessed: 5000, gst: 28 }),
    ])).toBe(18200);
  });

  test('only metal parts count', () => {
    expect(salvageBasis([
      row({ assessed: 10000, gst: 18 }),
      row({ assessed: 9000, partType: 'plastic' }),
      row({ assessed: 9000, partType: 'glass' }),
      row({ assessed: 9000, partType: 'fiberglass' }),
    ])).toBe(11800);
  });

  test('labour and paint never count, whatever their partType says', () => {
    expect(salvageBasis([
      row({ assessed: 9000, section: 'labour' }),
      row({ assessed: 9000, section: 'paint' }),
    ])).toBe(0);
  });

  // toggleRowAllowed does not zero `assessed` when it switches a row off, so a
  // rejected row keeps its old figure. Filtering on the amount would count it.
  test('a rejected metal part carrying a stale assessed figure counts nothing', () => {
    expect(salvageBasis([row({ assessed: 9000, allowed: false })])).toBe(0);
  });

  test('a disposal row counts its assessed amount with no GST', () => {
    expect(salvageBasis([row({ assessed: 4000, isDisposal: true, gst: 18 })])).toBe(4000);
  });

  test('a missing GST rate falls back to 18%', () => {
    expect(salvageBasis([row({ assessed: 10000, gst: undefined })])).toBe(11800);
  });
});

describe('salvageBasis, through the bill-check lens', () => {
  test('a capped row counts the billed figure, not the assessed one', () => {
    expect(salvageBasis(
      [row({ assessed: 10000, billedTaxable: 5000, gst: 18 })],
      billCheckAssessed,
    )).toBe(5900);
  });

  test('a not-in-bill row counts nothing — no old part came off', () => {
    expect(salvageBasis(
      [row({ assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 })],
      billCheckAssessed,
    )).toBe(0);
  });

  test('billAllowed above the assessment raises the basis', () => {
    expect(salvageBasis(
      [row({ assessed: 10000, billedTaxable: 15000, billAllowed: 20000, gst: 18 })],
      billCheckAssessed,
    )).toBe(23600);
  });

  test('a row with no bill yet counts its assessed amount', () => {
    expect(salvageBasis([row({ assessed: 10000, gst: 18 })], billCheckAssessed)).toBe(11800);
  });
});
