import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageAuditView, notInDocUpdates, typedRefUpdates, NOT_IN_ESTIMATE } from '../StageAuditView';
import { useClaimStore } from '@/stores/claim-store';
import type { AssessmentRow, ExtraBillItem, ClaimData } from '@/types';

const makeRow = (
  id: string,
  pn: string,
  particulars: string,
  assessed = 1000,
  extra: Partial<AssessmentRow> = {}
): AssessmentRow => ({
  id,
  srNo: 1,
  particulars,
  partNumber: pn,
  estimated: assessed,
  assessed,
  partType: 'plastic',
  gst: 18,
  section: 'parts',
  allowed: true,
  ...extra,
});

const makeExtra = (
  id: string,
  pn: string,
  desc: string,
  taxable = 1000
): ExtraBillItem => ({
  id,
  srNo: 11,
  partNumber: pn,
  description: desc,
  taxableAmount: taxable,
  amount: Math.round(taxable * 1.18),
  gstPercent: 18,
  section: 'parts',
  source: 'final-bill',
});

describe('StageAuditView', () => {
  beforeEach(() => {
    useClaimStore.setState({
      activeTallyStage: 4,
      currentClaim: {
        id: 'claim-1',
        assessmentRows: [],
        extraBillItems: [],
        billCheck: { billTotal: 11800 },
      } as unknown as ClaimData,
    });
  });

  it('renders Section 1: Disallowed Items Billed by Workshop with red badge, ₹0 liability, and remark', () => {
    const rows = [
      makeRow('r1', 'PN-SUSP', 'SUSPENSION ARM', 0, {
        allowed: false,
        billedTaxable: 800,
        billedAmount: 944,
      }),
    ];

    const html = renderToStaticMarkup(<StageAuditView rows={rows} />);

    expect(html).toContain('Disallowed Items Billed by Workshop');
    expect(html).toContain('SUSPENSION ARM');
    expect(html).toContain('PN-SUSP');
    expect(html).toContain('₹800');
    expect(html).toContain('₹0 Liability');
    expect(html).toContain('border-red-300');
    expect(html).toContain('bg-red-100');
    expect(html).toContain('Workshop claimed ₹800; disallowed at survey.');
  });

  it('renders Section 2: Insurer Savings with mint card, total saved, and mark savings button', () => {
    const rows = [
      makeRow('r1', 'PN-FOG', 'FOG LAMP BEZEL', 1000, {
        allowed: true,
        billedTaxable: undefined,
      }),
      makeRow('r2', 'PN-GRILL', 'FRONT RADIATOR GRILL', 2500, {
        allowed: true,
        billedTaxable: undefined,
      }),
    ];

    const html = renderToStaticMarkup(<StageAuditView rows={rows} />);

    expect(html).toContain('Insurer Savings (Allowed Items Not in Bill)');
    expect(html).toContain('₹3,500'); // 1000 + 2500
    expect(html).toContain('FOG LAMP BEZEL');
    expect(html).toContain('FRONT RADIATOR GRILL');
    expect(html).toContain('Mark All Remaining Allowed as Not in Bill (Saving)');
  });

  it('renders Section 3: Extra Bill Items with Add as Supplementary, Link, and Discard actions', () => {
    const extras = [
      makeExtra('e1', 'PN-MISC', 'WIPER BLADE SET', 600),
    ];

    const html = renderToStaticMarkup(<StageAuditView extraBillItems={extras} />);

    expect(html).toContain('Extra Bill Items (Leftover Invoice Lines)');
    expect(html).toContain('border-amber-300');
    expect(html).toContain('bg-amber-100');
    expect(html).toContain('WIPER BLADE SET');
    expect(html).toContain('Taxable: ₹600');
    expect(html).toContain('+ Add as Supplementary');
    expect(html).toContain('Link ▾');
    expect(html).toContain('Discard');
  });

  it('renders Section 4: Final Reconciliation Seal showing 100% Reconciled when balanced', () => {
    // 10,000 + 18% GST = 11,800 matches invoiceTotal 11,800
    const rows = [
      makeRow('r1', 'PN-1', 'FRONT BUMPER', 10000, {
        allowed: true,
        billedTaxable: 10000,
        gst: 18,
      }),
    ];

    const html = renderToStaticMarkup(
      <StageAuditView rows={rows} invoiceTotal={11800} />
    );

    expect(html).toContain('Final Reconciliation Seal');
    expect(html).toContain('₹11,800');
    expect(html).toContain('₹0.00');
    expect(html).toContain('100% Reconciled — Audit Clean');
  });

  it('renders Reconciliation Gap when invoice total and line total differ', () => {
    const rows = [
      makeRow('r1', 'PN-1', 'FRONT BUMPER', 10000, {
        allowed: true,
        billedTaxable: 10000,
        gst: 18,
      }),
    ];

    const html = renderToStaticMarkup(
      <StageAuditView rows={rows} invoiceTotal={15000} />
    );

    expect(html).toContain('Reconciliation Gap: ₹3200.00');
  });

  it('renders bottom actions for Print and Apply to Assessment Grid & Finish', () => {
    const html = renderToStaticMarkup(<StageAuditView />);

    expect(html).toContain('Print Bill Check Report');
    expect(html).toContain('Apply to Assessment Grid &amp; Finish');
  });
});

