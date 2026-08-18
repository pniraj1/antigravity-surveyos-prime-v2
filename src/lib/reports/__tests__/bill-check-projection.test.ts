import { describe, expect, test } from 'vitest';
import { projectForBillCheck } from '../bill-check-projection';
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
