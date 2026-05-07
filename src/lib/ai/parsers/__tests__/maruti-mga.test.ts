// src/lib/ai/parsers/__tests__/maruti-mga.test.ts
import { describe, it, expect } from 'vitest';
import { parseMarutiMga } from '../maruti-mga';

const MGA_SAMPLE = `
MARUTI SUZUKI INDIA LIMITED
MGA INVOICE
SUNRISE MARUTI WORKSHOP
456 Service Road, Nashik
Reg No: MH15CD5678   Date: 10/05/2026   Invoice No: MGA/MH/26/04567

S.No  Particulars              Part Number      HSN Code  Qty  MRP      Basic    CGST%  CGST    SGST%  SGST    Total Amount
1     FRONT BUMPER ASSY LH     1000082M50010   87082900   1    9200.00  8500.00  9%     765.00  9%     765.00  10030.00
2     PAINTING SOLID COLOUR    -               998714     1    2500.00  2500.00  9%     225.00  9%     225.00  2950.00
3     FITMENT CHARGES          -               998713     1    600.00   600.00   9%     54.00   9%     54.00   708.00

Parts Subtotal (Basic)        8500.00
Labour Subtotal (Basic)       600.00
Paint Subtotal (Basic)        2500.00
Total CGST                    1044.00
Total SGST                    1044.00
Net Payable                   14588.00
`;

describe('parseMarutiMga', () => {
  it('extracts vehicle_number', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.data.vehicle_number).toBe('MH15CD5678');
  });

  it('extracts bill_number containing MGA/MH/26/04567', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.data.bill_number).toContain('MGA/MH/26/04567');
  });

  it('spare_parts contains FRONT BUMPER ASSY LH with total_amount = 10030', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    const bumper = result.data.spare_parts.find(p => p.description.includes('FRONT BUMPER ASSY LH'));
    expect(bumper).toBeDefined();
    expect(bumper?.total_amount).toBe(10030);
  });

  it('painting_items.length > 0 (PAINTING SOLID COLOUR classified as painting)', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.data.painting_items.length).toBeGreaterThan(0);
    const paint = result.data.painting_items.find(p => p.description.includes('PAINTING SOLID COLOUR'));
    expect(paint).toBeDefined();
  });

  it('labour_items contains FITMENT CHARGES', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    const labour = result.data.labour_items.find(l => l.description.includes('FITMENT CHARGES'));
    expect(labour).toBeDefined();
  });

  it('gross_amount = 14588', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.data.gross_amount).toBe(14588);
  });

  it('confidence.items >= 0.85 (3 rows parsed → 3/3 = 1.0)', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.confidence.items).toBeGreaterThanOrEqual(0.85);
  });

  it('confidence.totals = 0.95', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.confidence.totals).toBe(0.95);
  });

  it('parserName is maruti-mga', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.parserName).toBe('maruti-mga');
  });

  it('subtotal_parts_taxable = 8500', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.data.subtotal_parts_taxable).toBe(8500);
  });

  it('extracts workshop_name = SUNRISE MARUTI WORKSHOP', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    expect(result.data.workshop_name).toBe('SUNRISE MARUTI WORKSHOP');
  });

  it('returns low confidence for empty input', () => {
    const result = parseMarutiMga(['']);
    expect(result.confidence.items).toBe(0);
    expect(result.confidence.totals).toBe(0);
  });

  it('unit_price uses Basic (taxable) not MRP', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    const bumper = result.data.spare_parts.find(p => p.description.includes('FRONT BUMPER ASSY LH'));
    // MRP is 9200, Basic is 8500 — unit_price must be 8500
    expect(bumper?.unit_price).toBe(8500);
  });

  it('extracts part_number for structured row', () => {
    const result = parseMarutiMga([MGA_SAMPLE]);
    const bumper = result.data.spare_parts.find(p => p.description.includes('FRONT BUMPER ASSY LH'));
    expect(bumper?.part_number).toBeTruthy();
  });
});
