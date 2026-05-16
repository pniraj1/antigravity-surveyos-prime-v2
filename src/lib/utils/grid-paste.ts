import type { AssessmentRow } from '@/types/assessment';

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
    const n = parseFloat(trimmed);
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
    if (columnKey === 'depOverride' && (!row.allowed || row.section !== 'parts')) continue;

    updates[row.id] = { [columnKey]: parsedValue } as Partial<AssessmentRow>;
  }

  return updates;
}
