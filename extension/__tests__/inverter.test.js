import { describe, it, expect } from 'vitest';
import { correlate, checkFieldMatch, applyTransform, toStandardDate, toNumeric } from '../src/lib/inverter.js';

describe('toStandardDate', () => {
  it('parses YYYY-MM-DD', () => {
    expect(toStandardDate('2026-11-09')).toBe('2026-11-09');
    expect(toStandardDate('2026/11/09')).toBe('2026-11-09');
  });

  it('parses DD/MM/YYYY and DD-MM-YYYY', () => {
    expect(toStandardDate('09/11/2026')).toBe('2026-11-09');
    expect(toStandardDate('9-11-2026')).toBe('2026-11-09');
  });

  it('handles ISO timestamps', () => {
    expect(toStandardDate('2026-11-09T14:30:00Z')).toBe('2026-11-09');
  });

  it('returns null for non-dates', () => {
    expect(toStandardDate('not-a-date')).toBeNull();
    expect(toStandardDate('')).toBeNull();
  });
});

describe('toNumeric', () => {
  it('handles integers, decimals, and commas', () => {
    expect(toNumeric('15000')).toBe(15000);
    expect(toNumeric('15,000.50')).toBe(15000.5);
    expect(toNumeric(1234)).toBe(1234);
  });

  it('returns null for invalid numbers', () => {
    expect(toNumeric('abc')).toBeNull();
    expect(toNumeric('')).toBeNull();
  });
});

describe('checkFieldMatch', () => {
  it('detects exact string matches case-insensitively', () => {
    expect(checkFieldMatch('Rajesh Kumar', 'rajesh kumar')).toBe('exact');
    expect(checkFieldMatch('PUNE', 'Pune')).toBe('exact');
  });

  it('detects alphanumeric matches (ignoring spaces & hyphens)', () => {
    expect(checkFieldMatch('MH 12 AB 1234', 'MH12AB1234')).toBe('alphanumeric');
    expect(checkFieldMatch('MH-12-AB-1234', 'MH12AB1234')).toBe('alphanumeric');
  });

  it('detects numeric equivalence', () => {
    expect(checkFieldMatch('15000', '15000.00')).toBe('numeric');
    expect(checkFieldMatch('15,000', 15000)).toBe('numeric');
  });

  it('detects date format matches', () => {
    expect(checkFieldMatch('09/11/2026', '2026-11-09')).toBe('ddmmyyyy');
    expect(checkFieldMatch('09-11-2026', '2026-11-09')).toBe('dd-mm-yyyy');
  });

  it('detects prefix and suffix for split fields (e.g. DL parts)', () => {
    const fullDl = 'MH1220110001234';
    expect(checkFieldMatch('MH12', fullDl)).toBe('prefix:4');
    expect(checkFieldMatch('1234', fullDl)).toBe('suffix:4');
    expect(checkFieldMatch('2011', fullDl)).toBe('substr:4:4');
  });

  it('returns null when no match', () => {
    expect(checkFieldMatch('Mumbai', 'Pune')).toBeNull();
    expect(checkFieldMatch('999', '12345')).toBeNull();
  });
});

describe('applyTransform', () => {
  it('applies exact and alphanumeric transforms', () => {
    expect(applyTransform('Hello', 'exact')).toBe('Hello');
    expect(applyTransform('MH-12-AB', 'alphanumeric')).toBe('MH12AB');
  });

  it('applies date transforms', () => {
    expect(applyTransform('2026-11-09', 'ddmmyyyy')).toBe('09/11/2026');
    expect(applyTransform('2026-11-09', 'dd-mm-yyyy')).toBe('09-11-2026');
  });

  it('applies prefix, suffix, and substr transforms', () => {
    const dl = 'MH1220110001234';
    expect(applyTransform(dl, 'prefix:4')).toBe('MH12');
    expect(applyTransform(dl, 'suffix:4')).toBe('1234');
    expect(applyTransform(dl, 'substr:4:4')).toBe('2011');
  });
});

describe('correlate', () => {
  const packetFields = {
    regNumber: 'DL01AB1234',
    surveyPlace: 'Pune',
    driverName: 'Rajesh Kumar',
    driverLicenceNo: 'MH1220110001234',
    netSalvage: 1500,
    surveyDate: '2026-11-09',
  };

  it('correlates single exact match with candidate confidence', () => {
    const res = correlate('Pune', packetFields);
    expect(res).toEqual({
      match: true,
      claimField: 'surveyPlace',
      transform: 'exact',
      confidence: 'candidate',
    });
  });

  it('correlates DL prefix to driverLicenceNo when unique', () => {
    const res = correlate('MH12', packetFields);
    expect(res.match).toBe(true);
    if (res.match) {
      expect(res.claimField).toBe('driverLicenceNo');
      expect(res.transform).toBe('prefix:4');
    }
  });

  it('correlates formatted date to surveyDate', () => {
    const res = correlate('09/11/2026', packetFields);
    expect(res).toEqual({
      match: true,
      claimField: 'surveyDate',
      transform: 'ddmmyyyy',
      confidence: 'candidate',
    });
  });

  it('detects ambiguity when multiple fields match same value', () => {
    const ambiguousFields = {
      driverName: 'Rajesh Kumar',
      insuredName: 'Rajesh Kumar',
      city: 'Pune',
    };
    const res = correlate('Rajesh Kumar', ambiguousFields);
    expect(res.match).toBe(false);
    if (!res.match) {
      expect(res.reason).toBe('ambiguous');
      expect(res.candidates).toHaveLength(2);
      expect(res.candidates?.map((c) => c.field)).toEqual(
        expect.arrayContaining(['driverName', 'insuredName'])
      );
    }
  });

  it('returns no_correlation when typed value matches nothing', () => {
    const res = correlate('Unknown Value', packetFields);
    expect(res).toEqual({
      match: false,
      reason: 'no_correlation',
    });
  });
});
