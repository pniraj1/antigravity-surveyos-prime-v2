/**
 * Bill Check grid: where a Shift+arrow moves, and what a pasted column writes.
 * Pure; the grid applies the result through updateAssessmentRow.
 */

import type { AssessmentRow } from '@/types/assessment';
import { parseClipboardValue } from '@/lib/utils/grid-paste';
import type { RowUpdate } from './ref-paste';

export type FillColumn = 'gst' | 'disposalPercent' | 'billAllowed' | 'depOverride' | 'billedTaxable' | 'billRemarks';
export interface CellRef { row: string; col: string }
export type MoveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/** Index in `cells` (editable cells in screen order) to move to, or null to stay. */
export function moveTarget(cells: CellRef[], current: CellRef, key: MoveKey): number | null {
  const i = cells.findIndex(c => c.row === current.row && c.col === current.col);
  if (i < 0) return null;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const j = i + (key === 'ArrowRight' ? 1 : -1);
    return cells[j]?.row === current.row ? j : null;
  }
  const step = key === 'ArrowDown' ? 1 : -1;
  for (let j = i + step; j >= 0 && j < cells.length; j += step) {
    if (cells[j].col === current.col && cells[j].row !== current.row) return j;
  }
  return null;
}

/** One value per line; null when the text has no line break (paste natively). */
export function columnValues(text: string): string[] | null {
  if (!/\n/.test(text)) return null;
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.map(l => l.trim());
}

export interface FillPlan { apply: RowUpdate[]; undo: RowUpdate[]; filled: number; skipped: number }
interface FillCtx { fromBill: boolean; autoDepRate: (row: AssessmentRow) => number }

const clamp = (n: number, lo: number, hi = Infinity): number => Math.min(hi, Math.max(lo, n));
const withTax = (taxable: number, gst: number): number => Math.round(taxable * (1 + gst / 100));

/** What this value writes to this row, or null when the box is locked or the value unreadable. */
function updatesFor(
  col: FillColumn, v: string, row: AssessmentRow, ctx: FillCtx,
): Partial<AssessmentRow> | null {
  if (col === 'billRemarks') return { billRemarks: v };
  const n = parseClipboardValue(v, 'billedTaxable');
  if (typeof n !== 'number') return null;
  switch (col) {
    case 'gst': {
      if (row.isDisposal) return null;
      const gst = Math.round(clamp(n, 0));
      return row.billedTaxable != null ? { gst, billedAmount: withTax(row.billedTaxable, gst) } : { gst };
    }
    case 'disposalPercent':
      return row.isDisposal ? { disposalPercent: clamp(n, 0, 100) } : null;
    case 'billAllowed':
      return row.allowed === false ? null : { billAllowed: clamp(n, 0) };
    case 'depOverride': {
      const dep = clamp(n, 0, 100);
      return { depOverride: dep === ctx.autoDepRate(row) ? undefined : dep };
    }
    case 'billedTaxable': {
      if (ctx.fromBill || row.allowed === false || row.billStatus === 'not-in-bill') return null;
      const billedTaxable = clamp(n, 0);
      return { billedTaxable, billedAmount: withTax(billedTaxable, row.gst ?? 18) };
    }
  }
}

export function planColumnFill(
  col: FillColumn, values: string[], onScreen: AssessmentRow[], startRowId: string, ctx: FillCtx,
): FillPlan {
  const plan: FillPlan = { apply: [], undo: [], filled: 0, skipped: 0 };
  const start = onScreen.findIndex(r => r.id === startRowId);
  if (start < 0) return plan;
  values.forEach((v, i) => {
    if (v === '') return;
    const row = onScreen[start + i];
    const updates = row ? updatesFor(col, v, row, ctx) : null;
    if (!row || !updates) { plan.skipped += 1; return; }
    const prev = Object.fromEntries(Object.keys(updates).map(k => [k, row[k as keyof AssessmentRow]]));
    plan.apply.push({ id: row.id, updates });
    plan.undo.push({ id: row.id, updates: prev as Partial<AssessmentRow> });
    plan.filled += 1;
  });
  return plan;
}
