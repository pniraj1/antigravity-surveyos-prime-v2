'use client';

import type { DeductionCategory } from '@/lib/constants/deduction-categories';
import type { AssessmentRow } from '@/types';
import { useClaimStore } from '@/stores/claim-store';
import { toast } from 'sonner';

// Shared by AssessmentGrid (the orchestrator) and AssessmentSectionTable (one
// per section). Lives in its own module so the two components do not have to
// import from each other.

export const CATEGORY_TAGS: Array<{ label: string; value: DeductionCategory; color: string }> = [
  { label: 'Safe',           value: 'safe',             color: 'bg-green-100 text-green-800 border-green-300' },
  { label: 'Depreciation',   value: 'depreciation',     color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { label: 'Disposal',       value: 'salvage',          color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { label: 'Consumable',     value: 'consumable',       color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { label: 'Not Covered',    value: 'not-covered',      color: 'bg-red-100 text-red-800 border-red-300' },
  { label: 'Prev. Damage',   value: 'previous-damage',  color: 'bg-red-100 text-red-800 border-red-300' },
  { label: 'Partial Repair', value: 'partial-repair',   color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { label: 'Wear & Tear',    value: 'wear-and-tear',    color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { label: 'Negotiated',     value: 'negotiated',       color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: 'Overpricing',    value: 'overpricing',      color: 'bg-purple-100 text-purple-800 border-purple-300' },
];

// ─── Column Visibility Configuration ─────────────────────────────
// Keys for optional columns that the user can show/hide
export type OptionalColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'type'
  | 'quantity'
  | 'unitPrice'
  | 'gst'
  | 'disposal'
  | 'imt23'
  | 'action'
  | 'remarks'
  | 'priceWithGst';

export interface ColumnMeta {
  key: OptionalColumn;
  label: string;
  description: string;
}

export const OPTIONAL_COLUMNS: ColumnMeta[] = [
  { key: 'partNumber', label: 'Part No.',            description: 'OEM part number' },
  { key: 'hsnSac',     label: 'HSN/SAC',             description: 'Tax classification code' },
  { key: 'type',       label: 'Type',                description: 'Metal / Plastic / Glass / Labour' },
  { key: 'quantity',   label: 'Qty',                 description: 'Quantity from estimate' },
  { key: 'unitPrice',  label: 'Estimate / Billed (taxable)',  description: 'Taxable amount from estimate (net, before GST)' },
  { key: 'gst',        label: 'GST %',               description: 'GST percentage (0 for disposal rows)' },
  { key: 'disposal',   label: 'Disposal',            description: 'Used/salvaged part — no GST; surveyor decides % of depreciated value' },
  { key: 'imt23',      label: 'IMT 23',              description: 'Endorsement IMT-23 part — insurer bears 50% of the assessed loss' },
  { key: 'action',      label: 'Action',              description: 'Replace / Repair / Disallow' },
  { key: 'remarks',    label: 'Remarks',             description: 'Smart contextual remarks with category tagging' },
  { key: 'priceWithGst', label: 'Price+GST',         description: 'Net assessed amount inclusive of GST' },
];

export const DEFAULT_VISIBLE: Record<OptionalColumn, boolean> = {
  partNumber: false,
  hsnSac: false,
  type: true,
  quantity: false,
  unitPrice: true,
  gst: true,
  disposal: true,
  imt23: true,
  action: true,
  remarks: false,
  priceWithGst: true,
};

export const STORAGE_KEY = 'surveyos-assessment-grid-columns';

export function loadVisibility(): Record<OptionalColumn, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_VISIBLE };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_VISIBLE, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VISIBLE };
}

export function saveVisibility(v: Record<OptionalColumn, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

/**
 * The IMT 23 column only earns its space when the policy carries IMT 23. Hidden
 * when the surveyor answered No / N.A., unless a row is already ticked (a tick
 * must never vanish). Unanswered: the column picker decides, as before.
 */
export function imt23ColumnShown(
  pickerOn: boolean,
  policyImt23: 'yes' | 'no' | 'na' | undefined,
  rows: ReadonlyArray<{ imt23?: boolean }>,
): boolean {
  if (rows.some(r => r.imt23)) return true;
  if (policyImt23 === 'no' || policyImt23 === 'na') return false;
  return pickerOn;
}

/** New array with `item` at `index` (clamped). Used to undo a row delete. */
export function insertRowAt<T>(list: readonly T[], item: T, index: number): T[] {
  const i = Math.min(Math.max(index, 0), list.length);
  return [...list.slice(0, i), item, ...list.slice(i)];
}

/** Particulars as compared for duplicates: case and spacing ignored. */
export const normParticulars = (p?: string): string => p?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';

/** Particulars that appear on more than one row (normalised). */
export function duplicateParticularsOf(rows: readonly AssessmentRow[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const r of rows) {
    const n = normParticulars(r.particulars);
    if (!n) continue;
    if (seen.has(n)) dupes.add(n); else seen.add(n);
  }
  return dupes;
}

/** Row background, the same in the Assessment and Bill Check grids. */
export function rowTintClass(row: AssessmentRow, isDuplicate: boolean, isTicked: boolean): string {
  return [
    'hover:bg-accent/30 transition-colors',
    isTicked && 'bg-slate-500/5',
    !row.allowed && !row.keptOpen && 'bg-muted/40 text-muted-foreground',
    row.keptOpen && 'bg-amber-500/10',
    isDuplicate && 'bg-orange-500/10',
    row.isDisposal && row.allowed && 'bg-amber-500/5',
    row.imt23 && row.allowed && 'bg-primary/5',
  ].filter(Boolean).join(' ');
}

/** Deletes a row at once and offers Undo, which puts it back at its old place. */
export function deleteRowWithUndo(id: string): void {
  const { currentClaim, deleteAssessmentRow, updateClaim } = useClaimStore.getState();
  const before = currentClaim?.assessmentRows ?? [];
  const index = before.findIndex(r => r.id === id);
  if (index < 0) return;
  const removed = before[index];
  deleteAssessmentRow(id);
  toast(`Deleted "${removed.particulars || 'row'}"`, {
    duration: 6000,
    action: {
      label: 'Undo',
      onClick: () => {
        const now = useClaimStore.getState().currentClaim?.assessmentRows ?? [];
        if (!now.some(r => r.id === id)) updateClaim({ assessmentRows: insertRowAt(now, removed, index) });
      },
    },
  });
}
