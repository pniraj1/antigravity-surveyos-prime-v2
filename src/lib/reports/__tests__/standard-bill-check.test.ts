import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML, buildStandardPrintDocument } from '../standard-report-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';
import type { SurveyorProfile } from '@/types';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Bonnet Assy.',
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

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    reportNo: 'BC/2026/0417',
    reportDate: '2026-08-14',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { insurerName: 'National Insurance Co. Ltd.', appointingOffice: 'DO-II Pune' },
    accident: { dateAndTime: '2026-06-24T10:00', workshopName: 'Sai Motors', dateOfSurvey: '2026-06-28' },
    driver: { name: 'UNIQUE_DRIVER_NAME' },
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'SM/INV/2026/1188', billDate: '2026-08-09', billTotal: 61832 },
  } as unknown as ClaimData;
}

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

describe('Standard Bill Check report', () => {
  test('is titled as a bill check', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('MOTOR BILL CHECK REPORT');
    expect(html).not.toContain('MOTOR (FINAL) SURVEY REPORT');
  });

  test('section 9 is DETAILS OF BILL CHECK and its money column reads Bill', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('9. DETAILS OF BILL CHECK');
    expect(html).toContain('Bill ₹');
    expect(html).not.toContain('Est. ₹');
  });

  test('section 8 heads its first money column Billed', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('>Billed<');
    expect(html).not.toContain('>Estimated<');
  });

  test('omits driver and cause sections, and carries the invoice instead', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).not.toContain("3. DRIVER'S PARTICULARS");
    expect(html).not.toContain('7. CAUSE &amp; NATURE OF ACCIDENT');
    expect(html).not.toContain('UNIQUE_DRIVER_NAME');
    expect(html).toContain('4. WORKSHOP INVOICE &amp; BILL REFERENCE');
    expect(html).toContain('SM/INV/2026/1188');
  });

  test('keeps insurer and vehicle sections', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('1. INSURER &amp; INSURED DETAILS');
    expect(html).toContain('National Insurance Co. Ltd.');
    expect(html).toContain('2. VEHICLE PARTICULARS');
  });

  test('the billed figure is what prints in the bill column', () => {
    const html = buildStandardFinalSurveyHTML(claim([row({ billedTaxable: 11500 })]), profile, 'bill-check');
    expect(html).toContain('11,500');
  });

  test('a disallowed row is absent from the bill check item table entirely', () => {
    const html = buildStandardFinalSurveyHTML(
      claim([row(), row({ id: 'r-disallowed', particulars: 'UNIQUE_DISALLOWED_PART', allowed: false })]),
      profile, 'bill-check',
    );
    expect(html).not.toContain('UNIQUE_DISALLOWED_PART');
    expect(html).not.toContain('NOT ALLOWED');
  });

  test('a disallowed row still prints in the final report, marked NOT ALLOWED', () => {
    const html = buildStandardFinalSurveyHTML(
      claim([row(), row({ id: 'r-disallowed', particulars: 'UNIQUE_DISALLOWED_PART', allowed: false })]),
      profile, 'final',
    );
    expect(html).toContain('UNIQUE_DISALLOWED_PART');
    expect(html).toContain('NOT ALLOWED');
  });

  test('a disallowed labour row is absent from bill check', () => {
    const html = buildStandardFinalSurveyHTML(
      claim([row({ section: 'labour', particulars: 'UNIQUE_DISALLOWED_LABOUR', allowed: false })]),
      profile, 'bill-check',
    );
    expect(html).not.toContain('UNIQUE_DISALLOWED_LABOUR');
  });

  test('a not-in-bill row carries no liability', () => {
    const kept = buildStandardFinalSurveyHTML(claim([row(), row({ id: 'r2', assessed: 5000, estimated: 5000 })]), profile, 'bill-check');
    const dropped = buildStandardFinalSurveyHTML(
      claim([row(), row({ id: 'r2', assessed: 5000, estimated: 5000, billStatus: 'not-in-bill' })]),
      profile, 'bill-check',
    );
    expect(kept).not.toBe(dropped);
    expect(dropped).toContain('9. DETAILS OF BILL CHECK');
  });

  // The regression guard for the whole design.
  test('billAllowed NEVER reaches the Final Survey Report', () => {
    const c = claim([row({ assessed: 1000, estimated: 1000, billAllowed: 1200, billedTaxable: 1200 })]);
    const final = buildStandardFinalSurveyHTML(c, profile, 'final');
    expect(final).toContain('1,000');
    expect(final).not.toContain('1,200');
  });

  test('defaults to final mode when no mode is given', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile);
    expect(html).toContain('MOTOR (FINAL) SURVEY REPORT');
    expect(html).toContain("3. DRIVER'S PARTICULARS");
  });
});

