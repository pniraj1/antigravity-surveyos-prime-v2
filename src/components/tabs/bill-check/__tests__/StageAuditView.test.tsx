import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageAuditView } from '../StageAuditView';
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
