import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckGrid, billCheckRowsShown, billCheckCounts } from '../bill-check/BillCheckGrid';
import { billedTotals } from '@/lib/calculations/section-subtotals';
import type { AssessmentRow, AssessmentSummary, ClaimData } from '@/types';

const mk = (id: string, particulars: string, allowed: boolean, billedAmount?: number): AssessmentRow => ({
  id, particulars, estimated: 1000, assessed: allowed ? 1000 : 0, partType: 'plastic', gst: 18,
  section: 'parts', allowed, isDisposal: false, disposalPercent: 50, billedAmount,
  billStatus: 'in-bill',
});
const A = mk('a', 'BUMPER', true, 1180);
const B = mk('b', 'GRILLE', false, 500);
const C = mk('c', 'MIRROR', false);

const summary = {
  partsBase: 1000, metalTotal: 0, plasticTotal: 1000, glassTotal: 0, fiberglassTotal: 0,
  partsTotal: 1180, labourBase: 0, labourGST: 0, labourTotal: 0, grandTotal: 1180,
} as unknown as AssessmentSummary;
const claim = {
  id: 'c1', depreciationType: 'standard', assessmentRows: [A, B, C],
  vehicle: { dateOfRegistration: '2023-01-01' }, accident: { dateAndTime: '2024-01-01' },
} as unknown as ClaimData;

describe('billCheckRowsShown', () => {
  it('allowed only drops every disallowed row', () => {
    expect(billCheckRowsShown([A, B, C], 'parts', true)).toEqual([A]);
  });
  it('off keeps disallowed rows the workshop billed', () => {
    expect(billCheckRowsShown([A, B, C], 'parts', false)).toEqual([A, B]);
  });
});

describe('BillCheckGrid allowed-only toggle', () => {
  const html = renderToStaticMarkup(
    <BillCheckGrid
      allRows={[A, B, C]} allowedRows={[A]} summary={summary}
      serials={new Map([['a', 1]])} updateAssessmentRow={vi.fn()} deleteAssessmentRow={vi.fn()}
      deleteAssessmentRows={vi.fn()} claimId="c1" fmt={n => String(n)} ageMonths={12} claim={claim}
    />,
  );
  it('hides disallowed rows by default', () => {
    expect(html).toContain('BUMPER');
    expect(html).not.toContain('GRILLE');
  });
  it('shows a pressed Allowed only toggle', () => {
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Allowed only/);
  });
});

describe('counts follow the rows shown', () => {
  const D = { ...mk('d', 'HOOD', false, 300), refStatus: 'ambiguous' as const };
  const rows = [{ ...A, refSrNo: '1' }, B, C, D];
  it('allowed only ignores hidden rows', () => {
    expect(billCheckCounts(rows, true)).toEqual({ shown: 1, uncertain: 0 });
  });
  it('off counts billed disallowed rows too', () => {
    expect(billCheckCounts(rows, false)).toEqual({ shown: 3, uncertain: 1 });
  });
  it('button and header agree with the screen by default', () => {
    const h = renderToStaticMarkup(
      <BillCheckGrid
        allRows={rows} allowedRows={[rows[0]]} summary={summary}
        serials={new Map([['a', 1]])} updateAssessmentRow={vi.fn()} deleteAssessmentRow={vi.fn()}
        deleteAssessmentRows={vi.fn()} claimId="c1" fmt={n => String(n)} ageMonths={12} claim={claim}
      />,
    );
    expect(h).not.toContain('Review Ref Numbers');
    expect(h).toContain('1 items');
    expect(h).toContain('Turn off Allowed only');
  });
});

describe('TOTAL figures do not depend on the toggle', () => {
  it('billed totals are identical on and off', () => {
    const on = billedTotals(billCheckRowsShown([A, B, C], 'parts', true).filter(r => r.allowed), false);
    const off = billedTotals(billCheckRowsShown([A, B, C], 'parts', false).filter(r => r.allowed), false);
    expect(off).toEqual(on);
  });
});
