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

  const mockSummary: AssessmentSummary = {
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
  };

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
});
