import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageReviewTable, type ReviewPair } from '../StageReviewTable';
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
      expect(html).toContain('PN: 52119-0K930');
      expect(html).toContain('₹4,200');

      // Bill Item
      expect(html).toContain('BUMPER FRONT');
      expect(html).toContain('Bill #11');
      expect(html).toContain('₹4,150');

      // Part Number Badge
      expect(html).toContain('Exact Part No.');

      // Price Delta: 4150 - 4200 = -50 (Cheaper)
      expect(html).toContain('-₹50');
      expect(html).toContain('Cheaper');

      // Action buttons
      expect(html).toContain('Keep');
      expect(html).toContain('Unlink');
      expect(html).toContain('Not Billed');
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

      expect(html).toContain('Verified');
      expect(html).toContain('₹0 (Exact)');
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

      expect(html).toContain('Stage 2: Name &amp; Price');
      expect(html).toContain('ORVM ASSY RH');
      expect(html).toContain('REAR VIEW MIRROR RH');

      // Semantic Reason badge
      expect(html).toContain('Synonym match');

      // Price Delta: 3950 - 3800 = +150 (Higher)
      expect(html).toContain('+₹150');
      expect(html).toContain('Higher');
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

      expect(html).toContain('Confirm Stage Matches &amp; Proceed to Next Stage');
      expect(html).toContain('Push Unmatched to Stage 2');
      expect(html).toContain('1 unconfirmed match');
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

      expect(html).toContain('All 1 Stage 1 pairs confirmed!');
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

      expect(html).toContain('Keep');
      expect(html).toContain('Unlink');
      expect(html).toContain('Not Billed');
      expect(html).toContain('Confirm Stage Matches &amp; Proceed to Next Stage');
    });
  });
});
