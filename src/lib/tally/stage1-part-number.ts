import type { AssessmentRow } from '@/types/assessment';
import type { BillItem } from '@/stores/slices/aiDataSlice';
import { normPart } from '@/lib/reports/bill-match-score';

export interface PartNumberMatch {
  rowId: string;
  lineId: string;
  partNumber: string;
  matchType: 'exact' | 'normalized';
  billItem: BillItem;
  priceDelta: number;
}

export interface Stage1Result {
  matches: PartNumberMatch[];
  unmatchedRows: AssessmentRow[];
  unmatchedLines: BillItem[];
}

export function matchStage1PartNumbers(
  rows: AssessmentRow[],
  billLines: BillItem[]
): Stage1Result {
  const matches: PartNumberMatch[] = [];
  const matchedRowIds = new Set<string>();
  const matchedLineIdxs = new Set<number>();

  const lineByNormPn = new Map<string, BillItem[]>();
  for (const line of billLines) {
    const np = normPart(line.partNumber);
    if (!np) continue;
    lineByNormPn.set(np, [...(lineByNormPn.get(np) || []), line]);
  }

  for (const row of rows) {
    const rawRowPn = (row.partNumber || '').trim();
    const np = normPart(rawRowPn);
    if (!np) continue;

    const candidateLines = (lineByNormPn.get(np) || []).filter((l) => !matchedLineIdxs.has(l.idx));
    if (candidateLines.length === 0) continue;

    const bestLine = candidateLines[0];
    const isExact = rawRowPn.toLowerCase() === (bestLine.partNumber || '').trim().toLowerCase();
    const priceDelta = bestLine.taxableAmount - (row.assessed || row.estimated || 0);

    matches.push({
      rowId: row.id,
      lineId: String(bestLine.idx),
      partNumber: rawRowPn,
      matchType: isExact ? 'exact' : 'normalized',
      billItem: bestLine,
      priceDelta,
    });

    matchedRowIds.add(row.id);
    matchedLineIdxs.add(bestLine.idx);
  }

  return {
    matches,
    unmatchedRows: rows.filter((r) => !matchedRowIds.has(r.id)),
    unmatchedLines: billLines.filter((l) => !matchedLineIdxs.has(l.idx)),
  };
}
