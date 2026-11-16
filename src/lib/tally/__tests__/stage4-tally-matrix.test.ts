import { describe, it, expect } from 'vitest';
import { segregateStage4Tally } from '../stage4-tally-matrix';
import type { AssessmentRow, BillItem } from '@/types';

const row = (
  id: string,
  text: string,
  allowed: boolean,
  billedTax?: number,
  billStatus?: AssessmentRow['billStatus']
): AssessmentRow => ({
  id,
  particulars: text,
  estimated: 1000,
  assessed: allowed ? 1000 : 0,
  partType: 'plastic',
  gst: 18,
  section: 'parts',
  allowed,
  billedTaxable: billedTax,
  billStatus,
});

const line = (idx: number, desc: string, taxable = 800): BillItem => ({
  idx,
  srNo: idx + 1,
  description: desc,
  partNumber: '',
  taxableAmount: taxable,
  totalAmount: Math.round(taxable * 1.18),
  gstPercent: 18,
  section: 'parts',
  raw: {},
});

describe('segregateStage4Tally', () => {
  it('flags disallowed items billed by workshop with 0 liability and audit remark', () => {
    const rows = [row('r1', 'SUSPENSION ARM', false, 800)];
    const out = segregateStage4Tally(rows, []);

    expect(out.disallowedBilled).toHaveLength(1);
    expect(out.disallowedBilled[0].liability).toBe(0);
    expect(out.disallowedBilled[0].billedTaxable).toBe(800);
    expect(out.disallowedBilled[0].remark).toContain('disallowed at survey');
  });

  it('identifies allowed items not in bill as insurer savings', () => {
    const rows = [row('r1', 'FOG LAMP BEZEL', true, undefined)];
    const out = segregateStage4Tally(rows, []);

    expect(out.savings).toHaveLength(1);
    expect(out.savings[0].savedAmount).toBe(1000);
    expect(out.totalSaved).toBe(1000);
  });

  it('segregates allowed billed rows and passes through extra bill items', () => {
    const rows = [
      row('r1', 'FRONT BUMPER', true, 4200, 'in-bill'),
      row('r2', 'REAR EMBLEM', true, undefined, 'not-in-bill'),
      row('r3', 'ALLOY WHEEL', false, 15000),
    ];
    const extraLines = [line(99, 'UNMATCHED CLIPS', 350)];

    const out = segregateStage4Tally(rows, extraLines);

    expect(out.allowedBilled).toHaveLength(1);
    expect(out.allowedBilled[0].id).toBe('r1');

    expect(out.savings).toHaveLength(1);
    expect(out.savings[0].row.id).toBe('r2');
    expect(out.savings[0].savedAmount).toBe(1000);

    expect(out.disallowedBilled).toHaveLength(1);
    expect(out.disallowedBilled[0].row.id).toBe('r3');
    expect(out.disallowedBilled[0].liability).toBe(0);

    expect(out.extraBillItems).toHaveLength(1);
    expect(out.extraBillItems[0].idx).toBe(99);
    expect(out.totalSaved).toBe(1000);
  });

  it('treats allowed items with billStatus not-in-bill as savings even if billedTaxable was set', () => {
    const rows = [row('r1', 'HEADLAMP BRACKET', true, 500, 'not-in-bill')];
    const out = segregateStage4Tally(rows, []);

    expect(out.allowedBilled).toHaveLength(0);
    expect(out.savings).toHaveLength(1);
    expect(out.savings[0].row.id).toBe('r1');
    expect(out.totalSaved).toBe(1000);
  });
});
