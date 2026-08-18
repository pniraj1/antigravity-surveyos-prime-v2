import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML, buildUIICFinalHTML } from '../uiic-final-builder';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

// "Repairs as per assessment" is a certification: the surveyor stating that the
// workshop did what was assessed. Both UIIC reports used to print `|| 'YES'`,
// and the claim factory seeded 'YES', so a claim with no reinspection asserted
// it to the insurer without anyone saying so.

function row(): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'Bonnet',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
  } as AssessmentRow;
}

function claim(reinspection: Record<string, unknown>): ClaimData {
  return {
    id: 'c1',
    assessmentRows: [row()],
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection,
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
  } as unknown as ClaimData;
}

/** The cell's value, isolated from any other 'YES' elsewhere on the page. */
function cellAfter(html: string, label: string): string {
  const i = html.toLowerCase().indexOf(label.toLowerCase());
  expect(i, `label "${label}" not found in report`).toBeGreaterThan(-1);
  const after = html.slice(i, i + 400);
  const cells = after.match(/>([^<>]*)</g) || [];
  // [0] closes the label cell; the next non-empty cell holds the value.
  const values = cells.slice(1).map(c => c.replace(/[><]/g, '').trim()).filter(Boolean);
  return values[0] ?? '';
}

describe('Repairs as per assessment is never asserted by default', () => {
  test('final report prints no certification when the surveyor set none', () => {
    const html = buildUIICFinalHTML(claim({}), null);
    expect(cellAfter(html, 'Repairs as per assessment')).not.toBe('YES');
  });

  test('bill check prints no certification when the surveyor set none', () => {
    const html = buildUIICBillCheckHTML(claim({}), null);
    expect(cellAfter(html, 'Repairs As Per Assessment')).not.toBe('YES');
  });

  test('a surveyor-set value still prints, in both reports', () => {
    const set = claim({ repairsAsAssessed: 'YES' });
    expect(cellAfter(buildUIICFinalHTML(set, null), 'Repairs as per assessment')).toBe('YES');
    expect(cellAfter(buildUIICBillCheckHTML(set, null), 'Repairs As Per Assessment')).toBe('YES');
  });

  test('PARTIAL is not silently upgraded to YES', () => {
    const partial = claim({ repairsAsAssessed: 'PARTIAL' });
    expect(cellAfter(buildUIICBillCheckHTML(partial, null), 'Repairs As Per Assessment')).toBe('PARTIAL');
  });

  test('a new claim does not arrive pre-certified', () => {
    expect(createBlankClaim().reinspection.repairsAsAssessed).toBeUndefined();
  });
});