describe('Bill check print document', () => {
  test('names the window after the bill check, not the final survey', () => {
    const doc = buildStandardPrintDocument(claim([row()]), profile, 'bill-check');
    expect(doc).toContain('Standard Bill Check Report');
    expect(doc).not.toContain('Standard Final Survey Report');
  });

  test('still names the final survey in final mode', () => {
    expect(buildStandardPrintDocument(claim([row()]), profile)).toContain('Standard Final Survey Report');
  });
});

describe('Standard Bill Check — serial numbering', () => {
  test('serials keep the assessment sheet numbering, so the gap shows a rejection', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ id: 'a', particulars: 'FIRST_PART', assessed: 10000 }),
      row({ id: 'b', particulars: 'REJECTED_PART', assessed: 5000, allowed: false }),
      row({ id: 'c', particulars: 'THIRD_PART', assessed: 3000 }),
    ]), profile, 'bill-check');

    const srOf = (name: string) => {
      const at = html.indexOf(name);
      const tr = html.slice(html.lastIndexOf('<tr>', at), at);
      return (tr.match(/>(\d+)</) || [])[1];
    };
    expect(srOf('FIRST_PART')).toBe('1');
    // 2 is the rejected row, absent from this report — the gap is the information
    expect(srOf('THIRD_PART')).toBe('3');
  });

  test('final mode numbering is unchanged by the switch', () => {
    const rows = [
      row({ id: 'a', particulars: 'P1', assessed: 10000 }),
      row({ id: 'b', particulars: 'P2', assessed: 5000, allowed: false }),
      row({ id: 'c', particulars: 'P3', assessed: 3000 }),
    ];
    const html = buildStandardFinalSurveyHTML(claim(rows), profile, 'final');
    for (const [name, sr] of [['P1', '1'], ['P2', '2'], ['P3', '3']] as const) {
      const at = html.indexOf(`>${name}<`);
      const tr = html.slice(html.lastIndexOf('<tr>', at), at);
      expect((tr.match(/>(\d+)</) || [])[1], `${name} should be Sr ${sr}`).toBe(sr);
    }
  });
});

describe('Standard Bill Check — No Bill', () => {
  test('a not-in-bill row says No Bill rather than 0.00', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ]), profile, 'bill-check');
    const at = html.indexOf('GRILLE');
    const tr = html.slice(html.lastIndexOf('<tr>', at), html.indexOf('</tr>', at));
    expect(tr).toContain('No Bill');
  });

  test('No Bill never appears in the final report', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ]), profile, 'final');
    expect(html).not.toContain('No Bill');
  });
});

describe('Standard report — the Estimated column states the garage estimate', () => {
  test('a rejected item still counts, and the column says its basis', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 10000, assessed: 10000 }),
      row({ particulars: 'REJECTED', estimated: 2000, assessed: 0, allowed: false }),
      row({ particulars: 'LAB', section: 'labour', partType: 'labour', estimated: 1000, assessed: 1000 }),
    ]), profile, 'final');

    expect(html).toContain('Estimated (before GST)');
    const sec8 = html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0];
    // Parts estimate is 12,000 — the garage's figure, not the 10,000 allowed
    expect(sec8).toContain('12,000.00');
    // Grand total estimate is 13,000
    expect(sec8).toContain('13,000.00');
  });

  test('section 8 reconciles with the narrative paragraph', () => {
    const c = claim([
      row({ particulars: 'KEPT', estimated: 10000, assessed: 10000 }),
      row({ particulars: 'REJECTED', estimated: 2000, assessed: 0, allowed: false }),
      row({ particulars: 'LAB', section: 'labour', partType: 'labour', estimated: 1000, assessed: 1000 }),
    ]);
    const html = buildStandardFinalSurveyHTML(c, profile, 'final');
    // Narrative quotes the GST-inclusive estimate: 13,000 x 1.18 = 15,340
    expect(html).toContain('15,340.00');
    // Section 8 quotes the same figure before GST
    expect(html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0]).toContain('13,000.00');
  });
});

