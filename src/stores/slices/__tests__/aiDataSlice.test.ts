import { describe, it, expect } from 'vitest';
import { applyEstimate, parseDate, parseAmount, coerceForPath } from '../aiDataSlice';
import { buildDecision, getConflictFields } from '@/lib/ai/reconciliation';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';

const baseClaim = { assessmentRows: [], accident: {} } as unknown as ClaimData;

// Typical dealer estimate where serial numbers RESTART per section
// (parts 1..2, labour 1..2, paint 1) — must NOT interleave.
const estimate = {
  spare_parts: [
    { sr_no: 1, description: 'Front Bumper', taxable_amount: 5000 },
    { sr_no: 2, description: 'Grille', taxable_amount: 2000 },
  ],
  labour_items: [
    { sr_no: 1, description: 'R & R Bumper', taxable_amount: 500 },
    { sr_no: 2, description: 'Denting', taxable_amount: 600 },
  ],
  painting_items: [{ sr_no: 1, description: 'Painting Bumper', taxable_amount: 700 }],
};

describe('applyEstimate', () => {
  it('keeps sections grouped when serial numbers restart per section', () => {
    const claim = applyEstimate(baseClaim, estimate);
    expect(claim.assessmentRows.map((r) => r.section)).toEqual([
      'parts', 'parts', 'labour', 'labour', 'paint',
    ]);
    expect(claim.assessmentRows.map((r) => r.particulars)).toEqual([
      'Front Bumper', 'Grille', 'R & R Bumper', 'Denting', 'Painting Bumper',
    ]);
  });

  it('tags AI-created rows with source: estimate', () => {
    const claim = applyEstimate(baseClaim, estimate);
    expect(claim.assessmentRows.every((r) => r.source === 'estimate')).toBe(true);
  });

  it('re-applying replaces previous AI rows but keeps manual rows', () => {
    const once = applyEstimate(baseClaim, estimate);
    const manualRow = {
      ...once.assessmentRows[0],
      id: 'manual-1',
      source: undefined,
      particulars: 'Towing charges (manual)',
    };
    const withManual = { ...once, assessmentRows: [...once.assessmentRows, manualRow] };

    const twice = applyEstimate(withManual, estimate);

    // 5 fresh AI rows + 1 manual row — no duplicates
    expect(twice.assessmentRows).toHaveLength(6);
    expect(twice.assessmentRows.filter((r) => r.particulars === 'Front Bumper')).toHaveLength(1);
    expect(twice.assessmentRows.some((r) => r.particulars === 'Towing charges (manual)')).toBe(true);
  });
});

/**
 * The strings below are copied verbatim from the two documents that reproduced
 * the extraction bug: a National Insurance GCV policy schedule and an RTO
 * Form 38 Certificate of Fitness.
 *
 * The failure they guard against is specific and silent. Every one of these
 * values feeds an <input type="date"> or <input type="number">, which renders
 * BLANK for anything that is not exactly YYYY-MM-DD / a bare number. While the
 * parser returned its input unchanged on failure, the extracted value reached
 * the store intact — the Evidence Viewer displayed it, the reconciliation
 * dialog listed it — and the Claim Details field still looked empty. Extraction
 * appeared broken when it had actually succeeded.
 */
describe('parseDate — dates wrapped in document prose', () => {
  it('pulls the date out of a policy period phrase', () => {
    expect(parseDate('from 00.00 Hrs of 22/02/2026')).toBe('2026-02-22');
    expect(parseDate('00.00 Hrs of 22/02/2026')).toBe('2026-02-22');
    expect(parseDate('Midnight of 21/02/2027')).toBe('2027-02-21');
    expect(parseDate('to Midnight of 21/02/2027')).toBe('2027-02-21');
  });

  it('pulls the expiry date out of Form 38 phrasing', () => {
    expect(parseDate('The certificate will expire on 16-03-2027')).toBe('2027-03-16');
    expect(parseDate('16-03-2027')).toBe('2027-03-16');
    expect(parseDate('to 16-03-2027')).toBe('2027-03-16');
  });

  it('reads bare Indian dates as DD-MM-YYYY, never US MM/DD/YYYY', () => {
    // The silent-corruption case: both components are <= 12, so a US-order
    // parse yields a real but wrong date instead of failing loudly.
    expect(parseDate('03/04/2026')).toBe('2026-04-03');
    expect(parseDate('05-03-2025')).toBe('2025-03-05');
  });

  it('passes ISO through and resolves named months', () => {
    expect(parseDate('2027-03-16')).toBe('2027-03-16');
    expect(parseDate('2026/02/22')).toBe('2026-02-22');
    expect(parseDate('20-Nov-2019')).toBe('2019-11-20');
    expect(parseDate('16 March 2027')).toBe('2027-03-16');
  });

  it('returns empty string when no date is present — never the raw input', () => {
    // This is the bug itself. Returning the input here leaves a non-ISO string
    // in a field whose type declares `// ISO date`, and the date input renders
    // it as blank.
    expect(parseDate('Not Available')).toBe('');
    expect(parseDate('March 2027')).toBe('');
    expect(parseDate('10:16 AM')).toBe('');
    expect(parseDate('')).toBe('');
  });

  // ponytail: returns the FIRST date found. A caller that passes a whole range
  // ("From 17-03-2025 to 16-03-2027") as validity_to therefore gets the start
  // date, not the expiry. The prompts now instruct the model to return a single
  // bare date, and the surveyor reviews before apply. If ranges show up in
  // practice, split on /\bto\b/ at the call site — parseDate cannot know which
  // end a given field wants.
  it('takes the first date from a range (documented ceiling)', () => {
    expect(parseDate('From 17-03-2025 to 16-03-2027')).toBe('2025-03-17');
  });
});

