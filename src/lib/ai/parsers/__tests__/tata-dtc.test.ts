// src/lib/ai/parsers/__tests__/tata-dtc.test.ts
import { describe, it, expect } from 'vitest';
import { parseTataDtc } from '../tata-dtc';

const DTC_SAMPLE = `
TATA MOTORS LIMITED
AUTHORISED SERVICE CENTRE
SUNRISE TATA WORKSHOP
123 Industrial Area, Pune
Vehicle No: MH12AB1234   Date: 10-05-2026   Bill No: TDC/26/00123

Sr No  Description              Part No          HSN      Qty  Rate     Taxable  CGST%  CGST    SGST%  SGST    Total
1      FRONT BUMPER ASSY        271755881502     87082900  1    8500.00  8500.00  9%     765.00  9%     765.00  10030.00
2      PAINT SOLID COLOUR COAT  -                998714    1    2500.00  2500.00  9%     225.00  9%     225.00  2950.00
3      R&R FRONT BUMPER         -                998713    1    600.00   600.00   9%     54.00   9%     54.00   708.00

Sub Total Parts (Taxable)     8500.00
Sub Total Labour (Taxable)    600.00
Sub Total Painting (Taxable)  2500.00
Total CGST                    1044.00
Total SGST                    1044.00
Grand Total                   14588.00
`;

describe('parseTataDtc', () => {
  it('extracts vehicle_number', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.data.vehicle_number).toBe('MH12AB1234');
  });

  it('extracts bill_number containing TDC/26/00123', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.data.bill_number).toContain('TDC/26/00123');
  });

  it('spare_parts contains FRONT BUMPER ASSY with total_amount = 10030', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    const bumper = result.data.spare_parts.find(p => p.description.includes('FRONT BUMPER ASSY'));
    expect(bumper).toBeDefined();
    expect(bumper?.total_amount).toBe(10030);
  });

  it('painting_items.length > 0 (PAINT SOLID COLOUR COAT classified as painting)', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.data.painting_items.length).toBeGreaterThan(0);
    const paint = result.data.painting_items.find(p => p.description.includes('PAINT SOLID COLOUR'));
    expect(paint).toBeDefined();
  });

  it('labour_items contains R&R FRONT BUMPER', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    const labour = result.data.labour_items.find(l => l.description.includes('R&R FRONT BUMPER'));
    expect(labour).toBeDefined();
  });

  it('gross_amount = 14588', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.data.gross_amount).toBe(14588);
  });

  it('confidence.items >= 0.85 (3 rows parsed → 3/3 = 1.0)', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.confidence.items).toBeGreaterThanOrEqual(0.85);
  });

  it('confidence.totals = 0.95', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.confidence.totals).toBe(0.95);
  });

  it('parserName is tata-dtc', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.parserName).toBe('tata-dtc');
  });

  it('extracts workshop_name = SUNRISE TATA WORKSHOP', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.data.workshop_name).toBe('SUNRISE TATA WORKSHOP');
  });

  it('returns low confidence for empty input', () => {
    const result = parseTataDtc(['']);
    expect(result.confidence.items).toBe(0);
    expect(result.confidence.totals).toBe(0);
  });

  it('extracts part number for structured row', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    const bumper = result.data.spare_parts.find(p => p.description.includes('FRONT BUMPER ASSY'));
    expect(bumper?.part_number).toBeTruthy();
  });

  it('extracts subtotal parts taxable', () => {
    const result = parseTataDtc([DTC_SAMPLE]);
    expect(result.data.subtotal_parts_taxable).toBe(8500);
  });
});
