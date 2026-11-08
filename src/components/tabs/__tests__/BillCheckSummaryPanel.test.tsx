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
    metalTotal: 20000,
    plasticTotal: 10000,
    glassTotal: 5000,
    fiberglassTotal: 0,
    partsBase: 35000,
    partsCGST: 3150,
    partsSGST: 3150,
    partsTotal: 41300,
    labourOnlyBase: 8000,
    labourGST: 1440,
    labourOnlyTotal: 9440,
    paintOnlyTotal: 1260,
    grandTotal: 52000,
    excess: 1500,
    salvage: 2500,
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

  it('renders loss assessment table with parts, labour, paint, tax, and gross assessed loss', () => {
    const html = renderToStaticMarkup(
      <BillCheckSummaryPanel
        bc={dummyBc}
        onBillCheckChange={() => {}}
        summary={dummySummary}
        bcSummary={dummyBcSummary}
        inBillTotal={46000}
        notInBillTotal={6000}
        partialTotal={500}
        fmt={(n) => `₹ ${n}`}
        salvageValue={2500}
        salvageBasis={20000}
        onSalvageChange={() => {}}
        onNavigateToReports={() => {}}
      />
    );

    // Primary Engine: Loss Assessment
    expect(html).toContain('Loss Assessment (Assessed)');
    expect(html).toContain('Sub total: Parts (Taxable)');
    expect(html).toContain('₹ 35000');
    expect(html).toContain('Metal');
    expect(html).toContain('₹ 20000');
    expect(html).toContain('Plastic / Rubber');
    expect(html).toContain('₹ 10000');
    expect(html).toContain('Glass');
    expect(html).toContain('₹ 5000');
    expect(html).toContain('Tax on parts (CGST + SGST)');
    expect(html).toContain('₹ 6300'); // 3150 + 3150
    expect(html).toContain('Final parts assessed amt');
    expect(html).toContain('₹ 41300');
    expect(html).toContain('Sub total: Labour (Taxable)');
    expect(html).toContain('₹ 8000');
    expect(html).toContain('Tax on labour (GST)');
    expect(html).toContain('₹ 1440');
    expect(html).toContain('Final labour assessed amt');
    expect(html).toContain('₹ 9440');
    expect(html).toContain('Painting charges (with GST)');
    expect(html).toContain('₹ 1260');
    expect(html).toContain('Total tax (GST)');
    expect(html).toContain('GROSS ASSESSED LOSS');
    expect(html).toContain('₹ 52000');

    // Deductions & Hero Total Liability
    expect(html).toContain('Less: Policy Excess');
    expect(html).toContain('-₹ 1500');
    expect(html).toContain('TOTAL LIABILITY');
    expect(html).toContain('Net payable under bill check');
    expect(html).toContain('₹ 42000');
    expect(html).toContain('RUPEES FORTY TWO THOUSAND ONLY');

    // Secondary Section (Audit & Reconciliation)
    expect(html).toContain('Audit &amp; Reconciliation');
    expect(html).toContain('Workshop Invoice Total:');
    expect(html).toContain('₹ 50000');
    expect(html).toContain('Verified in Bill:');
    expect(html).toContain('₹ 46000');
    expect(html).toContain('Difference:');
    expect(html).toContain('+₹ 4000');
    expect(html).toContain('Items Not in Bill (Saving):');
    expect(html).toContain('-₹ 6000');
    expect(html).toContain('Capped Variance:');
    expect(html).toContain('-₹ 500');

    // Report Center Link
    expect(html).toContain('View &amp; Print in Report Center');
  });

  it('respects zero policy excess and displays towing charges callout when present', () => {
    const zeroExcessBcSummary = {
      ...dummyBcSummary,
      excess: 0,
      towingCharges: 1000,
    };
    const summaryWithExcess = {
      ...dummySummary,
      excess: 1500, // Should NOT be used because bcSummary.excess is 0!
      towingCharges: 1000,
    };

    const html = renderToStaticMarkup(
      <BillCheckSummaryPanel
        claimId="test-claim-1"
        bc={{
          billNo: 'INV-001',
          billDate: '2026-11-06',
          billTotal: 50000,
          verifiedBySurveyor: true,
        }}
        onBillCheckChange={() => {}}
        summary={summaryWithExcess}
        bcSummary={zeroExcessBcSummary}
        inBillTotal={46000}
        notInBillTotal={6000}
        partialTotal={500}
        fmt={(n) => `₹ ${n}`}
        salvageValue={2500}
        salvageBasis={20000}
        onSalvageChange={() => {}}
        onNavigateToReports={() => {}}
      />
    );

    // Policy excess should strictly be 0, not 1500!
    expect(html).toContain('Less: Policy Excess');
    expect(html).toContain('-₹ 0');
    expect(html).not.toContain('-₹ 1500');

    // Towing charges callout should be rendered
    expect(html).toContain('Includes Towing Charges');
    expect(html).toContain('+ ₹ 1000');
  });
  it('renders Date of Bill Check Report input with value', () => {
    const html = renderToStaticMarkup(
      <BillCheckSummaryPanel
        claimId="test-claim-1"
        bc={{
          billNo: 'INV-001',
          billDate: '2026-11-06',
          billTotal: 50000,
          billCheckDate: '2026-11-08',
          verifiedBySurveyor: true,
        }}
        onBillCheckChange={() => {}}
        summary={dummySummary}
        bcSummary={dummyBcSummary}
        inBillTotal={46000}
        notInBillTotal={6000}
        partialTotal={500}
        fmt={(n) => `₹ ${n}`}
        salvageValue={2500}
        salvageBasis={20000}
        onSalvageChange={() => {}}
        onNavigateToReports={() => {}}
      />
    );

    expect(html).toContain('Date of Bill Check Report');
    expect(html).toContain('value="2026-11-08"');
  });
});
