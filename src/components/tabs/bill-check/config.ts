export type OptionalColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'section'
  | 'quantity'
  | 'taxable'
  | 'gst'
  | 'billedTaxable'
  | 'remarks';

export interface ColumnMeta {
  key: OptionalColumn;
  label: string;
  description: string;
}

export const OPTIONAL_COLUMNS: ColumnMeta[] = [
  { key: 'partNumber',    label: 'Part No.',         description: 'OEM part number' },
  { key: 'hsnSac',        label: 'HSN/SAC',          description: 'Tax classification code' },
  { key: 'section',       label: 'Section',          description: 'Parts / Labour / Paint' },
  { key: 'quantity',      label: 'Qty',              description: 'Quantity' },
  { key: 'taxable',       label: 'Assessed Taxable', description: 'Assessed taxable (net) amount before GST' },
  { key: 'gst',           label: 'GST %',            description: 'GST percentage' },
  { key: 'billedTaxable', label: 'Billed Taxable',   description: 'Billed taxable (net) amount before GST' },
  { key: 'remarks',       label: 'Remarks',          description: 'Surveyor notes' },
];

export const DEFAULT_VISIBLE: Record<OptionalColumn, boolean> = {
  partNumber: false,
  hsnSac: false,
  section: true,
  quantity: false,
  taxable: true,
  gst: true,
  billedTaxable: true,
  remarks: true,
};

export const COL_WIDTHS: Record<OptionalColumn, string> = {
  partNumber: '110px',
  hsnSac: '80px',
  section: '70px',
  quantity: '50px',
  taxable: '100px',
  gst: '60px',
  billedTaxable: '110px',
  remarks: '1fr',
};

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
