import { describe, it, expect } from 'vitest';
import {
  checkValidityOnAccidentDate,
  appendNote,
  suggestedNote,
} from '../validity-advisory';

describe('checkValidityOnAccidentDate', () => {
  it('advises when the document had expired before the accident', () => {
    const advice = checkValidityOnAccidentDate('2026-03-12', '2026-06-04');
    expect(advice).toEqual({ expiryDate: '2026-03-12', accidentDate: '2026-06-04' });
  });

  it('stays silent when the document was still valid on the accident date', () => {
    expect(checkValidityOnAccidentDate('2027-01-01', '2026-06-04')).toBeNull();
  });

  it('treats same-day expiry as still valid', () => {
    // Expiry dates run to the end of their day; an accident on the expiry date
    // is not a lapse, and flagging it would be a false positive on a fact that
    // carries repudiation weight.
    expect(checkValidityOnAccidentDate('2026-06-04', '2026-06-04')).toBeNull();
  });

  // The whole point of the change: comparing against `today` meant a licence
  // that had lapsed at the time of the accident but was renewed afterwards
  // read as valid.
  it('advises even when the document has since been renewed past today', () => {
    const longAgo = '2020-01-01';
    const accident = '2020-06-01';
    expect(checkValidityOnAccidentDate(longAgo, accident)).not.toBeNull();
  });

  it('stays silent when the accident date is not yet entered', () => {
    expect(checkValidityOnAccidentDate('2020-01-01', '')).toBeNull();
    expect(checkValidityOnAccidentDate('2020-01-01', undefined)).toBeNull();
  });

  it('stays silent when the expiry date is missing or unparseable', () => {
    expect(checkValidityOnAccidentDate('', '2026-06-04')).toBeNull();
    expect(checkValidityOnAccidentDate('not-a-date', '2026-06-04')).toBeNull();
  });

  it('handles an accident date carrying a time component', () => {
    expect(checkValidityOnAccidentDate('2026-03-12', '2026-06-04T14:30')).not.toBeNull();
  });
});

describe('appendNote', () => {
  it('uses the note alone when remarks are empty', () => {
    expect(appendNote('', 'Licence expired.')).toBe('Licence expired.');
  });

  it('appends to existing remarks', () => {
    expect(appendNote('Photocopy seen.', 'Licence expired.')).toBe('Photocopy seen. Licence expired.');
  });

  it('does not duplicate a note already recorded', () => {
    const existing = 'Licence expired.';
    expect(appendNote(existing, 'Licence expired.')).toBe('Licence expired.');
  });
});

describe('suggestedNote', () => {
  it('names both dates so the record stands alone', () => {
    const note = suggestedNote(
      'Transport validity',
      { expiryDate: '2026-03-12', accidentDate: '2026-06-04' },
      (d) => d,
    );
    expect(note).toContain('Transport validity');
    expect(note).toContain('2026-03-12');
    expect(note).toContain('2026-06-04');
  });
});
