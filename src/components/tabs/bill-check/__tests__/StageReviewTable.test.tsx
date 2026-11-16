import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageReviewTable, keepUpdates, pairsToKeep, type ReviewPair } from '../StageReviewTable';
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

describe('StageReviewTable', () => {
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

  describe('Stage 1 (Part Numbers)', () => {
    it('renders matched pairs side-by-side with Part Number badges and price deltas', () => {
      const rows = [
        makeRow('r1', '52119-0K930', 'FRONT BUMPER', 4200),
      ];
      const extras = [
        makeExtra('e1', '52119-0K930', 'BUMPER FRONT', 4150),
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={1} rows={rows} extraBillItems={extras} />
      );

      // Assessment Row
      expect(html).toContain('FRONT BUMPER');
      expect(html).toContain('52119-0K930');
      expect(html).toContain('₹4,200');

      // Bill Item
      expect(html).toContain('BUMPER FRONT');
      expect(html).toContain('#11');
      expect(html).toContain('₹4,150');

      // Same part number on both sides: printed once, not repeated on the bill side.
      expect(html.split('52119-0K930').length - 1).toBe(1);

      // Price difference: 4150 - 4200 = -50, a plain green number
      expect(html).toContain('−₹50');
      expect(html).toContain('text-emerald-700');

      // Quiet actions, no per-row Keep
      expect(html).toContain('Unlink');
      expect(html).toContain('Not billed');
      expect(html).not.toContain('>Keep<');
      expect(html).toContain('1</span> to review');
    });

    it('folds exact matches (same part number and price) away from the review list', () => {
      const rows = [makeRow('r1', 'PN-1', 'WIPER BLADE', 598), makeRow('r2', 'PN-2', 'BELT', 713)];
      const extras = [makeExtra('e1', 'PN-1', 'WIPER BLADE', 598), makeExtra('e2', 'PN-2', 'BELT', 700)];

      const html = renderToStaticMarkup(<StageReviewTable stage={1} rows={rows} extraBillItems={extras} />);

      expect(html).toContain('1</span> to review');
      expect(html).toContain('1 exact match — same part number and price');
      expect(html).toContain('<details');
    });

    it('offers a Parts / Labour / Paint filter when sections are mixed', () => {
      const rows = [
        makeRow('r1', 'PN-1', 'WIPER BLADE', 598),
        makeRow('r2', 'LAB-7', 'BUMPER R/R', 500, { section: 'labour' }),
      ];
      const extras = [
        makeExtra('e1', 'PN-1', 'WIPER BLADE', 598),
        { ...makeExtra('e2', 'LAB-7', 'BUMPER R/R', 500), section: 'labour' as const },
      ];

      const html = renderToStaticMarkup(<StageReviewTable stage={1} rows={rows} extraBillItems={extras} />);

      expect(html).toContain('aria-label="Filter by section"');
      expect(html).toContain('labour 1</button>');
    });

    it('renders Verified badge when pair has already been verified', () => {
      const rows = [
        makeRow('r1', '52119-0K930', 'FRONT BUMPER', 4000, {
          billVerified: true,
          billedTaxable: 4000,
          billStatus: 'in-bill',
          refMatch: {
            bill: makeExtra('e1', '52119-0K930', 'BUMPER FRONT', 4000),
            score: 100,
            reasons: ['Part no. matches'],
          },
        }),
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={1} rows={rows} extraBillItems={[]} />
      );

      expect(html).toContain('Kept');
      expect(html).toContain('1 exact match');
    });

    it('shows the bill part number when it is written differently', () => {
      const rows = [
        makeRow('r1', '52119-0K-930', 'FRONT BUMPER', 4200),
      ];
      const extras = [
        makeExtra('e1', '521190K930', 'BUMPER FRONT', 4150),
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={1} rows={rows} extraBillItems={extras} />
      );

      expect(html).toContain('52119-0K-930');
      expect(html).toContain('521190K930');
    });

    it('renders empty state when no Part Number matches exist', () => {
      const rows = [makeRow('r1', '', 'UNNUMBERED PART', 1000)];
      const extras = [makeExtra('e1', '', 'WORKSHOP LABOUR', 1000)];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={1} rows={rows} extraBillItems={extras} />
      );

      expect(html).toContain('No Stage 1 Matches Found');
      expect(html).toContain('Proceed to Stage 2');
    });
  });

  describe('Stage 2 (Name & Price)', () => {
    it('renders semantic matches with Semantic Reason badge and divergence delta', () => {
      const rows = [
        makeRow('r1', '', 'ORVM ASSY RH', 3800),
      ];
      const extras = [
        makeExtra('e1', '', 'REAR VIEW MIRROR RH', 3950),
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={2} rows={rows} extraBillItems={extras} />
      );

      expect(html).toContain('Stage 2 Review: Name &amp; Price');
      expect(html).toContain('ORVM ASSY RH');
      expect(html).toContain('REAR VIEW MIRROR RH');

      // Why it matched, as plain text
      expect(html).toContain('Synonym match');

      // Price difference: 3950 - 3800 = +150, amber
      expect(html).toContain('+₹150');
      expect(html).toContain('text-amber-700');
    });

    it('renders negative delta with orange price delta badge in Stage 2', () => {
      const rows = [
        makeRow('r1', '', 'ORVM ASSY RH', 4000),
      ];
      const extras = [
        makeExtra('e1', '', 'REAR VIEW MIRROR RH', 3800),
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={2} rows={rows} extraBillItems={extras} />
      );

      expect(html).toContain('−₹200');
      expect(html).toContain('Bill is cheaper than assessed');
    });
  });

  describe('Stage Action Bar and Navigation', () => {
    it('renders bottom action bar with Confirm and Push buttons when matches exist', () => {
      const pairs: ReviewPair[] = [
        {
          row: makeRow('r1', 'PN-101', 'HEADLAMP LH', 2500),
          billItem: {
            srNo: 1,
            description: 'HEAD LIGHT LH',
            partNumber: 'PN-101',
            taxableAmount: 2500,
            totalAmount: 2950,
          },
          stage: 1,
          matchBadge: { text: 'Exact Part No.', type: 'exact' },
          priceDelta: 0,
          isVerified: false,
        },
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={1} pairs={pairs} />
      );

      expect(html).toContain('Keep all 1 and go to Stage 2');
      expect(html).toContain('Skip to Stage 2');
      expect(html).toContain('sticky bottom-0');
    });

    it('displays full confirmation status when all pairs are verified', () => {
      const pairs: ReviewPair[] = [
        {
          row: makeRow('r1', 'PN-101', 'HEADLAMP LH', 2500),
          billItem: {
            srNo: 1,
            description: 'HEAD LIGHT LH',
            partNumber: 'PN-101',
            taxableAmount: 2500,
            totalAmount: 2950,
          },
          stage: 1,
          matchBadge: { text: 'Exact Part No.', type: 'exact' },
          priceDelta: 0,
          isVerified: true,
        },
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable stage={1} pairs={pairs} />
      );

      expect(html).toContain('1 kept');
    });

    it('renders empty state for Stage 2 when no matches exist', () => {
      const html = renderToStaticMarkup(
        <StageReviewTable stage={2} rows={[]} extraBillItems={[]} />
      );

      expect(html).toContain('No Stage 2 Matches Found');
      expect(html).toContain('Proceed to Stage 3');
    });

    it('handles custom callbacks when passed as props', () => {
      const onKeep = vi.fn();
      const onUnlink = vi.fn();
      const onMarkNotInBill = vi.fn();
      const onConfirmStage = vi.fn();
      const onPushUnmatched = vi.fn();

      const pairs: ReviewPair[] = [
        {
          row: makeRow('r1', 'PN-101', 'HEADLAMP LH', 2500),
          billItem: {
            srNo: 1,
            description: 'HEAD LIGHT LH',
            partNumber: 'PN-101',
            taxableAmount: 2500,
            totalAmount: 2950,
          },
          stage: 1,
          matchBadge: { text: 'Exact Part No.', type: 'exact' },
          priceDelta: 0,
          isVerified: false,
        },
      ];

      const html = renderToStaticMarkup(
        <StageReviewTable
          stage={1}
          pairs={pairs}
          onKeep={onKeep}
          onUnlink={onUnlink}
          onMarkNotInBill={onMarkNotInBill}
          onConfirmStage={onConfirmStage}
          onPushUnmatched={onPushUnmatched}
        />
      );

      expect(html).toContain('Unlink');
      expect(html).toContain('Not billed');
      expect(html).toContain('Keep all');
    });
  });
});

