import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createClaimSlice, type ClaimSlice } from '../claimSlice';
import { createBlankClaim } from '@/types';
import type { AssessmentRow } from '@/types/assessment';
import { isFromBill, uploadLabels, switchPrompt, rowsLostOnSwitch } from '@/lib/reports/bill-check-mode';
import { statusOptions } from '@/components/tabs/bill-check/config';
import { assessmentUploadDocType } from '@/lib/documents/upload-doc-type';
import { buildUIICBillCheckHTML } from '@/lib/reports/uiic-final-builder';
import { buildStandardBillCheckHTML } from '@/lib/reports/standard-report-builder';

// Audit of the Final bill / Estimate switch (setBillCheckUpload). Each `it` is one
// check from the audit list: what must change, what must NOT change.

const row = (over: Partial<AssessmentRow> = {}): AssessmentRow =>
  ({ id: 'p1', particulars: 'Door', section: 'parts', allowed: true, estimated: 1000, gst: 18, assessed: 900,
     remarks: 'surveyor note', depOverride: 10, partType: 'metal', ...over }) as AssessmentRow;

function seed(over: Record<string, unknown> = {}) {
  const store = create<ClaimSlice>()(createClaimSlice);
  store.setState({
    currentClaim: {
      ...createBlankClaim('final'),
      assessmentRows: [
        row({ refSrNo: '4', refStatus: 'clean', estimateAmount: 77 }),
        row({ id: 'p2', allowed: false, particulars: 'Mirror', estimated: 500, assessed: 0 }),
        row({ id: 'l1', section: 'labour', particulars: 'Fit', estimated: 200, assessed: 200, partType: undefined }),
      ],
      extractedData: { estimate: { bill_number: 'B-7', estimate_date: '2026-11-01', gross_amount: 2500 } },
      extraBillItems: [{ id: 'x', amount: 10, taxableAmount: 8 } as never],
      billCheck: { billNo: '', billDate: '', billTotal: 0, baseDocument: 'estimate', verifiedBySurveyor: true, estimateHeads: { metal: 1 } as never },
      ...over,
    },
  });
  return store;
}
const claim = (s: ReturnType<typeof seed>) => s.getState().currentClaim!;

describe('A. state when the claim becomes "made from the final bill" (button: Estimate)', () => {
  const s = seed();
  s.getState().setBillCheckUpload('estimate');
  const c = claim(s);
  const [p1, p2, l1] = c.assessmentRows;

  it('A1 mode flips to from-bill', () => expect(isFromBill(c)).toBe(true));
  it('A2 allowed rows are billed at their own figures, status In Bill', () => {
    expect(p1).toMatchObject({ billedTaxable: 1000, billedAmount: 1180, billStatus: 'in-bill' });
    expect(l1).toMatchObject({ billedTaxable: 200, billedAmount: 236, billStatus: 'in-bill' });
  });
  it('A3 a disallowed row is not billed', () => expect(p2.billedAmount).toBeUndefined());
  it("A4 surveyor's work survives: assessed, allowed, remarks, dep override", () => {
    expect(p1).toMatchObject({ assessed: 900, allowed: true, remarks: 'surveyor note', depOverride: 10 });
    expect(p2).toMatchObject({ allowed: false, assessed: 0 });
  });
  it('A5 item-number links to the other document are cleared', () =>
    expect([p1.refSrNo, p1.refStatus, p1.refMatch]).toEqual([undefined, undefined, undefined]));
  it('A6 old comparison data goes: estimateAmount, extra lines, estimate heads', () => {
    expect(p1.estimateAmount).toBeUndefined();
    expect(c.extraBillItems).toEqual([]);
    expect(c.billCheck.estimateHeads).toBeUndefined();
  });
  it('A7 bill header filled from the read and marked unverified', () => {
    expect(c.billCheck).toMatchObject({ billNo: 'B-7', billDate: '2026-11-01', billTotal: 2500, verifiedBySurveyor: false });
  });
  it('A8 the extracted document itself is kept', () => expect(c.extractedData?.estimate).toBeTruthy());
});

describe('B. state when switched back to "made from the estimate" (button: Final bill)', () => {
  const s = seed();
  s.getState().setBillCheckUpload('estimate');
  const hdr = claim(s).billCheck;
  s.getState().setBillCheckUpload('final-bill');
  const c = claim(s);
  const [p1, p2] = c.assessmentRows;

  it('B1 mode flips back', () => expect(isFromBill(c)).toBe(false));
  it('B2 self-billed figures cleared on allowed rows, status Pending', () =>
    expect(p1).toMatchObject({ billedTaxable: undefined, billedAmount: undefined, billStatus: 'pending' }));
  it('B3 refs cleared', () => expect(p1.refSrNo).toBeUndefined());
  it('B4 assessed / allowed / remarks / dep override unchanged after a round trip', () => {
    expect(p1).toMatchObject({ assessed: 900, allowed: true, remarks: 'surveyor note', depOverride: 10 });
    expect(p2).toMatchObject({ allowed: false });
  });
  it('B5 bill header is left as it was (not wiped)', () => expect(c.billCheck.billNo).toBe(hdr.billNo));
});

