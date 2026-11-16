import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckStepper } from '../BillCheckStepper';
import { useClaimStore } from '@/stores/claim-store';
import type { AssessmentRow, ExtraBillItem, ClaimData } from '@/types';

const makeRow = (id: string, pn: string, particulars: string, assessed = 1000, allowed = true): AssessmentRow => ({
  id,
  particulars,
  partNumber: pn,
  estimated: assessed,
  assessed,
  partType: 'plastic',
  gst: 18,
  section: 'parts',
  allowed,
});

const makeExtra = (id: string, pn: string, desc: string, taxable = 1000): ExtraBillItem => ({
  id,
  srNo: 1,
  partNumber: pn,
  description: desc,
  taxableAmount: taxable,
  amount: Math.round(taxable * 1.18),
  gstPercent: 18,
  section: 'parts',
  source: 'final-bill',
});

describe('BillCheckStepper', () => {
  beforeEach(() => {
    useClaimStore.setState({
      activeTallyStage: 1,
      currentClaim: {
        id: 'claim-1',
        assessmentRows: [],
        extraBillItems: [],
      } as unknown as ClaimData,
    });
  });

  it('renders all 4 stages with correct labels and icons', () => {
    const html = renderToStaticMarkup(<BillCheckStepper activeStage={1} />);

    expect(html).toContain('Stage 1:');
    expect(html).toContain('Part Numbers');
    expect(html).toContain('Stage 2:');
    expect(html).toContain('Name &amp; Price');
    expect(html).toContain('Stage 3:');
    expect(html).toContain('Ask AI');
    expect(html).toContain('Stage 4:');
    expect(html).toContain('Disallowed &amp; Tally');
    expect(html).toContain('Show Full Grid');
  });

  it('applies Brand Orange design system to the active stage and Slate to default stages', () => {
    const html = renderToStaticMarkup(<BillCheckStepper activeStage={1} />);

    // Stage 1 is active -> primary orange class
    expect(html).toContain('bg-primary text-white');
    // Default stages have slate styles
    expect(html).toContain('text-slate-700');
  });

  it('applies Emerald design system to confirmed stages', () => {
    // When activeStage is 3, Stage 1 and 2 should be confirmed (emerald)
    const html = renderToStaticMarkup(<BillCheckStepper activeStage={3} />);

    expect(html).toContain('bg-emerald-50 text-emerald-800');
  });

  it('displays custom stage counts when provided via props', () => {
    const customCounts = {
      stage1: 7,
      stage2: 4,
      stage3: 2,
      stage4: 5,
    };

    const html = renderToStaticMarkup(
      <BillCheckStepper activeStage={1} stageCounts={customCounts} />
    );

    expect(html).toContain('7');
    expect(html).toContain('4');
    expect(html).toContain('2');
    expect(html).toContain('5');
  });

  it('computes live counts dynamically from claim data', () => {
    const rows = [
      makeRow('r1', '52119-0K930', 'FRONT BUMPER', 4000),
      makeRow('r2', '', 'ORVM ASSY RH', 1500),
      makeRow('r3', '', 'SUSPENSION ARM', 800, false), // disallowed
    ];
    const extras = [
      makeExtra('e1', '52119-0K930', 'BUMPER FRONT', 4000),
      makeExtra('e2', '', 'REAR VIEW MIRROR RH', 1500),
    ];

    useClaimStore.setState({
      currentClaim: {
        id: 'claim-1',
        assessmentRows: rows,
        extraBillItems: extras,
      } as unknown as ClaimData,
    });

    const html = renderToStaticMarkup(<BillCheckStepper />);

    // Stage 1 should count the part number match (52119-0K930)
    expect(html).toContain('aria-label="1 items in Part Numbers"');
    // Stage 2 should count the mirror match
    expect(html).toContain('aria-label="1 items in Name &amp; Price"');
  });

  it('renders accessible buttons with min 44px touch targets', () => {
    const html = renderToStaticMarkup(<BillCheckStepper activeStage={1} />);

    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tablist"');
  });

  it('indicates active state when in grid mode', () => {
    const html = renderToStaticMarkup(<BillCheckStepper activeStage="grid" />);

    // Show Full Grid button should be active with blue style
    expect(html).toContain('aria-pressed="true"');
  });
});
