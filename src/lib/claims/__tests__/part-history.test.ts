import { describe, it, expect } from 'vitest';
import { partHistory, partNameKey } from '../part-history';
import { createBlankClaim, type ClaimData } from '@/types/claim';
import type { AssessmentRow } from '@/types';

function row(over: Partial<AssessmentRow>): AssessmentRow {
  return {
    id: Math.random().toString(36),
    particulars: '',
    estimated: 0,
    assessed: 0,
    partType: 'plastic',
    gst: 18,
    section: 'parts',
    allowed: true,
    ...over,
  } as AssessmentRow;
}

function claim(id: string, model: string, rows: AssessmentRow[], date = '2026-01-01', workshop = 'Shree Motors'): ClaimData {
  const c = createBlankClaim();
  return {
    ...c,
    id,
    reportNo: id.toUpperCase(),
    vehicle: { ...c.vehicle, make: 'Mahindra', model },
    accident: { ...c.accident, dateOfSurvey: date, workshopName: workshop },
    assessmentRows: rows,
  };
}

describe('partNameKey', () => {
  it('treats word order, case, punctuation and F./Frt abbreviations as one part', () => {
    const k = partNameKey('Bumper Front');
    expect(partNameKey('BUMPER FRONT')).toBe(k);
    expect(partNameKey('F. Bumper')).toBe(k);
    expect(partNameKey('Frt Bumper Assy')).toBe(k);
  });

  it('keeps different parts apart', () => {
    expect(partNameKey('Bumper Rear')).not.toBe(partNameKey('Bumper Front'));
    expect(partNameKey('Headlamp LH')).not.toBe(partNameKey('Headlamp RH'));
  });
});

describe('partHistory', () => {
  const current = claim('now', 'XUV700', []);

  it('finds the same part on the same model by name, newest first, skipping the current claim', () => {
    const all = [
      claim('a', 'XUV 700', [row({ particulars: 'Front Bumper', estimated: 5200, assessed: 4200 })], '2026-07-10'),
      claim('b', 'XUV700', [row({ particulars: 'BUMPER FRONT', estimated: 4000, assessed: 4000 })], '2026-09-02', 'Mahindra Auto'),
      claim('c', 'Scorpio N', [row({ particulars: 'Bumper Front', estimated: 3000, assessed: 3000 })]),
      { ...current, assessmentRows: [row({ particulars: 'Bumper Front', estimated: 6500 })] },
    ];
    const h = partHistory(all, current, row({ particulars: 'F. Bumper' }));
    expect(h.map((e) => e.claimId)).toEqual(['b', 'a']);
    expect(h[0]).toMatchObject({ workshop: 'Mahindra Auto', estimated: 4000, assessed: 4000, date: '2026-09-02' });
  });

  it('matches on part number when both rows have one, regardless of name', () => {
    const all = [
      claim('a', 'XUV700', [row({ particulars: 'Bumper cover', partNumber: '1701-BAR', estimated: 4000 })]),
      claim('b', 'XUV700', [row({ particulars: 'Bumper Front', partNumber: '9999ZZZ', estimated: 9000 })]),
    ];
    const h = partHistory(all, current, row({ particulars: 'Bumper Front', partNumber: '1701bar' }));
    expect(h.map((e) => e.claimId)).toEqual(['a']);
  });

  it('marks disallowed rows and skips rows with no estimate', () => {
    const all = [
      claim('a', 'XUV700', [row({ particulars: 'Bumper Front', estimated: 4000, assessed: 4000, allowed: false })]),
      claim('b', 'XUV700', [row({ particulars: 'Bumper Front', estimated: 0, assessed: 0 })]),
    ];
    const h = partHistory(all, current, row({ particulars: 'Bumper Front' }));
    expect(h).toHaveLength(1);
    expect(h[0].disallowed).toBe(true);
  });

  it('returns nothing when the current claim has no model or the row has no name', () => {
    const all = [claim('a', 'XUV700', [row({ particulars: 'Bumper Front', estimated: 4000 })])];
    expect(partHistory(all, claim('x', '', []), row({ particulars: 'Bumper Front' }))).toEqual([]);
    expect(partHistory(all, current, row({ particulars: '  ' }))).toEqual([]);
  });
});
