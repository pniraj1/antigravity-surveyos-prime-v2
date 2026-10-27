import { describe, it, expect } from 'vitest';
import { applyEstimate, applyClaim, parseDate, parseTime, parseAmount, coerceForPath, buildEstimateModePrompt, buildBillModePrompt, applyFinalBill, applyPolicy } from '../aiDataSlice';
import { buildDecision, getConflictFields } from '@/lib/ai/reconciliation';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

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

  it('append adds rows without removing existing estimate rows', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate, 'append');

    // 5 original + 5 supplementary — nothing dropped.
    expect(twice.assessmentRows).toHaveLength(10);
  });

  it('append tags its new rows as supplementary', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate, 'append');

    expect(twice.assessmentRows.filter((r) => r.source === 'estimate')).toHaveLength(5);
    expect(twice.assessmentRows.filter((r) => r.source === 'supplementary')).toHaveLength(5);
  });

  it('replace drops estimate rows but keeps supplementary rows', () => {
    const once = applyEstimate(baseClaim, estimate);
    const withSupp = applyEstimate(once, estimate, 'append');

    // Re-scanning the primary estimate must not discard a supplementary the
    // surveyor has already reviewed.
    const rescanned = applyEstimate(withSupp, estimate, 'replace');

    expect(rescanned.assessmentRows.filter((r) => r.source === 'supplementary')).toHaveLength(5);
    expect(rescanned.assessmentRows.filter((r) => r.source === 'estimate')).toHaveLength(5);
    expect(rescanned.assessmentRows).toHaveLength(10);
  });

  it('defaults to replace when no mode is given', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate);

    expect(twice.assessmentRows).toHaveLength(5);
  });

  it('two appends accumulate — no duplicate detection by design', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate, 'append');
    const thrice = applyEstimate(twice, estimate, 'append');

    expect(thrice.assessmentRows).toHaveLength(15);
  });

  describe('continue', () => {
    const unnumbered = {
      spare_parts: [
        { description: 'Headlamp', taxable_amount: 3000 },
        { description: 'Fender', taxable_amount: 1500 },
      ],
    };
    const row = (srNo: number, source: AssessmentRow['source'], section: AssessmentRow['section'] = 'parts') =>
      ({ id: `r${srNo}${source}`, srNo, source, section, particulars: `Old ${srNo}` }) as unknown as AssessmentRow;

    it('keeps every row, tags new rows estimate, numbers on from the highest estimate serial', () => {
      const claim = {
        ...baseClaim,
        assessmentRows: [row(1, 'estimate'), row(2, 'estimate', 'labour'), row(3, 'estimate', 'paint'), row(9, 'supplementary')],
      } as ClaimData;

      const out = applyEstimate(claim, unnumbered, 'continue');

      expect(out.assessmentRows).toHaveLength(6);
      expect(out.assessmentRows.slice(0, 4)).toEqual(claim.assessmentRows);
      const added = out.assessmentRows.slice(4);
      expect(added.map((r) => r.source)).toEqual(['estimate', 'estimate']);
      expect(added.map((r) => r.srNo)).toEqual([4, 5]);
    });

    it('printed sr_no is kept', () => {
      const claim = { ...baseClaim, assessmentRows: [row(1, 'estimate')] } as ClaimData;
      const out = applyEstimate(claim, { spare_parts: [{ sr_no: 40, description: 'Door', taxable_amount: 100 }] }, 'continue');
      expect(out.assessmentRows[1].srNo).toBe(40);
    });

    it('onto a sheet with only hand-typed rows numbers from 1 and drops nothing', () => {
      const claim = { ...baseClaim, assessmentRows: [row(7, undefined), row(8, undefined)] } as ClaimData;
      const out = applyEstimate(claim, unnumbered, 'continue');
      expect(out.assessmentRows).toHaveLength(4);
      expect(out.assessmentRows.slice(2).map((r) => r.srNo)).toEqual([1, 2]);
    });

    it('replace still drops estimate rows including continuation ones and keeps supplementary/manual', () => {
      const continued = applyEstimate(
        { ...baseClaim, assessmentRows: [row(1, 'estimate'), row(5, 'supplementary'), row(6, undefined)] } as ClaimData,
        unnumbered,
        'continue',
      );
      expect(continued.assessmentRows.filter((r) => r.source === 'estimate')).toHaveLength(3);

      const replaced = applyEstimate(continued, unnumbered, 'replace');

      expect(replaced.assessmentRows.filter((r) => r.source === 'supplementary')).toHaveLength(1);
      expect(replaced.assessmentRows.filter((r) => r.source === undefined)).toHaveLength(1);
      expect(replaced.assessmentRows.filter((r) => r.source === 'estimate')).toHaveLength(2);
      expect(replaced.assessmentRows).toHaveLength(4);
    });
  });
});

