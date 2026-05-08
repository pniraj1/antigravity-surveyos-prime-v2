// src/lib/ai/parsers/__tests__/generic-table.test.ts
import { describe, it, expect } from 'vitest';
import { parseGenericTable } from '../generic-table';

const SAMPLE_TEXT = `
SUNSHINE AUTO WORKSHOP
123 Main Road, Mumbai
Vehicle: MH12AB1234  Date: 10-05-2026

Sr No  Description           Qty  Rate    Taxable  CGST   SGST   Total
1      FR BUMPER ASSY        1    8500    8500     765    765    10030
2      PAINTING SOLID CLR    1    2500    2500     225    225    2950
3      R&R FR BUMPER         1    600     600      54     54     708
4      ENGINE OIL 1L         2    450     900      81     81     1062

Sub Total Parts              8500
Sub Total Labour             600
Sub Total Painting           2500
Total CGST                   1125
Total SGST                   1125
Grand Total                  14750
`;

describe('parseGenericTable', () => {
  it('extracts vehicle number', () => {
    const result = parseGenericTable([SAMPLE_TEXT]);
    expect(result.data.vehicle_number).toBe('MH12AB1234');
  });

  it('extracts spare part with correct total', () => {
    const result = parseGenericTable([SAMPLE_TEXT]);
    const bumper = result.data.spare_parts.find(p => p.description.includes('BUMPER ASSY'));
    expect(bumper).toBeDefined();
    expect(bumper?.total_amount).toBe(10030);
  });

  it('classifies painting items', () => {
    const result = parseGenericTable([SAMPLE_TEXT]);
    expect(result.data.painting_items.length).toBeGreaterThan(0);
    expect(result.data.painting_items[0].description).toMatch(/PAINTING/i);
  });

  it('classifies labour items', () => {
    const result = parseGenericTable([SAMPLE_TEXT]);
    const labour = result.data.labour_items.find(l => l.description.includes('R&R'));
    expect(labour).toBeDefined();
  });

  it('extracts grand total', () => {
    const result = parseGenericTable([SAMPLE_TEXT]);
    expect(result.data.gross_amount).toBe(14750);
  });

  it('returns high item confidence for structured table', () => {
    const result = parseGenericTable([SAMPLE_TEXT]);
    expect(result.confidence.items).toBeGreaterThan(0.8);
  });

  it('returns low confidence for unstructured text', () => {
    const result = parseGenericTable(['no tables here just text']);
    expect(result.confidence.items).toBeLessThan(0.5);
  });
});
