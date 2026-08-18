// The one place a grid column is named.
//
// AssessmentSectionTable and BillCheckGrid stayed separate components, so
// their headers drifted: the same field, row.estimated, was "Estimate(taxable
// amount)" in one and "Assessed Tax" in the other — directly beside a real
// Assessed column. Two components may render the columns; only this file
// names them.

export type GridColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'type'
  | 'section'
  | 'quantity'
  | 'unitPrice'
  | 'gst'
  | 'disposal'
  | 'priceWithGst'
  | 'billedTaxable'
  | 'status'
  | 'action'
  | 'remarks';

export interface GridColumnMeta {
  key: GridColumn;
  /** Header text. The single source of truth for what this column is called. */
  label: string;
  /** Shown in the column-picker tooltip. */
  description: string;
  /** CSS grid track width. */
  width: string;
}

export const GRID_COLUMNS: Record<GridColumn, GridColumnMeta> = {
  partNumber:    { key: 'partNumber',    label: 'Part No.',           description: 'OEM part number', width: '110px' },
  hsnSac:        { key: 'hsnSac',        label: 'HSN/SAC',            description: 'Tax classification code', width: '80px' },
  type:          { key: 'type',          label: 'Type',               description: 'Metal / Plastic / Glass / Labour', width: '90px' },
  section:       { key: 'section',       label: 'Section',            description: 'Parts / Labour / Paint', width: '70px' },
  quantity:      { key: 'quantity',      label: 'Qty',                description: 'Quantity', width: '50px' },
  unitPrice:     { key: 'unitPrice',     label: 'Estimate (taxable)', description: 'Taxable amount from the estimate, before GST', width: '110px' },
  gst:           { key: 'gst',           label: 'GST %',              description: 'GST percentage (0 for disposal rows)', width: '60px' },
  disposal:      { key: 'disposal',      label: 'Disposal',           description: 'Used/salvaged part — no GST; surveyor sets % of depreciated value', width: '110px' },
  priceWithGst:  { key: 'priceWithGst',  label: 'Price+GST',          description: 'Net assessed amount inclusive of GST', width: '100px' },
  billedTaxable: { key: 'billedTaxable', label: 'Billed Taxable',     description: 'Billed taxable (net) amount before GST, from the workshop bill', width: '110px' },
  status:        { key: 'status',        label: 'Status',             description: 'In Bill / Not in Bill / Partial', width: '120px' },
  action:        { key: 'action',        label: 'Action',             description: 'Replace / Repair / Disallow', width: '90px' },
  remarks:       { key: 'remarks',       label: 'Remarks',            description: 'Surveyor notes', width: '1fr' },
};

/**
 * Column order for the Assessment grid. Always-on columns (Assessed, Dep%,
 * Net) are rendered by the component between `disposal` and `priceWithGst`
 * and are deliberately absent here — they are not optional.
 */
export const ASSESSMENT_COLUMN_ORDER: GridColumn[] = [
  'partNumber', 'hsnSac', 'type', 'section', 'quantity',
  'unitPrice', 'gst', 'disposal', 'priceWithGst', 'action', 'remarks',
];

/** Bill check is the assessment grid plus the bill columns. */
export const BILL_CHECK_COLUMN_ORDER: GridColumn[] = [
  'partNumber', 'hsnSac', 'type', 'section', 'quantity',
  'unitPrice', 'gst', 'disposal', 'priceWithGst',
  'billedTaxable', 'status', 'action', 'remarks',
];
