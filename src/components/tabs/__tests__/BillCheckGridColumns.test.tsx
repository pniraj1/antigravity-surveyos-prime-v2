import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckGrid } from '../bill-check/BillCheckGrid';
import type { AssessmentRow, AssessmentSummary, ClaimData } from '@/types';

const row: AssessmentRow = {
  id: 'a', particulars: 'BUMPER', estimated: 1000, assessed: 900, billedTaxable: 950, estimateAmount: 880,
  refSrNo: '7', partType: 'plastic', gst: 18, section: 'parts', allowed: true, isDisposal: false,
  disposalPercent: 50, billedAmount: 1121, billStatus: 'in-bill',
};
const summary = {
  partsBase: 1000, metalTotal: 0, plasticTotal: 1000, glassTotal: 0, fiberglassTotal: 0,
  partsTotal: 1180, labourBase: 0, labourGST: 0, labourTotal: 0, grandTotal: 1180,
} as unknown as AssessmentSummary;

const render = (fromBill: boolean) => {
  const claim = {
    id: 'c1', depreciationType: 'standard', assessmentRows: [row],
    vehicle: { dateOfRegistration: '2023-01-01' }, accident: { dateAndTime: '2024-01-01' },
    ...(fromBill ? { billCheck: { baseDocument: 'final-bill' } } : {}),
  } as unknown as ClaimData;
  return renderToStaticMarkup(
    <BillCheckGrid
      allRows={[row]} allowedRows={[row]} summary={summary} serials={new Map([['a', 1]])}
      updateAssessmentRow={vi.fn()} deleteAssessmentRow={vi.fn()} deleteAssessmentRows={vi.fn()}
      claimId="c1" fmt={n => n.toLocaleString('en-IN')} ageMonths={12} claim={claim}
    />,
  );
};
const inOrder = (html: string, keys: string[]) => {
  const at = keys.map(k => html.indexOf(k));
  expect(at.every(i => i >= 0), `missing in ${JSON.stringify(at)}`).toBe(true);
  expect([...at].sort((x, y) => x - y)).toEqual(at);
};
const rowHtml = (html: string) => html.slice(html.indexOf('id="bc-row-a"'));

describe('Bill Check columns, case 1 (bill uploaded)', () => {
  const html = render(false);
  it('header reads base, assessed, uploaded, item no., status, dep, price+gst, remarks', () => {
    inOrder(html, ['Estimate (taxable)', 'Assessed', 'Billed (taxable)', 'Bill Item No.', 'Status', 'Dep%', 'Price+GST', 'Remarks']);
  });
  it('row cells follow the header', () => {
    const r = rowHtml(html);
    inOrder(r, ['1,000', '900', '950', 'value="7"']);
  });
});

describe('Bill Check columns, case 2 (built from the bill)', () => {
  const html = render(true);
  it('header reads bill, assessed, estimated, item no., status', () => {
    inOrder(html, ['Bill (taxable)', 'Assessed', 'Estimated (taxable)', 'Est. Item No.', 'Status']);
    expect(html).not.toContain('Billed Taxable');
  });
  it('row cells follow the header', () => {
    inOrder(rowHtml(html), ['1,000', '900', '880']);
  });
  it('totals: base shows the bill figure, uploaded shows the estimate figure', () => {
    const t = html.slice(html.indexOf('>TOTAL<'));
    inOrder(t, ['1,000', '900', '880']);
    expect(t).not.toContain('950');
  });
});
