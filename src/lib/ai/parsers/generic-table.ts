// src/lib/ai/parsers/generic-table.ts
import type { ParserResult, EstimateLineItem, ExtractedEstimate } from './types';

const LABOUR_KEYWORDS   = /\b(r\s*&\s*r|remove|replace|fitment|diagnosis|welding|cutting|gas charges|align|balance)\b/i;
const PAINTING_KEYWORDS = /\b(paint\w*|solid colo?ur|metallic|touch.?up|buffing)\b/i;

type ItemCategory = 'spare_parts' | 'labour_items' | 'painting_items';

function classifyDescription(desc: string): ItemCategory {
  if (PAINTING_KEYWORDS.test(desc)) return 'painting_items';
  if (LABOUR_KEYWORDS.test(desc))   return 'labour_items';
  return 'spare_parts';
}

function toNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

// Data row: starts with a number, has multiple numeric columns at the end (up to 6 numeric cols)
const DATA_ROW = /^\s*(\d+)\s+(.+?)\s{2,}([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)(?:\s+([\d,]+\.?\d*))?(?:\s+([\d,]+\.?\d*))?(?:\s+([\d,]+\.?\d*))?/;

const GRAND_TOTAL_PAT  = /grand\s*total|net\s*payable|total\s*amount/i;
const CGST_TOTAL_PAT   = /total\s*cgst/i;
const SGST_TOTAL_PAT   = /total\s*sgst/i;
const PARTS_SUB_PAT    = /sub.?total\s*parts|parts\s*sub.?total/i;
const LABOUR_SUB_PAT   = /sub.?total\s*labour/i;
const PAINTING_SUB_PAT = /sub.?total\s*paint/i;

const VEHICLE_PAT  = /(?:vehicle|veh\.?\s*no\.?|reg\.?\s*no\.?)\s*:?\s*([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4})/i;
const DATE_PAT     = /(?:date|dt\.?)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i;
const WORKSHOP_PAT = /^([A-Z][A-Z\s&.'-]{4,60})$/;

export function parseGenericTable(textLayers: string[]): ParserResult {
  const spare_parts:    EstimateLineItem[]                    = [];
  const labour_items:   Omit<EstimateLineItem, 'category'>[] = [];
  const painting_items: Omit<EstimateLineItem, 'category'>[] = [];
  const unparsableSections: string[]                         = [];

  let workshop_name  = '';
  let vehicle_number = '';
  let estimate_date  = '';
  let gross_amount     = 0;
  let total_cgst       = 0;
  let total_sgst       = 0;
  let subtotal_parts   = 0;
  let subtotal_labour  = 0;
  let subtotal_painting = 0;
  let rowsParsed       = 0;

  for (const page of textLayers) {
    const lines = page.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Header fields
      const vm = trimmed.match(VEHICLE_PAT);
      if (vm) vehicle_number = vm[1].toUpperCase();

      const dm = trimmed.match(DATE_PAT);
      if (dm && !estimate_date) estimate_date = dm[1];

      if (!workshop_name && WORKSHOP_PAT.test(trimmed) && trimmed.length > 5) {
        workshop_name = trimmed;
      }

      // Summary lines
      if (GRAND_TOTAL_PAT.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)$/);
        if (n) gross_amount = Math.max(gross_amount, toNum(n[1]));
        continue;
      }
      if (CGST_TOTAL_PAT.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)$/);
        if (n) total_cgst = Math.max(total_cgst, toNum(n[1]));
        continue;
      }
      if (SGST_TOTAL_PAT.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)$/);
        if (n) total_sgst = Math.max(total_sgst, toNum(n[1]));
        continue;
      }
      if (PARTS_SUB_PAT.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)$/);
        if (n) subtotal_parts = Math.max(subtotal_parts, toNum(n[1]));
        continue;
      }
      if (LABOUR_SUB_PAT.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)$/);
        if (n) subtotal_labour = Math.max(subtotal_labour, toNum(n[1]));
        continue;
      }
      if (PAINTING_SUB_PAT.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)$/);
        if (n) subtotal_painting = Math.max(subtotal_painting, toNum(n[1]));
        continue;
      }

      // Data rows
      const match = trimmed.match(DATA_ROW);
      if (!match) continue;

      const [, sr, desc, col3, col4, col5, col6, col7, col8] = match;
      const nums = [col3, col4, col5, col6, col7, col8]
        .filter(Boolean)
        .map(toNum)
        .filter(n => n > 0);

      const total_amount   = nums[nums.length - 1] ?? 0;
      const taxable_amount = nums[0] ?? total_amount;
      const cgst_amount    = nums.length >= 3 ? nums[nums.length - 3] : 0;
      const sgst_amount    = nums.length >= 2 ? nums[nums.length - 2] : 0;

      const base: Omit<EstimateLineItem, 'category'> = {
        sr_no:          parseInt(sr, 10),
        description:    desc.trim().toUpperCase(),
        part_number:    '',
        hsn_sac:        '',
        quantity:       1,
        unit_price:     taxable_amount,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        total_amount,
        gst_percent:    taxable_amount > 0
          ? Math.round((cgst_amount + sgst_amount) / taxable_amount * 100)
          : 18,
      };

      const cat = classifyDescription(base.description);
      rowsParsed++;

      if (cat === 'spare_parts') {
        spare_parts.push({ ...base, category: '' });
      } else if (cat === 'painting_items') {
        painting_items.push(base);
      } else {
        labour_items.push(base);
      }
    }
  }

  const data: ExtractedEstimate = {
    workshop_name,
    workshop_address: '',
    vehicle_number,
    chassis_number:   '',
    engine_number:    '',
    estimate_date,
    bill_number:      '',
    spare_parts,
    labour_items:     labour_items as EstimateLineItem[],
    painting_items:   painting_items as EstimateLineItem[],
    subtotal_parts_taxable:    subtotal_parts,
    subtotal_labour_taxable:   subtotal_labour,
    subtotal_painting_taxable: subtotal_painting,
    total_cgst,
    total_sgst,
    total_tax:   total_cgst + total_sgst,
    gross_amount,
  };

  const itemConf   = rowsParsed > 0 ? Math.min(1, rowsParsed / 4) : 0;
  const totalConf  = gross_amount > 0 ? 0.9 : 0;
  const headerConf = vehicle_number ? 0.8 : 0.3;

  return {
    data,
    confidence:        { header: headerConf, items: itemConf, totals: totalConf },
    unparsableSections,
    parserName:        'generic-table',
  };
}