describe('keepUpdates', () => {
  const pair = {
    row: makeRow('r1', 'P1', 'FRONT BUMPER'),
    billItem: { srNo: 7, description: 'FRONT BUMPER', taxableAmount: 900, totalAmount: 1062 },
    stage: 2, matchBadge: { text: 'x', type: 'semantic' }, priceDelta: 0, isVerified: false,
  } as ReviewPair;

  it('from-bill links by refSrNo and leaves billed figures alone', () => {
    const u = keepUpdates(pair, true);
    expect(u).toEqual({ refSrNo: 7, estimateAmount: 900, billVerified: true });
    expect(u).not.toHaveProperty('billedTaxable');
    expect(u).not.toHaveProperty('billedAmount');
    expect(u).not.toHaveProperty('billStatus');
  });
  it('normal claims write the billed figures', () => {
    expect(keepUpdates(pair, false)).toEqual({
      billVerified: true, billStatus: 'in-bill', billedTaxable: 900, billedAmount: 1062,
    });
  });
});

describe('StageReviewTable wording follows the uploaded document', () => {
  const rows = [makeRow('r1', 'PN1', 'FRONT BUMPER', 1000)];
  const extras = [makeExtra('e1', 'PN1', 'FRONT BUMPER', 900)];
  const render = (baseDocument?: string) => {
    // Server render reads the store's initial state, so put the claim under test there.
    Object.assign(useClaimStore.getInitialState(), { currentClaim: { id: 'c', assessmentRows: rows, extraBillItems: extras, billCheck: { baseDocument } } as unknown as ClaimData });
    return renderToStaticMarkup(<StageReviewTable stage={1} rows={rows} extraBillItems={extras} />);
  };
  afterEach(() => { Object.assign(useClaimStore.getInitialState(), { currentClaim: null }); });
  it('from-bill says Estimate / Estimated and a lower figure is amber', () => {
    const html = render('final-bill');
    expect(html).toContain('>Estimate<');
    expect(html).toContain('>Estimated<');
    expect(html).toContain('text-amber-700');
    expect(html).toContain('Estimate is lower than assessed');
  });
  it('normal claim keeps Workshop bill / Billed and emerald', () => {
    const html = render();
    expect(html).toContain('>Workshop bill<');
    expect(html).toContain('>Billed<');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('Bill is cheaper than assessed');
  });
});

describe('pairsToKeep (F4)', () => {
  const pair = (id: string, isVerified = false) => ({
    row: makeRow(id, 'P', 'X'), billItem: { srNo: 1, description: 'X', taxableAmount: 1 },
    stage: 1, matchBadge: { text: 'x', type: 'exact' }, priceDelta: 0, isVerified,
  }) as ReviewPair;
  it('skips dismissed candidates and already-kept pairs', () => {
    const kept = pairsToKeep([pair('a'), pair('b'), pair('c', true)], new Set(['b']));
    expect(kept.map((p) => p.row.id)).toEqual(['a']);
  });
  it('with no dismissals a candidate is still rendered', () => {
    const html = renderToStaticMarkup(
      <StageReviewTable stage={1} rows={[makeRow('r1', 'PN9', 'DOOR', 1000)]} extraBillItems={[makeExtra('e1', 'PN9', 'DOOR', 900)]} />
    );
    expect(html).toContain('DOOR');
    expect(html).toContain('Keep all 1 and go to Stage 2');
  });
});

