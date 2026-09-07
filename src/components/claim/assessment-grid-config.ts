'use client';

import type { DeductionCategory } from '@/lib/constants/deduction-categories';

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
  { key: 'unitPrice',  label: 'Estimate (taxable)',  description: 'Taxable amount from estimate (net, before GST)' },
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
