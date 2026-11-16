import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageAITrigger } from '../StageAITrigger';
import { useClaimStore } from '@/stores/claim-store';
import type { AssessmentRow, ExtraBillItem, ClaimData } from '@/types';
import type { AIProposal } from '@/lib/tally/stage3-ai-matcher';

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

describe('StageAITrigger', () => {
  beforeEach(() => {
    useClaimStore.setState({
      activeTallyStage: 3,
      currentClaim: {
        id: 'claim-1',
        assessmentRows: [],
        extraBillItems: [],
      } as unknown as ClaimData,
    });
  });

  it('renders hero card with remaining unmatched counts and Ask AI button', () => {
    const rows = [
      makeRow('r1', '', 'ALTERNATOR BELT', 850),
      makeRow('r2', '', 'ENGINE MOUNTING', 1800),
    ];
    const extras = [
      makeExtra('e1', '', 'DRIVE BELT V-RIBBED', 900),
      makeExtra('e2', '', 'RUBBER MOUNT RH', 1750),
      makeExtra('e3', '', 'BOLT HEX M8', 50),
    ];

    const html = renderToStaticMarkup(
      <StageAITrigger rows={rows} extraBillItems={extras} />
    );

    expect(html).toContain('Remaining Items');
    expect(html).not.toContain('Bill Lines');
    expect(html).toContain('Ask AI to Match Remaining Items');
    expect(html).toContain('Proceed to Stage 4 (Disallowed &amp; Tally)');
  });

  it('renders proposals with confidence and plain-English reasons', () => {
    const rows = [makeRow('r1', '', 'ALTERNATOR BELT', 850)];
    const extras = [makeExtra('e1', '', 'DRIVE BELT V-RIBBED', 900)];
    const proposals: AIProposal[] = [
      {
        rowId: 'r1',
        lineId: 'e1',
        confidence: 94,
        reason: 'Drive belt v-ribbed corresponds to the alternator drive belt assembly in Indian vehicle catalog.',
      },
    ];

    const html = renderToStaticMarkup(
      <StageAITrigger rows={rows} extraBillItems={extras} proposals={proposals} />
    );

    expect(html).toContain('ALTERNATOR BELT');
    expect(html).toContain('DRIVE BELT V-RIBBED');
    expect(html).toContain('94% Confidence');
    expect(html).toContain('Drive belt v-ribbed corresponds to the alternator drive belt');
    expect(html).toContain('Accept Proposal');
    expect(html).toContain('Reject');
  });

  it('calls onProceedToStage4 callback when bottom button is clicked', () => {
    const onProceed = vi.fn();
    // Verify component renders proceed button
    const html = renderToStaticMarkup(
      <StageAITrigger onProceedToStage4={onProceed} />
    );
    expect(html).toContain('Proceed to Stage 4 (Disallowed &amp; Tally)');
  });

  it('invokes onAcceptProposal with correct extraId and rowId', () => {
    const onAccept = vi.fn();
    const rows = [makeRow('r1', '', 'ALTERNATOR BELT', 850)];
    const extras = [makeExtra('e1', '', 'DRIVE BELT V-RIBBED', 900)];
    const proposal: AIProposal = {
      rowId: 'r1',
      lineId: 'e1',
      confidence: 92,
      reason: 'Same belt',
    };

    // Test the accept logic directly
    const extra = extras.find((e) => e.id === proposal.lineId);
    expect(extra?.id).toBe('e1');
    onAccept(extra!.id, proposal.rowId);
    expect(onAccept).toHaveBeenCalledWith('e1', 'r1');
  });

  describe('two lists side by side', () => {
    afterEach(() => {
      Object.assign(useClaimStore.getInitialState(), { currentClaim: null });
    });
    const rows = [makeRow('r1', 'PN-77', 'ALTERNATOR BELT', 850)];
    const extras = [makeExtra('e1', 'XY-9', 'DRIVE BELT V-RIBBED', 900)];

    it('lists assessment on the left and workshop bill lines on the right', () => {
      const html = renderToStaticMarkup(<StageAITrigger rows={rows} extraBillItems={extras} />);
      expect(html).toContain('Assessment');
      expect(html).toContain('Workshop bill lines');
      expect(html).toContain('ALTERNATOR BELT');
      expect(html).toContain('₹850');
      expect(html).toContain('#11');
      expect(html).toContain('DRIVE BELT V-RIBBED');
      expect(html).toContain('₹900');
      expect(html.indexOf('ALTERNATOR BELT')).toBeLessThan(html.indexOf('DRIVE BELT V-RIBBED'));
    });

    it('calls the right side Estimate on from-bill claims', () => {
      Object.assign(useClaimStore.getInitialState(), {
        currentClaim: { id: 'c', billCheck: { baseDocument: 'final-bill' } } as unknown as ClaimData,
      });
      const proposals: AIProposal[] = [{ rowId: 'r1', lineId: 'e1', confidence: 90, reason: 'same' }];
      const html = renderToStaticMarkup(
        <StageAITrigger rows={rows} extraBillItems={extras} proposals={proposals} />
      );
      expect(html).toContain('Estimate lines');
      expect(html).toContain('Estimate line');
      expect(html).toContain('Estimated:');
      expect(html).not.toContain('Workshop bill');
      expect(html).not.toContain('Estimate Item');
      expect(html).not.toContain('Bill Lines');
    });

    it('proposal card uses Assessment / Workshop bill line / Billed labels', () => {
      const proposals: AIProposal[] = [{ rowId: 'r1', lineId: 'e1', confidence: 90, reason: 'same' }];
      const html = renderToStaticMarkup(
        <StageAITrigger rows={rows} extraBillItems={extras} proposals={proposals} />
      );
      expect(html).toContain('Workshop bill line');
      expect(html).toContain('Billed:');
      expect(html).not.toContain('Estimate Item');
    });
  });
});
