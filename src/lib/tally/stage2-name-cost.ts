import type { AssessmentRow } from '@/types/assessment';
import type { BillItem } from '@/stores/slices/aiDataSlice';
import { sideConflicts } from '@/lib/reports/bill-match-score';

const SYNONYMS: Record<string, string> = {
  orvm: 'mirror',
  rv: 'mirror',
  ws: 'windshield',
  windscreen: 'windshield',
  bonnet: 'hood',
  dicky: 'boot',
  trunk: 'boot',
  fender: 'mudguard',
  strg: 'steering',
  susp: 'suspension',
  monogram: 'emblem',
  badge: 'emblem',
  lining: 'apron',
  fl: 'fog',
  hl: 'headlight',
  tl: 'taillight',
};

function normalizeTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => SYNONYMS[w] || w)
    .filter((w) => w.length > 1 && !['assy', 'assembly', 'set', 'complete'].includes(w));
}

export interface NameCostMatch {
  rowId: string;
  lineId: string;
  reasons: string[];
  billItem: BillItem;
  priceDelta: number;
  confidence: number;
}

export interface Stage2Result {
  matches: NameCostMatch[];
  unmatchedRows: AssessmentRow[];
  unmatchedLines: BillItem[];
}

export function matchStage2NameAndCost(
  rows: AssessmentRow[],
  billLines: BillItem[]
): Stage2Result {
  const matches: NameCostMatch[] = [];
  const matchedRowIds = new Set<string>();
  const matchedLineIdxs = new Set<number>();

  for (const r of rows) {
    const rTerms = new Set(normalizeTerms(r.particulars));
    const rCost = r.assessed || r.estimated || 0;

    let bestLine: BillItem | null = null;
    let bestScore = 0;
    let matchReasons: string[] = [];

    for (const l of billLines) {
      if (matchedLineIdxs.has(l.idx)) continue;
      if (r.section && l.section && r.section !== l.section) continue;

      // Strict directional clash rejection
      if (sideConflicts(r.particulars, l.description).size > 0) continue;

      const lTerms = new Set(normalizeTerms(l.description));
      let shared = 0;
      rTerms.forEach((t) => { if (lTerms.has(t)) shared += 1; });
      const termOverlap = (rTerms.size && lTerms.size) ? (2 * shared) / (rTerms.size + lTerms.size) : 0;
      if (termOverlap < 0.6) continue;

      const lCost = l.taxableAmount;
      if (rCost > 0 && lCost > 0) {
        const diffRatio = Math.abs(lCost - rCost) / Math.max(rCost, lCost);
        if (diffRatio > 0.40) continue; // Divergence over 40% rejected in Stage 2
      }

      const score = termOverlap * 100;
      if (score > bestScore) {
        bestScore = score;
        bestLine = l;
        matchReasons = ['Synonym match', `Term overlap ${Math.round(termOverlap * 100)}%`];
      }
    }

    if (bestLine && bestScore >= 65) {
      matches.push({
        rowId: r.id,
        lineId: String(bestLine.idx),
        reasons: matchReasons,
        billItem: bestLine,
        priceDelta: bestLine.taxableAmount - rCost,
        confidence: Math.round(bestScore),
      });
      matchedRowIds.add(r.id);
      matchedLineIdxs.add(bestLine.idx);
    }
  }

  return {
    matches,
    unmatchedRows: rows.filter((r) => !matchedRowIds.has(r.id)),
    unmatchedLines: billLines.filter((l) => !matchedLineIdxs.has(l.idx)),
  };
}
