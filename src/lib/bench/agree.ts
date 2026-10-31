import { compareToReference, passes, selfCheck } from './score';
import type { BenchError, BenchRow, PdfProfile } from './types';

export interface Reading { cellId: string; model: string; rows: BenchRow[]; errors: BenchError[] }

/** Gold wins; else the first pair of self-check-clean readings from different models that agree. */
export function referenceFor(
  readings: Reading[], profile: PdfProfile, gold?: BenchRow[],
): { source: 'gold' | 'agreement'; rows: BenchRow[] } | null {
  if (gold) return { source: 'gold', rows: gold };
  const clean = readings.filter(r => passes(selfCheck(r.rows, profile)));
  for (let i = 0; i < clean.length; i++) {
    for (let j = i + 1; j < clean.length; j++) {
      if (clean[i].model !== clean[j].model && passes(compareToReference(clean[i].rows, clean[j].rows, profile))) {
        return { source: 'agreement', rows: clean[i].rows };
      }
    }
  }
  return null;
}
