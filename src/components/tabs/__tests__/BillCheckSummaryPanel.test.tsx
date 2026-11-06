import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckSummaryPanel } from '../bill-check/BillCheckSummaryPanel';

describe('BillCheckSummaryPanel', () => {
  const dummyBc = {
    billNo: 'INV-101',
    billDate: '2026-11-05',
    billTotal: 50000,
    verifiedBySurveyor: false,
  };

  const dummySummary = {
    grandTotal: 52000,
    netAssessedLoss: 48000,
  };

  const dummyBcSummary = {
    grandTotalAssessed: 52000,
    grandTotalBilled: 46000,
    notInBillTotal: 6000,
    netLiability: 42000,
    excess: 1500,
    salvage: 2500,
  };

  it('renders unverified badge when verifiedBySurveyor is false', () => {
    const html = renderToStaticMarkup(
      <BillCheckSummaryPanel
        bc={dummyBc}
        onBillCheckChange={() => {}}
        summary={dummySummary}
        bcSummary={dummyBcSummary}
        inBillTotal={46000}
        notInBillTotal={6000}
        partialTotal={0}
        fmt={(n) => `₹ ${n}`}
        salvageValue={2500}
        salvageBasis={20000}
        onSalvageChange={() => {}}
      />
    );

    expect(html).toContain('Unverified');
    expect(html).toContain('INV-101');
    expect(html).toContain('₹ 42000');
    expect(html).toContain('FORTY TWO THOUSAND');
  });

  it('renders verified badge when verifiedBySurveyor is true', () => {
    const html = renderToStaticMarkup(
      <BillCheckSummaryPanel
        bc={{ ...dummyBc, verifiedBySurveyor: true, verifiedAt: '2026-11-06T10:00:00Z' }}
        onBillCheckChange={() => {}}
        summary={dummySummary}
        bcSummary={dummyBcSummary}
        inBillTotal={46000}
        notInBillTotal={6000}
        partialTotal={0}
        fmt={(n) => `₹ ${n}`}
        salvageValue={2500}
        salvageBasis={20000}
        onSalvageChange={() => {}}
      />
    );

    expect(html).toContain('Verified');
    expect(html).not.toContain('Unverified');
  });
});