/**
 * Whether to ask the surveyor "re-scan or supplementary?" is decided BEFORE the
 * document is read, so the question is a pure function of what is already on
 * the assessment sheet. Asking first means a surveyor who picks the wrong file
 * cancels without paying for an extraction.
 */
function sheet(rows: Partial<AssessmentRow>[]): ClaimData {
  return {
    ...createBlankClaim(),
    assessmentRows: rows.map((r, i) => ({
      id: `r${i}`,
      particulars: 'Item',
      estimated: 0,
      assessed: 0,
      partType: 'metal',
      gst: 18,
      section: 'parts',
      allowed: true,
      ...r,
    })),
  } as unknown as ClaimData;
}

describe('buildEstimateModePrompt', () => {
  it('does not prompt when the assessment sheet is empty', () => {
    expect(buildEstimateModePrompt(sheet([]))).toBeNull();
  });

  it('does not prompt when no claim is loaded', () => {
    expect(buildEstimateModePrompt(null)).toBeNull();
  });

  // The defect this replaces: the gate required a row tagged by a previous AI
  // apply, so a sheet the surveyor had typed in by hand skipped the question
  // entirely and the upload silently replaced their work.
  it('prompts when the sheet holds only hand-added rows', () => {
    const p = buildEstimateModePrompt(sheet([{ source: undefined }, { source: undefined }]));
    expect(p).not.toBeNull();
    expect(p!.rowCount).toBe(2);
  });

  it('prompts when the sheet holds rows from a previous estimate', () => {
    expect(buildEstimateModePrompt(sheet([{ source: 'estimate' }]))).not.toBeNull();
  });

  it('counts every row on the sheet, hand-added ones included', () => {
    const p = buildEstimateModePrompt(sheet([
      { source: 'estimate', estimated: 5000 },
      { source: 'supplementary', estimated: 2000 },
      { source: undefined, estimated: 1000 },
    ]));
    expect(p!.rowCount).toBe(3);
    expect(p!.total).toBe(8000);
  });

  it('treats a missing estimated as zero, never NaN', () => {
    const p = buildEstimateModePrompt(sheet([{ estimated: undefined as never }, { estimated: 500 }]));
    expect(p!.total).toBe(500);
  });
});

describe('buildBillModePrompt', () => {
  it('does not prompt on a claim with no bill read yet', () => {
    expect(buildBillModePrompt(sheet([{}]))).toBeNull();
    expect(buildBillModePrompt(null)).toBeNull();
  });

  it('prompts when a bill number is set', () => {
    const c = { ...sheet([{}]), billCheck: { billNo: 'B1', billDate: '', billTotal: 0 } } as ClaimData;
    expect(buildBillModePrompt(c)).toEqual({ billNo: 'B1', billedRows: 0 });
  });

  it('prompts when any row is already billed', () => {
    expect(buildBillModePrompt(sheet([{ billedAmount: 500 }, {}]))).toEqual({ billNo: '', billedRows: 1 });
  });
});

