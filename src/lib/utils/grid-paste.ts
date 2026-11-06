import type { AssessmentRow } from '@/types/assessment';
import { evaluateFormula } from './formula-eval';

const NUMBER_COLUMNS = new Set<keyof AssessmentRow>([
  'gst', 'assessed', 'estimated', 'quantity', 'unitPrice',
  'depOverride', 'disposalPercent', 'billedTaxable', 'billedAmount',
]);

const VALID_ACTION_VALUES = new Set(['replace', 'repair', 'disallow', '']);
const VALID_PART_TYPE_VALUES = new Set(['metal', 'plastic', 'fiberglass', 'glass', 'paint', 'labour']);

export function parseClipboardValue(
  text: string,
  columnKey: keyof AssessmentRow,
): unknown {
  const trimmed = text.trim();

  if (NUMBER_COLUMNS.has(columnKey)) {
    // Check for inline math/formula e.g. =150+200 or 150+200
    const formulaVal = evaluateFormula(trimmed);
    if (formulaVal !== null) return formulaVal;

    // Handle percentage strings like "18%"
    const cleanNum = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
    const n = parseFloat(cleanNum);
    return isNaN(n) ? null : n;
  }

  if (columnKey === 'isDisposal') {
    const lower = trimmed.toLowerCase();
    if (['true', '1', 'yes'].includes(lower)) return true;
    if (['false', '0', 'no'].includes(lower)) return false;
    return null;
  }

  if (columnKey === 'action') {
    return VALID_ACTION_VALUES.has(trimmed) ? trimmed : null;
  }

  if (columnKey === 'partType') {
    return VALID_PART_TYPE_VALUES.has(trimmed) ? trimmed : null;
  }

  // String columns: particulars, partNumber, hsnSac
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Standard single-value range paste. Applies parsedValue to all rows between
 * anchorRowId and focusRowId in the provided rows array.
 */
export function buildPasteUpdates(
  rows: AssessmentRow[],
  anchorRowId: string,
  focusRowId: string,
  columnKey: keyof AssessmentRow,
  parsedValue: unknown,
): Record<string, Partial<AssessmentRow>> {
  if (parsedValue === null || parsedValue === undefined) return {};

  const anchorIdx = rows.findIndex(r => r.id === anchorRowId);
  const focusIdx = rows.findIndex(r => r.id === focusRowId);
  if (anchorIdx === -1 || focusIdx === -1) return {};

  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);

  const updates: Record<string, Partial<AssessmentRow>> = {};

  for (let i = start; i <= end; i++) {
    const row = rows[i];

    // Skip rules
    if (columnKey === 'gst' && row.isDisposal) continue;
    // Labour and paint have no automatic depreciation, but the surveyor may
    // set one. Only the allowed-row guard remains.
    if (columnKey === 'depOverride' && !row.allowed) continue;

    updates[row.id] = { [columnKey]: parsedValue } as Partial<AssessmentRow>;
  }

  return updates;
}

/**
 * Multi-line or single-value clipboard paste across selected cells in a section.
 * - If lines.length === 1: fills ALL targetRowIds with that single value.
 * - If lines.length > 1 and targetRowIds.length === 1: fills lines downwards starting from that row.
 * - If lines.length > 1 and targetRowIds.length > 1: fills targetRowIds line-by-line (repeating if needed).
 */
export function buildMultiLinePasteUpdates(
  sectionRows: AssessmentRow[],
  targetRowIds: string[],
  columnKey: keyof AssessmentRow,
  lines: string[],
): Record<string, Partial<AssessmentRow>> {
  if (lines.length === 0 || targetRowIds.length === 0) return {};

  const updates: Record<string, Partial<AssessmentRow>> = {};

  // Case 1: single line copied -> apply parsed value to all target rows
  if (lines.length === 1) {
    const parsed = parseClipboardValue(lines[0], columnKey);
    if (parsed === null || parsed === undefined) return {};
    for (const rowId of targetRowIds) {
      const row = sectionRows.find(r => r.id === rowId);
      if (!row) continue;
      if (columnKey === 'gst' && row.isDisposal) continue;
      if (columnKey === 'depOverride' && !row.allowed) continue;
      updates[row.id] = { [columnKey]: parsed } as Partial<AssessmentRow>;
    }
    return updates;
  }

  // Case 2: multiple lines copied
  // If only 1 cell was selected, paste downwards from that cell in sectionRows
  let rowsToFill: AssessmentRow[] = [];
  if (targetRowIds.length === 1) {
    const startIdx = sectionRows.findIndex(r => r.id === targetRowIds[0]);
    if (startIdx === -1) return {};
    rowsToFill = sectionRows.slice(startIdx, startIdx + lines.length);
  } else {
    // A range of cells was selected -> fill matching rows in sectionRows
    rowsToFill = sectionRows.filter(r => targetRowIds.includes(r.id));
  }

  for (let i = 0; i < rowsToFill.length; i++) {
    const row = rowsToFill[i];
    const lineVal = lines[i % lines.length];
    const parsed = parseClipboardValue(lineVal, columnKey);
    if (parsed === null || parsed === undefined) continue;

    if (columnKey === 'gst' && row.isDisposal) continue;
    if (columnKey === 'depOverride' && !row.allowed) continue;

    updates[row.id] = { [columnKey]: parsed } as Partial<AssessmentRow>;
  }

  return updates;
}

/**
 * Returns newline-separated text representation of the selected cells in section order.
 */
export function getSelectionClipboardText(
  sectionRows: AssessmentRow[],
  targetRowIds: string[],
  columnKey: keyof AssessmentRow,
): string {
  if (targetRowIds.length === 0) return '';
  const selectedRows = sectionRows.filter(r => targetRowIds.includes(r.id));

  const values: string[] = [];
  for (const row of selectedRows) {
    const raw = row[columnKey];
    if (raw === undefined || raw === null) {
      values.push('');
    } else {
      values.push(String(raw));
    }
  }

  return values.join('\n');
}
