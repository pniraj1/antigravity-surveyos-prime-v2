import { describe, expect, test } from 'vitest';
import { niaAssessmentRows } from '../nia-assessment-excel';
import { partHistory } from '@/lib/claims/part-history';
import { getBlockingRows } from '@/lib/ai/insured-report';
import { categoryLabel } from '@/components/pdf/InsuredSummaryDocument';
import { createBlankClaim, type ClaimData } from '@/types/claim';
import type { AssessmentRow } from '@/types/assessment';

function row(o: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Bumper Front', estimated: 4000, assessed: 4000,
    billedTaxable: 4000, partType: 'metal', gst: 18, section: 'parts', allowed: true,
    isDisposal: false, disposalPercent: 50, ...o,
  } as AssessmentRow;
}
const ko = (o: Partial<AssessmentRow> = {}) => row({ allowed: false, keptOpen: true, ...o });

function claim(id: string, rows: AssessmentRow[]): ClaimData {
  const c = createBlankClaim();
  return { ...c, id, vehicle: { ...c.vehicle, model: 'XUV700' }, assessmentRows: rows };
}

describe('kept-open misc', () => {
  test('NIA export: K.O. rows absent', () => {
    const out = niaAssessmentRows([row(), ko({ particulars: 'Door' })], 36, 'standard');
    expect(out).toHaveLength(1);
  });

  test('part history entry for K.O. row has keptOpen: true', () => {
    const h = partHistory([claim('a', [ko()])], claim('now', []), row());
    expect(h[0].keptOpen).toBe(true);
    expect(h[0].disallowed).toBe(false);
  });

  test('insured report label for K.O. row', () => {
    expect(categoryLabel('not-covered', false, true)).toBe('Kept open, to be decided after dismantling');
  });

  test('K.O. row does not block the insured report gate', () => {
    expect(getBlockingRows(claim('a', [ko()]), false)).toEqual([]);
  });
});
