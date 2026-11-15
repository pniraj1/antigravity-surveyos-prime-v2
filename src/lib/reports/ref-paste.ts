/**
 * Pasting estimate numbers into Bill Check's Ref No. column (spec D10).
 * Pure: reads the clipboard text and works out what to write to which row.
 * The grid applies the result; nothing here touches the store.
 */

import type { AssessmentRow, ExtraBillItem } from '@/types/assessment';
import { normPart } from './bill-match-score';

export type RefPaste =
  | { kind: 'single' }                                        // no line break, no tab: let the input paste natively
  | { kind: 'column'; refs: string[] }                        // '' = leave that row unchanged
  | { kind: 'keyed'; pairs: Array<{ srNo: number; ref: string }> }
  | { kind: 'invalid' };

const isWhole = (s: string): boolean => s !== '' && Number.isInteger(Number(s));

export function parseRefPaste(text: string): RefPaste {
  if (!/[\n\t]/.test(text)) return { kind: 'single' };
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const rows = lines.map(l => l.split('\t').map(c => c.trim()));
  const width = rows[0].length;
  if (rows.some(r => r.length !== width) || width > 2) return { kind: 'invalid' };
  if (width === 1) {
    // Real refs always carry a digit; a first line without one is the column's header.
    const refs = rows.map(r => r[0]);
    return { kind: 'column', refs: refs.length > 1 && !/\d/.test(refs[0]) ? refs.slice(1) : refs };
  }

  // Two columns: Sr No. → Ref No. A first line that is not a number is a header.
  const body = isWhole(rows[0][0]) ? rows : rows.slice(1);
  if (!body.length || !body.every(r => isWhole(r[0]))) return { kind: 'invalid' };
  // Serials restart in each section, so a repeated serial means the sheet spans
  // sections and cannot say which row it means. One section at a time.
  if (new Set(body.map(r => Number(r[0]))).size !== body.length) return { kind: 'invalid' };
  return {
    kind: 'keyed',
    pairs: body.filter(r => r[1] !== '').map(r => ({ srNo: Number(r[0]), ref: r[1] })),
  };
}

/** A line of the document read in Bill Check (buildBillItems output fits this shape). */
export interface ReadLine { srNo?: number | string; partNumber?: string; section?: string }
export interface RowUpdate { id: string; updates: Partial<AssessmentRow> }
export interface RefPastePlan {
  apply: RowUpdate[];
  undo: RowUpdate[];      // each touched row's previous refSrNo, refStatus, refMatch
  filled: number;         // written as manual
  flagged: number;        // written as ambiguous
  notOnDocument: number;  // of flagged: a serial not on the stored document
  skipped: number;        // pasted values that found no row
  released: ExtraBillItem[]; // lines the touched rows' old matches held: back to unmatched
}

const SERIALS = /^\d+(\s*,\s*\d+)*$/;

/** Why a pasted ref is doubtful against what Bill Check read, or null when it holds. */
function doubt(row: AssessmentRow, ref: string, lines: ReadLine[] | null): 'missing' | 'part' | null {
  if (!lines || !SERIALS.test(ref)) return null;
  const rp = normPart(row.partNumber);
  for (const s of ref.split(/\s*,\s*/)) {
    // Bills that number each section separately reuse serials: only this row's section counts.
    const found = lines.filter(l => String(l.srNo) === s && (!l.section || l.section === row.section));
    if (!found.length) return 'missing';
    if (rp && found.every(l => normPart(l.partNumber) && normPart(l.partNumber) !== rp)) return 'part';
  }
  return null;
}

export function planRefPaste(
  paste: RefPaste,
  onScreen: AssessmentRow[],
  startRowId: string,
  lines: ReadLine[] | null,
  /** The Sr No. the surveyor sees for a row (the report's serial); defaults to the estimate's. */
  serialOf: (id: string) => number | undefined = () => undefined,
  /** Every Bill Check row, filter or not: a serial must be unique among all of its section. */
  pool: AssessmentRow[] = onScreen,
): RefPastePlan {
  const plan: RefPastePlan = { apply: [], undo: [], filled: 0, flagged: 0, notOnDocument: 0, skipped: 0, released: [] };
  const targets: Array<[AssessmentRow, string]> = [];

  if (paste.kind === 'column') {
    const start = onScreen.findIndex(r => r.id === startRowId);
    if (start < 0) return plan;
    paste.refs.forEach((ref, i) => {
      if (ref === '') return;
      const row = onScreen[start + i];
      if (row) targets.push([row, ref]);
      else plan.skipped += 1;
    });
  } else if (paste.kind === 'keyed') {
    // Serials restart in each section: pairs belong to the section pasted into.
    const section = onScreen.find(r => r.id === startRowId)?.section;
    const shown = new Set(onScreen.map(r => r.id));
    for (const { srNo, ref } of paste.pairs) {
      const hits = pool.filter(r => r.section === section && (serialOf(r.id) ?? r.srNo) === srNo);
      // A row the filter hides already has a ref; the paste does not reach it.
      if (hits.length === 1 && shown.has(hits[0].id)) targets.push([hits[0], ref]);
      else plan.skipped += 1;
    }
  }

  for (const [row, ref] of targets) {
    if (String(row.refSrNo ?? '') === ref) continue;
    const why = doubt(row, ref, lines);
    plan.apply.push({ id: row.id, updates: { refSrNo: ref, refStatus: why ? 'ambiguous' : 'manual', refMatch: undefined } });
    plan.undo.push({ id: row.id, updates: { refSrNo: row.refSrNo, refStatus: row.refStatus, refMatch: row.refMatch } });
    if (why) plan.flagged += 1; else plan.filled += 1;
    if (why === 'missing') plan.notOnDocument += 1;
    if (row.refMatch && !row.refMatch.refOnly) plan.released.push(row.refMatch.bill, ...(row.refMatch.also ?? []));
  }
  return plan;
}