describe('C. titles that must follow the mode', () => {
  it('C1 uploadLabels: from-bill', () =>
    expect(uploadLabels({ billCheck: { baseDocument: 'final-bill' } })).toEqual({
      doc: 'Estimate', amount: 'Estimated', itemNo: 'Est. Item No.', base: 'Billed', comparison: 'Bill vs assessment comparison' }));
  it('C2 uploadLabels: estimate-based', () =>
    expect(uploadLabels({ billCheck: { baseDocument: 'estimate' } })).toEqual({
      doc: 'Workshop bill', amount: 'Billed', itemNo: 'Bill Item No.', base: 'Estimate', comparison: 'Estimate vs assessment comparison' }));
  it('C3 status dropdown wording', () => {
    expect(statusOptions(true).map(o => o.label)).toEqual(['Pending', 'In Estimate ✓', 'Not in Estimate ✗']);
    expect(statusOptions(false).map(o => o.label)).toEqual(['Pending', 'In Bill ✓', 'Not in Bill ✗']);
  });
  it('C4 confirm text names what is lost, in both directions', () => {
    const s = seed();
    expect(switchPrompt(claim(s), 'estimate')).toMatch(/Switch to Estimate\?.*3 items|Switch to Estimate\?/);
    s.getState().setBillCheckUpload('estimate');
    expect(switchPrompt(claim(s), 'final-bill')).toMatch(/Switch to Final bill\?/);
    expect(switchPrompt(claim(s), 'estimate')).toBeNull();   // already that mode: no prompt
  });
});

describe('D. printed reports follow the mode', () => {
  const html = (fn: typeof buildUIICBillCheckHTML, fromBill: boolean) => {
    const s = seed();
    if (fromBill) s.getState().setBillCheckUpload('estimate');
    return fn(claim(s), null);
  };
  it('D1 UIIC Bill Check: reference column title', () => {
    expect(html(buildUIICBillCheckHTML, true)).toContain('Est. No.');
    expect(html(buildUIICBillCheckHTML, false)).toContain('Bill No.');
    expect(html(buildUIICBillCheckHTML, false)).not.toContain('Est. No.');
  });
  it('D2 Standard Bill Check: reference column title', () => {
    expect(html(buildStandardBillCheckHTML, true)).toContain('Est. No.');
    expect(html(buildStandardBillCheckHTML, false)).toContain('Bill No.');
    expect(html(buildStandardBillCheckHTML, false)).not.toContain('Est. No.');
  });
});

describe('E. other things the switch touches', () => {
  it('E1 later uploads are filed under the right type', () => {
    const s = seed();
    expect(assessmentUploadDocType(claim(s))).toBe('estimate');
    s.getState().setBillCheckUpload('estimate');
    expect(assessmentUploadDocType(claim(s))).toBe('invoice');
  });
  it('E2 the confirm counts rows that lose figures', () => expect(rowsLostOnSwitch(claim(seed()), 'estimate')).toBeGreaterThan(0));
});

describe('F. gaps fixed after the audit', () => {
  const custom = { billNo: '', billDate: '', billTotal: 0, baseDocument: 'estimate' as const, refColumnTitle: 'Custom Ref' };
  const summary = (html: string) => {
    const i = html.indexOf('>Estimated</th>');
    return html.slice(i, html.indexOf('NET ASSESSED LOSS', i)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  };

  it('F1 a custom reference-column title is dropped when the mode changes', () => {
    const s = seed({ billCheck: custom });
    s.getState().setBillCheckUpload('estimate');
    expect(claim(s).billCheck.refColumnTitle).toBeUndefined();
    expect(buildStandardBillCheckHTML(claim(s), null)).toContain('Est. No.');
    expect(buildStandardBillCheckHTML(claim(s), null)).not.toContain('Custom Ref');
  });
  it('F2 …and kept when the switch does not change the mode', () => {
    const s = seed({ billCheck: { ...custom, baseDocument: 'final-bill' as const } });
    s.getState().setBillCheckUpload('estimate');   // already from-bill
    expect(claim(s).billCheck.refColumnTitle).toBe('Custom Ref');
  });
  it('F3 UIIC Bill Check: after switching to from-bill with no estimate, Estimated prints a dash, not the bill', () => {
    const s = seed();
    s.getState().setBillCheckUpload('estimate');
    const t = summary(buildUIICBillCheckHTML(claim(s), null));
    expect(t).toContain('–');
    expect(t).not.toContain('1500.00');   // the bill's figures (parts 1000 + disallowed 500) must not sit under "Estimated"
    expect(t).not.toContain('1700.00');
    expect(t).toMatch(/Spare Parts – [\d.]+ [\d.]+/);   // dash under Estimated; Assessed and Incl. GST still print numbers
  });
  it('F4 UIIC Bill Check: confirmed estimate heads still print', () => {
    const s = seed();
    s.getState().setBillCheckUpload('estimate');
    s.getState().updateBillCheck({ estimateHeads: { metal: 850, plastic: 0, glass: 0, fiberglass: 0, labour: 0, paint: 0 } });
    expect(summary(buildUIICBillCheckHTML(claim(s), null))).toContain('850.00');
  });
  it('F5 UIIC Bill Check: an estimate-based claim still prints its estimate figures', () =>
    expect(summary(buildUIICBillCheckHTML(claim(seed()), null))).toContain('1500.00'));
});
