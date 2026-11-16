import { describe, it, expect } from 'vitest';
import { matchStage2NameAndCost } from '../stage2-name-cost';
import type { AssessmentRow, BillItem } from '@/types';

const row = (id: string, text: string, assessed = 1000): AssessmentRow => ({
  id, particulars: text, estimated: assessed, assessed,
  partType: 'plastic', gst: 18, section: 'parts', allowed: true,
});

const line = (idx: number, srNo: number, desc: string, taxable = 1000, pn = ''): BillItem => ({
  idx, srNo, description: desc, partNumber: pn, taxableAmount: taxable,
  totalAmount: Math.round(taxable * 1.18), gstPercent: 18, section: 'parts', raw: {},
});

describe('matchStage2NameAndCost', () => {
  it('matches automotive synonyms like ORVM to Rear View Mirror', () => {
    const rows = [row('r1', 'ORVM ASSY RH', 3800)];
    const lines = [line(0, 12, 'REAR VIEW MIRROR RH', 3850)];

    const res = matchStage2NameAndCost(rows, lines);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].rowId).toBe('r1');
    expect(res.matches[0].reasons).toContain('Synonym match');
    expect(res.matches[0].priceDelta).toBe(50);
  });

  it('strictly forbids matching opposite sides (LH vs RH)', () => {
    const rows = [row('r1', 'FOG LAMP BEZEL LH', 400)];
    const lines = [line(0, 15, 'FOG LAMP BEZEL RH', 400)];

    const res = matchStage2NameAndCost(rows, lines);
    expect(res.matches).toHaveLength(0);
    expect(res.unmatchedRows).toHaveLength(1);
  });

  it('rejects pairs with large price divergences over 40%', () => {
    const rows = [row('r1', 'BUMPER BRACKET', 500)];
    const lines = [line(0, 20, 'BUMPER BRACKET', 2500)]; // 400% divergence

    const res = matchStage2NameAndCost(rows, lines);
    expect(res.matches).toHaveLength(0);
  });

  it('returns unmatched rows and unmatched lines when no match is found', () => {
    const rows = [row('r1', 'RADIATOR GRILLE', 1500)];
    const lines = [line(0, 5, 'ENGINE MOUNTING', 1200)];

    const res = matchStage2NameAndCost(rows, lines);
    expect(res.matches).toHaveLength(0);
    expect(res.unmatchedRows).toHaveLength(1);
    expect(res.unmatchedLines).toHaveLength(1);
  });
});
