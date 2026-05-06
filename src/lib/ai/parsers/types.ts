// src/lib/ai/parsers/types.ts

export type DetectedFormat =
  | 'tata-dtc'
  | 'maruti-mga'
  | 'hyundai-dms'
  | 'mahindra-mds'
  | 'generic-table'
  | 'unknown';

export type TextLayerQuality = 'rich' | 'sparse' | 'garbled' | 'none';

export interface DocumentProfile {
  fileHash: string;
  pageCount: number;
  hasTextLayer: boolean;
  textLayerQuality: TextLayerQuality;
  detectedFormat: DetectedFormat;
  formatConfidence: number; // 0–1
  textLayers: string[];     // raw per-page text (passed in from processor)
}

export interface ParserConfidence {
  header: number;   // 0–1
  items: number;    // 0–1
  totals: number;   // 0–1
}

export interface EstimateLineItem {
  sr_no: number;
  description: string;
  part_number: string;
  hsn_sac: string;
  quantity: number;
  unit_price: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_amount: number;
  gst_percent: number;
  category: 'metal' | 'plastic' | 'glass' | '';
}

export interface EstimateHeader {
  workshop_name: string;
  workshop_address: string;
  vehicle_number: string;
  chassis_number: string;
  engine_number: string;
  estimate_date: string;
  bill_number: string;
}

export interface EstimateTotals {
  subtotal_parts_taxable: number;
  subtotal_labour_taxable: number;
  subtotal_painting_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_tax: number;
  gross_amount: number;
}

export interface ExtractedEstimate extends EstimateHeader, EstimateTotals {
  spare_parts: EstimateLineItem[];
  labour_items: Omit<EstimateLineItem, 'category'>[];
  painting_items: Omit<EstimateLineItem, 'category'>[];
}

export interface ParserResult {
  data: ExtractedEstimate;
  confidence: ParserConfidence;
  unparsableSections: string[];
  parserName: string;
}
