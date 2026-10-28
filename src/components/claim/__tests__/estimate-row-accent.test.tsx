import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { AssessmentSectionTable } from '../AssessmentSectionTable';
import { createAssessmentRow } from '@/lib/calculations';
import type { SectionSubtotal } from '@/lib/calculations/section-subtotals';

const emptySubtotal: any = {
  base: 0,
  gst: 0,
  total: 0,
};

const dummySelection: any = {
  selected: new Set(),
  toggleSelect: () => {},
  isCellSelected: () => false,
  handleCellMouseDown: () => {},
  sectionTickState: () => false,
  toggleSectionSelectAll: () => {},
};

describe('AssessmentSectionTable estimate row accent border', () => {
  it('applies border-l-4 accent color when 2 or more distinct estimates exist', () => {
    const row1 = createAssessmentRow('parts', { id: 'r1', particulars: 'Part A', estimateId: 'EST_ALPHA' });
    const row2 = createAssessmentRow('parts', { id: 'r2', particulars: 'Part B', estimateId: 'EST_BETA' });
    const allRows = [row1, row2];

    const html = renderToStaticMarkup(
      <AssessmentSectionTable
        section="parts"
        title="Spare Parts"
        rows={[row1, row2]}
        allRows={allRows}
        subtotal={emptySubtotal}
        visible={{'hsnSac': false, 'partNumber': false, 'billGst': false, 'disposal': false, 'category': false, 'imt23': false, 'itemType': false, 'remarks': false, 'taxable': false}}
        visibleCount={0}
        selection={dummySelection}
        ageMonths={12}
        depreciationType="standard"
        duplicateParticulars={new Set()}
        onGridKeyDown={() => {}}
      />
    );

    // Should contain border-l-4 blue/purple accents
    expect(html).toContain('border-l-4 border-l-blue-500');
    expect(html).toContain('border-l-4 border-l-purple-500');
  });

  it('does NOT apply estimate accent border when only 1 estimate exists', () => {
    const row1 = createAssessmentRow('parts', { id: 'r1', particulars: 'Part A', estimateId: 'EST_SINGLE' });
    const row2 = createAssessmentRow('parts', { id: 'r2', particulars: 'Part B', estimateId: 'EST_SINGLE' });
    const allRows = [row1, row2];

    const html = renderToStaticMarkup(
      <AssessmentSectionTable
        section="parts"
        title="Spare Parts"
        rows={[row1, row2]}
        allRows={allRows}
        subtotal={emptySubtotal}
        visible={{'hsnSac': false, 'partNumber': false, 'billGst': false, 'disposal': false, 'category': false, 'imt23': false, 'itemType': false, 'remarks': false, 'taxable': false}}
        visibleCount={0}
        selection={dummySelection}
        ageMonths={12}
        depreciationType="standard"
        duplicateParticulars={new Set()}
        onGridKeyDown={() => {}}
      />
    );

    expect(html).not.toContain('border-l-blue-500');
  });
});
