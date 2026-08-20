import { describe, expect, test } from 'vitest';
import { calculateAssessmentSummary, getVehicleAgeMonths } from '../index';
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
  } as AssessmentRow;
}

const AGE = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');
const sum = (rows: AssessmentRow[]) => calculateAssessmentSummary(rows, AGE, 'nil', 0, 0, 0);

describe('estimate totals are a fact about the garage document', () => {
  test('a rejected part still counts toward the parts estimate', () => {
    const s = sum([
      row({ estimated: 10000, assessed: 10000 }),
      row({ estimated: 2000, assessed: 0, allowed: false }),
    ]);
    expect(s.estimatePartsBase).toBe(12000);
  });

  // The engine used to filter the material split but not the total, so these
  // two disagreed and any report printing both showed a breakdown that did
  // not sum to its own heading.
  test('the parts estimate equals the sum of its material parts', () => {
    const s = sum([
      row({ estimated: 10000, assessed: 10000, partType: 'metal' }),
      row({ estimated: 2000, assessed: 0, partType: 'metal', allowed: false }),
      row({ estimated: 3000, assessed: 3000, partType: 'glass' }),
    ]);
    const materials =
      s.estimateMetalBase + s.estimatePlasticBase + s.estimateGlassBase + s.estimateFiberglassBase;
    expect(materials).toBe(s.estimatePartsBase);
    expect(s.estimatePartsBase).toBe(15000);
  });

  test('a rejected labour line still counts toward the labour estimate', () => {
    const s = sum([
      row({ section: 'labour', partType: 'labour', estimated: 1000, assessed: 1000 }),
      row({ section: 'labour', partType: 'labour', estimated: 400, assessed: 0, allowed: false }),
    ]);
    expect(s.estimateLabourOnlyBase).toBe(1400);
  });

  test('assessed totals are unaffected — rejected rows still carry no money', () => {
    const s = sum([
      row({ estimated: 10000, assessed: 10000 }),
      row({ estimated: 2000, assessed: 0, allowed: false }),
    ]);
    expect(s.partsBase).toBe(10000);
  });
});