describe('StageAuditView from-bill wording', () => {
  // Server render reads the store's initial state, so put the claim under test there.
  const set = (baseDocument?: string) =>
    Object.assign(useClaimStore.getInitialState(), {
      currentClaim: { id: 'c', assessmentRows: [], extraBillItems: [], billCheck: { baseDocument } } as unknown as ClaimData,
    });
  afterEach(() => { Object.assign(useClaimStore.getInitialState(), { currentClaim: null }); });
  it('from-bill renames the sections and hides the saving button', () => {
    set('final-bill');
    const html = renderToStaticMarkup(<StageAuditView />);
    expect(html).toContain('Billed Items Not in Estimate');
    expect(html).toContain('Items on the bill that the estimate did not include.');
    expect(html).toContain('Estimate Lines Not on the Bill');
    expect(html).not.toContain('Mark All Remaining Allowed as Not in Bill');
  });
  it('from-bill lists bill rows the estimate did not include, with no Total Saved (F6)', () => {
    const rows = [
      makeRow('r1', 'PN1', 'TAIL LAMP', 1000, { billedTaxable: 1200 }),
      makeRow('r2', 'PN2', 'FRONT GRILLE', 500, { refSrNo: 4 }),
    ];
    Object.assign(useClaimStore.getInitialState(), {
      currentClaim: { id: 'c', assessmentRows: rows, extraBillItems: [], billCheck: { baseDocument: 'final-bill' } } as unknown as ClaimData,
    });
    const html = renderToStaticMarkup(<StageAuditView />);
    expect(html).toContain('TAIL LAMP');
    expect(html).toContain('₹1,200');
    expect(html).not.toContain('FRONT GRILLE');
    expect(html).not.toContain('Total Saved');
    expect(html).toContain('Estimate lines not matched to any billed item.');
    expect(html).not.toContain('Billed lines not matched to initial assessment');
  });
  it('from-bill with every row found says so (F6)', () => {
    set('final-bill');
    expect(renderToStaticMarkup(<StageAuditView />)).toContain('Every billed item was found in the estimate.');
  });
  it('normal claim keeps the original wording', () => {
    set();
    const html = renderToStaticMarkup(<StageAuditView />);
    expect(html).toContain('Insurer Savings (Allowed Items Not in Bill)');
    expect(html).toContain('Extra Bill Items (Leftover Invoice Lines)');
    expect(html).toContain('Mark All Remaining Allowed as Not in Bill');
    expect(html).toContain('Total Saved');
    expect(html).toContain('No allowed items saved (all allowed items appeared in the bill).');
    expect(html).toContain('Billed lines not matched to initial assessment');
  });
});