describe('parseAmount — currency-formatted values', () => {
  it('strips Indian currency formatting to bare digits', () => {
    // "Rs." is the trap: stripping to [\d.] first would read the dot in the
    // prefix as a decimal point and turn this into 0.2.
    expect(parseAmount('Rs.20,00,000')).toBe('2000000');
    expect(parseAmount('₹ 20,00,000')).toBe('2000000');
    expect(parseAmount('₹5,00,000/-')).toBe('500000');
    expect(parseAmount('2000000')).toBe('2000000');
  });

  it('handles weights, where parseFloat silently truncates at the comma', () => {
    // parseFloat('2,500 kg') === 2 — a plausible-looking wrong weight.
    expect(parseAmount('2,500 kg')).toBe('2500');
    expect(parseAmount('35000')).toBe('35000');
  });

  it('returns empty string for values with no number', () => {
    expect(parseAmount('Not Available')).toBe('');
    expect(parseAmount('')).toBe('');
  });
});

/**
 * The Reconciliation Hub is a SECOND way the same raw value reaches the claim.
 * It renders extracted values as one-click buttons, so accepting a suggestion
 * must normalize exactly like the extraction path — otherwise resolving a
 * conflict blanks the field the surveyor was trying to fill.
 */
describe('coerceForPath — Reconciliation Hub writes', () => {
  it('normalizes amounts, keeping policy.idv a numeric string', () => {
    expect(coerceForPath('policy.idv', 'Rs.20,00,000')).toBe('2000000');
  });

  it('normalizes numeric vehicle fields to number | null', () => {
    expect(coerceForPath('vehicle.unladenWeight', '2,500 kg')).toBe(2500);
    expect(coerceForPath('vehicle.grossWeight', '35000')).toBe(35000);
    expect(coerceForPath('vehicle.yearOfManufacture', '2019')).toBe(2019);
    expect(coerceForPath('vehicle.unladenWeight', 'Not Available')).toBeNull();
  });

  it('normalizes date fields out of document prose', () => {
    expect(coerceForPath('vehicle.fitnessValidUpto', 'expire on 16-03-2027')).toBe('2027-03-16');
    expect(coerceForPath('driver.dateOfBirth', '05-03-2025')).toBe('2025-03-05');
  });

  it('leaves free-text fields untouched', () => {
    expect(coerceForPath('policy.insuredName', 'Mr BALVINDER SINGH')).toBe('Mr BALVINDER SINGH');
    expect(coerceForPath('vehicle.registrationNumber', 'MP-09-HH-8879')).toBe('MP-09-HH-8879');
  });
});

describe('buildDecision', () => {
  const claim = {
    ...createBlankClaim(),
    extractedData: {
      rc: { engine_number: 'ABC123' },
      policy: { engine_number: 'ABC124' },
    },
  } as ClaimData;

  it('captures the choice, its source, and the sources seen', () => {
    const d = buildDecision(claim, 'vehicle.engineNumber', 'ABC123', 'rc');

    expect(d.value).toBe('ABC123');
    expect(d.source).toBe('rc');
    expect(d.sourcesSeen).toContain('rc=abc123');
    expect(d.sourcesSeen).toContain('policy=abc124');
    expect(Date.parse(d.decidedAt)).not.toBeNaN();
  });

  it('produces a fingerprint that matches the field it came from', () => {
    const d = buildDecision(claim, 'vehicle.engineNumber', 'ABC123', 'rc');
    const decided = { ...claim, reconciliationDecisions: { 'vehicle.engineNumber': d } };

    // The whole point: a decision built this way removes the field from the Hub.
    expect(getConflictFields(decided).map((f) => f.path))
      .not.toContain('vehicle.engineNumber');
  });
});
