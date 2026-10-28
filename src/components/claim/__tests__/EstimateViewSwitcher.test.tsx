import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { EstimateViewSwitcher, parseEstimateLabel } from '../EstimateViewSwitcher';
import { EstimateTallyBanner } from '../EstimateTallyBanner';
import { createAssessmentRow } from '@/lib/calculations';

describe('EstimateViewSwitcher', () => {
  it('parses estimate label cleanly', () => {
    expect(parseEstimateLabel('Pawar Motors-EST100-2024-01-01')).toBe('Pawar Motors #EST100');
    expect(parseEstimateLabel('')).toBe('Manual / Untagged');
  });

  it('renders nothing when rows have only 1 estimate or none', () => {
    const rows = [
      createAssessmentRow('parts', { particulars: 'Bumper', estimateId: 'EST1' }),
      createAssessmentRow('parts', { particulars: 'Fender', estimateId: 'EST1' }),
    ];
    const html = renderToStaticMarkup(
      <EstimateViewSwitcher rows={rows} activeEstimateId="all" onSelectEstimate={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders pills when 2 or more distinct estimates exist', () => {
    const rows = [
      createAssessmentRow('parts', { particulars: 'Bumper', estimateId: 'Pawar-101' }),
      createAssessmentRow('parts', { particulars: 'Cabin', estimateId: 'Dhanashree-202' }),
      createAssessmentRow('labour', { particulars: 'Labour', estimateId: undefined }),
    ];
    const html = renderToStaticMarkup(
      <EstimateViewSwitcher rows={rows} activeEstimateId="all" onSelectEstimate={() => {}} />
    );
    expect(html).toContain('All Quotations (3)');
    expect(html).toContain('Pawar #101 (1)');
    expect(html).toContain('Dhanashree #202 (1)');
    expect(html).toContain('Manual / Other (1)');
  });
});

describe('EstimateTallyBanner', () => {
  it('renders nothing when activeEstimateId is all', () => {
    const rows = [
      createAssessmentRow('parts', { particulars: 'Bumper', estimated: 1000, gst: 18, estimateId: 'EST1' }),
    ];
    const html = renderToStaticMarkup(
      <EstimateTallyBanner activeEstimateId="all" rows={rows} onResetView={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders tally totals when activeEstimateId is selected', () => {
    const rows = [
      createAssessmentRow('parts', { particulars: 'Bumper', estimated: 1000, gst: 18, estimateId: 'EST1' }),
      createAssessmentRow('parts', { particulars: 'Cabin', estimated: 5000, gst: 18, estimateId: 'EST2' }),
    ];
    const html = renderToStaticMarkup(
      <EstimateTallyBanner activeEstimateId="EST1" rows={rows} onResetView={() => {}} />
    );
    expect(html).toContain('Filtering:');
    expect(html).toContain('(1 items)');
    // ₹1,000 + 18% = ₹1,180
    expect(html).toContain('1,000');
    expect(html).toContain('1,180');
  });
});
