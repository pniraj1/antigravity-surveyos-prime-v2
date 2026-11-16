import { describe, it, expect } from 'vitest';
import { matchStage1PartNumbers } from '../stage1-part-number';
import type { AssessmentRow, BillItem } from '@/types';

const makeRow = (id: string, pn: string, particulars: string, assessed = 1000): AssessmentRow => ({
  id, particulars, partNumber: pn, estimated: assessed, assessed,
  partType: 'plastic', gst: 18, section: 'parts', allowed: true,
});

const makeLine = (idx: number, srNo: number, pn: string, desc: string, taxable = 1000): BillItem => ({
  idx, srNo, description: desc, partNumber: pn, taxableAmount: taxable,
  totalAmount: Math.round(taxable * 1.18), gstPercent: 18, section: 'parts', raw: {},
});

describe('matchStage1PartNumbers', () => {
  it('pairs exact part numbers and computes price difference', () => {
    const rows = [makeRow('r1', '52119-0K930', 'FRONT BUMPER', 4200)];
    const lines = [makeLine(0, 11, '52119-0K930', 'BUMPER FRONT', 4193)];

    const result = matchStage1PartNumbers(rows, lines);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].rowId).toBe('r1');
    expect(result.matches[0].lineId).toBe('0');
    expect(result.matches[0].matchType).toBe('exact');
    expect(result.matches[0].priceDelta).toBe(-7);
    expect(result.unmatchedRows).toHaveLength(0);
    expect(result.unmatchedLines).toHaveLength(0);
  });

  it('pairs normalized part numbers ignoring hyphens and spaces', () => {
    const rows = [makeRow('r1', '81110-0K450', 'HEADLAMP RH')];
    const lines = [makeLine(0, 15, '81110 0K450', 'HEAD LIGHT RH')];

    const result = matchStage1PartNumbers(rows, lines);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchType).toBe('normalized');
  });

  it('keeps rows and lines without part numbers in unmatched pools', () => {
    const rows = [makeRow('r1', '', 'FRONT BUMPER')];
    const lines = [makeLine(0, 11, '', 'FRONT BUMPER')];

    const result = matchStage1PartNumbers(rows, lines);
    expect(result.matches).toHaveLength(0);
    expect(result.unmatchedRows).toHaveLength(1);
    expect(result.unmatchedLines).toHaveLength(1);
  });
});
