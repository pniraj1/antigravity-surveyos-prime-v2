import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OPTIONAL_COLUMNS, DEFAULT_VISIBLE, COL_WIDTHS } from '../bill-check/config';
import { BillCheckGrid } from '../bill-check/BillCheckGrid';
import type { AssessmentRow, AssessmentSummary, ClaimData } from '@/types';

describe('BillCheck Column Configuration', () => {
  it('includes disposal in optional columns and default visible', () => {
    const keys = OPTIONAL_COLUMNS.map(c => c.key);
    expect(keys).toContain('disposal');
    expect((DEFAULT_VISIBLE as Record<string, boolean>).disposal).toBe(true);
    expect((COL_WIDTHS as Record<string, string>).disposal).toBe('110px');
  });
});

describe('BillCheckGrid Editability Markup', () => {
  const baseRow: AssessmentRow = {
    id: 'row-1',
    particulars: 'Front Bumper',
    estimated: 10000,
    assessed: 10000,
    partType: 'plastic',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    billedTaxable: 8000,
    billedAmount: 9440,
    billStatus: 'in-bill',
  };

  const mockSummary = {
    partsBase: 10000,
    metalTotal: 0,
    plasticTotal: 10000,
    glassTotal: 0,
    fiberglassTotal: 0,
    partsCGST: 900,
    partsSGST: 900,
    partsTotal: 11800,
    labourBase: 0,
    labourGST: 0,
    labourTotal: 0,
    labourOnlyBase: 0,
    labourOnlyTotal: 0,
    paintOnlyBase: 0,
    paintOnlyTotal: 0,
    grandTotal: 11800,
    salvage: 0,
    compulsoryExcess: 0,
    voluntaryExcess: 0,
    excess: 0,
    towingCharges: 0,
    netAssessedLoss: 11800,
    netInWords: 'Eleven Thousand Eight Hundred',
    totalEstimated: 10000,
    estimatePartsBase: 10000,
    estimateMetalBase: 0,
    estimatePlasticBase: 10000,
    estimateGlassBase: 0,
    estimateFiberglassBase: 0,
    estimatePartsGST: 1800,
    estimatePartsTotal: 11800,
    estimateLabourBase: 0,
    estimateLabourGST: 0,
    estimateLabourTotal: 0,
    estimateGrossTotal: 11800,
  } as unknown as AssessmentSummary;

  const mockClaim = {
    id: 'claim-1',
    depreciationType: 'standard',
    assessmentRows: [baseRow],
    vehicle: { dateOfRegistration: '2023-01-01' },
    accident: { dateAndTime: '2024-01-01' },
  } as unknown as ClaimData;

  it('renders editable GST input, disposal column, and editable dep input', () => {
    const html = renderToStaticMarkup(
      <BillCheckGrid
        allRows={[baseRow]}
        allowedRows={[baseRow]}
        summary={mockSummary}
        serials={new Map([['row-1', 1]])}
        updateAssessmentRow={vi.fn()}
        deleteAssessmentRow={vi.fn()}
        deleteAssessmentRows={vi.fn()}
        claimId="claim-1"
        fmt={n => String(n)}
        ageMonths={12}
        claim={mockClaim}
      />
    );

    // 1. Header has Disposal column
    expect(html).toContain('Disposal');

    // 2. GST input exists with value "18"
    expect(html).toContain('value="18"');

    // 3. Disposal checkbox exists
    expect(html).toContain('title="Disposal / Used Part (No GST)"');

    // 4. Dep input exists with auto rate
    expect(html).toContain('step="1"');
    expect(html).toContain('max="100"');
  });

  it('renders checked disposal checkbox and disposal % when isDisposal is true', () => {
    const disposalRow: AssessmentRow = {
      ...baseRow,
      id: 'row-2',
      isDisposal: true,
      disposalPercent: 50,
      gst: 0,
    };

    const html = renderToStaticMarkup(
      <BillCheckGrid
        allRows={[disposalRow]}
        allowedRows={[disposalRow]}
        summary={mockSummary}
        serials={new Map([['row-2', 1]])}
        updateAssessmentRow={vi.fn()}
        deleteAssessmentRow={vi.fn()}
        deleteAssessmentRows={vi.fn()}
        claimId="claim-1"
        fmt={n => String(n)}
        ageMonths={12}
        claim={mockClaim}
      />
    );

    expect(html).toContain('checked=""');
    expect(html).toContain('value="50"');
  });

  const render = (claim: ClaimData, after?: React.ReactNode) =>
    renderToStaticMarkup(
      <BillCheckGrid
        allRows={[baseRow]}
        allowedRows={[baseRow]}
        summary={mockSummary}
        serials={new Map([['row-1', 1]])}
        updateAssessmentRow={vi.fn()}
        deleteAssessmentRow={vi.fn()}
        deleteAssessmentRows={vi.fn()}
        claimId="claim-1"
        fmt={n => String(n)}
        ageMonths={12}
        claim={claim}
        after={after}
      />
    );
  const LOCK = 'title="Billed at the bill&#x27;s own figure (this claim is made from the bill)."';

  it('locks the billed box (not the status) in a claim made from the bill', () => {
    const html = render({ ...mockClaim, billCheck: { baseDocument: 'final-bill' } } as unknown as ClaimData);
    expect(html.split(LOCK).length - 1).toBe(1);
  });

  it('leaves them editable in a normal claim', () => {
    expect(render(mockClaim)).not.toContain('own figure');
  });

  it('tags the editable boxes for Shift+arrow moves and column paste', () => {
    const html = render(mockClaim);
    for (const col of ['gst', 'billAllowed', 'depOverride', 'billedTaxable', 'billStatus', 'refSrNo', 'billRemarks']) {
      expect(html).toMatch(new RegExp(`data-bc-row="row-1"[^>]*data-bc-col="${col}"|data-bc-col="${col}"[^>]*data-bc-row="row-1"`));
    }
  });

  it('is one scroll box with sticky section headings', () => {
    const html = render(mockClaim);
    expect(html).not.toContain('calc(100dvh - 240px)');
    expect(html).toContain('flex-1 min-h-0 overflow-auto');
    expect(html).toMatch(/position:sticky;top:0;z-index:10/);
    expect(html).toMatch(/scroll-padding-top:44px/);
  });

  it('puts the extras inside the scroll box, after the rows, pinned left', () => {
    const html = render(mockClaim, <div>EXTRAS</div>);
    const box = html.indexOf('flex-1 min-h-0 overflow-auto');
    const pinned = html.indexOf('<div class="sticky left-0 p-4">', box);
    const extras = html.indexOf('EXTRAS');
    expect(box).toBeGreaterThan(-1);
    expect(pinned).toBeGreaterThan(html.indexOf('Front Bumper'));
    expect(extras).toBeGreaterThan(pinned);
  });

  it('still shows the extras when the assessment has no rows', () => {
    const html = renderToStaticMarkup(
      <BillCheckGrid
        allRows={[]}
        allowedRows={[]}
        summary={mockSummary}
        serials={new Map()}
        updateAssessmentRow={vi.fn()}
        deleteAssessmentRow={vi.fn()}
        deleteAssessmentRows={vi.fn()}
        claimId="claim-1"
        fmt={n => String(n)}
        ageMonths={12}
        claim={mockClaim}
        after={<div>EXTRAS</div>}
      />
    );
    expect(html).toContain('No items in assessment');
    expect(html).toContain('EXTRAS');
  });
});
