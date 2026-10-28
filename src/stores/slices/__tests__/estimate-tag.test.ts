import { describe, it, expect } from 'vitest';
import { buildEstimateRows } from '../aiDataSlice';

describe('AssessmentRow estimateId tagging', () => {
  it('assigns estimateId derived from workshop_name and estimate_number', () => {
    const data = {
      workshop_name: 'Pawar Automobiles',
      estimate_number: 'SPIPAD1270000018',
      estimate_date: '2026-10-14',
      spare_parts: [
        { sr_no: 1, description: 'FENDER DAY LH', unit_price: 1670.34, taxable_amount: 1670.34, gst_percent: 18 }
      ],
      labour_items: [
        { sr_no: 1, description: 'ELECTRICAL WORK', unit_price: 10500, taxable_amount: 10500, gst_percent: 18 }
      ],
      painting_items: []
    };

    const rows = buildEstimateRows(data, 'estimate', 1);
    expect(rows).toHaveLength(2);
    expect(rows[0].estimateId).toBe('Pawar Automobiles-SPIPAD1270000018-2026-10-14');
    expect(rows[1].estimateId).toBe('Pawar Automobiles-SPIPAD1270000018-2026-10-14');
    expect(rows[0].particulars).toBe('FENDER DAY LH');
    expect(rows[0].partNumber).toBe('');
    expect(rows[0].estimated).toBe(1670.34);
  });

  it('leaves estimateId undefined if no workshop or estimate number is present', () => {
    const data = {
      spare_parts: [
        { sr_no: 1, description: 'Part without header', unit_price: 100, taxable_amount: 100 }
      ]
    };
    const rows = buildEstimateRows(data, 'estimate', 1);
    expect(rows[0].estimateId).toBeUndefined();
  });
});
