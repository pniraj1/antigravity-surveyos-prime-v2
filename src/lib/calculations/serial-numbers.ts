import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

/**
 * Serial number per row, counted within its section across ALL rows —
 * disallowed included.
 *
 * The Final Report lists every item with the surveyor's decision on it. Bill
 * Check lists only the insurer-liability ones, but carries these same numbers,
 * so the insurer reading both documents sees 1, 4, 5 and knows 2 and 3 were
 * rejected without cross-referencing. The gap is the information.
 */
export function buildSerialMap(rows: AssessmentRow[]): Map<string, number> {
  const counters: Record<AssessmentSection, number> = { parts: 0, labour: 0, paint: 0 };
  const map = new Map<string, number>();

  for (const row of rows) {
    counters[row.section] += 1;
    map.set(row.id, counters[row.section]);
  }

  return map;
}