describe('Standard report — section 9 subtotals', () => {
  test('each section subtotals its Estimate and Assessed columns', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'P1', estimated: 10000, assessed: 9000 }),
      row({ particulars: 'P2', estimated: 2000, assessed: 1500 }),
      row({ particulars: 'L1', section: 'labour', partType: 'labour', estimated: 800, assessed: 700 }),
    ]), profile, 'final');

    const sec9 = html.split('9. DETAILS OF ASSESSMENT')[1].split('</table>')[0];
    const partsSub = sec9.slice(sec9.indexOf('Sub-Total Parts'), sec9.indexOf('LABOUR'));
    expect(partsSub).toContain('12,000.00'); // estimate 10,000 + 2,000
    expect(partsSub).toContain('10,500.00'); // assessed 9,000 + 1,500

    const labSub = sec9.slice(sec9.indexOf('Sub-Total Labour'));
    expect(labSub).toContain('800.00');
    expect(labSub).toContain('700.00');
  });

  test('every row still spans the full column count', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'P1', estimated: 10000, assessed: 9000 }),
      row({ particulars: 'L1', section: 'labour', partType: 'labour', estimated: 800, assessed: 700 }),
      row({ particulars: 'T1', section: 'paint', partType: 'paint', estimated: 900, assessed: 900 }),
    ]), profile, 'final');
    const sec9 = html.split('9. DETAILS OF ASSESSMENT')[1].split('</table>')[0];
    const spans = (tr: string) => [...tr.matchAll(/<t[dh]\b[^>]*>/g)]
      .reduce((n, c) => n + (Number((/colspan="(\d+)"/.exec(c[0]) || [])[1]) || 1), 0);
    const rows_ = sec9.split('<tr').slice(1);
    const counts = new Set(rows_.map(spans));
    expect(counts.size, `rows span differing column counts: ${[...counts].join(', ')}`).toBe(1);
  });
});

describe('Standard Bill Check — billed but rejected', () => {
  test('the Billed total ties to the invoice, with one line explaining the gap', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'SEATCOVERS', estimated: 2400, assessed: 0, allowed: false, billedTaxable: 2400 }),
    ]), profile, 'bill-check');

    const sec8 = html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0];
    expect(sec8).toContain('14,400.00');
    expect(sec8).toContain('billed for items rejected at survey');
    expect(sec8).toContain('2,400.00');
    expect(sec8).toContain('12,000.00');
  });

  test('three rejected items still produce one line', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'R1', estimated: 800, assessed: 0, allowed: false, billedTaxable: 800 }),
      row({ particulars: 'R2', estimated: 800, assessed: 0, allowed: false, billedTaxable: 800 }),
      row({ particulars: 'R3', estimated: 800, assessed: 0, allowed: false, billedTaxable: 800 }),
    ]), profile, 'bill-check');
    const sec8 = html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0];
    const occurrences = sec8.split('billed for items rejected at survey').length - 1;
    expect(occurrences).toBe(1);
    expect(sec8).toContain('2,400.00');
  });

  test('nothing appears when no rejected item was billed', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'REJECTED', estimated: 900, assessed: 0, allowed: false }),
    ]), profile, 'bill-check');
    expect(html).not.toContain('billed for items rejected at survey');
  });

  test('never appears in the final report', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'SEATCOVERS', estimated: 2400, assessed: 0, allowed: false, billedTaxable: 2400 }),
    ]), profile, 'final');
    expect(html).not.toContain('billed for items rejected at survey');
  });
});

describe('the cap and the Final Survey Report', () => {
  test('the cap NEVER reaches the Final Survey Report', () => {
    const c = claim([row({ particulars: 'BONNET', estimated: 1000, assessed: 1000, billedTaxable: 700 })]);
    const final = buildStandardFinalSurveyHTML(c, profile, 'final');
    expect(final).toContain('1,000');
    expect(final).not.toContain('700.00');
  });
});
