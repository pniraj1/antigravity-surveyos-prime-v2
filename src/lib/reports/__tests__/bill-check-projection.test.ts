import { describe, expect, test } from 'vitest';
import { projectForBillCheck, billCheckAssessed } from '../bill-check-projection';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'Bonnet Assy.',
    estimated: 10000,
    assessed: 9000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

describe('projectForBillCheck', () => {
  test('moves the billed figure into the estimate slot', () => {
    const [p] = projectForBillCheck([row({ billedTaxable: 9500 })]);
    expect(p.estimated).toBe(9500);
    expect(p.assessed).toBe(9000);
  });

  test('a row with no billed figure carries no bill amount', () => {
    const [p] = projectForBillCheck([row()]);
    expect(p.estimated).toBe(0);
  });

  test('billAllowed overrides assessed for this document', () => {
    const [p] = projectForBillCheck([row({ billedTaxable: 12000, billAllowed: 12000 })]);
    expect(p.assessed).toBe(12000);
  });

  test('a not-in-bill row carries no money at all', () => {
    const [p] = projectForBillCheck([row({ billStatus: 'not-in-bill', billedTaxable: 0 })]);
    expect(p.estimated).toBe(0);
    expect(p.assessed).toBe(0);
  });

  test('not-in-bill wins over billAllowed', () => {
    const [p] = projectForBillCheck([row({ billStatus: 'not-in-bill', billAllowed: 5000 })]);
    expect(p.assessed).toBe(0);
  });

  test('does not mutate the input rows', () => {
    const input = [row({ billedTaxable: 9500, billAllowed: 9800 })];
    const snapshot = JSON.parse(JSON.stringify(input));
    projectForBillCheck(input);
    expect(input).toEqual(snapshot);
  });
});

describe('billCheckAssessed', () => {
  test('uses the final-survey figure when no allowance was recorded', () => {
    expect(billCheckAssessed(row({ assessed: 1000 }))).toBe(1000);
  });

  test('uses the bill-check allowance when one was recorded', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billAllowed: 700 }))).toBe(700);
  });

  test('an allowance of zero is a decision, not an absence', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billAllowed: 0 }))).toBe(0);
  });

  test('a not-in-bill row carries nothing, whatever was allowed', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billAllowed: 700, billStatus: 'not-in-bill' }))).toBe(0);
  });

  // The guard against screen and report drifting apart again.
  test('the projection routes through it', () => {
    const r = row({ assessed: 1000, billAllowed: 700, billedTaxable: 700 });
    expect(projectForBillCheck([r])[0].assessed).toBe(billCheckAssessed(r));
  });
});

describe('billed is the cap per item', () => {
  test('a bill below the assessment caps the claim', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 700 }))).toBe(700);
  });

  test('a bill above the assessment does not raise it', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 1200 }))).toBe(1000);
  });

  test('no billed figure means nothing to cap against', () => {
    expect(billCheckAssessed(row({ assessed: 1000 }))).toBe(1000);
  });

  test('a billed figure of zero caps to zero', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 0 }))).toBe(0);
  });

  test('an explicit allowance overrides the cap downward', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 700, billAllowed: 500 }))).toBe(500);
  });

  test('an explicit allowance overrides the cap upward', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 1200, billAllowed: 1200 }))).toBe(1200);
  });

  test('not-in-bill still wins over everything', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 700, billStatus: 'not-in-bill' }))).toBe(0);
  });
});
