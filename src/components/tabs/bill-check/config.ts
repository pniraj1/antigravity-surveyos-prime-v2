import { GRID_COLUMNS } from '@/components/claim/grid-columns';

// Labels and widths are sourced from the shared grid-columns module, so this
// grid cannot re-name a column the Assessment grid already named differently.
// The set of columns that are actually optional here — and their order in the
// column-visibility picker — stays local, since not every shared column has a
// renderer in this grid yet.

export type OptionalColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'section'
  | 'quantity'
  | 'unitPrice'
  | 'gst'
  | 'billedTaxable'
  | 'remarks';

const OPTIONAL_COLUMN_ORDER: OptionalColumn[] = [
  'partNumber', 'hsnSac', 'section', 'quantity', 'unitPrice', 'gst', 'billedTaxable', 'remarks',
];

export interface ColumnMeta {
  key: OptionalColumn;
  label: string;
  description: string;
}

export const OPTIONAL_COLUMNS: ColumnMeta[] = OPTIONAL_COLUMN_ORDER.map(key => ({
  key,
  label: GRID_COLUMNS[key].label,
  description: GRID_COLUMNS[key].description,
}));

export const DEFAULT_VISIBLE: Record<OptionalColumn, boolean> = {
  partNumber: false,
  hsnSac: false,
  section: false, // both grids already group by section — the column repeats its own heading
  quantity: false,
  unitPrice: true,
  gst: true,
  billedTaxable: true,
  remarks: true,
};

export const COL_WIDTHS: Record<OptionalColumn, string> = Object.fromEntries(
  OPTIONAL_COLUMN_ORDER.map(key => [key, GRID_COLUMNS[key].width]),
) as Record<OptionalColumn, string>;

export const STORAGE_KEY = 'surveyos-billcheck-grid-columns';

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

export type BillStatus = 'in-bill' | 'not-in-bill' | 'partial' | 'pending' | 'not-allowed';

export function statusLabel(s: BillStatus) {
  switch (s) {
    case 'in-bill':     return { label: 'In Bill',        color: '#059669', bg: 'rgba(5,150,105,0.1)' };
    case 'not-in-bill': return { label: 'Not in Bill',    color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
    case 'partial':     return { label: 'Partial',        color: '#d97706', bg: 'rgba(217,119,6,0.1)' };
    case 'not-allowed': return { label: 'Not Allowed',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
    default:            return { label: 'Pending Review', color: '#8D99AE', bg: 'rgba(141,153,174,0.1)' };
  }
}

export const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