describe('StageAuditView unlinked assessed rows', () => {
  afterEach(() => { Object.assign(useClaimStore.getInitialState(), { currentClaim: null }); });
  const setup = (baseDocument?: string) => {
    const rows = [
      makeRow('r1', 'PN-W', 'WIPER BLADE', 500),
      makeRow('r2', 'PN-B', 'BELT', 400, { refSrNo: 3 }),
    ];
    const extras = [{ ...makeExtra('e1', 'PN-X', 'WIPER BLADE ASSY', 450), srNo: 7 }];
    Object.assign(useClaimStore.getInitialState(), {
      currentClaim: { id: 'c', assessmentRows: rows, extraBillItems: extras, billCheck: { baseDocument } } as unknown as ClaimData,
    });
    return renderToStaticMarkup(<StageAuditView />);
  };

  it('notInDocUpdates / typedRefUpdates return the exact patches', () => {
    expect(notInDocUpdates(false)).toEqual({ billStatus: 'not-in-bill', billedTaxable: 0, billedAmount: 0 });
    const fb = notInDocUpdates(true);
    expect(fb).toEqual({ refSrNo: 'Not in estimate', refStatus: 'manual' });
    expect(fb).not.toHaveProperty('billedTaxable');
    expect(fb).not.toHaveProperty('billedAmount');
    expect(fb).not.toHaveProperty('billStatus');
    expect(typedRefUpdates('  12 ')).toEqual({ refSrNo: '12', refStatus: 'manual' });
    expect(typedRefUpdates('   ').refSrNo).toBeUndefined();
  });

  it('from-bill row marked Not in estimate stays in the Summary list, not in unlinked rows (F1)', () => {
    const rows = [makeRow('r1', 'PN1', 'TAIL LAMP', 1000, { billedTaxable: 1200, ...notInDocUpdates(true) })];
    Object.assign(useClaimStore.getInitialState(), {
      currentClaim: { id: 'c', assessmentRows: rows, extraBillItems: [], billCheck: { baseDocument: 'final-bill' } } as unknown as ClaimData,
    });
    expect(NOT_IN_ESTIMATE).toBe('Not in estimate');
    const html = renderToStaticMarkup(<StageAuditView />);
    const first = html.slice(html.indexOf('<section'), html.indexOf('</section>'));
    expect(first).not.toContain('TAIL LAMP');
    const d = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
    expect(d).toContain('TAIL LAMP');
    expect(d).not.toContain('Every billed item was found in the estimate.');
  });
  it('Link to option shows taxable amount (M1)', () => {
    const rows = [makeRow('r1', 'PN-W', 'WIPER BLADE', 500)];
    Object.assign(useClaimStore.getInitialState(), {
      currentClaim: { id: 'c', assessmentRows: rows, extraBillItems: [makeExtra('e1', 'PN-X', 'WIPER ASSY', 1000)], billCheck: {} } as unknown as ClaimData,
    });
    const html = renderToStaticMarkup(<StageAuditView />);
    expect(html).toContain('#11 WIPER ASSY (₹1,000)');
  });

  it('first section lists only unlinked rows with Link to, Not in bill and a ref input', () => {
    const html = setup();
    const first = html.slice(html.indexOf('<section'), html.indexOf('</section>'));
    expect(first).toContain('Assessed rows not linked');
    expect(first).toContain('WIPER BLADE');
    expect(first).not.toContain('BELT');
    expect(first).toContain('Link to');
    expect(first).toContain('#7 WIPER BLADE ASSY');
    expect(first).toContain('Not in bill');
    expect(first).toMatch(/<input[^>]*aria-label="[^"]*ref/);
    expect(first).toContain('Mark All Remaining');
  });

  it('from-bill says Not in estimate and has no Mark All', () => {
    const html = setup('final-bill');
    const first = html.slice(html.indexOf('<section'), html.indexOf('</section>'));
    expect(first).toContain('Not in estimate');
    expect(first).not.toContain('Mark All Remaining');
  });

  it('keeps disallowed, savings and seal inside a collapsed Summary details', () => {
    const html = setup();
    const m = html.match(/<details([^>]*)><summary[^>]*>\s*(?:<[^>]+>)*Summary/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain('open');
    const d = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
    expect(d).toContain('Disallowed Items Billed by Workshop');
    expect(d).toContain('Final Reconciliation Seal');
  });

  it('empty state when everything is linked', () => {
    Object.assign(useClaimStore.getInitialState(), {
      currentClaim: { id: 'c', assessmentRows: [], extraBillItems: [], billCheck: {} } as unknown as ClaimData,
    });
    expect(renderToStaticMarkup(<StageAuditView />)).toContain('Every allowed row is linked.');
  });
});