describe('applyFinalBill continue', () => {
  const page1 = (): ClaimData => ({
    ...sheet([
      { id: 'r1', particulars: 'FRONT BUMPER', billedAmount: 11800, billedTaxable: 10000, billStatus: 'in-bill' },
      { id: 'r2', particulars: 'RADIATOR ASSY', estimated: 6000, assessed: 6000 },
    ]),
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 18880 },
  }) as ClaimData;
  const item = (description: string, amt: number) =>
    ({ description, taxable_amount: amt, total_amount: amt * 1.18, gst_percent: 18 });

  it('keeps bill no., date and total when the page prints none', () => {
    const out = applyFinalBill(page1(), { spare_parts: [item('RADIATOR ASSY', 6000)] }, 'continue');
    expect(out.billCheck).toEqual({ billNo: 'B1', billDate: '2026-08-01', billTotal: 18880 });
  });

  it('takes the printed total from the new page, keeping bill no. and date', () => {
    const out = applyFinalBill(page1(), { total_amount: 50000, spare_parts: [] }, 'continue');
    expect(out.billCheck).toEqual({ billNo: 'B1', billDate: '2026-08-01', billTotal: 50000 });
  });

  it('does not re-match a row that is already billed', () => {
    const out = applyFinalBill(page1(), { spare_parts: [item('FRONT BUMPER', 999)] }, 'continue');
    const r1 = out.assessmentRows.find((r) => r.id === 'r1')!;
    expect(r1.billedAmount).toBe(11800);
    expect(r1.billedTaxable).toBe(10000);
  });

  it('still matches the rows that are not billed yet', () => {
    const out = applyFinalBill(page1(), { spare_parts: [item('RADIATOR ASSY', 6000)] }, 'continue');
    expect(out.assessmentRows.find((r) => r.id === 'r2')!.billStatus).toBe('in-bill');
  });

  it('replace still overwrites the bill header', () => {
    const out = applyFinalBill(page1(), { spare_parts: [] });
    expect(out.billCheck).toEqual({ billNo: '', billDate: '', billTotal: 0 });
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

describe('parseTime — accident times as Indian forms write them', () => {
  it('reads 24-hour and dotted times', () => {
    expect(parseTime('16:30')).toBe('16:30');
    expect(parseTime('16.30 hrs')).toBe('16:30');
    expect(parseTime('1630 hrs')).toBe('16:30');
    expect(parseTime('9:05')).toBe('09:05');
  });

  it('converts am/pm instead of dropping it', () => {
    expect(parseTime('02:30 PM')).toBe('14:30');
    expect(parseTime('4.30 pm')).toBe('16:30');
    expect(parseTime('4 p.m.')).toBe('16:00');
    expect(parseTime('12:15 am')).toBe('00:15');
    expect(parseTime('12:15 pm')).toBe('12:15');
    expect(parseTime('12:00 approx')).toBe('12:00');
  });

  it('never mistakes a dotted date for a time', () => {
    expect(parseTime('12.03.2026')).toBe('');
    expect(parseTime('12/03/2026')).toBe('');
    expect(parseTime('12/03/2026 at 4.30 pm')).toBe('16:30');
    expect(parseTime('2026-03-12T16:30')).toBe('16:30');
  });

  it('returns empty for unreadable or impossible times', () => {
    expect(parseTime('')).toBe('');
    expect(parseTime('evening')).toBe('');
    expect(parseTime('25:00')).toBe('');
  });
});

describe('applyClaim — accident date/time', () => {
  const withDate = (v: string): ClaimData => {
    const c = createBlankClaim() as ClaimData;
    return { ...c, accident: { ...c.accident, dateAndTime: v } };
  };

  it('writes a valid datetime-local from loose formats', () => {
    const out = applyClaim(withDate(''), { date_of_accident: '05/08/2026', time_of_accident: '4.30 pm' });
    expect(out.accident.dateAndTime).toBe('2026-08-05T16:30');
  });

  it('keeps the existing value when the date is unreadable', () => {
    const out = applyClaim(withDate('2026-08-05T10:00'), { date_of_accident: 'N/A', time_of_accident: '' });
    expect(out.accident.dateAndTime).toBe('2026-08-05T10:00');
  });

  it('falls back to a time written inside the date field, else midnight', () => {
    expect(applyClaim(withDate(''), { date_of_accident: '05/08/2026 at 16:30' }).accident.dateAndTime).toBe('2026-08-05T16:30');
    expect(applyClaim(withDate(''), { date_of_accident: '05/08/2026', time_of_accident: 'night' }).accident.dateAndTime).toBe('2026-08-05T00:00');
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

  it('turns a document date into a valid accident datetime-local', () => {
    expect(coerceForPath('accident.dateAndTime', '05/08/2026')).toBe('2026-08-05T00:00');
    expect(coerceForPath('accident.dateAndTime', '05/08/2026 4.30 pm')).toBe('2026-08-05T16:30');
    expect(coerceForPath('accident.dateAndTime', 'N/A')).toBe('');
  });

  it('does not flag a date-vs-datetime difference as a conflict', () => {
    const c = createBlankClaim() as ClaimData;
    const claim = {
      ...c,
      accident: { ...c.accident, dateAndTime: '2026-08-05T16:30' },
      extractedData: { claim: { date_of_accident: '05/08/2026' }, fir: { date_of_accident: '2026-08-05' } },
    } as ClaimData;
    expect(getConflictFields(claim).map((f) => f.path)).not.toContain('accident.dateAndTime');
    const differs = { ...claim, extractedData: { claim: { date_of_accident: '06/08/2026' } } } as ClaimData;
    expect(getConflictFields(differs).map((f) => f.path)).toContain('accident.dateAndTime');
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

describe('applyPolicy — policy check suggestions', () => {
  const base = (): ClaimData => {
    const c = createBlankClaim();
    return { ...c, feeBill: { ...c.feeBill, compulsoryExcess: 0, lessExcess: 0, voluntaryExcess: 0 } };
  };

  it('stores aiRead and fills empty excess, but never sets answers', () => {
    const r = applyPolicy(base(), { nil_depreciation: 'yes', compulsory_excess: '1000', voluntary_excess: '500' });
    expect(r.policyCheck).toEqual({ aiRead: { nilDep: 'yes', compulsoryExcess: 1000, voluntaryExcess: 500 } });
    expect(r.feeBill.compulsoryExcess).toBe(1000);
    expect(r.feeBill.lessExcess).toBe(1000);
    expect(r.feeBill.voluntaryExcess).toBe(500);
  });

  it('does not overwrite typed excess and clears excessConfirmed when AI differs', () => {
    const c = base();
    c.feeBill.compulsoryExcess = 2000;
    c.feeBill.lessExcess = 2000;
    c.policyCheck = { excessConfirmed: true, nilDep: 'no' };
    const r = applyPolicy(c, { compulsory_excess: '1000', nil_depreciation: 'yes' });
    expect(r.feeBill.compulsoryExcess).toBe(2000);
    expect(r.feeBill.lessExcess).toBe(2000);
    expect(r.policyCheck?.excessConfirmed).toBeUndefined();
    expect(r.policyCheck?.nilDep).toBeUndefined();
  });

  it('old claim with a policy read lacking add-on keys still works', () => {
    const r = applyPolicy(base(), { policy_number: 'P1' });
    expect(r.policy.policyNumber).toBe('P1');
    expect(r.policyCheck).toEqual({ aiRead: {} });
  });
});

describe('applyEstimateFixToClaim', () => {
  const sheetRow = (id: string, particulars: string, srNo: number, estimated: number): AssessmentRow => ({
    id, particulars, srNo, estimated, assessed: estimated, partType: 'metal', gst: 18,
    section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, source: 'estimate',
  } as AssessmentRow);

  it('applies only the ticked picks, keeps every row, and marks the claim dirty', async () => {
    const { useClaimStore } = await import('@/stores/claim-store');
    const kept = sheetRow('a', 'Bumper', 1, 1000);
    const added = sheetRow('new', 'Grille', 2, 500);
    const skipped = sheetRow('skip', 'Lamp', 3, 700);
    useClaimStore.setState({
      currentClaim: { ...createBlankClaim('final'), assessmentRows: [kept], updatedAt: 'old' },
      isDirty: false,
    });
    useClaimStore.getState().applyEstimateFixToClaim(
      { missing: [added, skipped], changed: [] },
      { missingIds: ['new'], changedRowIds: [] },
    );
    const s = useClaimStore.getState();
    expect(s.currentClaim!.assessmentRows.map((r) => r.id)).toEqual(['a', 'new']);
    expect(s.isDirty).toBe(true);
    expect(s.currentClaim!.updatedAt).not.toBe('old');
  });

  it('does nothing without a claim', async () => {
    const { useClaimStore } = await import('@/stores/claim-store');
    useClaimStore.setState({ currentClaim: null, isDirty: false });
    useClaimStore.getState().applyEstimateFixToClaim({ missing: [], changed: [] }, { missingIds: [], changedRowIds: [] });
    expect(useClaimStore.getState().isDirty).toBe(false);
  });
});
